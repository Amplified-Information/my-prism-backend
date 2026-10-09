/**
 * Serialize wallet-bound signing requests.
 *
 * HashPack (via WalletConnect / hedera-extension) queues one signing prompt at a
 * time. If the app fires a second request while a first is in-flight, the
 * second sits in the wallet's queue and often times out silently on our side.
 *
 * `withWalletLock(label, fn)` runs `fn` exclusively — no other wallet call in
 * this tab, or in any other tab of the same origin, runs at the same time.
 * Serialization is provided by the Web Locks API (`navigator.locks.request`):
 * one named lock, requested exclusively, queues every caller (same tab or a
 * different one) in a single browser-managed FIFO. Environments without Web
 * Locks (older browsers, and the jsdom test environment) fall back to a plain
 * in-tab FIFO chain.
 *
 * ## The lock can never be held forever
 *
 * The wallet promise returned by WalletConnect is not guaranteed to settle:
 * a relay drop, a request expiry, or a popup dismissed without a response can
 * leave it pending indefinitely. Because both timeout paths
 * (`signWithWallet.withHardTimeout`, `hedera.withTimeout`) deliberately do NOT
 * force-abort the wallet call, an un-settling promise used to wedge this lock
 * permanently — every later wallet action then queued inside
 * `navigator.locks.request` with no prompt and no error, which is exactly the
 * "HashPack only responds to the first signature" symptom.
 *
 * The hold is therefore bounded:
 *   - a hard ceiling (`HOLD_CEILING_MS`, slightly above the callers' own
 *     5-minute timeouts) always releases the lock;
 *   - `abortActiveWalletCall(reason, { releaseLock: false })` still keeps the
 *     lock while the first prompt may be live in the wallet, but only for
 *     `CANCEL_GRACE_MS`, not forever;
 *   - `forceResetWalletLock()` releases it immediately (disconnect, debug
 *     panel, and the "queued" toast action).
 *
 * When the lock is released ahead of the wallet promise, the orphaned promise
 * is left to settle on its own; its result is discarded.
 */
import { SessionNotFoundError } from '@hashgraph/hedera-wallet-connect'
import toast from 'react-hot-toast'

const LOCK_NAME = 'prism:wallet-call'

/** Ceiling on how long one wallet call may hold the lock (callers time out at 300s). */
const HOLD_CEILING_MS = 310_000
/** After a UI cancel that keeps the lock, release anyway once this elapses. */
const CANCEL_GRACE_MS = 10_000
/** Warn the user when a call has been queued behind another one this long. */
const QUEUE_TOAST_MS = 2_000
/** Record a diagnostic when a call waited at least this long for the lock. */
const QUEUE_NOTE_MS = 1_500

let currentAbort: ((reason: string, options?: { releaseLock?: boolean }) => void) | null = null
let currentLabel: string | null = null
let currentRelease: (() => void) | null = null
let lockHeldSince: number | null = null

// Fallback in-tab FIFO for environments without the Web Locks API.
let fallbackChain: Promise<unknown> = Promise.resolve()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const locksApi = (): any =>
  typeof navigator !== 'undefined' ? (navigator as any).locks : undefined

/** Diagnostics are recorded lazily — walletDiagnostics imports this module. */
const note = (label: string, meta: Record<string, unknown>) => {
  void import('./walletDiagnostics')
    .then(({ recordSignEvent }) => recordSignEvent(label, 'note', { meta }))
    .catch(() => { /* ignore */ })
}

export interface WalletLockOptions {
  /** Override the maximum time this call may hold the lock. */
  holdCeilingMs?: number
}

/**
 * Run `fn` exclusively — no other wallet-facing call in this tab (or in any
 * other tab of the same app) runs at the same time.
 */
