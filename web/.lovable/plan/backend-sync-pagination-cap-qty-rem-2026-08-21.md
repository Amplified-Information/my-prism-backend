# Backend sync: pagination cap + `qty_rem`

## What changed on the backend since our last sync (`1fce0091`)

Five new commits; three matter.

1. **`e12e20ce` (Aug 17)** — CLOB renamed `qty` → `qty_rem` on `CreateOrderRequestClob`, and residual-after-partial-fill is now tracked per leg (`qty_rem` persisted, order marked fully matched only when its own remainder hits zero). This is the real fix for the "part of my sell disappears" problem.
2. **`28f58cc2` (Aug 21)** — Prism Rewards / LOM v2: `GetPrism`, `GetLOMrewardsByMarketId/ByAccountId`, `ClaimPrism`, `SendEntitledPrism`; `CreateMarket` deprecated in favour of `CreateMarketv2`; old `prism_points` removed. **We already absorbed this** in the last proto regeneration (`lib/usePrism.ts`, `lib/useLomRewards.ts`, `CreateMarketv2`).
3. **`8449a838` (Aug 21, 21:39)** — pagination. `LimitOffsetRequest.limit` is now validated `lte: 25`, and `MatchesResponse`, `PositionsResponse`, `PredictionIntentsResponse` gained a `pagination { limit, offset, total, hasMore, nextOffset }` field.

`ClaimPrism` and `SendEntitledPrism` are server-side stubs that return "not implemented" — no claim button should be wired yet.

## The breaking item

Every call we make with `limit > 25` will now be **rejected outright** instead of silently clamped. Affected call sites:

- `components/AllowanceManager.tsx:45` — `getMarkets({ limit: 500 })`
- `components/WalletMenu.tsx:43` — `getMarkets({ limit: 500 })`
- `components/Explore.tsx:25` — `getMarkets({ limit: 100 })`
- `src/pages/RewardsPage.tsx:87` — `getMarkets({ limit: 100 })`
- `lib/usePortfolio.ts:150` — `getMarkets({ limit: 50 })`
- `components/Login.tsx:144,151,158` — diagnostic calls at `limit: 100`
- `components/GraphPriceV2.tsx:360,396` and `lib/useLastTradePrice.ts:43` — `limit: 1000` (these use `PriceHistoryRequest`, a **different** message, so they are unaffected — verify at regen time and leave alone if so)

## Plan

### 1. Regenerate protobufs
Regenerate `gen/api.ts` / `gen/api.client.ts` / `gen/clob.ts` against the new `api.proto` and `clob.proto` so `Pagination` and `qtyRem` land in the typed surface.

### 2. Add a paging helper
New `lib/fetchAllPaged.ts`:
- `PAGE_LIMIT = 25` constant (single source of truth, mirrors the server cap).
- `fetchAllPaged(fetchPage, { maxPages })` — loops `offset += 25` while `pagination.hasMore`, falls back to "stop when a page returns fewer than `limit` rows" if `pagination` is absent (so it still works against an older backend), and hard-stops at `maxPages` to avoid runaway loops on a bad feed.
- Sequential, not parallel — we already hit 502s on the gateway when bursting requests (see the 1D price-history throttle).

### 3. Convert the call sites
- `getMarkets` consumers (`Explore`, `RewardsPage`, `WalletMenu`, `AllowanceManager`, `usePortfolio`) switch to `fetchAllPaged`, keeping their existing effective ceilings (`maxPages` of 4 for the 100-row users, 20 for the 500-row ones).
- `Login.tsx` diagnostics drop to `limit: 25`, single page — they only prove the auth header works.
- Leave `PriceHistoryRequest` call sites unchanged.

### 4. Surface `hasMore` where it matters
`Explore` and the Rewards eligible-markets table get a "showing N of `pagination.total`" line so a truncated list is honest rather than silently short. No infinite-scroll work in this pass.

### 5. Partial-fill bookkeeping
With the backend now persisting `qty_rem` per leg, residual sells should reappear on the book and in `open_prediction_intents` correctly. Reduce `lib/pendingSells.ts` TTL from 10 minutes to 90 seconds so the session-local shim only bridges feed lag rather than masking real state. Keep the shim — do not delete it yet — until residual behaviour is confirmed live on `dev.prism.market`.

### 6. Docs
Update `docs/backend-sync.md` to `8449a838` with sync notes for the three commits, and record in the pending-requests section that `ClaimPrism` / `SendEntitledPrism` are stubs blocking any rewards-claim UI.

## Out of scope
- Any claim/redeem-rewards button (backend stubs).
- Infinite scroll or cursor-based UI.
- LOM scoring constant changes — `useLomRewards` already reads live values.
