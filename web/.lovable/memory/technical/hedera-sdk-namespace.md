---
name: Hedera SDK namespace consolidation
description: Direct frontend imports use @hiero-ledger/sdk; @hashgraph/sdk remains only as a hashconnect transitive dependency.
type: technical
---
# Hedera SDK namespace consolidation

## Rule

All direct frontend source imports use `@hiero-ledger/sdk` and `@hiero-ledger/proto`.

- `@hiero-ledger/sdk` is pinned to `2.85.0` (latest stable at the time of writing).
- `@hashgraph/sdk` and `@hashgraph/proto` remain in the dependency tree only because `hashconnect` v3 hard-depends on them.
- Do not add new `import ... from '@hashgraph/sdk'` or `import ... from '@hashgraph/proto'` statements in application code.

## Why

The Hedera SDK migrated from the `@hashgraph` npm scope to `@hiero-ledger`. The project now tracks the canonical namespace, which avoids duplicate class identities, reduces bundle confusion, and keeps us on the actively maintained package.

## How to apply

When you need `LedgerId`, `AccountId`, `ContractExecuteTransaction`, `ContractFunctionParameters`, `ContractId`, or `PublicKey`, import from `@hiero-ledger/sdk`.

`lib/appkit.ts` handles the one remaining boundary: `hashconnect` v3's constructor type declarations still reference `@hashgraph/sdk` LedgerId. The runtime values are identical, so the build uses a cast:

```ts
new HashConnect(
  network as unknown as ConstructorParameters<typeof HashConnect>[0],
  ...
)
```

If `hashconnect` is ever upgraded to a version that natively accepts `@hiero-ledger/sdk` types, remove this cast.

## Verification

Run `rg "from '@hashgraph/sdk'" -g '*.ts' -g '*.tsx' .` from the repo root. It should return no direct application imports. (The package will still exist under `node_modules` because of `hashconnect`.)
