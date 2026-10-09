# Cost-Basis & P&L Specification

Status: **Partially shipped** — see "Status (2026-06-15)" below.
Owner: Frontend (Prism Market) ↔ Backend (Go gRPC API).
Last updated: 2026-06-15.

## Status (2026-06-15)

Backend commit `788dd7f5` ("Add user cost-basis to positions") shipped a
**minimal subset** of this spec. Frontend has been wired to match.

**Shipped on `api.PositionInfo`:**

- `double cost_basis_yes = 6  [json_name="costBasisYes"]` — total USDC paid for YES side
- `double cost_basis_no  = 7  [json_name="costBasisNo"]` — total USDC paid for NO side

Both are plain (non-optional) doubles. A zero value on a side means "no fills
tracked for that side". Frontend treats a position as `costBasisAvailable` when
either side total is `> 0`.

**Derived client-side** (`lib/costBasis.ts`):

- `avgPriceYes = costBasisYes / qtyYes` (when `qtyYes > 0`)
- `avgPriceNo  = costBasisNo  / qtyNo`  (when `qtyNo  > 0`)
- `totalCost`, `marketValue`, `unrealizedPnL`, `pnlPercent` as before.

**Deferred (not in backend; UI still shows `—` / falls back):**

- `avg_price_yes_usd` / `avg_price_no_usd` — server-side weighted-average entry.
- `realized_pnl_usd` — lifetime realized; resolved-position P&L still uses the
  client-side payout calc against `costBasis*`.
- `cost_basis_as_of` — timestamp of last fill applied.
- Resolution-payout accounting and the §5/§7 invariants below.

The remainder of this document is the **original proposal** kept for reference
and as a roadmap for the deferred fields.

---



## 1. Problem

The Portfolio page must display, per position and at the portfolio level:

- **Avg price** — the user's volume-weighted entry price per share.
- **Cost** — total USDC the user paid to open the position.
- **Unrealized P&L** — `marketValue − cost` for open positions.
- **Realized P&L** — `proceeds − costOfSharesRemoved` for closed/resolved positions.
- **Total P&L** and **P&L %**.

Today the backend does not surface the required fields:

- `api.PositionInfo.price_usd` is the **latest market price**, not the user's average entry price.
- The DB columns `cost_basis_price_yes_usd` / `cost_basis_price_no_usd` exist but are **not selected** by `GetUserPositions` and **not mapped** into the `PositionInfo` proto.
- Realized P&L from partial sales and resolution payouts is not tracked anywhere the frontend can read.

As a result the UI falls back to `costBasisAvailable: false` and renders Avg / Cost / P&L as `—` (see `lib/usePortfolio.ts:31-44`, `components/Portfolio.tsx`). This spec defines the data contract and accounting rules needed to remove that fallback.

## 2. Scope

In scope:
- Per-side (YES / NO) cost basis for every open and resolved position.
- Realized P&L from sells, resolution payouts, and redemptions.
- Aggregation rules for portfolio totals.
- Backend proto additions and frontend wiring.

Out of scope:
- Tax-lot reporting (FIFO/LIFO/specific-lot). We use a single weighted-average lot per (user, market, side).
- Fee accounting at order level (rolled into cost — see §4.4).
- Historical P&L charts / time-series (future work; this spec provides the inputs).

## 3. Definitions

| Term | Meaning |
|---|---|
| **Share** | One unit of a YES or NO outcome token. Settles at $1.00 if its outcome wins, $0.00 otherwise. |
| **Side** | `YES` or `NO`. A position can hold both simultaneously. |
| **Qty** | Number of shares currently held on a side. Always ≥ 0. |
| **Avg price** | Volume-weighted average USDC paid per share currently held, in `[0.00, 1.00]`. |
| **Cost** | `qty × avgPrice`. Total USDC tied up in the open position. |
| **Mark price** | Best **bid** for the side from the live order book (the price the user could exit at right now). |
| **Market value** | `qty × markPrice`. |
| **Unrealized P&L** | `marketValue − cost`. Defined only while the position is open. |
| **Proceeds** | USDC received from a sell or a resolution payout. |
| **Realized P&L** | `proceeds − costOfSharesRemoved`, accumulated over the lifetime of the position. |
| **Resolution payout** | $1.00 × winning-side shares at resolution; $0.00 to the losing side. |

