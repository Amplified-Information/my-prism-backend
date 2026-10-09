/**
 * In-memory suppression set for markets the user has just redeemed.
 *
 * Why this exists:
 *   Backend `prediction_intents.redeemed_at` is populated when the NATS
 *   subscriber sees the on-chain WinningsRedeemed event, but:
 *     1. It is not exposed on the gRPC `PositionInfo` message yet, AND
 *     2. The `positions.n_yes` / `n_no` counts the FE reads are never
 *        decremented on redeem.
 *
 *   So after a successful on-chain redeem the row keeps showing in
 *   "Redeemable Winnings" until the user reloads — and even then it
 *   reappears, because the backend still reports the original share count.
 *
 *   This module provides a session-local "I just redeemed this" gate that
 *   `usePortfolio` consults to force `redeemableUsd = 0`. State is lost on
 *   reload; that's acceptable as an interim fix until the backend exposes
 *   `redeemed_at` on `PositionInfo` (see .lovable/plan.md, Phase 1+2).
 *
 *   The store replaces the Set on every mutation so React's
 *   `useSyncExternalStore` sees a fresh reference and re-renders.
 */

let redeemedMarketIds: ReadonlySet<string> = new Set<string>()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(l => l())
}

export function markMarketRedeemed(marketId: string) {
  if (!marketId || redeemedMarketIds.has(marketId)) return
  const next = new Set(redeemedMarketIds)
  next.add(marketId)
  redeemedMarketIds = next
  emit()
}

export function clearMarketRedeemed(marketId: string) {
  if (!redeemedMarketIds.has(marketId)) return
  const next = new Set(redeemedMarketIds)
  next.delete(marketId)
  redeemedMarketIds = next
  emit()
}

export function isMarketRedeemedLocally(marketId: string): boolean {
  return redeemedMarketIds.has(marketId)
}

export function subscribeRedeemedMarkets(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function snapshotRedeemedMarkets(): ReadonlySet<string> {
  return redeemedMarketIds
}
