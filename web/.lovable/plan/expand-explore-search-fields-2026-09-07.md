# Expand /explore search fields

## Goal
The search box on /explore currently matches only the market statement. Searching should also match the market description, rules, and market ID.

## Change
In `components/Explore.tsx`, update the search filter so a query matches when it appears (case-insensitive) in any of:

- `statement` (existing)
- `description`
- `rules`
- `marketId`

All four are plain strings already present on the loaded `MarketResponse` objects (`description` field 10, `rules` field 11 in `gen/api.ts`), so no new API calls are needed — this stays a client-side filter over markets already fetched.

## Behavior details
- Existing behavior unchanged otherwise: empty query shows all, category filter still combines with search, "Showing X of Y" count reflects the widened matches.
- Searching by full or partial market ID will find that market even if its text doesn't match.

## Verification
- Typecheck/build passes.
- In the preview, search for a word that appears only in a market's rules/description and confirm the card appears; search for a market ID and confirm its card appears.
