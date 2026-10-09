# Backend sync: `5724668` — upgradeable contract proxy

Only one backend commit landed since our sync point `e1be389`:

- **`5724668` "Add ERC1967 Proxy and upgrade scripts"** (Sep 6, 2026)

It touches only the smart-contract folder: a new `Proxy.sol` (ERC-1967, admin-only
`upgrade` / `changeAdmin`), a new script to point the proxy at a new implementation,
deploy/compile script tweaks, and dependency bumps. There are **no proto changes, no
database migrations, and no gRPC/REST surface changes**, so nothing needs regenerating.

## What this means for the app

Today the app assumes each new contract deployment produces a **new, higher Hedera
entity ID**, and the allowance picker sorts contracts by that number to guess the
"current" one. With a proxy in front, the address users approve stops changing: the
proxy keeps its ID while upgraded implementations get higher IDs behind it. Once the
backend starts reporting the proxy address, "highest ID wins" can pick an
implementation address that no one should ever approve.

## Proposed changes

### 1. Trust the backend's configured contract first
In the allowance picker, make the network's configured contract (the one the backend
publishes in its network config) the default selection, instead of the
highest-numbered ID. The highest-ID sort stays only as a fallback when the backend has
not published one. This is correct both today and after the proxy rollout.

Ordering of the dropdown list also changes: configured contract first, then the
remaining contracts, still newest-first, so people with old approvals can still find them.

### 2. Keep per-market approvals exact
No change needed: trading already asks for approval against the specific contract
recorded on the market being traded, which stays right whether that address is a proxy
or a direct deployment.

### 3. Documentation
Update the backend sync notes to record `5724668`: no wire changes, and a note that the
contract address may become stable across upgrades once the proxy is live, plus the
follow-up ask that the backend publish the proxy address (not the implementation) in its
network config.

## Technical notes

- Files touched: `components/AllowanceManager.tsx` (default/ordering of
  `contractOptions` and `smartContractId`), `docs/backend-sync.md`.
- `smartContractIds[networkKey]` from `MacroMetadata` is the "configured" value.
- No `gen/*` regeneration, no new RPC calls, no state or data-model changes.
- Existing behaviour preserved: an explicitly requested contract (TradePanel "Manage")
  still wins over the default.

## Out of scope

- Any admin UI for upgrading the proxy (admin lives in a separate project).
- `ClaimPrism` / `SendEntitledPrism` — still backend stubs.
