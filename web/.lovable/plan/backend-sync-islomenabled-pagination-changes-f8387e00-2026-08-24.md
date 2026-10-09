# Backend sync: `isLOMenabled` + pagination changes (`f8387e00`)

One new backend commit since our sync point (`8449a838`): **`f8387e00` "isLOMenabled"** (Aug 24). It carries one new feature flag plus two wire changes that affect us.

## What changed on the backend

1. **`MarketResponse.is_lom_enabled` (field 21, JSON `isLOMenabled`)** — new `markets.is_LOM_enabled` column, defaults `true`. The LOM cron now skips markets where it is false, so those markets earn no rewards.
2. **Pagination cap raised** — `LimitOffsetRequest.limit` validation moved from `lte: 25` to `lte: 100`. The server still clamps to `DB_MAX_ROWS`, and the internal default dropped from 100 to 50, so a request of 100 can come back as 50 rows. `GetMatchesRequest.limit` was tightened the other way: `lte: 1000` → `lte: 100`.
3. **`Pagination` renamed to `PaginationRes`** — breaking rename in the generated types.
4. **`CreateMarketv2Request.is_lom_enabled` / `PatchMarketRequest.is_lom_enabled`** — admin-only surface; out of scope for this project.
5. **`MatchedIntents` commented out** in the proto. We do not reference it outside docs, so nothing to do beyond regeneration.

## Plan

### 1. Regenerate protobufs
Regenerate `gen/api.ts`, `gen/api.client.ts`, `gen/clob.ts`, `gen/clob.client.ts` against the new `api.proto` / `clob.proto`. This lands `isLOMenabled` on `MarketResponse` and renames `Pagination` → `PaginationRes`.

### 2. Fix the renamed type
`lib/fetchAllPaged.ts` imports `Pagination`; switch it to `PaginationRes` (type-only change, same field shape).

### 3. Widen the page walk
In `lib/fetchAllPaged.ts`, raise `PAGE_LIMIT` from 25 to 100 and stop treating `PAGE_LIMIT` as the short-page threshold — because the server clamps to 50, a "full" page is whatever `pagination.limit` reports, not what we asked for. The fallback path (no `pagination` present, as with `getMarkets`) compares against the rows actually returned on the first page instead of the requested limit, so a clamped 50-row page is not mistaken for the end of the feed.

Net effect: the same `maxPages` ceilings now cover roughly 2× the markets per page, and the existing `truncated` indicator on Explore/Rewards keeps working.

### 4. Respect the LOM flag on the Rewards page
`src/pages/RewardsPage.tsx` currently filters eligible markets on `getMarketStatus(m) === 'active'` only. Add `m.isLOMenabled !== false` to that filter so markets the backend cron skips are not advertised as reward-eligible. The `!== false` form keeps older backends (field absent → `undefined`) behaving as today.

`lib/useLomRewards.ts` needs no change — it already reads live per-market scores, and a disabled market simply has none.

### 5. Match-limit call sites
No frontend call passes `limit > 100` to `GetPredictionIntentMatches`. The `limit: 1000` calls in `components/GraphPriceV2.tsx` and `lib/useLastTradePrice.ts` use `PriceHistoryRequest`, a different message, and stay unchanged. `components/Comments.tsx` at `limit: 100` is within the comments cap.

### 6. Docs
Update `docs/backend-sync.md` to `f8387e00`: record the three wire changes, and resolve the standing request in the pending section — note that `MarketsResponse` still has no `Pagination`, so `getMarkets` continues to rely on short-page detection.

## Out of scope
- Any admin UI for toggling `isLOMenabled` (admin lives in a separate project).
- Rewards claim buttons — `ClaimPrism` / `SendEntitledPrism` are still backend stubs.
