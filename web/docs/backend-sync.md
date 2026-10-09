# Backend Sync Status

**Frontend synced to backend commit:** `77604f9` ("Enable PRISM claimability and multi-sig setup")

## Sync notes for `77604f9` (rewards un-gated, claimability, proto moved)

**Wire changes (`api/proto/api.proto`):**
- `GetRewardsByMarketId` / `GetRewardsByAccountId` moved into the public section
  of `ApiServicePublic` and the **ADMIN role check was removed** from both
  handlers (`api/server/main.go`). The per-market / per-account reward tables
  this project removed on 2026-09-14 can now be restored — the endpoints are
  callable by normal users.
- New public RPC `MarkPrismAsClaimableByAccountId(AccountIdRequest) returns
  (StdResponse)` — flips the account's unredeemed rewards to claimable
  (`is_redeemable`) on a network. No auth check on this handler either.
- `ClaimPrism` gained a guard: the destination account must have the $PRISM
  token **associated** on Hedera (`lib.IsPRISMassociated`), else it errors
  "destination account ... does not have the PRISM token associated". Signature
  verification is still a TODO.

Other changes in the commit (no frontend impact): soft-deleting a market now
also closes it on the CLOB; new multi-sig treasury creation script; token
launch config updates; monolith image bumps (api `0.7.12`).

Frontend changes:
- Regenerated `gen/*` from the new protos (now includes
  `markPrismAsClaimableByAccountId`). Typecheck passes.

**Follow-ups:**
- The per-market reward tables (per-market scores on `/rewards`, Top Miners,
  Portfolio per-market breakdown) can be restored — see
  `docs/lom-rewards-api-spec.md` and the 2026-09-14 removal section below for
  what was deleted (`lib/useLomRewards.ts`, the LOM aggregation helpers in
  `lib/rewardsMath.ts`, and their tests). Awaiting product decision on whether
  to restore them now that the reads are public.
- A claim flow now needs: PRISM token association check/prompt, then
  `MarkPrismAsClaimableByAccountId` (if rewards not yet claimable), then
  `ClaimPrism`. Signature verification still TODO backend-side.

## Sync notes for `3501b7f` (deployment image bump)

Deployment-only commit: `docker-compose-monolith.yml` now points the monolith
at api `0.7.11`, web `0.8.19`, web.admin `0.2.10` — no source, proto,
migration, or wire changes. **No frontend update required.** This is the
redeploy that resolves the "Deployment gap observed 2026-09-14" below: the
deployed API now includes `3dcae0e`, so the "unknown method GetRewardsBy*" and
"prismRewardsRepository is not initialized" errors clear once the stack is
restarted with these tags. (The admin gating on `GetRewardsBy*` is unchanged —
the frontend still does not call them.)

## Sync notes for `3dcae0e` (rewards RPC rename + live ClaimPrism)

**Frontend updated — breaking wire change.** `api/proto/api.proto`:
- `GetLOMrewardsByMarketId` → `GetRewardsByMarketId`
- `GetLOMrewardsByAccountId` → `GetRewardsByAccountId`
- `LOMrewardsResponse` → `RewardsResponse`, now with an added
  `points_rewards` field (`Pointsreward { marketId, accountId, points,
  createdAt }`). The backend service implementations for points rewards are
  still `TODO` stubs returning empty lists.
- `SendEntitledPrism` commented out of the public service.
- `ClaimPrism` is now real: it transfers the account's unredeemed $PRSM from
  a backend hot-payer on Hedera and marks `prism_rewards` rows redeemed
  (`MarkAllPrismClaimed`). Auth/signature verification is still a backend TODO.

Frontend changes:
- Regenerated `gen/*` from the new protos.
- `lib/useLomRewards.ts` and `src/pages/RewardsDiagnosticsPage.tsx` moved to
  the renamed RPCs. Existing `lomRewards` handling is unchanged; the new
  `pointsRewards` field is tolerated but not yet displayed.

**Follow-ups:**
- A claim flow (button + signed `ClaimPrism` request) can now be wired for
  real — previously both claim RPCs were stubs. Signature verification is
  still TODO backend-side, so gate any claim UI on that landing first.
- Points rewards can be surfaced in `/rewards` / Portfolio once the backend
  populates `points_rewards`.

### Deployment gap observed 2026-09-14

Live diagnostics against the deployed API returned:
- `GetRewardsByAccountId` / `GetRewardsByMarketId`: *"unknown method … for
  service api.ApiServicePublic"* — the deployed API image predates `3dcae0e`,
  so it still exposes the old `GetLOMrewards*` names. No frontend fix; the
  API image must be rebuilt and redeployed from `3dcae0e`.
  (`docker-compose-monolith.yml` was **not** bumped in `3dcae0e`.)
- `GetPrism`: *"prismRewardsRepository is not initialized"* — a real bug in
  the deployed build: `PrismRewardsService.Init` ran before
  `prismRewardsRepository` existed. `3dcae0e` fixes it by moving the init
  after the repository/LOM service setup. Also resolved by redeploying.

### Admin-gated reward reads removed from this project (2026-09-14)

In `3dcae0e` both `GetRewardsBy*` handlers are guarded by
`s.authService.HasRole(ctx, lib.ADMIN)`, so no end user can ever load that
data. The frontend therefore **no longer calls** `GetRewardsByMarketId` or
`GetRewardsByAccountId` anywhere:

- `lib/useLomRewards.ts` deleted.
- `lib/rewardsMath.ts` trimmed to `mapPrismResponse` / `PrismBalances`; the LOM
  aggregation helpers (`aggregate`, `buildLeaderboard`, `groupRowsByMarket`,
  `scoreByMarketFrom`, `lastScoredAtByMarketFrom`, `latestScoredAt`) and their
  tests were removed with it.
- `src/pages/RewardsPage.tsx`: per-market LOM score table and the Top Miners
  leaderboard removed; the eligible-markets list and $PRSM hero stats stay.
- `components/Portfolio.tsx`: Rewards tab keeps the three $PRSM stats and shows
  a note that the per-market breakdown is not published yet.
- `src/pages/RewardsDiagnosticsPage.tsx`: the two admin-gated checks removed;
  `GetPrism` and `GetMarkets` checks remain.

`gen/*` is untouched — the generated RPCs stay available. To restore the
tables the backend must expose a non-admin read path (e.g. account-scoped rows
for the authenticated caller plus aggregated per-market stats); see
`docs/lom-rewards-api-spec.md`. `GetPrism` is **not** admin-gated and remains
the source of $PRSM balance / vesting / redeemable.


## Sync notes for `459c0ae` (deployment image bumps + proxy docs)

**No frontend change required.** The diff `5724668..459c0ae` touches four files:
a one-line clarifying comment in `api/server/services/hedera.go`
(`ResolveMarketOnChain`), image tag bumps in `docker-compose-data.yml`
(redis 0.0.1→0.0.2, blocknode 0.1.16→0.1.19) and `docker-compose-monolith.yml`
(api 0.7.6→0.7.10, web 0.8.17→0.8.18, web.admin 0.2.8→0.2.9), and a new
"Proxy contract" section in `scs/README.md` documenting
`scripts/8_proxyChangeImplContract.ts <proxyId> <newImplementationId> [migrationDataHex]`.
No proto edits, no migrations, no gRPC/REST surface change, no signing or error
string changes.

