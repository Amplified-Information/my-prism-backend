/**
 * Shared wrapper for a wallet-facing signing call (`DAppSigner.sign(...)`).
 *
 * Consolidates what used to be four near-identical per-flow implementations
 * (order sign, cancel sign, login sign, comment sign) of the same pattern:
 * serialize behind the wallet mutex, enforce a hard timeout, fire an
 * advisory (non-blocking) relay ping, and log start/ack/error lifecycle
 * events. Before this consolidation, a hardening fix applied to one flow
 * routinely failed to reach the others — cancel signing, for instance, had
 * no timeout at all while the rest had a 5-minute one.
 *
 * Not used by the allowance/redeem flows in `lib/hedera.ts`: those wrap a
 * Hedera `Transaction.executeWithSigner(...)` rather than a raw message
 * sign, and race the wallet ack against mirror-node confirmation, which
 * doesn't fit this "run fn, return the signature" shape. They call
 * `withWalletLock` directly instead.
 */
import { withWalletLock } from './walletMutex'
import { recordSignEvent } from './walletDiagnostics'
import { instrumentWcCall } from './wcInstrument'

// HashPack reviews can legitimately take minutes; anything shorter routinely
// trips on careful users.
const DEFAULT_TIMEOUT_MS = 300_000

const withHardTimeout = <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      // We do NOT force-abort the underlying wallet call here — that races
      // the wallet's response and corrupts session state when the ack was
      // about to arrive. Just reject the awaiter; the mutex releases when
      // the underlying wallet promise actually settles.
      void label
      reject(new Error('Wallet did not respond in time. Please open your wallet and retry.'))
    }, timeoutMs)
    promise
      .then((v) => { window.clearTimeout(timer); resolve(v) })
      .catch((e) => { window.clearTimeout(timer); reject(e) })
  })

export interface SignWithWalletOptions {
  timeoutMs?: number
  pingTimeoutMs?: number
  meta?: Record<string, unknown>
  /** Emit a 'heartbeat' diagnostic event on this interval while waiting. */
  heartbeatMs?: number
  /**
   * Stop the heartbeat early without affecting the underlying wallet call
   * (e.g. a UI cancel that rejects the visible awaiter via
   * `abortActiveWalletCall(reason, { releaseLock: false })` but must keep
   * the mutex held until the real wallet promise settles).
   */
  cancelSignal?: AbortSignal
}

/**
 * Run `fn` — a single wallet-facing signing request — serialized behind the
 * shared wallet mutex, with a hard timeout and start/heartbeat/ack/error
 * diagnostics recorded to the same ring buffer the WalletSignDebugPanel
 * reads from.
 */
export const signWithWallet = async <T>(
  label: string,
  fn: () => Promise<T>,
  opts: SignWithWalletOptions = {},
): Promise<T> => {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const startedAt = Date.now()
  recordSignEvent(label, 'start', { meta: opts.meta })

  let heartbeat: ReturnType<typeof setInterval> | undefined
  if (opts.heartbeatMs) {
    heartbeat = setInterval(() => {
      recordSignEvent(label, 'heartbeat', { durMs: Date.now() - startedAt, meta: opts.meta })
    }, opts.heartbeatMs)
  }
  const onCancel = () => {
    if (heartbeat) clearInterval(heartbeat)
    recordSignEvent(label, 'note', {
      durMs: Date.now() - startedAt,
      meta: { ...opts.meta, cancelled: true, reason: opts.cancelSignal?.reason ?? 'cancelled' },
    })
  }
  if (opts.cancelSignal) {
    if (opts.cancelSignal.aborted) onCancel()
    else opts.cancelSignal.addEventListener('abort', onCancel, { once: true })
  }

  try {
    const result = await withWalletLock(label, () => {
      // Deep instrumentation: relayer connect/disconnect, JSON-RPC send/ack,
      // and — critically — a popup heuristic (tab blur within ~3s of send
      // means HashPack's popup almost certainly opened; no blur means it
      // likely never received the request).
      //
      // The advisory `pingWalletConnectSession` preflight that used to run
      // here was removed: mirrors SaucerSwap's minimal shape. Any relay
      // probing before the actual signing call was competing with the
      // wallet's response channel and contributed to "second action doesn't
      // reach HashPack" failures.
      return instrumentWcCall(label, () => withHardTimeout(fn(), timeoutMs, label))
    })
    if (heartbeat) clearInterval(heartbeat)
    opts.cancelSignal?.removeEventListener('abort', onCancel)
    recordSignEvent(label, 'ack', { durMs: Date.now() - startedAt, meta: opts.meta })
    return result
  } catch (err) {
    if (heartbeat) clearInterval(heartbeat)
    opts.cancelSignal?.removeEventListener('abort', onCancel)
    const e = err as Error & { code?: unknown }
    recordSignEvent(label, 'error', {
      durMs: Date.now() - startedAt,
      error: { name: e?.name, message: e?.message, code: e?.code },
      meta: opts.meta,
    })
    throw err
  }
}
