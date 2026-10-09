# Rewards API testing: offline tests + live diagnostics page

Two separate ways to check the three rewards data sources (`GetPrism`, LOM rewards by account, LOM rewards by market):

1. Offline tests that run with the project's test command and never touch the network.
2. A hidden diagnostics page inside the app that calls the real backend and shows, per endpoint, whether it responded, how long it took, how many rows came back, and a small sample.

## Offline tests

New file `lib/useLomRewards.test.ts` plus `lib/usePrism.test.ts`, using the existing vitest setup (`vitest.config.ts` already includes `lib/**/*.test.ts`).

Covered behaviour, with the gRPC client mocked:
- Market aggregation: total score, distinct participants, score-weighted distance/size/duration, most recent scored timestamp.
- Fallback to a plain mean when every score is zero, and the empty-rows case.
- Account rows grouped per market (`rowsByMarket`, `lastScoredAtByMarket`).
- Leaderboard ordering and per-miner market counts.
- `$PRSM` balances mapping: balance, vesting (unredeemed), redeemable, including missing-field defaults.
- Error path: a failing RPC leaves empty results rather than throwing.

Where the aggregation logic currently lives inside the hook file as non-exported helpers, it gets exported (no behaviour change) so it can be tested directly without rendering React.

## Live diagnostics page

New route `/diagnostics/rewards`, gated exactly like `/rewards` (hidden in production, using the same `showRewards` flag). Not linked from any menu.

Contents:
- A "Run checks" button; nothing fires automatically on load.
- One row per endpoint: name, status (pass / empty / failed), response time, row count, and an expandable raw sample of the first few records.
- The account-scoped checks use the connected wallet; if no wallet is connected they show as skipped with a short note instead of failing.
- The market-scoped check uses a market ID field, pre-filled with the first market returned by the market list.
- A copy-to-clipboard button that dumps the whole result set as text for pasting into a bug report.

## Technical notes

- Reuses `apiClient` and `authHeaders` from `grpcClient.ts`; no new transport, no new endpoints, no changes to `gen/*`.
- Diagnostics page lives at `src/pages/RewardsDiagnosticsPage.tsx`; route added in `components/Routes.tsx` next to the existing rewards route.
- Checks call the RPCs directly rather than through the hooks, so a hook-level bug cannot mask a backend-level one.
- Styling follows the existing cosmic dark theme tokens and the table patterns already used on the rewards page.
- No changes to `RewardsPage.tsx`, `Portfolio.tsx`, or any trading/signing code.
