# Realized P&L — Pre-Close Sells Specification

Status: **Proposed** — backend not yet implementing.
Owner: Backend (Go gRPC API + Rust CLOB) ↔ Frontend (Prism Market).
Last updated: 2026-06-15.
Parent spec: [`docs/cost-basis-and-pnl-spec.md`](./cost-basis-and-pnl-spec.md).

## 1. Purpose & Scope

This spec defines the backend contract and accounting rules for **realized P&L
generated when a user sells shares before a market resolves**. It narrows the
"deferred" `realized_pnl_usd` work item from the parent cost-basis spec into a
self-contained deliverable so the backend team can implement and ship it
independently of resolution-payout accounting.

### In scope
- Realized P&L from sell fills on **open** (not-yet-resolved) markets.
- Per-side (YES / NO) ledger updates triggered by sell fills.
- New persistence columns and new fields on `api.PositionInfo`.
- Backfill from the historical fills table.

### Out of scope
- Resolution-payout P&L (winning/losing side at market close) — handled
  separately in `cost-basis-and-pnl-spec.md` §4.1 / §5.
- Redemptions (`Prism.redeem`) — settlement-only, not a P&L event.
- Fee-architecture redesign — this spec consumes whatever per-fill fee
  attribution the engine already produces.
- Tax-lot reporting (FIFO/LIFO/specific-lot). We continue to use a single
  weighted-average lot per `(user, market, side)`.

### Relationship to shipped work
Backend commit `788dd7f5` added `cost_basis_yes` and `cost_basis_no` to
`api.PositionInfo`. The frontend derives avg price as `costBasis / qty` from
those fields. This spec extends that ledger with a **realized** counterpart so
the UI can stop hard-coding `realizedPnL = 0` in `lib/costBasis.ts`.

## 2. Definitions

| Term | Meaning |
|---|---|
| **Sell fill** | A fill that decreases the user's `qty` on a given side. |
| **Δqty** | Shares removed by the sell fill. Always > 0. |
| **p** | Fill price in USDC, in `[0.00, 1.00]`. |
| **f** | Fee allocated to this fill on this side, in USDC. May be 0. |
| **Proceeds** | `Δqty × p` — gross USDC received before fees. |
| **Cost removed** | `round(avgPrice × Δqty)` in USDC smallest units — the portion of `costAccum` released by the sell. |
| **Avg price** | `costAccum / qty` immediately **before** the sell fill is applied. |
| **Realized P&L** | Lifetime sum of `(proceeds − fees − costRemoved)` over all sell fills on a side. Signed. |

All monetary state is stored as integer USDC smallest units (`10^usdcNdecimals`)
on the backend, exposed as `double` (USDC dollars) on the wire, and rounded to
cents at display per the Precision Standards memory.

## 3. Accounting Rules (Sell Path)

Maintain, per `(user, market, side)`:

```
qty            : uint128   // shares currently held
costAccum      : uint128   // total USDC paid for those shares (smallest unit)
realizedPnL    : int128    // lifetime sell-side P&L (smallest unit, signed)
```

On every **sell fill** of `Δqty` shares at price `p` with fee `f`:

```
require Δqty <= qty                            // upstream invariant
avgPrice    = costAccum / qty                  // before update; integer division
costRemoved = round(avgPrice * Δqty)           // smallest-unit USDC
qty         -= Δqty
costAccum   -= costRemoved
realizedPnL += (Δqty * p) - f - costRemoved
```

Key invariants:
- **Avg price is unchanged** by a sell — only `qty` and `costAccum` shrink, in
  proportion.
- **Partial fills** apply the rule once per fill, not once per order. The
  matching engine MUST emit one ledger update per fill event.
- **Rounding** keeps `costAccum` and `realizedPnL` as integers throughout.
  Never reconstruct them from `avgPrice * qty` floats.
- **`qty == 0` after the sell** ⇒ `costAccum` MUST equal 0 (within ±1 USDC
  smallest unit of accumulated rounding). If it does not, snap `costAccum` to 0
  and fold the residual into `realizedPnL` so subsequent buys start fresh.

### Interaction with the cost-basis ledger
- Buys still update `qty` and `costAccum` per `cost-basis-and-pnl-spec.md` §4.1.
- Buys after a full sell (`qty` returned to 0) start a fresh weighted-average.
  Realized P&L is **not** reset — it is lifetime.
- YES and NO ledgers are independent; a sell on YES has no effect on NO.

### Edge cases
- **Self-trade / wash**: emit both a buy and a sell ledger update; they net to
  zero on `qty` but the sell leg still produces realized P&L (typically zero
  if both legs fill at the same price).
- **Order cancellation**: no ledger effect.
- **Refund / chargeback**: emit a synthetic negative-Δqty buy fill (per parent
  spec §4.5). Do **not** emit a sell fill, so realized P&L is unchanged.
- **Fees not allocable to a side**: the matching engine MUST adopt a documented
  convention. Recommendation: deduct the fee from proceeds on the side being
  sold, matching the formula above.

## 4. Persistence

Add to the positions table (column names indicative):

```sql
ALTER TABLE positions
  ADD COLUMN realized_pnl_yes_usdc_units BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN realized_pnl_no_usdc_units  BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN realized_pnl_as_of          TIMESTAMPTZ;
```

