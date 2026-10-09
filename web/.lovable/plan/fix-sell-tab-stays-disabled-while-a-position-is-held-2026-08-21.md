# Fix: Sell tab stays disabled while a position is held

## What's happening

The Sell tab in the trade panel is enabled only when `hasPosition` is true. That flag comes from `useMarketPosition(marketId)`, which is true only when `qtyYes > 0 || qtyNo > 0` for this one market. That hook is a separate, market-filtered portfolio fetch — it does not share data with the Portfolio page — so it can report "no position" even when the Portfolio page shows shares.

Three concrete ways it currently returns zero while you actually hold shares:

1. It bails out early unless BOTH `signerZero` and `userAccountInfo` are present. `userAccountInfo` hydrates later than the signer (the same gap already patched in the cancel-order flow), so on a fresh page load the fetch is skipped and never retried.
2. It calls `GetUserPortfolio` with a `marketId` filter and then reads `positions[marketId]`. If the backend ignores the filter or keys the map differently, the lookup misses and the position reads as zero.
3. It only refetches when its dependencies change — there is no refresh after a fill, so a position opened in the current session doesn't unlock Sell until a reload.

The exact cause for this market is not yet confirmed, so step 1 of the work is to confirm it before changing behaviour.

## Plan

1. **Confirm the cause.** Add temporary diagnostics (behind the existing debug-log gate) around the `GetUserPortfolio` call in `useMarketPosition`: whether the fetch was skipped, the returned position map keys vs. the requested `marketId`, and the raw yes/no values. Compare against what the Portfolio page shows for the same market.

2. **Remove the `userAccountInfo` dependency as a hard gate.** When the signer is present but account info isn't, resolve the EVM address on demand (same approach already used in the cancel-order path) instead of silently returning no position.

3. **Make the position lookup resilient.** Read the position by exact `marketId` key, and fall back to a case-insensitive / single-entry match when the filtered response returns one entry under a different key. If the filtered call comes back empty, fall back to the unfiltered portfolio response and select this market from it.

4. **Refresh after activity.** Refetch the position after an order fills or is cancelled, and on a light interval while the market page is open, so Sell unlocks without a reload.

5. **Better disabled state.** Distinguish "still loading your position" from "no position to sell" in the tab's tooltip/appearance, so a pending fetch doesn't look like a permanent lockout.

## Technical notes

- Files touched: `lib/useMarketPosition.ts` (fetch gating, key lookup, fallback, refresh), `components/TradePanel.tsx` (loading vs. no-position tab state, wiring `refreshPosition` to order lifecycle events).
- The per-outcome cap (`availableSellShares = qty − open secondary orders`) stays as is; this change only affects whether the Sell tab itself is reachable.
- No backend or proto changes.
