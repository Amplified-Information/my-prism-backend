/**
 * WalletConnect diagnostics — logging only.
 *
 * Provides:
 *   - `snapshotSessions()` for log payloads
 *   - `instrumentWalletCall()` wrapper for start/heartbeat/finish logs
 *
 * No behavior changes — every export here only emits console output.
 */
import { getDAppConnector, hederaNamespace } from './appkit'
import { activeWalletLabel } from './walletMutex'

const topicShort = (t?: string) => (t ? t.slice(0, 8) : 'none')

type SessionSource = 'extension' | 'relay'

export const snapshotSessions = (): Array<{
  source: SessionSource
  topic: string
  peer?: string
  expiry?: number
  expiresInSec?: number
  namespaces?: string[]
}> => {
  const out: Array<{
    source: SessionSource
    topic: string
    peer?: string
    expiry?: number
    expiresInSec?: number
    namespaces?: string[]
  }> = []
  const now = Math.floor(Date.now() / 1000)

  try {
    const dc = getDAppConnector() as unknown as {
      walletConnectClient?: { session?: { getAll?: () => unknown[] } }
      signers?: Array<{ topic: string; getAccountId(): { toString(): string } }>
      extensions?: Array<{ id?: string; available?: boolean }>
    } | undefined
    const wcSessions = (dc?.walletConnectClient?.session?.getAll?.() ?? []) as Array<{
      topic: string
      peer?: { metadata?: { name?: string } }
      expiry?: number
      namespaces?: Record<string, unknown>
    }>
    const extensionIds = new Set(
      (dc?.extensions ?? [])
        .filter((e) => e.available && e.id)
        .map((e) => e.id as string),
    )
    for (const s of wcSessions) {
      // Heuristic: sessions whose peer metadata matches a known extension
      // id are classified as "extension" (the DAppConnector routed the
      // pairing through the hedera-extension protocol); everything else
      // came from the WalletConnect relay/modal path.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const peerName = s.peer?.metadata?.name
      const source: SessionSource = extensionIds.size && peerName
        ? 'extension'
        : 'relay'
      out.push({
        source,
        topic: s.topic,
        peer: peerName,
        expiry: s.expiry,
        expiresInSec: s.expiry ? s.expiry - now : undefined,
        namespaces: s.namespaces ? Object.keys(s.namespaces) : undefined,
      })
    }
  } catch (e) {
    console.warn('[wc] snapshotSessions failed', e)
  }

  return out
}

// Kept for compatibility — still referenced by callers when classifying
// failures.
export class WalletNotConnectedError extends Error {
  code = 'WALLET_NOT_CONNECTED'
  constructor() { super('Wallet is not connected. Please reconnect your wallet.') }
}
export class WalletSessionExpiredError extends Error {
  code = 'WALLET_SESSION_EXPIRED'
  constructor() { super('Wallet session expired. Please reconnect your wallet.') }
}

// ─────────────────────────────────────────────────────────────
// In-memory event bus for the dev-only WalletSignDebugPanel.
// Ring buffer of the most recent signing lifecycle events.
// No effect on runtime behavior; safe to keep enabled in prod.
// ─────────────────────────────────────────────────────────────

export type SignEventPhase =
  | 'start'
  | 'heartbeat'
  | 'ack'
  | 'error'
  | 'note'

export interface SignEvent {
  id: number
  t: number                     // epoch ms
  label: string                 // e.g. 'order.sign', 'login.sign'
  phase: SignEventPhase
  durMs?: number                // elapsed since start for ack/error/heartbeat
  visibility?: string
  activeLock?: string | null
  sessions?: ReturnType<typeof snapshotSessions>

  meta?: Record<string, unknown>
  error?: { name?: string; message?: string; stack?: string; code?: unknown }
}

const RING_SIZE = 200
const ring: SignEvent[] = []
let nextId = 1
const subs = new Set<(events: SignEvent[]) => void>()

const notify = () => {
  const snap = ring.slice()
  subs.forEach((cb) => {
    try { cb(snap) } catch { /* noop */ }
  })
}

