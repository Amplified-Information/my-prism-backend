# Remove the admin-only rewards endpoints

Both reward-list endpoints require an admin role on the backend, so neither the
per-user nor the per-market reward tables can ever load for a normal user:

- `GetRewardsByAccountId` (a user's own scored rows) — admin only
- `GetRewardsByMarketId` (rewards by market) — admin only

`GetPrism` ($PRSM balance / vesting / redeemable) is **not** admin gated and stays.

So the answer to your question: yes, the by-market endpoint is admin-only too.
Both calls get removed from this project.

## What changes on screen

**Portfolio → Rewards tab** keeps working, but only with data that is actually
available to you: your $PRSM balance, vesting (unredeemed) and redeemable
amounts. The per-market score table (score, distance, size, duration, last
scored) is removed, with a short line explaining detailed per-market rewards
aren't published yet.

**/rewards page** (hidden outside preview) keeps the headline $PRSM figures and
the explanation of how limit-order mining works. The per-market rewards table
and the Top Miners leaderboard are removed, replaced by the same short note.

**Hidden checks page** (`/diagnostics/rewards`) drops the two admin-only checks
and keeps the balance and market-list checks.

Nothing else in the app is touched — trading, portfolio holdings, orders and
the wallet area stay exactly as they are.

## Technical details

- `lib/useLomRewards.ts` deleted; both hooks (`useLomMarketRewards`,
  `useLomAccountRewards`) and their call sites removed.
- `lib/rewardsMath.ts` trimmed to what still has a consumer (`mapPrismResponse`);
  the LOM aggregation helpers (`aggregate`, `buildLeaderboard`,
  `groupRowsByMarket`, `scoreByMarketFrom`, `lastScoredAtByMarketFrom`,
  `latestScoredAt`) and their `MarketLomStats` / `LeaderboardEntry` types go, with
  matching cases dropped from `lib/rewardsMath.test.ts`.
- `components/Portfolio.tsx`: `RewardsList` and the reward-market lookup removed;
  the Rewards tab renders the `usePrism` summary grid plus the note.
- `src/pages/RewardsPage.tsx`: reward table + leaderboard sections removed; hero
  stats stay on `usePrism`. Hand-copied weighting-tier/emission constants are kept
  only where they are pure explanatory copy.
- `src/pages/RewardsDiagnosticsPage.tsx`: the two `GetRewardsBy*` entries removed
  from the check list.
- `gen/*` untouched — the generated RPCs remain available for when the backend
  publishes a non-admin read path.
- `docs/backend-sync.md` and `docs/lom-rewards-api-spec.md` updated to record that
  the frontend no longer calls the admin-gated RPCs and what the backend must
  expose before the tables can return.
- Verification: `npx tsgo --noEmit` and the full Vitest suite.