**Watch item:** the `api` image jumps four point releases (0.7.6→0.7.10) with no
corresponding source diff in this repo — those builds come from a separate
pipeline. If a wire change shipped inside those builds it would not be visible
in `my-prism-backend`'s commit log; re-verify against the deployed API if
unexplained protobuf drift appears.



**No wire changes.** The diff `e1be389..5724668` touches only `scs/`: a new
`scs/contracts/Proxy.sol` (ERC-1967 proxy with admin-only `upgrade` /
`changeAdmin` and delegatecall init), a new
`scs/scripts/8_proxyChangeImplContract.ts`, deploy/compile script tweaks, and
`@noble/secp256k1` / `@openzeppelin/contracts` / `@walletconnect/types` bumps.
No proto edits, no migrations, no gRPC/REST surface change — nothing to
regenerate.

**Frontend impact (defensive):** `components/AllowanceManager.tsx` previously
picked the *highest* Hedera entity ID among all contracts seen on markets as
the default allowance spender, assuming "newest deployment = highest ID". Under
the proxy that assumption inverts — the proxy keeps a lower, stable ID while
upgraded implementations get higher IDs behind it, and users must approve the
proxy, never an implementation. The picker now defaults to
`smartContractIds[network]` (the backend-published address from
`MacroMetadata`) and lists it first, with the highest-ID sort retained only as
an ordering for the remaining historical contracts / as a fallback when the
backend publishes nothing. Per-market approvals are unaffected: trading already
approves the exact `market.smart_contract_id`.

**Backend ask:** once the proxy is live, `MacroMetadata.smart_contract_ids` and
`markets.smart_contract_id` must carry the **proxy** address, not the
implementation address.


## Rewards surface coverage audit (frontend, no backend change)

Audit of every reward capability on the wire vs. what `/rewards` renders:

| Wire surface | Status |
| --- | --- |
| `GetPrism.prism_balance` / `.prism_unredeemed` | shown (hero: "$PRSM Balance" / "Vesting $PRSM") |
| `GetPrism.prism_redeemable` | **now shown** (hero: "Redeemable $PRSM") |
| `GetLOMrewardsByMarketId` → `distance`/`size`/`duration`/`lom_score`/`created_at` | all shown — `size` is a new sortable column, `created_at` drives the "Last scoring run" age in the hero |
| `GetLOMrewardsByAccountId` | per-market "Your Score" column **plus** a new "Your LOM Score" hero total |
| `MarketResponse.is_lom_enabled` | eligible-markets filter (unchanged) |
| `ClaimPrism` / `SendEntitledPrism` | still backend stubs — no claim UI; the hero instead notes that on-chain claiming is not enabled yet |

There is no `GetLomLeaderboard` RPC, so the new **Top miners** table folds
`LOMreward.account_id` across the per-market rows already fetched for the
eligible-markets table and highlights the connected account's own row.

## Sync notes for `e1be389` (rewards campaign + settlement fix)


**No wire changes.** The only proto diff is a comment clarification on
`CreateOrderRequestClob.qty_rem` (in match notifications it carries the
executed fill quantity; on book orders it is the remaining quantity). Nothing
to regenerate — the frontend does not read `qtyRem` outside `gen/`.

Backend-only changes, for context:
- **Match settlement fix (`hedera.go`)**: settlements now use the actual
  matched fill quantity via `matchedSettlementAmounts` instead of the
  min-clamped original authorization, fixing the "Oversize settlement tuple"
  failure on residual/partial fills. Covered by new e2e
  `6i_residual_multifill_reverse.sh` and `hedera_test.go` unit tests. This
  directly addresses the residual-fill settlement failures seen on testnet.
- **Rewards campaign cron (`cronRewardsCampaign.go`, campaign_id = 2)**:
  per-epoch PRISM allocations for users with matched positions on markets
  resolved in the epoch, written to `prism_rewards`. No new gRPC surface —
  these rewards aggregate into the same `prism_rewards` table that `GetPrism`
  already reads (queries have no `campaign_id` filter), so the existing
  `usePrism()` balances and the Rewards page pick them up with no change.
- **Migration `000059`**: drops `positions.points_awarded_at` (never read by
  the frontend) and adds `GetResolvedMarketsAfter` / `GetPositionsByMarketId*`
  queries used by the new cron.
- `Prism.sol` diff is comment/formatting only — no ABI or behaviour change,
  no contract redeploy implied for the frontend.
- Go/Rust dependency and docker image bumps; e2e scripts refactored onto
  shared helpers.

## Sync notes for `8667b93` (rewards campaigns + LOM vesting schedule)

**No wire changes.** `git diff f8387e00..8667b93 -- '*.proto'` is empty: no new,
renamed or removed messages, fields, RPCs or validation rules. Nothing to
regenerate, no frontend code change required.

Backend-only changes, for context:
- Migration `000058` adds `prism_rewards.campaign_id BIGINT NOT NULL DEFAULT 1`;
  `CreatePrismReward` gained a `campaignID` argument (internal Go signature only).
- New internal `CronRewardsCampaignService` (`cronRewardsCampaign.go`) wired in
  `main.go` under `CRON_STR_REWARDS_CAMPAIGN`. Not exposed over gRPC.
- `cronLOM.go` replaced the flat `LOMrewardsVestingPeriodDays` /
  `LOMrewardsPercentOfTokensForLOMrewards` constants with
  `LOMrewardsAllocationAbsolute = 30_000_000` and a per-year
  `LOMrewardsVestingSchedule` (Y1 8.6M, Y2 7.2M, Y3 5.4M, Y4 4.375M, …).
  The frontend does **not** mirror emission constants — `lib/useLomRewards.ts`
  reads live per-market scores only — so this needs no follow-up. It does
  invalidate the emission figures written in `docs/lom-rewards-api-spec.md`
  (the "10% of 1B supply over 6 years" framing); those are request notes, not
  shipped code.
- `ClaimPrism` / `SendEntitledPrism` are still "Unimplemented" stubs, so the
  rewards-claim UI stays unbuilt (see pending requests below).


## Pending backend requests

Outstanding asks the frontend has filed against `my-prism-backend`. These are
not yet implemented — track here so they aren't lost between sync passes.

- **`ClaimPrism` / `SendEntitledPrism` are stubs.** Both handlers return
  `StdResponse{ message: "Unimplemented: ..." }` and carry
  `// no auth - TODO: implement auth and signature verification`. No rewards
  claim UI can be wired until they land with real auth + signature
  verification (`ClaimPrismRequest` already has the
  `accountId/net/sig/publicKey/keyType` shape used by `CancelOrderRequest`).
