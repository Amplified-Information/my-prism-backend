# Auth Token Cookie Migration

## Current state (frontend)

The frontend does **not** yet use cookie-based auth. Today:

- The JWT is held in memory with a `sessionStorage` fallback
  (`lib/authToken.ts`). No `localStorage` persistence.
- The token is attached to every authenticated gRPC-Web call as an
  `authorization` metadata header (`grpcClient.ts#authHeaders`).
- The gRPC-Web transport does **not** set `credentials: 'include'`. It
  was tried and reverted because the backend gateway does not yet echo
  the request origin or emit `Access-Control-Allow-Credentials: true`,
  which caused every cross-origin call to fail CORS preflight
  ("Failed to fetch"). See the inline note in `grpcClient.ts`.
- `useCookieAuth` in `lib/authToken.ts` is `false`.

Net effect: cookie-based auth is not active. The `sessionStorage` +
in-memory posture is the current best-effort mitigation against
`localStorage` persistence, but the token is still reachable by
JavaScript running on the page.

## Backend checklist (still pending)

Owned by `Amplified-Information/my-prism-backend`.

1. **Set the cookie on `ApiAuth.VerifyChallenge`** (in addition to, or
   instead of, the current `authorization` response header):
   ```
   Set-Cookie: jwt=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=<ttl>
   ```
2. **Read the cookie** on every authenticated RPC instead of (or as a
   fallback to) the `authorization` gRPC metadata.
3. **CORS**: the gRPC-Web proxy (envoy/nginx) must send
   `Access-Control-Allow-Credentials: true` and an **explicit** origin —
   wildcard `*` is invalid with credentials. This is the blocker that
   forced `credentials: 'include'` to be removed from the transport.
4. **Logout endpoint**: add an RPC (or HTTP route) that responds with
   `Set-Cookie: jwt=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`
   so the client can revoke the cookie.
5. **CSRF**: with `SameSite=Strict` (or `Lax`) the risk is low for the
   trading surface, but consider a double-submit token if any
   cross-site form posts are added later.

## Frontend cutover (once the backend ships)

Two edits, in this order:

1. Re-enable credentialed requests on the gRPC transport in
   `grpcClient.ts`:
   ```ts
   const transport = new GrpcWebFetchTransport({
     baseUrl,
     fetchInit: { credentials: 'include' },
   })
   ```
2. Flip the toggle in `lib/authToken.ts`:
   ```ts
   export const useCookieAuth = true
   ```
   With the flag on, `authHeaders()` stops attaching the `authorization`
   metadata and the browser-managed cookie carries auth on its own.

Optionally remove the in-memory / `sessionStorage` token store once no
code path reads `getToken()` anymore.

## Why we can't finish this on the frontend alone

`HttpOnly` cookies cannot be set or read by JavaScript by definition —
only the server can issue them. Any JS-accessible store (`localStorage`,
`sessionStorage`, IndexedDB, in-memory) leaves the token reachable by
injected scripts. The current `sessionStorage` + in-memory posture
materially reduces blast radius vs. `localStorage` (no cross-tab/device
persistence, no survival past tab close), but the complete fix requires
the backend changes above.