Update rules:
- Updated **transactionally** in the same DB write as `qty` and
  `cost_basis_*_usdc_units` so the ledger never observes a partial state.
- `realized_pnl_as_of` is set to the timestamp of the most recent sell fill
  applied (per position, not per side — see §7 Open Questions).
- `BIGINT` accommodates roughly ±9.2e18 smallest units = ±9.2e12 USDC, which is
  ample. Use `NUMERIC(38,0)` if a stricter upper bound is desired.

### Backfill
Run a one-off job that replays sell fills from the fills table in chronological
order against a reconstructed `(qty, costAccum)` ledger and writes the
resulting `realized_pnl_*_usdc_units` and `realized_pnl_as_of`. Positions whose
fill history cannot be reconstructed (pre-ledger users) leave the columns at
`DEFAULT 0` and `realized_pnl_as_of = NULL` so the API can emit "no data" per
§5.

## 5. Proto / API Contract

Extend `api.PositionInfo`:

```proto
message PositionInfo {
  // ... existing fields ...
  // double cost_basis_yes = 6;   // shipped (788dd7f5)
  // double cost_basis_no  = 7;   // shipped (788dd7f5)

  // NEW — sell-side realized P&L. USDC dollars. `optional` distinguishes
  // "no data" (legacy / un-backfilled position) from a legitimate 0.
  optional double realized_pnl_yes_usd = 16; // lifetime sell P&L, YES side
  optional double realized_pnl_no_usd  = 17; // lifetime sell P&L, NO  side
  optional double realized_pnl_usd     = 14; // sum of YES + NO (reserved in parent spec)
  optional string realized_pnl_as_of   = 18; // RFC3339 of last sell fill applied
}
```

`GetUserPortfolio` behavior:
- MUST populate all four fields for every position the backend has a sell-fill
  ledger for.
- MUST omit (not zero) the fields for positions where the data is unavailable
  (no backfill possible).
- `realized_pnl_usd` MUST equal `realized_pnl_yes_usd + realized_pnl_no_usd`
  when both sides are present; equal the present side when only one is.
- Portfolio-level realized P&L is computed client-side as the sum over
  positions where `realized_pnl_usd` is present.

### Distinction from resolution P&L
These fields cover **sells on open markets only**. Resolution-payout P&L is the
domain of the parent spec and SHOULD be surfaced as a separate field (e.g.
`resolution_pnl_usd`) when implemented, so the frontend can label the two
sources distinctly ("Realized (sells)" vs. "Realized (resolution)") or sum
them as preferred.

## 6. Validation Invariants

For every position returned by `GetUserPortfolio`, backend MUST satisfy:

1. `qty >= 0` and `costAccum >= 0`.
2. `costAccum == 0` whenever `qty == 0` (±1 smallest unit tolerance).
3. `0 <= avgPrice <= 1` when `qty > 0` (±$0.0001 tolerance).
4. For every user and market: the sum over sell fills of
   `(proceeds − fees − costRemoved)` equals
   `realized_pnl_yes_usd + realized_pnl_no_usd`.
5. Selling more shares than held MUST be rejected upstream; the ledger MUST
   NOT be updated on a violation.

Frontend unit tests (Vitest, alongside `lib/costBasis.test.ts`) MUST cover:
- Sell at a price above avg → positive `realizedPnL`, unchanged `avgPrice`.
- Sell at a price below avg → negative `realizedPnL`, unchanged `avgPrice`.
- Buy → partial sell → buy: weighted-average recomputes only on the new buy
  legs; realized P&L persists across the round-trip.
- Field absence keeps the UI rendering "—" (regression guard for legacy
  positions).

## 7. Rollout

1. **Backend, write-only.** Add DB columns and matching-engine ledger updates
   behind a feature flag. No API changes yet.
2. **Backfill.** Replay historical sell fills to populate the new columns.
3. **API.** Add the new proto fields and populate them in `GetUserPortfolio`.
   Regenerate `gen/api.ts` per the gRPC Maintenance memory.
4. **Frontend.** Wire `realized_pnl_usd` into `lib/costBasis.ts` (replace the
   hard-coded `0`) and aggregate in `lib/usePortfolio.ts` portfolio summary.
   Update `components/Portfolio.tsx` realized-P&L row to consume the live
   value.

## 8. Open Questions

- **Per-fill fee attribution.** Does the matching engine currently emit a
  per-side fee on each sell fill, or is the fee charged at order-completion
  time? The formula in §3 assumes per-fill `f`.
- **Engine hook.** Is there an existing atomic write path where the positions
  ledger can be updated alongside the fill, or does this require a new event
  in the Rust CLOB → Go API bridge?
- **`realized_pnl_as_of` granularity.** Per-position (recommended for
  simplicity) or per-side (matches the per-side P&L fields)? If per-side, add
  `realized_pnl_yes_as_of` / `realized_pnl_no_as_of` and drop the combined
  field.
- **Resolution-payout split.** Confirm the frontend wants resolution P&L
  exposed as a separate field rather than folded into `realized_pnl_usd`. This
  spec assumes "separate".
