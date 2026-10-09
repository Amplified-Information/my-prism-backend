# Limit Order Mining (LOM) Rewards — Backend Specification

Status: **Blocked on backend** — the only LOM read RPCs that exist
(`GetRewardsByMarketId`, `GetRewardsByAccountId`, as of backend `3dcae0e`) are
guarded by an ADMIN role check, so end users cannot call them. As of
2026-09-14 the frontend does not call them at all: the per-market LOM tables
and the miner leaderboard were removed from `/rewards`, the Portfolio Rewards
tab and the `/diagnostics/rewards` checks. Only `GetPrism` ($PRSM balance,
vesting, redeemable) is consumed. To restore the tables the backend must
expose a non-admin read path — account-scoped rows for the authenticated
caller, plus pre-aggregated per-market stats that leak no other account's
data.
Owner: Backend (Go gRPC API) ↔ Frontend (Prism Market, `/rewards`).
Last updated: 2026-09-14.
Related: [`docs/backend-sync.md`](./backend-sync.md), `api/server/services/cronLOM.go`, table `prism_lom`.

## 1. Purpose

The `/rewards` page renders Limit Order Mining. Today it can only show:

- `prism_points` and `prism_token_balance` from `GetUserPortfolio`,
- weighting tiers and emission constants **hardcoded in the frontend** as mirrors of `cronLOM.go`,
- a market list with no reward data attached.

This is fragile: every backend tuning of a weight, tier, or emission rate silently
desynchronises the UI. This spec defines the read surface required to drive the page
from live data.

`prism_lom` is currently write-only from the API's perspective (populated hourly by the
cron). No new scoring logic is requested here — only exposure of what is already computed.

## 2. Definitions

| Term | Meaning |
|---|---|
| **Epoch** | One hourly LOM scoring run. Identified by its UTC start timestamp. |
| **Score** | Per-order points produced by the cron: `price_weight × duration_weight × size` (as implemented in `cronLOM.go`). |
| **Season** | Points accumulation period, already modelled as `PrismPoints.season_id`. |
| **Emission** | $PRSM distributed per epoch, currently `10% of 1,000,000,000 supply / (6 years)` split by hour. |
| **Eligible market** | Unresolved, unpaused, unsuspended market included in the epoch's scoring set. |

$PRSM is a 6-decimal HTS token. All token amounts below are **integer base units** (`uint64`).
All USD prices are decimal strings with 6 dp. All timestamps are RFC3339 UTC strings.

## 3. Persistence

Assumed existing (`prism_lom`, written by the cron). Required columns for the reads below —
add any that are missing:

```text
epoch_start        timestamptz    -- UTC hour boundary, indexed
market_id          text           -- indexed
account_id         text           -- 0.0.x, indexed
order_id           text           -- tx_id of the resting intent
side               enum(YES,NO)
limit_price_usd    numeric(10,6)
mid_price_usd      numeric(10,6)  -- market mid at scoring time
price_weight       int            -- tier applied (90/60/30/10/5/0)
duration_weight    int            -- tier applied (15/10/2/1/0)
resting_seconds    bigint
qty                numeric(20,6)
score              numeric(20,6)  -- points awarded for this order this epoch
prsm_awarded       bigint         -- base units, after pro-rata split
season_id          int
```

Indexes required: `(account_id, epoch_start desc)`, `(epoch_start, market_id)`,
`(market_id, epoch_start desc)`.

Retention: keep at least 90 days of per-order rows; aggregates below may be materialised
into rollup tables if per-order retention becomes costly.

## 4. gRPC surface

All four RPCs are **read-only**. Auth follows the existing pattern: authenticated calls
(`GetLomUserSummary`) require the standard Bearer + challenge-derived session; the other
three are public.

### 4.1 `GetLomConfig`

Replaces the frontend's hardcoded constants. Should be cheap and cacheable (`60s`).

```proto
message GetLomConfigRequest {}

message LomWeightTier {
  string label            = 1; // "Within 1% of market price"
  double threshold        = 2; // 0.01  (fraction for price, seconds for duration)
  uint32 weight           = 3; // 90
}

message GetLomConfigResponse {
  repeated LomWeightTier price_distance_tiers = 1; // descending weight
  repeated LomWeightTier order_duration_tiers = 2; // descending weight
  uint64 total_supply_base            = 3;  // 1e9 * 1e6
  double emission_fraction            = 4;  // 0.10
  uint32 vesting_period_days          = 5;  // 6 * 365
  uint64 prsm_per_epoch_base          = 6;  // authoritative, do not recompute client-side
  uint32 epoch_seconds                = 7;  // 3600
  uint32 current_season_id            = 8;
  double min_order_size_usd           = 9;  // eligibility floor
  string last_epoch_start             = 10; // RFC3339, last completed run
}
```

The frontend must render tiers **only** from this response — no local fallback table.

### 4.2 `GetLomUserSummary`

Drives the hero cards and the "your position" column.

