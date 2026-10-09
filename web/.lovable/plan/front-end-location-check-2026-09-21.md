# Front-end location check

Add a country check that runs in the browser when the site loads, and shows a full-screen "not available in your region" notice instead of the app when the visitor's country is on the restricted list.

Note up front: a browser-side check is advisory. It can be bypassed with a VPN or by disabling the request, so it works as a deterrent and a disclosure, not as a compliance-grade control. If a hard block is needed later, the same country list can be enforced by the server.

## What the visitor sees

- On first load, the app quietly looks up the visitor's country (no prompt, no browser location permission — it is based on their internet connection, not GPS).
- Restricted country: the whole app is replaced by a centered notice — heading "Not available in your region", a short line naming the detected country, and a link to Contact. Header and footer stay visible so the site still looks like Prism.
- Allowed country: nothing changes, no visible delay (the app renders immediately and only swaps to the notice if the lookup comes back restricted).
- Lookup fails or is blocked: the app stays usable (fail-open) and the result is not cached, so it retries next visit.
- The answer is cached in the browser session, so it is one request per visit.

## Restricted list

Kept in one place as an editable list of two-letter country codes. Starting list to confirm: US, GB, SG, AU plus the sanctioned set (IR, KP, SY, CU, RU, BY). Tell me the list you want and I will use exactly that; an empty list disables the block without removing the code.

A dev/preview override is included so the notice can be previewed and so restricted-country testing does not lock you out of dev.

## Technical detail

- New `lib/useGeoCountry.ts`: fetches `https://www.cloudflare.com/cdn-cgi/trace` and parses the `loc=` field (free, no key, no CORS issue); falls back to `https://ipapi.co/json/` once if that fails. 4s timeout via `AbortSignal.timeout`, result stored in `sessionStorage` under a versioned key. Returns `{ country, status: 'loading' | 'ok' | 'error' }`.
- New `constants.ts` entry `RESTRICTED_COUNTRIES: string[]` plus a `geoOverrideCountry` read from `?geo=XX` accepted only when `env !== 'prod'` (uses existing `env` from `env.ts`).
- New `components/GeoBlockNotice.tsx`: presentational notice using existing card/border tokens, the current `Contact` route link, and i18n strings added to `i18n/locales/*/` following the existing key layout.
- `App.tsx`: call the hook, and render `<GeoBlockNotice />` in place of `<Routes />` when blocked; `Header`, `Footer`, `DustParticles` and `MacroMetadata` stay mounted. Wallet, trading and rewards code is untouched — nothing renders when blocked, so no orders can be placed from the UI.
- No backend, protobuf or `gen/*` changes; no new dependency.

## Out of scope

- Server-side enforcement of the same list.
- Recording or reporting blocked visits.
