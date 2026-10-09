/**
 * Session-local record of SELL (secondary) intents this tab has submitted.
 *
 * Why this exists:
 *   `CreatePredictionIntent` returns "txId submitted to CLOB for matching"
 *   immediately, but the order can take a while to appear in the order book,
 *   and `GetUserPortfolio.open_prediction_intents` frequently comes back `{}`
 *   for secondary intents. Meanwhile `positions.n_yes` / `n_no` are NOT
 *   decremented while shares sit escrowed in a resting sell.
 *
 *   Net effect for the user: after selling their whole position the Portfolio
 *   row still shows a live "Sell" button and the Trade panel still reports the
 *   full share count as sellable — so the same shares can be offered for sale
 *   over and over, and every extra order is silently dropped by the CLOB.
 *
 *   This store bridges the gap: submitted sells are remembered locally and
 *   counted as escrowed until the backend surfaces them (book entry / open
 *   intent with the same txId) or the TTL expires.
 */

export interface PendingSell {
  txId: string
  marketId: string
  outcome: 'yes' | 'no'
  qty: number
  priceUsd: number
  ts: number
}

// Long enough to cover CLOB ingestion lag, short enough that a rejected order
// doesn't lock the position for the rest of the session.
// 90s: the backend now persists per-leg `qty_rem` (backend commit e12e20ce), so
// residual sells reappear on the book / in open intents on their own. This shim
// only needs to bridge feed lag, not mask real state.
export const PENDING_SELL_TTL_MS = 90 * 1000

let pending: readonly PendingSell[] = []
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(l => l())
}

function prune(list: readonly PendingSell[]): readonly PendingSell[] {
  const cutoff = Date.now() - PENDING_SELL_TTL_MS
  return list.filter(p => p.ts >= cutoff)
}

export function recordPendingSell(entry: Omit<PendingSell, 'ts'>) {
  if (!entry.txId || !entry.marketId || entry.qty <= 0) return
  const next = prune(pending).filter(p => p.txId !== entry.txId)
  pending = [...next, { ...entry, ts: Date.now() }]
  emit()
}

/** Drop entries the backend now reports itself (book entry / open intent). */
export function reconcilePendingSells(knownTxIds: Iterable<string>) {
  const known = new Set(knownTxIds)
  const next = prune(pending).filter(p => !known.has(p.txId))
  if (next.length === pending.length) return
  pending = next
  emit()
}

export function clearPendingSell(txId: string) {
  const next = pending.filter(p => p.txId !== txId)
  if (next.length === pending.length) return
  pending = next
  emit()
}

export function subscribePendingSells(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function snapshotPendingSells(): readonly PendingSell[] {
  const next = prune(pending)
  if (next.length !== pending.length) pending = next
  return pending
}

/** Escrowed share count this tab believes is already up for sale. */
export function pendingSellQty(
  list: readonly PendingSell[],
  marketId: string,
  outcome: 'yes' | 'no'
): number {
  return list.reduce(
    (sum, p) => (p.marketId === marketId && p.outcome === outcome ? sum + p.qty : sum),
    0
  )
}
