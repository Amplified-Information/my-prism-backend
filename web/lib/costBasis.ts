// Cost-basis & P&L derivation, kept as a pure helper so it can be unit-tested
// independently of the React hook.
//
// Backend commit 66b90827 ("Add position PnL accumulators and sig cancel")
// reshuffled `PositionInfo`:
//
//   6  optional double avg_price_yes_usd   (NEW)
//   7  optional double avg_price_no_usd    (NEW)
//   8  optional double cost_basis_yes_usd  (renamed from cost_basis_yes @ 6)
//   9  optional double cost_basis_no_usd   (renamed from cost_basis_no  @ 7)
//   10 optional double realized_pnl_usd    (NEW)
//   11 optional string cost_basis_as_of    (NEW)
//
// We prefer backend-provided `avgPriceYesUsd` / `avgPriceNoUsd` when present
// (handles edge cases like backfilled positions where cost/qty isn't reliable)
// and fall back to `cost / qty` otherwise. `costBasisAvailable` flips true when
// any non-zero cost/avg total is present.

export interface CostBasisFields {
  // Renamed wire fields (66b90827+).
  costBasisYesUsd?: number | null
  costBasisNoUsd?: number | null
  avgPriceYesUsd?: number | null
  avgPriceNoUsd?: number | null
  realizedPnlUsd?: number | null
  // Legacy wire fields (≤ 788dd7f5). Kept as a transitional fallback while
  // staging rolls — safe to drop once backend 66b90827 is fully deployed.
  costBasisYes?: number | null
  costBasisNo?: number | null
}

export interface DerivedCostBasis {
  costBasisAvailable: boolean
  avgPriceYes: number
  avgPriceNo: number
  totalCost: number
  marketValue: number
  unrealizedPnL: number
  pnlPercent: number
  realizedPnL: number
}

export function deriveCostBasis(
  info: CostBasisFields | undefined | null,
  qtyYes: number,
  qtyNo: number,
  yesBid: number,
  noBid: number,
): DerivedCostBasis {
  const costBasisYesRaw = (info?.costBasisYesUsd ?? info?.costBasisYes ?? 0) || 0
  const costBasisNoRaw  = (info?.costBasisNoUsd  ?? info?.costBasisNo  ?? 0) || 0
  const avgFromBackendYes = info?.avgPriceYesUsd ?? null
  const avgFromBackendNo  = info?.avgPriceNoUsd  ?? null
  const hasBackendAvg =
    (avgFromBackendYes !== null && avgFromBackendYes !== undefined) ||
    (avgFromBackendNo  !== null && avgFromBackendNo  !== undefined)

  const costBasisAvailable =
    costBasisYesRaw > 0 || costBasisNoRaw > 0 ||
    (avgFromBackendYes !== null && avgFromBackendYes > 0) ||
    (avgFromBackendNo  !== null && avgFromBackendNo  > 0)

  const avgPriceYes = avgFromBackendYes !== null && avgFromBackendYes > 0
    ? avgFromBackendYes
    : (qtyYes > 0 ? costBasisYesRaw / qtyYes : 0)
  const avgPriceNo  = avgFromBackendNo  !== null && avgFromBackendNo  > 0
    ? avgFromBackendNo
    : (qtyNo > 0 ? costBasisNoRaw / qtyNo : 0)

  // NOTE (backend bug, commit 66b90827): the producer emits
  // `cost_basis_*_usd` and `realized_pnl_usd` in raw USDC base units
  // (×1e6) rather than human USD, while `avg_price_*_usd` is correct.
  // To avoid the visible 1,000,000× blow-up on the Portfolio page,
  // whenever the backend ships `avg_price_*_usd` we derive totalCost
  // from `qty × avgPrice` and ignore the bogus cost-basis fields.
  // The legacy ≤788dd7f5 path (no avg fields) still trusts the raw
  // cost-basis sums. Remove this guard once the backend fix lands.
  const totalCost = hasBackendAvg
    ? (qtyYes * avgPriceYes) + (qtyNo * avgPriceNo)
    : ((costBasisYesRaw + costBasisNoRaw) > 0
        ? costBasisYesRaw + costBasisNoRaw
        : (qtyYes * avgPriceYes) + (qtyNo * avgPriceNo))

  const marketValue   = qtyYes * yesBid + qtyNo * noBid
  const unrealizedPnL = costBasisAvailable ? marketValue - totalCost : 0
  const pnlPercent    = costBasisAvailable && totalCost > 0
    ? (unrealizedPnL / totalCost) * 100
    : 0

  // Backend `realized_pnl_usd` (66b90827) currently suffers the same
  // unit bug as `cost_basis_*_usd`. Don't trust it here; usePortfolio.ts
  // recomputes `payout − totalCost` for resolved positions instead.
  const realizedPnL = 0

  return {
    costBasisAvailable,
    avgPriceYes,
    avgPriceNo,
    totalCost,
    marketValue,
    unrealizedPnL,
    pnlPercent,
    realizedPnL,
  }
}
