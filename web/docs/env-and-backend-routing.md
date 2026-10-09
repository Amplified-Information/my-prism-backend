# Environment & Backend Routing

`env.ts` is the single source of truth for environment detection and gRPC backend URL selection. All env / host-conditional code MUST import from it. Do **not** re-sniff `window.location.hostname` elsewhere, and do not reintroduce `isLovable` / `isAmplified` / `prismBackendByHost` patterns.

## Exports (`env.ts`)

- `env: 'prod' | 'uat' | 'dev' | 'local'` — derived from `HOST_ENV` (exact-match table) with `PREVIEW_HOST_SUFFIXES` falling back to `'dev'` and everything else to `'local'`.
- `isSameOriginEnv` — `true` for known `prism.market` hosts (they reach the backend same-origin via nginx reverse proxy).
- `CROSS_ORIGIN_BACKEND[env]` — fallback URL used only by preview hosts (Lovable / Amplified).

## `grpcClient.ts` routing priority

1. `import.meta.env.VITE_GRPC_BASE_URL` — build-time ops escape hatch.
2. `'/'` when `isSameOriginEnv` — nginx proxies to the matching backend; **no CORS needed**.
3. `CROSS_ORIGIN_BACKEND[env]` — for preview hosts, which **do** require backend CORS allowlisting.

## Adding a new prism.market domain

One line in `HOST_ENV`. Nothing else.

## Why this exists

Previously two parallel mechanisms (`prismBackendByHost` map + chained ternary on `isLovable` / `isAmplified`) drifted and coupled frontend code to backend CORS gaps. Same-origin routing via nginx removes the CORS dependency for prod traffic entirely.

See also: [cors-architecture.md](./cors-architecture.md).
