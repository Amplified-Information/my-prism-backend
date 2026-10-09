# Security Review — prism-front-end

**Date:** 2026-07-15
**Scope:** Full codebase (no pending diff — working tree was clean, so this covers `main` at commit `b8c23df`)
**Result:** No high-confidence (≥80%) exploitable vulnerabilities found.

## Summary

Two focused passes were run in parallel:

1. Wallet / signing / auth flow
2. React components, generated gRPC client code, and infrastructure config

Neither surfaced a concrete, exploitable vulnerability meeting the confidence bar. Findings below are informational/hygiene notes only.

## Areas reviewed

### Wallet / signing / auth flow

Files: `lib/hedera.ts`, `lib/signCancel.ts`, `lib/cancelOrder.ts`, `lib/trading/useOrderLifecycle.ts`, `lib/authToken.ts`, `grpcClient.ts`, `lib/utils.ts`, allowance components (`AllowanceManager.tsx`, `PopupAllowance.tsx`, `GlobalAllowanceSidebar.tsx`), session-timeout logic (`useIdleDisconnect24h.ts`, `useActivityTimeout.ts`, `SessionTimeoutDialog.tsx`), `constants.ts`, `env.ts`.

- Order signatures cover all economically-relevant fields (amount, address, market, tx id) via `assemblePayloadHexForSigning`; the signed hash is re-verified against the payload immediately before submission (`useOrderLifecycle.ts:428-436`) — no TOCTOU gap between sign and submit.
- Cancel-order ownership/market binding is enforced server-side, confirmed via the frontend's own backend-error-mapping table (`useOrderLifecycle.ts:79-84`) matching backend rejection strings — correct trust boundary placement.
- Allowance-grant spender (`smartContractId`) is backend-assigned per market via `getMarkets`; not influenceable from `CreateMarket.tsx`'s client-side submit payload.
- JWT is stored in memory + `sessionStorage` (not `localStorage`), sent only via an explicit `Authorization` header. `credentials: 'include'` is *not* actually wired up in `grpcClient.ts` despite `docs/auth-cookie-migration.md` describing it — so there's no cookie-based CSRF surface today.
- No SSRF/host-confusion: mirror-node/network URLs are built from a fixed suffix + UI-selected enum (`LedgerId`), never from user/query-string input.
- No hardcoded secrets or private key material found. `walletConnectProjectId` is a public client identifier by design, not a secret.

### Components / generated gRPC code / infrastructure

Files: all of `components/`, `src/components/ui/*`, `gen/*.ts`, `i18n/i18n.ts` + locale files, `nginx.conf`, `Dockerfile`, `docker-entrypoint.sh`, `.github/workflows/notify-parent.yml`, `vite.config.ts`.

- Zero uses of `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, `eval`, or `new Function` anywhere in application code (repo-wide grep).
- `i18next` has `escapeValue: false` set, but nothing consumes translated strings via an unsafe sink and the `Trans` component is never used — no injection path exists despite the permissive config.
- No open-redirect surface: routing is handled entirely by React Router; no manual `location.*`/`URLSearchParams` wiring found.
- `nginx.conf` ships a solid CSP (`default-src 'self'`, explicit allowlisted connect/frame sources) plus standard security headers (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`).
- `gen/*.ts` protobuf client code shows no hand-edit markers (`@ts-ignore`, `as any`, `HACK`) suggesting validation was bypassed.

## Informational notes (not vulnerabilities)

| Note | Detail |
|---|---|
| Stale documentation | `docs/auth-cookie-migration.md` describes a `credentials:'include'` cookie flow that isn't actually active in `grpcClient.ts`. Worth correcting the doc, not a security issue. |
| `postMessage` without origin check | `lib/connectWallet.ts` / `lib/walletDetect.ts` broadcast and listen for wallet-extension discovery messages via `window.postMessage(msg, '*')` without validating `event.origin` on the receiving listener. This path only drives cosmetic "wallet detected" UI state, not signing/fund flows, so impact is low — but origin-checking would be a reasonable defense-in-depth addition. |
| Committed binary artifact | `api/main` is a ~29MB unstripped Linux ELF binary committed at the repo root. Scanned its strings for embedded credentials — none found — but this is unusual for a frontend repo and bloats the repository. Worth confirming it's intentional and not an accidentally-committed build artifact. |
| Tracked placeholder config | `.secrets` / `.config*` files are tracked in git but contain only placeholders (e.g. `HTPASSWD=<aws ssm>`), not real credentials. |

## Methodology

- Confirmed no pending diff existed (`git status` clean), so the review covered the full tracked file tree (174 files) rather than a PR diff.
- Checked for tracked secret/config files and validated their contents were placeholders, not live credentials.
- Grepped for common risky sinks (`dangerouslySetInnerHTML`, `eval`, `innerHTML`, `postMessage`, `localStorage`, `window.open`, etc.) to scope deeper manual review.
- Ran two parallel deep-dive passes: one over wallet/signing/auth-critical paths, one over UI components, generated client code, and infra config.
- Applied standard exclusions: DoS/resource exhaustion, client-side-only authorization gaps (backend is the trust boundary), theoretical issues below 80% confidence, dependency-version issues, and findings in test files or docs.