```proto
message GetLomUserSummaryRequest {
  string account_id = 1;
  uint32 season_id  = 2; // 0 = current season
}

message LomMarketAccrual {
  string market_id            = 1;
  double score_last_epoch     = 2;
  uint64 prsm_last_epoch_base = 3;
  double score_season         = 4;
  uint64 prsm_season_base     = 5;
  uint32 open_orders          = 6; // currently eligible resting orders
}

message GetLomUserSummaryResponse {
  uint32 season_id                        = 1;
  double points_season                    = 2;
  uint64 prsm_earned_season_base          = 3;
  uint64 prsm_earned_lifetime_base        = 4;
  uint64 prsm_unclaimed_base              = 5; // 0 if distribution is automatic
  double share_of_last_epoch              = 6; // 0..1
  repeated LomMarketAccrual markets       = 7;
  string last_epoch_start                 = 8;
}
```

Must return an all-zero response (not an error) for an account with no LOM history.

### 4.3 `GetLomMarketStats`

Attaches live reward data to each row of the eligible-markets table. Batched by market id
so the page issues one call, not N.

```proto
message GetLomMarketStatsRequest {
  repeated string market_ids = 1; // empty = all eligible markets
  uint32 limit               = 2; // default 100
  uint32 offset              = 3;
}

message LomMarketStats {
  string market_id                = 1;
  bool   eligible                 = 2;
  string ineligible_reason        = 3; // "resolved" | "paused" | "suspended" | ""
  double total_score_last_epoch   = 4;
  uint64 prsm_last_epoch_base     = 5; // pro-rata slice this market received
  uint32 participants_last_epoch  = 6;
  double avg_price_distance       = 7; // fraction, liquidity-weighted
  double resting_liquidity_usd    = 8;
}

message GetLomMarketStatsResponse {
  repeated LomMarketStats markets = 1;
  string epoch_start              = 2;
  uint32 total                    = 3;
}
```

### 4.4 `GetLomLeaderboard`

Optional for Phase 1, required for the planned leaderboard tab.

```proto
message GetLomLeaderboardRequest {
  uint32 season_id = 1; // 0 = current
  uint32 limit     = 2; // default 50, max 200
  uint32 offset    = 3;
}

message LomLeaderboardEntry {
  uint32 rank             = 1;
  string account_id       = 2;
  double points_season    = 3;
  uint64 prsm_season_base = 4;
}

message GetLomLeaderboardResponse {
  repeated LomLeaderboardEntry entries = 1;
  uint32 total                         = 2;
  uint32 caller_rank                   = 3; // 0 if unauthenticated / unranked
}
```

## 5. Semantics and invariants

1. **Authoritative maths.** `prsm_per_epoch_base` and all weights come from the server.
   The frontend never recomputes emission from supply/vesting inputs.
2. **Pro-rata.** For an epoch, `Σ prsm_awarded` across all rows ≤ `prsm_per_epoch_base`.
   Rounding dust stays with the treasury; never over-issue.
3. **Zero-score epochs.** If no eligible orders exist, the epoch emits nothing and
   `GetLomMarketStats` returns rows with zeroed values, not an error.
4. **Consistency.** `GetLomUserSummary.points_season` must equal the matching
   `PrismPoints.points` entry in `GetUserPortfolio` for the same season. If they can
   diverge, `GetUserPortfolio` should be changed to read from the same aggregate.
5. **Epoch visibility.** Only *completed* epochs are readable. In-flight scoring must not
   leak partial rows.
6. **Precision.** Scores are `double`; token amounts are `uint64` base units. No float
   token amounts anywhere on the wire.

## 6. Errors

| Condition | Code | Message |
|---|---|---|
| Unknown `market_id` in batch | omit from response (no error) | — |
| `limit` above max | `INVALID_ARGUMENT` | `limit exceeds 200` |
| Unknown `season_id` | `NOT_FOUND` | `season not found` |
| Unauthenticated user summary | `UNAUTHENTICATED` | standard session message |
| LOM cron never run | `FAILED_PRECONDITION` | `no completed lom epoch` |

## 7. Delivery phases

**Phase 1 (unblocks the current page)**
- `GetLomConfig`
- `GetLomUserSummary`
- `GetLomMarketStats`

**Phase 2**
- `GetLomLeaderboard`
- Historical series (`epoch_start` range) for a per-user earnings chart.

## 8. Frontend work gated on this

`src/pages/RewardsPage.tsx` currently hardcodes:

- `TOTAL_PRSM_SUPPLY`, `VESTING_PERIOD_YEARS`, `PRSM_PER_DAY`, `PRSM_PER_HOUR`
- `PRICE_DISTANCE_TIERS`, `ORDER_DURATION_TIERS`
- `PRSM_DECIMALS` (safe to keep — token property, not policy)

All of the above except `PRSM_DECIMALS` are deleted once `GetLomConfig` lands. Market rows
gain live score / emission / participant columns from `GetLomMarketStats`, and the hero
cards switch from summed `PrismPoints` to `GetLomUserSummary`.

## 9. Acceptance criteria

- Changing a weight tier in `cronLOM.go` changes the `/rewards` UI with no frontend deploy.
- A user with resting eligible orders sees non-zero `score_last_epoch` within one hour.
- `Σ` of `prsm_last_epoch_base` across `GetLomMarketStats` equals the epoch emission
  minus dust.
- `GetLomUserSummary` and `GetUserPortfolio` report identical season points.
- All four RPCs return in < 300 ms p95 at 100 markets / 10k rows per epoch.