- **`getMarkets` has no `pagination` field.** `MatchesResponse`,
  `PositionsResponse` and `PredictionIntentsResponse` carry `PaginationRes`
  (still true as of `f8387e00`), but `MarketsResponse` does not — the frontend has to infer the
  end of the feed from a short page. Please add `Pagination` to
  `MarketsResponse` too.

## Sync notes for `f8387e00` (isLOMenabled + pagination changes)

Wire changes in `api/proto/api.proto`:
- **Additive**: `MarketResponse.is_lom_enabled` (field 21, JSON `isLOMenabled`),
  backed by the new `markets.is_LOM_enabled` column (migration `000057`,
  default `true`). `cronLOM.go` now skips markets where it is false, so those
  markets accrue no LOM rewards.
- **Relaxed**: `LimitOffsetRequest.limit` validation moved `lte: 25` → `lte: 100`.
  The server still clamps to `DB_MAX_ROWS`, and `lib.LIMIT` dropped 100 → 50,
  so a 100-row request may legitimately return 50 rows.
- **Tightened**: `GetMatchesRequest.limit` moved `lte: 1000` → `lte: 100`. No
  frontend call site exceeds 100.
- **Breaking rename**: `Pagination` → `PaginationRes`.
- `MatchedIntents` is commented out in the proto; the frontend never referenced it.
- Admin-only: `CreateMarketv2Request.is_lom_enabled` and
  `PatchMarketRequest.is_lom_enabled` (admin UI lives in a separate project).