All monetary values are USDC, stored as integers in the smallest unit (`10^usdcNdecimals`) on-chain and exposed as `float`/`string` in the proto. Frontend rounds to cents for display per the **Precision Standards** memory.

## 4. Accounting Rules

### 4.1 Weighted-average cost basis per side

Maintain, per `(user, market, side)`:

```
qty           : uint128   // shares currently held
costAccum     : uint128   // total USDC paid for those shares (smallest unit)
avgPrice      := costAccum / qty            // undefined when qty == 0
```

On every fill update:

- **Buy fill** (`Δqty > 0`, fill price `p`, fee `f` allocated to this side):
  ```
  qty       += Δqty
  costAccum += Δqty * p + f
  ```
- **Sell fill** (`Δqty > 0` shares removed at fill price `p`, fee `f`):
  ```
  costRemoved   = round(avgPrice * Δqty)       // proportional cost
  qty          -= Δqty
  costAccum    -= costRemoved
  realizedPnL  += Δqty * p - f - costRemoved
  ```
  Selling does **not** change `avgPrice` of the remaining shares.

- **Resolution** at time `tR`:
  - Winning side: `realizedPnL += qty * 1.00 − costAccum`; then `qty = 0`, `costAccum = 0`.
  - Losing side:  `realizedPnL += 0       − costAccum`; then `qty = 0`, `costAccum = 0`.
  - These updates are applied even if the user has not yet called `Prism.redeem(...)`. Redemption is a settlement event, not a P&L event.

### 4.2 Cost flow across YES/NO on the same market

YES and NO are independent ledgers — buying NO does not reduce the cost basis of YES. The portfolio total simply sums both sides.

### 4.3 Sign conventions

- `cost`, `qty`, `marketValue`, `redeemableUsd` are always ≥ 0.
- `unrealizedPnL`, `realizedPnL`, `totalPnL` are signed.
- `pnlPercent = pnl / cost * 100` when `cost > 0`, else `null` (UI shows `—`).

### 4.4 Fees

Trading fees (if any) are folded into cost on buys and netted from proceeds on sells, as shown in §4.1. The frontend does not need a separate fee field. If the backend cannot allocate fees to a fill at the side level, it MUST document the convention used (e.g. "fees excluded from cost basis") so the UI label can match.

### 4.5 Edge cases

- **Self-trade / wash**: treat as a buy and a sell that net to zero qty change; both legs update the ledger.
- **Order cancellation**: no cost-basis effect (no fill).
- **Refund / chargeback**: backend MUST emit a synthetic negative-quantity buy fill that reverses the original cost change.
- **Floating-point drift**: backend MUST maintain `costAccum` as an integer in USDC smallest-unit; never as a float over `avgPrice * qty`.
- **`qty == 0`**: omit `avgPrice` from the response (or send `null`). Do not send `0.0`, which is a legal price.

## 5. Backend Contract

### 5.1 Proto changes

Extend `api.PositionInfo` (in `gen/api.ts` / source proto):

```proto
message PositionInfo {
  Position position           = 1;  // existing
  float    price_usd          = 2;  // existing — current market price
  bool     is_paused          = 3;
  string   resolved_at        = 4;
  string   redeemed_at        = 5;

  // NEW — cost basis & realized P&L. All amounts in USDC (float dollars,
  // matching existing convention). Null/absent ⇒ data not yet available
  // for this position; client renders "—".
  optional double avg_price_yes_usd      = 10;  // weighted-avg entry, YES
  optional double avg_price_no_usd       = 11;  // weighted-avg entry, NO
  optional double cost_basis_yes_usd     = 12;  // = qtyYes * avgPriceYes + unallocated fees
  optional double cost_basis_no_usd      = 13;  // = qtyNo  * avgPriceNo  + unallocated fees
  optional double realized_pnl_usd       = 14;  // lifetime, both sides combined for this market
  optional string cost_basis_as_of       = 15;  // RFC3339 timestamp of the last fill applied
}
```

