# Plan: $PRSM claim flow

## Goal
Let a connected user claim their matured $PRSM from the rewards page and the
portfolio Rewards tab, using the newly live backend claim endpoint.

## What the backend gives us
- **Balances** — the existing balance call returns three totals: held, vesting,
  and redeemable (matured). Redeemable is the claimable amount.
- **Claim** — one public call that takes the account, the network, and a wallet
  signature, sends the tokens on Hedera from the project wallet, and marks the
  rewards claimed.
- **Marking rewards claimable** is an admin-only operation and stays outside
  this app — the app only ever reads the redeemable total.

## User flow
1. Rewards page and portfolio Rewards tab show a **Claim $PRSM** button next to
   the Redeemable total. Disabled (with a reason) when: wallet not connected,
   redeemable is zero, or a claim is already in flight.
2. Pressing it opens a confirmation panel showing the amount, the destination
   account, and a note that the tokens arrive on Hedera within a minute.
3. Confirming asks the wallet for one signature over the claim message, then
   sends the claim.
4. On success: a toast with the transaction, balances refresh, redeemable drops
   to zero. On failure: the friendly error mapping already used for orders, and
   the button becomes available again.

## Edge cases
- Wallet must be associated with the $PRSM token; if the backend rejects for
  that reason, show a clear "associate $PRSM in your wallet first" message.
- Wrong network selected vs. the wallet's network — block with an explanation.
- Signature timeout reuses the long signing window used for orders.
- Double-press protection via a single in-flight guard per account.

## Technical notes
- New `lib/useClaimPrism.ts`: mutation calling `apiClient.claimPrism` with
  `{ accountId, net, sig, publicKey, keyType }`, signed through the existing
  wallet signing helpers (same prefix/encoding path as cancel-order signing),
  then invalidating the `prism` query.
- New `components/ClaimPrismDialog.tsx` used by both `src/pages/RewardsPage.tsx`
  and the Portfolio Rewards tab.
- Offline unit tests for the claim payload builder in `lib/rewardsMath.test.ts`
  (or a new `lib/claimPrism.test.ts`), plus a claim check on
  `/diagnostics/rewards` that is read-only (balance only, never fires a claim).

## Blocker
The backend does not yet verify the claim signature (marked TODO in its code).
Recommendation: build behind the existing rewards flag and keep the button
hidden in production until signature verification ships, so an unsigned claim
path is never exposed publicly.
