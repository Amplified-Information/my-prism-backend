# Add a "Rewards" tab to Portfolio

Give each user a personal rewards view inside `/portfolio`, alongside Open Orders, Active Positions and History.

## What the tab shows

Everything comes from data the backend already exposes for the connected account — no new backend work.

1. **$PRSM summary row** (from `GetPrism`):
   - Balance — liquid $PRSM in the wallet
   - Vesting — earned but not yet allocated
   - Redeemable — matured and claimable (shown read-only; the claim RPCs are still backend stubs, so no claim button)
2. **Your total LOM score** — sum of the account's Limit Order Mining rows.
3. **Per-market breakdown table** — one row per market the user has mined:
   - Market (title when known, clickable through to the market page; falls back to the id)
   - Your LOM score for that market
   - Share of that market's total score, when market-level rows are loaded
   - Last scored (relative age, e.g. "42m ago")
   Sortable by score, default highest first.
4. **Empty / disconnected states** — "Connect your wallet" when no signer, and a "No rewards scored yet" state with a link to Explore when the account has no rows.

The tab header carries the same trophy icon and yellow accent used elsewhere for rewards, plus a count badge of scored markets.

## Technical notes

- `components/Portfolio.tsx`: add a fourth `TabsTrigger`/`TabsContent` pair (`value="rewards"`) following the existing Card + skeleton + empty-state pattern. Table body extracted into a small `RewardsList` component in the same file, matching `HoldingsList`/`HistoryList`.
- Data: `lib/usePrism.ts` for the three $PRSM figures and `useLomAccountRewards()` from `lib/useLomRewards.ts` for per-market scores. `useLomAccountRewards` currently returns only `scoreByMarket`/`totalScore`; extend it to also return the raw rows (for `createdAt`) keyed by market so the tab can show freshness — additive, no change to existing consumers.
- Market titles: reuse the market records already resolved by `usePortfolio()`; fall back to a truncated id when a market isn't in that set.
- Reuse the `formatAge` helper currently local to `src/pages/RewardsPage.tsx` by moving it into a shared util so both pages share one implementation.
- Gating: the standalone `/rewards` page is hidden in prod via `showRewards`. The portfolio tab will follow the same flag so prod behaviour stays consistent.
- Strings go through `t('portfolio.rewards.*', 'fallback')` like the other tabs; English fallbacks inline, no other locale files touched.
