# CORS Architecture

The frontend does **not** enforce CORS — it only chooses which backend origin to call (`grpcClient.ts`, driven by `env.ts`) and declares the CSP `connect-src` allowlist (`nginx.conf` + `index.html`).

CSP `connect-src` already includes `https://*.prism.market`, so all subdomains are browser-permitted.

Routing is centralized in `env.ts` (see [env-and-backend-routing.md](./env-and-backend-routing.md)). The old `prismBackendByHost` map and `isLovable` / `isAmplified` booleans were removed.

## Effective backend selection

| Frontend host | Backend URL | Cross-origin? |
|---|---|---|
| `prism.market` | `/` (nginx proxy) | No |
| `testnet.prism.market` | `/` (nginx proxy) | No |
| `uat.prism.market` | `/` (nginx proxy) | No |
| `dev.prism.market` | `/` (nginx proxy) | No |
| `testnet.dev.prism.market` | `/` (nginx proxy) | No |
| `*.lovable.app`, `*.lovableproject.com`, `*.lovable.dev` | `CROSS_ORIGIN_BACKEND.dev` | **Yes** |
| `*.prism.amplified.info` | `CROSS_ORIGIN_BACKEND[env]` | **Yes** |

`VITE_GRPC_BASE_URL` (build-time) overrides everything.

## Backend CORS requirement (narrowed)

The gRPC gateway allowlist only needs to cover the **preview-host suffixes** above. The `testnet.*.prism.market` hosts no longer require CORS because they reach the backend same-origin via nginx.

## Nginx requirement

Each `prism.market` host's nginx config MUST reverse-proxy `/clob.*`, `/api.*`, `/grpc.*` paths to the matching backend gateway. Without this, same-origin routing breaks.
