# Audit: incomplete parts of the app

Findings from a full scan of the project, ordered by how visible they are to a visitor.

## Visible to users

1. **Terms of Service page** (`components/Terms.tsx`) — a heading and the words "Coming Soon". No content.
2. **Privacy Policy page** (`components/Privacy.tsx`) — same, only "Coming Soon".
3. **Contact page FAQ** — only two questions ("How do I connect my wallet?", "What tokens are supported?"). No contact form; email/Discord/docs links only.
4. **Connect wallet sheet** — one wallet option is shown greyed out with a "Coming soon" tag (`components/ConnectWalletSheet.tsx`).
5. **"Manage Persona" item in the wallet menu** — present but switched off, marked "disabled for now" (`components/WalletMenu.tsx:361`).
6. **Redeemable winnings notice** — the whole component exists but is commented out of the app (`App.tsx:82`), so users never see the prompt to claim winnings.
7. **Rewards claiming** — the rewards screens show balances and vesting but there is no claim button, because the two backend claim calls are still stubs (noted in `docs/backend-sync.md:61`).
8. **Market creation categories** — markets are created with an empty category list; the category picker was deferred to the admin project (`components/CreateMarket.tsx:312`).
9. **Rewards pages are hidden in production** — `/rewards` and `/diagnostics/rewards` only appear outside production (`components/Routes.tsx`).

## Unfinished code, not user-visible

10. `lib/hedera.ts` — `getActiveMarkets` returns one hardcoded market id and `getAllPositions` returns an empty list; both are marked TODO and are dead placeholders.
11. `lib/usePortfolio.ts:202` — TODO to show a "Close" badge on open orders that are sell-side.
12. `components/Login.tsx:111,134` — TODOs noting that the session token should move to a secure server-set cookie and that logout should also clear it server-side.
13. `src/pages/RewardsPage.tsx` — reward weighting tiers and emission constants are still copied from the backend by hand; the backend read API for them is only a proposal (`docs/lom-rewards-api-spec.md`).
14. `components/GraphOrderbook.tsx:720-780` — two blocks of commented-out cancel-order markup left in place.

## Suggested order of work

If you want these closed out, a sensible sequence is:

1. Write real Terms and Privacy content (needs your legal text).
2. Restore or delete the redeemable-winnings notice — decide which.
3. Remove the dead placeholders: `getActiveMarkets` / `getAllPositions`, the commented orderbook blocks, and the disabled "Manage Persona" item.
4. Expand the Contact FAQ.
5. Leave rewards claiming, the category picker and the LOM config API blocked until the backend lands them.

Tell me which of these to take on and I will turn it into a build plan.
