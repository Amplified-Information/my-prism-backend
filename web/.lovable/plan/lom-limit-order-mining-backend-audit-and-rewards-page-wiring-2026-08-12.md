# LOM (Limit Order Mining) backend audit and Rewards page wiring

## What exists in the backend today

Findings from the backend repo (`api/`):

- **No LOM gRPC API exists — not even commented out.** The only commented-out RPCs in the whole repo are `DeleteMarket` (api.proto, clob.proto) and `PauseMarketToggle` (clob.proto). There is no `GetLOM`, `GetRewards`, `GetLomMarkets`, or similar, active or disabled.
- **LOM runs entirely as a server-side cron job**: `api/server/services/cronLOM.go` (`CronLOMService.CalcLOM`). Every hour it scores open limit orders across all unresolved markets and writes rows to the `prism_lom` table. It exposes nothing over the wire.
- **`prism_lom` table is write-only from the API's point of view.** `api/db/queries/prism_lom.sql` has only `CreateLOMentryForUserOnMarket`; the READ/UPDATE/DELETE sections are empty stubs. `api/server/repositories/prism_lom.go` likewise implements only the insert.
- **The one reward-related thing the frontend *can* read today** is on `GetUserPortfolio`:
  - `prismPoints[] { seasonId, points }` — populated in `positions.go`
  - `prismTokenBalance` (uint64) — populated in `positions.go`
  Both already exist in this project's generated types (`gen/api.ts`).
- **Prism Points are a separate mechanism from LOM** (`prismPoints.go`): points awarded on market resolution based on cost basis, stored in `prism_points`. They are not the LOM reward stream.

### LOM economics (constants living in cronLOM.go, not in any API)

- `PRISMperDay = 10% of 1,000,000,000 PRISM / (6 years * 365)`, allocated 1/24 per hourly run
- Price-distance tiers: 20%→5, 10%→10, 5%→30, 2%→60, 1%→90
- Duration tiers: 24h→15, 1h→10, 30m→2, 10m→1; only orders within 20% of market price earn duration points
- `distance2durationRatio = 2.0`, `dollarValue2lomScoreRatio = 1.25`
- Random 0–55 minute jitter before each run to prevent gaming

### What the Rewards page currently shows vs. what the backend can supply

`src/pages/RewardsPage.tsx` invents per-market values via `mockRewardData()`: max spread, min shares, daily reward, APR. **None of these exist per-market in the backend** — they are global tier constants, and the resulting reward split is only knowable after the cron run, per user, in `prism_lom`.

Real data available now: the user's `prismPoints` and `prismTokenBalance` (the two hero tiles currently hardcoded to `0`).

## Proposed plan

### Phase 1 — wire up what is real (frontend only, no backend change)

1. Replace the hardcoded `totalPoints = 0` / `prismTokenBalance = '0'` in `RewardsPage.tsx` with live values from the portfolio query (`prismPoints` summed across seasons, `prismTokenBalance` formatted with the PRSM decimals).
2. Replace `mockRewardData()` per-market columns with the **actual global LOM rules** shown as a static "How rewards are earned" panel: the price-distance tier table, duration tier table, and the daily PRISM emission figure. This is truthful and needs no backend.
3. Keep the market table, but drop the fabricated Max Spread / Min Shares / Daily Reward / APR columns; keep market, price, and a link to trade. Add a note that LOM accrues hourly.
4. Keep the page gated behind `showRewards` (non-prod) until the backend API lands.

### Phase 2 — backend API request (needs backend work, out of this project's scope)

Specify the endpoints the page really needs, to hand to the backend team:

- `GetLomSummary(evmAddress|accountId)` → total LOM score, PRISM earned to date, last `cron_ran_at`, current epoch estimate
- `GetLomByMarket(accountId, limit, offset)` → per-market rows from `prism_lom` (market_id, total_lom_score, prism awarded, cron_ran_at)
- `GetLomMarketStats(limit, offset)` → per-market pool size / total score so an APR-like figure can be derived honestly
- Emission config (PRISMperDay, tier tables) exposed once so the frontend stops hardcoding them

Once those exist, regenerate `gen/api.ts` and swap the static panel for live data.

## Technical notes

- Files touched in Phase 1: `src/pages/RewardsPage.tsx` only (plus reading `prismPoints`/`prismTokenBalance` through the existing portfolio hook in `lib/usePortfolio.ts` if not already surfaced).
- No proto regeneration is needed for Phase 1 — `PrismPoints` and `prismTokenBalance` are already in `gen/api.ts`.
- `FALLBACK_MARKETS` mock list stays only as an offline-render safety net, or is removed if you prefer an empty state.