export const withWalletLock = async <T>(
  label: string,
  fn: () => Promise<T>,
  options: WalletLockOptions = {},
): Promise<T> => {
  const ceilingMs = options.holdCeilingMs ?? HOLD_CEILING_MS
  const requestedAt = Date.now()
  const holderAtRequest = currentLabel
  let acquired = false

  // Surface the invisible case: this call is stuck behind another wallet
  // request. Without this the user just sees "nothing happened".
  let queueToastId: string | undefined
  const queueToastTimer = setTimeout(() => {
    if (acquired) return
    queueToastId = toast(
      `Waiting for the previous wallet request (${currentLabel ?? holderAtRequest ?? 'unknown'}) to finish…`,
      { duration: 8000, id: 'wallet-queue' },
    )
  }, QUEUE_TOAST_MS)

  let callerSettled = false
  let resolveCaller: (value: T) => void = () => { /* assigned below */ }
  let rejectCaller: (reason?: unknown) => void = () => { /* assigned below */ }
  const callerPromise = new Promise<T>((resolve, reject) => {
    resolveCaller = resolve
    rejectCaller = reject
  })

  const settleResolve = (value: T) => {
    if (callerSettled) return
    callerSettled = true
    resolveCaller(value)
  }
  const settleReject = (reason?: unknown) => {
    if (callerSettled) return
    callerSettled = true
    rejectCaller(reason)
  }

  const run = async (): Promise<void> => {
    acquired = true
    clearTimeout(queueToastTimer)
    if (queueToastId) toast.dismiss(queueToastId)

    const waitedMs = Date.now() - requestedAt
    if (waitedMs >= QUEUE_NOTE_MS) {
      note(label, { queuedMs: waitedMs, heldBy: holderAtRequest })
      console.warn('[walletMutex] queued', label, `${waitedMs}ms behind`, holderAtRequest)
    }

    currentLabel = label
    lockHeldSince = Date.now()

    // `released` resolves when the lock may be handed to the next caller —
    // either because the wallet promise settled, or because a ceiling /
    // cancel / force-reset fired first.
    let markReleased: () => void = () => { /* assigned below */ }
    const released = new Promise<void>((resolve) => { markReleased = resolve })

    let graceTimer: ReturnType<typeof setTimeout> | undefined
    const ceilingTimer = setTimeout(() => {
      console.warn('[walletMutex] hold ceiling reached — releasing lock', label)
      note(label, { lockReleased: 'ceiling', afterMs: ceilingMs })
      settleReject(new Error('Wallet did not respond in time. Please open your wallet and retry.'))
      markReleased()
    }, ceilingMs)

    currentRelease = () => {
      note(label, { lockReleased: 'forced' })
      markReleased()
    }

    currentAbort = (reason, opts = {}) => {
      const err = new Error(`Wallet call aborted: ${reason}`)
      settleReject(err)
      if (opts.releaseLock !== false) {
        markReleased()
      } else if (!graceTimer) {
        // The wallet-side prompt may still be live: hold the lock briefly so
        // we don't stack a competing prompt, then release regardless.
        graceTimer = setTimeout(() => {
          note(label, { lockReleased: 'cancel-grace', afterMs: CANCEL_GRACE_MS })
          markReleased()
        }, CANCEL_GRACE_MS)
      }
    }

    const fnPromise = Promise.resolve().then(fn)
    fnPromise.then(
      (result) => {
        settleResolve(result as T)
        markReleased()
      },
      (err) => {
        // DAppSigner.request() checks its own local session store before ever
        // touching the relay; if the SDK has already purged the session, this
        // throws without any relay round-trip, and keeps throwing until the
        // user reconnects. Surface it unmistakably.
        if (err instanceof SessionNotFoundError) {
          console.error('[walletMutex] WalletConnect session store lost (SessionNotFoundError) — reconnect required', {
            label,
            message: err.message,
          })
          settleReject(new Error('Wallet session was lost. Please reconnect your wallet and try again.'))
        } else {
          settleReject(err)
        }
        markReleased()
      },
    )

    try {
      await released
    } finally {
      clearTimeout(ceilingTimer)
      if (graceTimer) clearTimeout(graceTimer)
      currentAbort = null
      currentRelease = null
      currentLabel = null
      lockHeldSince = null
    }
  }

  const locks = locksApi()
  if (locks?.request) {
    void locks.request(LOCK_NAME, run).catch(() => { /* run() never rejects itself */ })
  } else {
    const prev = fallbackChain
    const next = prev.then(run, run)
    fallbackChain = next.catch(() => { /* keep chain alive */ })
  }

  return callerPromise.finally(() => {
    clearTimeout(queueToastTimer)
    if (queueToastId) toast.dismiss(queueToastId)
  })
}

/**
 * Force-release the currently-running wallet call in this tab. Used by the
 * timeout path in `hedera.ts` so a stuck WalletConnect request does not block
 * every subsequent signing prompt.
 */
export const abortActiveWalletCall = (reason: string, options?: { releaseLock?: boolean }): boolean => {
  if (!currentAbort) return false
  console.warn('[walletMutex] aborting active call', currentLabel, 'reason=', reason)
  currentAbort(reason, options)
  return true
}

/**
 * Release the wallet lock immediately, whatever is holding it. The orphaned
 * wallet promise (if any) is left to settle on its own and its result is
 * discarded. Used on disconnect, from the debug panel, and from the
 * "still waiting" toast.
 */
export const forceResetWalletLock = (): boolean => {
  if (!currentRelease) return false
  console.warn('[walletMutex] force reset while holding', currentLabel)
  currentAbort?.('wallet queue reset', { releaseLock: true })
  currentRelease?.()
  return true
}

/** Diagnostics: is a wallet call currently in-flight in this tab? */
export const activeWalletLabel = (): string | null => currentLabel

/** Diagnostics: how long (ms) the current call has held the lock, if any. */
export const walletLockHeldMs = (): number | null =>
  lockHeldSince === null ? null : Date.now() - lockHeldSince