export const recordSignEvent = (
  label: string,
  phase: SignEventPhase,
  extra: Partial<Omit<SignEvent, 'id' | 't' | 'label' | 'phase'>> = {},
): SignEvent => {
  const ev: SignEvent = {
    id: nextId++,
    t: Date.now(),
    label,
    phase,
    visibility: typeof document !== 'undefined' ? document.visibilityState : undefined,
    activeLock: activeWalletLabel(),
    ...extra,
  }
  ring.push(ev)
  if (ring.length > RING_SIZE) ring.shift()
  notify()
  return ev
}

export const subscribeSignEvents = (cb: (events: SignEvent[]) => void): (() => void) => {
  subs.add(cb)
  cb(ring.slice())
  return () => { subs.delete(cb) }
}

export const getSignEvents = (): SignEvent[] => ring.slice()

export const clearSignEvents = (): void => {
  ring.length = 0
  notify()
}

/**
 * Wraps a wallet-bound promise with start/heartbeat/finish logging.
 * Does not change timing or error propagation.
 */
export const instrumentWalletCall = async <T>(
  label: string,
  fn: () => Promise<T>,
  opts: { heartbeatMs?: number; meta?: Record<string, unknown>; cancelSignal?: AbortSignal } = {}
): Promise<T> => {
  const heartbeatMs = opts.heartbeatMs ?? 5000
  const startedAt = Date.now()

  const startMeta = {
    t: new Date().toISOString(),
    visibility: typeof document !== 'undefined' ? document.visibilityState : 'n/a',
    namespace: hederaNamespace,
    activeLock: activeWalletLabel(),
    sessions: snapshotSessions(),
    ...(opts.meta || {}),
  }
  console.log(`[wc] ${label} → sending`, startMeta)
  recordSignEvent(label, 'start', {
    sessions: startMeta.sessions,
    meta: opts.meta,
  })

  const heartbeat = setInterval(() => {
    const elapsed = Math.round((Date.now() - startedAt) / 1000)
    console.log(`[wc] ${label} waiting ${elapsed}s`, {
      visibility: typeof document !== 'undefined' ? document.visibilityState : 'n/a',
      activeLock: activeWalletLabel(),
      sessions: snapshotSessions().map((s) => ({
        source: s.source,
        topic: topicShort(s.topic),
        peer: s.peer,
        expiresInSec: s.expiresInSec,
      })),
    })
    recordSignEvent(label, 'heartbeat', {
      durMs: Date.now() - startedAt,
      sessions: snapshotSessions(),
    })
  }, heartbeatMs)

  // Callers that resolve the outer op via a race (e.g. mirror-node ack
  // beat the wallet ack) can pass an AbortSignal to stop the heartbeat
  // even though the underlying wallet promise is still pending. This
  // prevents the debug panel from filling with phantom heartbeats and
  // stops us from leaking a timer per stuck signing prompt.
  const onCancel = () => {
    clearInterval(heartbeat)
    recordSignEvent(label, 'note', {
      durMs: Date.now() - startedAt,
      meta: { cancelled: true, reason: opts.cancelSignal?.reason ?? 'cancelled' },
    })
  }
  if (opts.cancelSignal) {
    if (opts.cancelSignal.aborted) onCancel()
    else opts.cancelSignal.addEventListener('abort', onCancel, { once: true })
  }

  try {
    const result = await fn()
    clearInterval(heartbeat)
    opts.cancelSignal?.removeEventListener('abort', onCancel)
    const durMs = Date.now() - startedAt
    console.log(`[wc] ${label} ← ack in ${durMs}ms`)
    recordSignEvent(label, 'ack', { durMs, meta: opts.meta })
    return result
  } catch (err) {
    clearInterval(heartbeat)
    opts.cancelSignal?.removeEventListener('abort', onCancel)
    const e = err as Error & { code?: unknown }
    const durMs = Date.now() - startedAt
    console.error(`[wc] ${label} ✗ rejected after ${durMs}ms`, {
      name: e?.name,
      message: e?.message,
      code: e?.code,
      visibility: typeof document !== 'undefined' ? document.visibilityState : 'n/a',
      sessions: snapshotSessions(),
    })
    recordSignEvent(label, 'error', {
      durMs,
      error: { name: e?.name, message: e?.message, code: e?.code },
      sessions: snapshotSessions(),
      meta: opts.meta,
    })
    throw err
  }
}