Frontend changes:
- `gen/*` regenerated against `f8387e00`.
- `lib/fetchAllPaged.ts` — `PaginationRes` import, `PAGE_LIMIT` raised to 100,
  and end-of-feed detection no longer compares against the *requested* limit.
  The effective page size is learned from `pagination.limit` (or the first
  page's row count) so a server-clamped 50-row page isn't mistaken for the end.
- `src/pages/RewardsPage.tsx` — eligible-markets filter now excludes markets
  with `isLomEnabled === false`.
- Unchanged: `PriceHistoryRequest` call sites (`GraphPriceV2.tsx`,
  `useLastTradePrice.ts`) at `limit: 1000` use a different message;
  `Comments.tsx` at `limit: 100` is within the comments cap.

## Delivered

- **Settlement guard** — shipped in `59c72d49`. `Prism.sol` now uses
  `settlementUsdAbsScaled` (= `|price × qty_live|`) for transfers and events,
  while signature verification still reconstructs the **signed** payload from
  `|price × qtyOrig|`. A pre-submit invariant check in `hedera.go` rejects
  mismatches before they reach the contract. No FE change required; existing
  order preflights already prevent the mismatch path.
- **New testnet contract** — `0.0.9792499` deployed in `59c72d49` (was
  `0.0.9653861`). The Allowance Manager already defaults to the max entity ID,
  so newly-deployed markets automatically bind to the new contract.
- **AI comment moderation** — shipped in `553088c`
  (`api/server/services/comments_moderation.go`). Implementation differs from
  the frontend spec in `docs/comment-moderation-spec.md`: backend returns a
  plain gRPC error (`"comment rejected by moderation: <reason>"`) rather than
  adding `moderation_status` / `moderation_reason` proto fields. Fall-open on
  provider errors. Frontend handles the error string in `components/Comments.tsx`.
- **Comment replay-attack guard** — migration `000050_comments_unique_sig`
  adds a unique constraint on the comment signature. Duplicate submits now
  return a duplicate-key error, surfaced as a friendly toast client-side.

## Sync notes for `8449a838` (pagination)

Wire changes in `api/proto/api.proto`:
- **Breaking**: `LimitOffsetRequest.limit` is now validated `lte: 25`. Requests
  above 25 rows are **rejected** by PGV rather than silently clamped. This hit
  every `getMarkets` call site (100–500) plus the `Login.tsx` diagnostics.
- **Additive**: new `Pagination { limit, offset, total, hasMore, nextOffset }`
  on `MatchesResponse`, `PositionsResponse`, `PredictionIntentsResponse`.

Frontend changes:
- `gen/*` regenerated against the new `api.proto` / `clob.proto`. The RPC
  surface is unchanged; only `Pagination` is new.
- New `lib/fetchAllPaged.ts` — `PAGE_LIMIT = 25` plus a sequential
  limit/offset walker. Sequential on purpose: the gateway 502s on bursts of
  concurrent gRPC-web calls. Uses `pagination.hasMore`/`nextOffset` when
  present and falls back to short-page detection when absent, so it also works
  against an older API.
- Converted `components/Explore.tsx`, `components/WalletMenu.tsx`,
  `components/AllowanceManager.tsx`, `src/pages/RewardsPage.tsx` and
  `lib/usePortfolio.ts` to the paged walker (4 pages for the former 100-row
  callers, 20 for the former 500-row ones).
- `components/Login.tsx` diagnostics dropped to `limit: 25`, single page.
- `PriceHistoryRequest` call sites (`GraphPriceV2.tsx`, `useLastTradePrice.ts`)
  are a different message with no cap — left at `limit: 1000`.
- Explore and the Rewards eligible-markets table now show
  "Showing N of M … (list truncated)" so a capped list is honest.

## Sync notes for `e12e20ce` (August 17)

- **`clob.proto` breaking rename**: `CreateOrderRequestClob.qty` (tag 6) →
  `qty_rem` / json `qtyRem`, "remaining qty internal to the clob".
  `gen/clob.ts` regenerated; the frontend does not read raw CLOB order
  messages, so no call-site change was required.
- **Residual partial-fill fix.** `orderbook.rs` decrements `qty_rem` in place,
  `nats.go` persists it per leg via `UpdatePredictionIntentQtyRem`, and
  `fullyMatchedOrderIndexFromTuple` now marks a leg matched only when its own
  `|qty_rem| <= 1e-9` instead of inferring from `qty_orig`. Migration
  `000051` adds the `qty_rem` column. This is the proper fix for residual sells
  disappearing after a partial fill.
- Frontend follow-up: `lib/pendingSells.ts` TTL cut from 10 min to 90 s. The
  shim stays until residual behaviour is confirmed live on `dev.prism.market`,
  but it should no longer need to mask real state.
- Also backend-only: match-tuple invariant validation and an in-memory
  duplicate-match dedup in `nats.go`. No FE surface.

## Sync notes for `28f58cc2` (Prism Rewards / LOM v2)

Already absorbed in the previous proto regeneration — recorded here for
completeness:
- `CreateMarket` commented out of the service; `CreateMarketv2` is the only
  path (`components/CreateMarket.tsx` already uses it).
- `UserPortfolioResponse.prism_points` / `prism_token_balance` removed;
  replaced by `GetPrism` → `lib/usePrism.ts`.
- `GetLOMrewardsByMarketId` / `GetLOMrewardsByAccountId` → `lib/useLomRewards.ts`.
- LOM scoring rewritten server-side (tiered price-distance / duration weights,
  hourly accrual, `prism_rewards` table replacing `prism_points`). The
  frontend reads live values, so tuning is transparent to it.

`cc7e931a` and `8c832698` are docker image bumps — no FE surface.

## Sync notes for `1fce0091`

Backend-only changes (no proto/wire changes, **no FE code change required**):
- **CLOB now publishes matched quantities** (`clob/src/orderbook.rs`). Both
  sides of a `clob.matches.*` NATS message carry `qty = matched_qty`, while
  `qty_orig` keeps the originally signed size. `hedera.go` derives settlement
  from `min(|qtyYes|, |qtyNo|)` so both slots settle the identical amount, and
  the pre-submit invariant compares that against the signed collateral.
- **Partial-fill bookkeeping** (`nats.go` →
  `fullyMatchedOrderIndexFromTuple`) now decides which order is fully consumed
  from `qty_orig` rather than the (now-matched) `qty`. This fixes residual
  multi-fill orders being incorrectly soft-deleted — previously a partially
  filled larger order could disappear from the book / portfolio. Purely a
  server-side correctness fix; the frontend reads whatever
  `GetAllPredictionIntents` / `GetUserPortfolio` return.
- **New testnet contract `0.0.9891475`** — replaces `0.0.9792499`. The frontend
  does not hardcode contract IDs (`market.smartContractId` per market, max
  active ID in the Allowance Manager), so it binds automatically. Users holding
  an allowance against `0.0.9792499` will need to grant one against the new
  contract for newly created markets — expected behaviour, already handled by
  the Allowance Manager contract picker.
- Infra: docker-compose/image bumps, `localRun.sh`, new `nats_test.go`, and an
  updated `6_residual_multifill_repro.sh` e2e script. No FE surface.

## Sync notes for `59c72d49`

Backend-only changes (no wire/proto changes, no FE code change required):
- **New testnet contract `0.0.9792499`** — replaces `0.0.9653861`. The frontend
  does not hardcode a contract ID; `market.smartContractId` is the per-market
  source of truth, and the Allowance Manager selects the max active ID.
- **Settlement guard in `Prism.sol`** — on-chain transfers/events now use
  `settlementUsdAbsScaled = |price × qty_live|`. Signature verification still
  expects the payload built from `|price × qtyOrig|`, so the backend added a
  pre-submit invariant in `hedera.go` to reject mismatches. Frontend order
  preflights (qty/price validation, available balance, allowance) already keep
  the live/original quantities aligned for normal user orders.
- **Duplicate comment signature error** — the backend now returns a clearer
  gRPC error for duplicate comment signatures. The existing duplicate-key toast
  in `components/Comments.tsx` still catches it; optional polish to map the new
  string explicitly was deferred.
- Infra/docker image bumps and e2e script additions — no FE surface.

## Sync notes for `553088c`

Wire changes in `api/proto/api.proto`:
- **Additive**: `Match` gained `price_usd1` (tag 10, json `priceUsd1`) and
  `price_usd2` (tag 11, json `priceUsd2`) — entry prices for each side of a
  match. Wired into `gen/api.ts` `Match` message. No UI surface yet.

Backend-only changes (no frontend impact):
- New testnet contract `0.0.9653861` with a reentrancy guard on redemption.
  Already the max entity ID the Allowance Manager selects by default.
- New e2e scripts, `extractMetadata.py`, `utils_test.go`.


## Sync notes for `d62ec41f`

Wire changes in `api/proto/api.proto`:
- **Breaking**: `UserPortfolioResponse.matched_prediction_intents` (tag 3) was
  removed. Tags reverted: `prism_points` is now tag 3, `prism_token_balance`
  is now tag 4. Reading a fresh backend response with the old descriptor threw
  `illegal tag: field no 0 wire type 2` because the decoder tried to parse
  `prism_points` (message) using the old map-entry schema for
  `matched_prediction_intents`.
- New RPC: `GetPredictionIntentMatches(GetMatchesRequest) → MatchesResponse`
  exposes per-market fills. `Match` now carries `market_id`, `tx_id1`,
  `tx_id2`, `price_usd`, `qty1`, `qty2`, `created_at`, `tx_hash`.
- `MatchedIntents` now wraps `repeated Match` (was `PredictionIntentResponse`).
- `GetTxHashes` (added in `98c8cf6e`) is retained.

Frontend changes:
- `gen/api.ts` — `UserPortfolioResponse` realigned (dropped
  `matchedPredictionIntents`, retagged `prismPoints=3`, `prismTokenBalance=4`).
  The dead `MatchedIntents` message type is left in place but no longer
  referenced.
- `lib/usePortfolio.ts` — dropped the `matched_prediction_intents` parser;
  `matchedOrders` stays as an empty array for API compatibility with any
  future consumer that pivots to `GetPredictionIntentMatches`.
- `GetPredictionIntentMatches` RPC wiring is deferred until a UI surface
  needs it — no consumer today.

**Frontend synced (prior):** `6a52d55e` (2026-07-10, "Improve e2e robustness, positions filter, bump images")

## Sync notes for `6a52d55e`

## Sync notes for `6a52d55e`

Wire changes:
- `UserPortfolioRequest.market_id` (`optional string`, tag 3) is now honored
  server-side. When set, `open_prediction_intents` and
  `matched_prediction_intents` are filtered to that market before being
  returned. Positions were already looked up per-user; the filter narrows the
  intent lists returned alongside them.
- No response shape changes; no new messages or RPCs.
- Everything else in the commit is e2e scripts (`api/e2e/*.sh`) and docker
  image bumps — no frontend impact.

Frontend status:
- `gen/api.ts` already carried `marketId?: string` on `UserPortfolioRequest`
  (added when we synced `98c8cf6e`), so no regeneration is needed.
- `lib/useMarketPosition.ts` already sends `marketId` on the request — the
  backend previously ignored it, now it actually filters. Effect: smaller
  response payload on the Market detail page, no code change needed.
- `lib/usePortfolio.ts` (global Portfolio page) continues to send no
  `marketId`, so it still gets the full portfolio.

**Frontend synced (prior):** `98c8cf6e` (matched intents tracking)

## Sync notes for `98c8cf6e`

Wire changes in `api/proto/api.proto`:
- `UserPortfolioResponse` adds `map<string, MatchedIntents> matched_prediction_intents = 3`;
  `prism_points` shifts to tag 4, `prism_token_balance` to tag 5.
- New message `MatchedIntents { repeated PredictionIntentResponse matched_prediction_intents = 1 }`.
- New RPC `GetTxHashes(TxIdRequest) returns (TxIdHashesResponse)` with associated
  `TxIdRequest`, `TxHash`, and `TxIdHashesResponse` messages, for Hedera
  transaction-hash lookup (HashScan deep-links).

Frontend updates:
- `gen/api.ts` and `gen/api.client.ts` hand-regenerated to include the new
  types, updated tag numbers on `UserPortfolioResponse`, and the `GetTxHashes`
  RPC. Reflection classes (`$Type`) added for `TxIdRequest`, `MatchedIntents`,
  `TxHash`, `TxIdHashesResponse`.
- `lib/usePortfolio.ts` parses `matched_prediction_intents` into a
  `matchedOrders: OpenOrder[]` list, exposed on the hook return. Bridges the
  UX gap between a fill and the corresponding `PositionInfo` becoming visible.
  No UI surface yet — consumers can render a "Recently Matched" section when
  desired.

## Sync notes for `98c8cf6e`

Wire changes in `api/proto/api.proto`:
- `UserPortfolioResponse` adds `map<string, MatchedIntents> matched_prediction_intents = 3`;
  `prism_points` shifts to tag 4, `prism_token_balance` to tag 5.
- New message `MatchedIntents { repeated PredictionIntentResponse matched_prediction_intents = 1 }`.
- New RPC `GetTxHashes(TxIdRequest) returns (TxIdHashesResponse)` with associated
  `TxIdRequest`, `TxHash`, and `TxIdHashesResponse` messages, for Hedera
  transaction-hash lookup (HashScan deep-links).

Frontend updates:
- `gen/api.ts` and `gen/api.client.ts` hand-regenerated to include the new
  types, updated tag numbers on `UserPortfolioResponse`, and the `GetTxHashes`
  RPC. Reflection classes (`$Type`) added for `TxIdRequest`, `MatchedIntents`,
  `TxHash`, `TxIdHashesResponse`.
- `lib/usePortfolio.ts` parses `matched_prediction_intents` into a
  `matchedOrders: OpenOrder[]` list, exposed on the hook return. Bridges the
  UX gap between a fill and the corresponding `PositionInfo` becoming visible.
  No UI surface yet — consumers can render a "Recently Matched" section when
  desired.

**Frontend synced (prior):** `7228e725` (cancel-sign txId encoding fix)


**Proto types up to:** `66b90827` — `gen/api.ts` `PositionInfo` carries the
weighted-avg / cost-basis / realized-PnL accumulators, and `CancelOrderRequest`
carries the signed-cancel fields. `gen/clob.ts` is unchanged since
`788dd7f5` (`OrderDetail.ps` field 5, `"p"`/`"s"`). Latest regeneration was
external commit `03922b84` — comment reformat on `PositionInfo`, doc comment
on `CancelOrderRequest`, and a validator relax on
`CreateCommentRequest.public_key` from `^(04|03|02)[0-9a-fA-F]{32,256}$` to
`^(04[0-9a-fA-F]{128}|0[23][0-9a-fA-F]{64}|[0-9a-fA-F]{64})$` (also accepts
bare 64-hex Ed25519 keys).

## Sync notes for `7228e725` (cancel-sign txId encoding fix)

Backend `VerifySig` now returns an error when `Hex2utf8(payloadHex)` fails
instead of silently hashing empty bytes, and `CancelPredictionIntent` now
wraps the hyphenated `txId` with `Utf82hex(txId)` before calling `VerifySig`.
Effect: cancel signatures now verify against `keccak256(utf8(txId))` — the
canonical protocol.

**Frontend already aligned** by external commit `03922b84` — flipped
`DEFAULT_CANCEL_PAYLOAD_MODE` from `'empty'` → `'utf8-hyphenated'` in
`lib/signCancel.ts`. The old `'empty'` mode is retained diagnostic-only.

External commit `54beab66` migrated `components/Comments.tsx` onto the same
canonical Hedera sign pattern (sign UTF-8 bytes of `base64(keccak256(utf8(content)))`
via existing `normalizeSignatureBase64` helper).

`auth.go` debug-logging changes (adds `publicKey` / `payloadHex` / `sigBase64`
context) have no frontend surface.



## Sync notes for `0dcdf7bf` (Prism v0.0.9385460)

New testnet smart contract `0.0.9385460` deployed with three safety
invariants. **No FE constant to bump** — `market.smartContractId` is the
per-market source of truth (see `mem://config/token-specs`), so newly-created
markets automatically bind to the new contract while existing markets keep
their original one. No proto / service / CLOB changes in this commit.

### New on-chain revert strings — mapped

| Revert | Where it surfaces | FE mapping |
|---|---|---|
| `"Collateral/qty mismatch"` | `posColToksOnBehalfAtomic` — slot-level `collateralUsdAbsScaled == qtyScaled` invariant. Bubbles through `CreatePredictionIntent`. | `mapServerError` in `lib/trading/useOrderLifecycle.ts` → "Order was rejected on-chain (price/quantity mismatch). Please refresh the book and retry." |
| `"Collateral accounting mismatch"` | `redeem` — new check that `collateralToken.balanceOf(this) >= totalCollateralUsd[marketId]`. | `lib/useRedeem.ts` catch block → "Redemption temporarily unavailable — market collateral is being reconciled. Please retry shortly." |
| `"Collateral transfer failed"` (renamed from `"Transfer failed"`) | `redeem` payout `transfer` to winner. | `lib/useRedeem.ts` catch block → "On-chain transfer failed during redeem. Please retry." |

### Market creation fee routed directly to owner

`createNewMarket` now `transferFrom(msg.sender, owner, marketCreationFeeUsdc)`
instead of pulling the fee into the contract's collateral pool. Market
collateral is now cleanly isolated from protocol fees. **No FE change** —
`RedeemableWinningsNotice` still displays "Net of 2% protocol fee", and the
2%-rake-net payout math in `useRedeem` still holds (rake is deducted at
redeem time, independent of the creation-fee routing).

## Sync notes for `2559a7aa`

Docs (`resources/perp_futures.md`, `Orderbook_generic.md`) + docker-compose
image bumps + trivial `Prism.sol` comment tweak. **No FE surface.**


## Sync notes for `2de4c00f` / `941cd580`

### `CancelPredictionIntent` — new ownership / state guards (`2de4c00f`)

Backend now looks up the intent by `txId` and rejects **before** signature
verification with these strings:

- `no prediction intent found for txId …`
- `accountId … does not own prediction intent …`
- `marketId … does not match prediction intent …`
- `prediction intent … is already cancelled at …`

All four are mapped to friendly toasts in `mapServerError`
(`lib/trading/useOrderLifecycle.ts`).

### `CancelPredictionIntent` sig verify — current backend hashes empty payload

`my-prism-backend@main` currently calls
`lib.VerifySig(&publicKey, txId, sigBase64)` in
`api/server/services/predictionIntent.go::CancelPredictionIntent`. Since `txId`
is a hyphenated UUID, `api/server/lib/sign.go::VerifySig` calls
`Hex2utf8(txId)`, `hex.DecodeString` fails on the `-` byte, and the function
ignores that error before hashing `payload == ""`.

Frontend code in `lib/signCancel.ts` therefore defaults to `empty`: sign the
UTF-8 bytes of `base64(keccak256(empty bytes))`, which is the exact message the
current backend reconstructs.

Important WalletConnect nuance: `lib/cancelOrder.ts` must call
`signer.sign([Buffer.from(messageToSign, 'utf8')])` without
`{ encoding: 'base64' }`. Passing that option makes the Hedera WalletConnect
signer base64-encode the supplied message before sending it to HashPack, so the
wallet signs the wrong message content and the backend returns
`invalid signature`.

### `public_key` validator relaxed (`2de4c00f`)

`CreateCommentRequest.public_key` regex now accepts ECDSA
compressed/uncompressed **and** bare 64-hex Ed25519 (no `02/03/04` prefix).
Looser, not stricter — no FE change.

### `GetUserPortfolio` includes suspended/paused markets (`2de4c00f`)

`services/positions.go` flips `includeSuspendedOrPaused` to `true`. FE
already tolerates this:
- `lib/usePortfolio.ts` skips `GetBook` for paused/resolved markets.
- `components/Portfolio.tsx` filters open orders to active markets.
No code change; visual smoke check only.

### Backend-only changes in `2de4c00f` / `941cd580`

- HCS `LogMarketResolvedEvent` on market resolve.
- DB `GetPredictionIntentByTxId` query + positions insert type-cast fix.
- Envoy / ALB header stripping, dedicated health mux, docker-compose image
  bumps, README submodule guidance.



## Sync notes for `66b90827`

### ⚠ `PositionInfo` field renumber (breaking wire change)

`api.proto` `PositionInfo` was extended and field numbers 6/7 were reassigned.
Failing to regenerate would mean the FE silently parses `avgPrice` as
`costBasis`, displaying USD totals ~50× too small.

```text
old (788dd7f5)                  new (66b90827)
6  double cost_basis_yes   →    6  optional double avg_price_yes_usd  (NEW)
7  double cost_basis_no    →    7  optional double avg_price_no_usd   (NEW)
                                8  optional double cost_basis_yes_usd (renamed/moved)
                                9  optional double cost_basis_no_usd
                                10 optional double realized_pnl_usd   (NEW)
                                11 optional string cost_basis_as_of   (NEW)
```

- `lib/costBasis.ts` — reads `costBasisYesUsd` / `costBasisNoUsd`, prefers
  backend `avgPriceYesUsd` / `avgPriceNoUsd` when present, and passes through
  `realizedPnlUsd`. Keeps the legacy `costBasisYes` / `costBasisNo` field
  names as a transitional fallback while staging rolls.
- `lib/useMarketPosition.ts` — same field migration.
- `lib/usePortfolio.ts` — for resolved positions, prefers backend
  `realizedPnlUsd`; falls back to `payout − totalCost` when null.
- Tests: `lib/costBasis.test.ts` covers backend avg + realized + legacy paths.

### ⚠ `CancelPredictionIntent` is now signature-verified

`CancelOrderRequest` gained five required fields (`net`, `accountId`, `sig`,
`publicKey`, `keyType`). Backend `services/predictionIntent.go::CancelPredictionIntent`
calls `lib.VerifySig(publicKey, txId, sig)`.

- `lib/signCancel.ts` — builds the keccak payload as
  `keccak256(utf8Bytes(txId))` (hyphenated UUIDv7 string, utf8-encoded).
- `lib/cancelOrder.ts` — shared `submitSignedCancel()` helper used by both
  call sites (`lib/trading/useOrderLifecycle.ts` and `components/Portfolio.tsx`).
- `mapServerError` in `useOrderLifecycle.ts` maps the new
  `invalid signature` / `key mismatch` PGV errors to a friendly toast.

**Future backend fix:** change the backend call site to pass the intended
payload representation into `VerifySig` and handle `Hex2utf8` errors. If the
intended payload is UTF-8 `txId`, pass `lib.Utf82hex(txId)`. If the intended
payload is base64 raw UUID bytes, pass `lib.Utf82hex(base64Uuid)`. After that
backend patch ships, flip `DEFAULT_CANCEL_PAYLOAD_MODE` away from `empty`.


### Backend-only changes in `66b90827`
- DB migration `000049_positions_pnl_accumulators` (UP/DOWN, backfill).
- `CancelPredictionIntentNoSigCheck` internal RPC used by cron kickout.
- CLOB Rust deps + `rust-toolchain.toml`, `Market not found → NotFound` (already mapped on FE).
- docker-compose image bumps, proxy entrypoint fix, `scs/contracts/Test.sol` removal.

## Sync notes for `788dd7f5`

- **`PositionInfo.costBasisYes` / `costBasisNo`** — superseded by 66b90827.
- **DB migration `000049_positions_pnl_accumulators`** — backend-only, no FE surface.
- **CLOB / Rust toolchain / docker-compose / proxy changes** — backend-only.

## Sync notes for `7bb88fd7`

- **`MarketResponse.rules`** — wired through Description/Rules tabs on `components/Market.tsx`.
- **`MarketResponse.outcome` (`bool` → `optional int32`)** — consumed by
  `MarketUnavailableNotice` (`0`/`1`/`2`) and `lib/marketStatus.ts`.
- **`MarketResponse.rakePercent`** — typed but not yet displayed; `RedeemableWinningsNotice`
  still hardcodes "2%". Switching to the dynamic field is a follow-up.
- **`PatchMarket` RPC (admin-only)** — intentionally not wired. Admin lives in a
  separate project (see `mem://constraints/admin-feature-exclusion`).
- **New SC event tables (`dao_updated`, `oracle_updated`, `rake_updated`) + outcome
  int migrations** — backend-only, no FE surface.
- **`TESTNET_SMART_CONTRACT_ID` bump** — no FE change; `market.smartContractId` is
  the source of truth per market.

## ✅ Resolved: realized P&L wire ask

Commit `66b90827` shipped `realized_pnl_usd`, `avg_price_yes_usd`,
`avg_price_no_usd`, and `cost_basis_as_of` per the spec in
`docs/cost-basis-and-pnl-spec.md` §5.1. The FE now reads them directly; the
client-side `payout − totalCost` calculation remains as a fallback only when
the backend returns null (legacy/backfilled positions).





## ✅ Resolved: `GetUserPortfolio` regression

The `continue`-on-missing-`WinningsRedeemed`-event bug in
`services/positions.go` is fixed. A DB miss now logs a warning and leaves
`redeemed_at = ""`, so never-redeemed positions are returned correctly and
`usePortfolio.ts` can rely on `PositionInfo.redeemedAt` as designed.

## Known gap — `positions` table not decremented on redeem (interim)

Backend wires `prediction_intents.redeemed_at` via the `WinningsRedeemed`
NATS subscriber and exposes `PositionInfo.redeemed_at`. But the `positions`
table (`n_yes` / `n_no`) is still **not** decremented on redeem, so a
just-redeemed position's share count remains nonzero in subsequent
`GetUserPortfolio` responses until the next on-chain event reconciliation.

Interim fix: `lib/redeemSuppression.ts` keeps a session-local set of
just-redeemed market IDs, populated on successful redeem in `useRedeem.ts`
and consumed by `usePortfolio.ts` to force `redeemableUsd = 0`. Lost on
reload — acceptable until the backend ships position decrement.

## Known: 2% rake on redeem (`93d65164`)

The smart contract now deducts a 2% rake when winners redeem. The
`WinningsRedeemed.amount` event reflects the post-rake payout. No proto
field currently exposes the rake percentage, so any frontend display of
"expected winnings" is pre-rake and ~2% higher than the actual USDC
received. Consider surfacing this in `RedeemableWinningsNotice` once the
backend exposes `rakeBps` (e.g. on `MacroMetadataResponse`).

## New CLOB cancel error mapping (`93d65164`)

CLOB `cancel_order` now returns `Status::not_found` (gRPC code 5) when the
order is already matched / gone, distinct from `Status::internal`. The
frontend's `mapServerError` in `useOrderLifecycle.ts` matches
`/not[\s_-]?found|NOT_FOUND|code = 5/i` and surfaces:
"This order was already matched or cancelled."

## Behaviour fixes in `d464263` (no FE code change required)

- **Winner address lookup is now case-insensitive and `0x`-agnostic**
  (`api/db/queries/sc_events.sql`). Users whose `WinningsRedeemed` event
  was stored with mixed casing will now correctly populate `redeemedAt`,
  so rows drop out of Redeemable Winnings on the next poll without
  relying on `lib/redeemSuppression.ts`.
- **Secondary-order kick-out is live.** Backend cron
  (`cronKickOutUnfunded`) now evicts open secondary sells when the
  on-chain YES/NO token balance drops below the sum of reserved qty.
  Open orders may disappear between portfolio polls; existing 5s
  polling handles this gracefully.
- **CLOB partial-match flag + buy-side sort corrected**
  (`clob/src/orderbook.rs`). Buy orders now hit the lowest ask first;
  partial-match marking in `nats.go` switched from USD-scaled to raw
  qty comparison. No proto/UI impact, but fills on thin books may
  price slightly differently.
- **Smart-contract ID filter removed from event ingestion**
  (`api/server/services/nats.go`). All Prism contracts on a given
  network are now ingested; FE assumption that the active env contract
  is the relevant one remains correct per environment.
- **Hedera `GetUserPositionTokenBalance` query payment fixed** — now
  prefetches `query.GetCost()` and sets `SetQueryPayment` with a
  10k-tinybar buffer. Improves secondary-order validation reliability.

## Optional follow-ups (proto fields available, FE not yet wired)

- **Admin-curated outcome labels & colors** — `MarketResponse.aliasYes`,
  `aliasNo`, `hexColorYes`, `hexColorNo` are populated by the backend when
  set, but the FE still uses default "YES/NO" labels and theme colors.
  Wiring them through `MarketContext` / outcome widgets / Portfolio /
  TradePanel is a follow-up task.
- **`OrderDetail.ps` on book snapshots** — `gen/clob.ts` now exposes
  `bids[n].ps` and `asks[n].ps` (`"p"` primary / `"s"` secondary). No
  consumer wires it yet; could be used to badge resting orders as
  "Closing" in `GraphOrderbook`.

## Backend → Frontend behaviour mirrors

The backend `CreatePredictionIntent` validator rejects orders for several
reasons. The frontend preflights each one so the user gets an instant
inline error before the wallet signing prompt.

| Backend rejection | Frontend preflight | Location |
|---|---|---|
| `order quantity exceeds available liquidity` | Market orders against an empty opposite side are blocked. | `useOrderLifecycle.signOrder` |
| `insufficient position token balance` (sells) | `shares > positionYes\|positionNo` is blocked. | `useOrderLifecycle.signOrder` |
| `reserved secondary YES/NO position tokens` (d464263) | Pass-through; surfaced as "You already have open sell orders reserving these shares." (Preflight TBD — could subtract open secondary intent qty in `useTradingValidation`.) | `mapServerError` |
| `Spender allowance is …` (primary buys) | `amountUsd > spenderAllowanceUsd` disables the button. | `useTradingValidation` |
| `PrimarySecondary invalid` | FE hardcodes `'p'` for buys, `'s'` for sells. | `useOrderLifecycle.generatePredictionIntent` |
| `smart contract not found` | Pass-through; surfaced via `mapServerError`. | `useOrderLifecycle.submitOrder` |
| CLOB cancel `NOT_FOUND` (code 5) | Friendly "already matched or cancelled" toast. | `useOrderLifecycle.cancelPendingOrder` |

If any of these still slip through (e.g. stale book cache), `mapServerError`
in `useOrderLifecycle.ts` converts the raw server string into a clean toast.

## Verifying after a backend bump

1. Pull latest `my-prism-backend`, `git log d464263..HEAD -- api/proto/ clob/proto/ gen/` —
   if empty, no proto regeneration is needed.
2. Skim `api/server/services/*intent*.go` and `clob/src/grpc_service.rs` for
   new validation branches / error statuses and add matching preflights +
   `mapServerError` entries.
3. Update this file's sync commit and re-run the manual checks below.

## Manual smoke checks

- Thin book + market buy larger than depth → toast, no wallet prompt.
- Sell more YES than you hold → toast, no wallet prompt.
- Revoke allowance, place a primary buy → friendly mapped toast (not raw log).
- Cancel a limit order that just matched → "already matched or cancelled" toast.
- Place a secondary sell larger than (held balance − existing open secondary sells)
  on the same side → "You already have open sell orders reserving these shares." toast.
- Confirm `GetBook` payload includes `ps` on each `bids` / `asks` entry.


## Rake (commit `93d65164`)

Prism smart contract now applies a configurable protocol rake on `redeem`:

- Default **2%** (`rakePercentScaled100 = 200`), owner-settable up to 100% via `setRakeScaled100`.
- The rake is transferred to the contract owner; `totalCollateral` and the
  `WinningsRedeemed` event are emitted post-rake.
- `TESTNET_SMART_CONTRACT_ID` bumped to `0.0.9070333` server-side. The frontend
  does not hardcode a contract id — `market.smartContractId` is the source of
  truth per market.

**FE assumption:** backend reports `position.redeemableUsd` already net of the
rake (it mirrors the on-chain event). If that ever changes, adjust the headline
in `components/RedeemableWinningsNotice.tsx` and the on-chain expected payout
math in `useRedeem`.

**UI disclosure:** `RedeemableWinningsNotice` shows a "Net of 2% protocol fee
withheld on redeem." sub-line and a tooltip on the headline total. The "2%"
literal is hardcoded — if the rake becomes variable in production, expose it
through a proto field and source it here.

**Manual QA:**
- Redeem a winning position; on-chain USDC received ≈ 98% of headline figure.
- Row clears from the notice on the next portfolio poll.

## 2026-06-16 — cost_basis_*_usd / realized_pnl_usd unit mismatch

Backend commit `66b90827` added `cost_basis_yes_usd`, `cost_basis_no_usd`, and
`realized_pnl_usd` to `PositionInfo`. The producer currently emits these in raw
USDC base units (×1e6) rather than human USD, while `avg_price_*_usd` (added in
the same commit) is correctly in USD. This caused the Portfolio "Unrealized
P&L" column to show values like `-$5,753,915` for a ~$5.75 position.

**FE workaround (lib/costBasis.ts, lib/usePortfolio.ts):**
- When `avg_price_*_usd` is present, derive `totalCost = qty × avgPrice` and
  ignore `cost_basis_*_usd`.
- Always ignore `realized_pnl_usd`; recompute `payout − totalCost` locally for
  resolved positions.
- Legacy (≤ `788dd7f5`) path still trusts `cost_basis_yes` / `cost_basis_no`.

**Backend follow-up:** divide `cost_basis_*_usd` and `realized_pnl_usd` by 1e6
in the API layer (or rename to `_micro_usd`). Once shipped, remove the
`hasBackendAvg` guard in `deriveCostBasis` and restore the realized-PnL
pass-through in `usePortfolio.ts`.

## 2026-08-17 — clob.proto `qty` → `qty_rem` (no frontend change required)

Backend commit `e12e20ce` renamed field 6 of `CreateOrderRequestClob` from
`qty` to `qty_rem` (wire tag unchanged) and split the matching engine's
bookkeeping into `qty_orig` (signed, immutable) and `qty_rem` (remaining).
`api.proto` only gained comments on `Match.qty1` / `Match.qty2`.

**Impact: none.** `CreateOrderRequestClob` is an internal server↔CLOB message;
this frontend never constructs it (verified — no references outside `gen/`).
Orderbook depth responses (`OrderDetail.qty`) keep their field name and are
still populated from `qty_rem`, so `GraphOrderbook` / `useOrderBookPrice` are
unaffected. `gen/clob.ts` still shows the old `qty` label for field 6; this is
cosmetic drift only and will resolve on the next codegen sync.

`Match.price_usd1` / `price_usd2` (commit `553088ce`) are already present in
`gen/api.ts` — in sync.

## 2026-08-21 — protobuf regeneration (api.proto + clob.proto)

Regenerated `gen/*` from `Amplified-Information/my-prism-backend` (`api/proto`, `clob/proto`).

New in `gen/api.ts` / `gen/api.client.ts`:
- `AccountIdRequest`, `GetMatchesRequest`, `Match` (now the element type of `MatchedIntents`),
  `ClaimPrismRequest`, `PrismResponse`, `LOMreward`, `LOMrewardsResponse`.
- RPCs: `GetPredictionIntentMatches`, `GetPrism`, `ClaimPrism`,
  `GetLOMrewardsByMarketId`, `GetLOMrewardsByAccountId`, `SendEntitledPrism`.

Removed / changed (breaking):
- `UserPortfolioResponse.prism_points` and `.prism_token_balance` are commented out server-side.
  Frontend now reads $PRSM via `GetPrism` (`lib/usePrism.ts`), consumed by
  `components/Balances.tsx` and `src/pages/RewardsPage.tsx`.
- `CreateMarket` RPC deprecated/removed → `components/CreateMarket.tsx` migrated to
  `CreateMarketv2` (image sent as bytes, `category_ids` required 1–5 — picker still TODO).
- `clob.proto` `CreateOrderRequestClob.qty` → `qty_rem` (tag 6). Internal server↔CLOB
  message; not constructed by this app.

Follow-up work (not yet built):
- Category picker + image upload UI for `CreateMarketv2` (currently sends empty `category_ids`).
- Wire `GetLOMrewardsByAccountId` / `GetLOMrewardsByMarketId` into `/rewards` to replace
  the deterministic mock reward metrics.
- `ClaimPrism` / `SendEntitledPrism` claim flow using `prism_redeemable`.

## 2026-09-18 — reward tables restored (public reads)

The backend removed the ADMIN role check from `GetRewardsByMarketId` /
`GetRewardsByAccountId`, so the reads deleted on 2026-09-14 are restored from
git (`260222f2^`):
- `lib/useLomRewards.ts`, `lib/rewardsMath.ts` (+ tests) — full LOM math back.
- `components/Portfolio.tsx` — per-market LOM table and "Your LOM Score" stat.
- `src/pages/RewardsPage.tsx` — per-market score table + Top Miners board.
- `src/pages/RewardsDiagnosticsPage.tsx` — both reward-list checks.

Verified: typecheck clean, 52 tests pass.

**Still open:** the claim flow is not wired. `ClaimPrism` (public, signed:
account_id / net / sig / public_key / key_type) is the only claim RPC on the
public service; `MarkPrismAsClaimableByAccountId` sits on the admin service, so
the frontend cannot mark rewards claimable itself — it reads `prism_redeemable`
from `GetPrism`. `ClaimPrism` signature verification is still a TODO
server-side. Points rewards remain empty
stubs.

## 2026-09-19 — $PRSM claim flow wired to `ClaimPrism`

Frontend additions:
- `lib/claimPrism.ts` — claim signing payload (`utf8(base64(keccak256(utf8("<accountId>:<net>"))))`,
  same shape as cancel-order signing), public-key/keyType normalization, wire
  request builder and friendly error mapping. Unit tested in `lib/claimPrism.test.ts`.
- `lib/useClaimPrism.ts` — signs via `signWithWallet` (5-min wallet window,
  wallet mutex), submits `ClaimPrism`, invalidates the `prism` query.
- `components/ClaimPrismDialog.tsx` — confirm dialog + button, used by
  `src/pages/RewardsPage.tsx` and the Portfolio Rewards tab.
- `/diagnostics/rewards` gained a **read-only** claim preflight (reads `GetPrism`
  and shows the message that would be signed; never calls `ClaimPrism`).

Backend notes (`api/server/services/prismRewards.go` @ `77604f9`):
- `ClaimPrism` pays out `GetTotalUnredeemedPrismRewardsByUser`, i.e. the
  **unredeemed** total — not `prism_redeemable`. The claim UI therefore shows and
  gates on `prism_unredeemed`.
- Signature verification is still a server-side TODO (`// TODO: implement auth and
  signature verification?`). The frontend signs regardless so the payload is
  already correct when verification lands. Until then the claim UI is reachable
  only where `showRewards` is true (non-prod), matching the rewards routes.
- Claim guard requires the account to have the $PRSM token associated; that error
  is mapped to "Associate the $PRSM token in your wallet first".
- `MarkPrismAsClaimableByAccountId` remains on the **admin** service — the
  frontend never calls it.

## Sync point 25fd9bd — PrismV2 integer order protocol

- `gen/*` regenerated. V1 float order fields (`priceUsd`, `qty`, `primarySecondary`, `generatedAt`) are gone from requests, book entries and open intents.
- `lib/prismV2.ts` is the single home for V2 units, `collateralCap`, the authorization struct hash and a legacy-view adapter (`toLegacyOrder` / `toLegacyBook`) that display code uses.
- `lib/prismV2.test.ts` checks the backend reference struct hash `0x29ab…36c0`.
- Orders sign `base64(structHash)` (44 chars); deadline defaults to 1h; `verifyingContract` / `chainId` come from `MacroMetadata.prismV2ProxyAddresses` / `chainIds` (fallback 295/296/297). Signing is refused if no proxy address is published.
- Allowance refresh after submit prefers the network contract (`smartContractIds[net]`, expected to be the proxy). Redeem still targets the market's contract — confirm it is the proxy.