Why `optional double` (not `float`):
- `double` avoids precision loss for cost totals on long-lived users.
- `optional` distinguishes "no data" from "zero".

### 5.2 `GetUserPortfolio` behavior

- MUST populate the five new fields for every position the backend has fills for.
- MUST set `cost_basis_as_of` to the timestamp of the most recent fill included.
- Aggregate `realized_pnl_usd` SHOULD include resolution payouts for resolved positions even when the user has not yet redeemed.
- If the backend cannot compute one field (e.g. legacy positions predating the ledger), it MUST omit that field rather than send `0`.

### 5.3 Backwards compatibility

- Frontend currently treats absent cost-basis as `costBasisAvailable: false` and renders `—`. New fields are additive — old clients keep working.
- Once the backend deploys the new fields, the frontend flips `costBasisAvailable` to `true` per-position based on presence of `avg_price_yes_usd` / `avg_price_no_usd`.

## 6. Frontend Wiring

File: `lib/usePortfolio.ts`.

1. Update `EnrichedPosition` mapping:
   ```ts
   const hasYes = info.avgPriceYesUsd != null
   const hasNo  = info.avgPriceNoUsd  != null
   const costBasisAvailable = hasYes || hasNo
   const avgPriceYes = info.avgPriceYesUsd ?? 0
   const avgPriceNo  = info.avgPriceNoUsd  ?? 0
   const totalCost   = (info.costBasisYesUsd ?? 0) + (info.costBasisNoUsd ?? 0)
   const realizedPnL = info.realizedPnlUsd ?? 0
   ```
2. Compute per-position:
   ```ts
   const marketValue   = qtyYes * yesBid + qtyNo * noBid
   const unrealizedPnL = costBasisAvailable ? marketValue - totalCost : 0
   const pnlPercent    = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0
   ```
3. Portfolio summary aggregates only positions where `costBasisAvailable === true`; `summary.costBasisAvailable` becomes true if **all** open positions have data (stricter than today's "any") so that totals are not misleading mixtures.
4. `components/Portfolio.tsx` row rendering (lines ~670-695) keeps its current logic — `avgPriceYes`/`avgPriceNo` now carry real values, so the existing math (`cost = qty * avgPrice`, `pnl = value - cost`) becomes correct automatically.

## 7. Validation

Backend MUST satisfy these invariants for every position returned by `GetUserPortfolio`:

1. `qty >= 0` and `costAccum >= 0`.
2. `0 <= avgPrice <= 1` (within ±$0.0001 rounding tolerance).
3. `costBasis ≈ qty * avgPrice` (within ±$0.01).
4. For a resolved position: `qty == 0` on both sides and `realizedPnL` reflects the payout.
5. Sum of `realizedPnL` across markets equals the sum of (sell-proceeds − cost-removed) + (resolution-payouts − cost-on-resolution) for the user.

Frontend unit tests (Vitest) MUST cover:

- Buy → buy raises weighted average correctly.
- Buy → partial sell leaves avgPrice unchanged and increments realized.
- Resolution of winning / losing side zeroes qty and updates realized.
- `costBasisAvailable === false` keeps the UI rendering `—` (regression guard).

## 8. Rollout

1. Backend: add proto fields, populate from existing `cost_basis_price_*_usd` DB columns, deploy behind a feature flag.
2. Frontend: ship the wiring in §6 guarded by presence-checks (safe with or without backend rollout).
3. Backfill: run a one-off job that reconstructs `costAccum` and `realizedPnL` from historical fills for accounts that predate the ledger. Mark positions that cannot be backfilled by leaving the new fields null.
4. Once backfill completes, remove the `costBasisAvailable: false` fallback path from the UI.

## 9. Open Questions

- **Fee allocation** — confirm whether the matching engine attaches a per-side fee to each fill, or whether fees are charged at a market level.
- **Sub-cent precision** — should `avgPrice` be rounded to cents server-side or kept at full precision? Recommendation: keep full precision in the API, round only at display.
- **Pre-ledger positions** — acceptable to show `—` indefinitely, or do we need a partial reconstruction from on-chain transfers?
