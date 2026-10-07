# Upgrading the Prism smart contract

A plain-English guide to how the PrismV2 contract is deployed, administered and upgraded on Hedera.

## Code on Hedera can't be changed

A smart contract is an entity that lives on the Hedera network. It gets an ID like `0.0.9891475`, and it holds two things:

1. **Code**: the compiled contract
2. **Storage**: its data (markets, balances, roles, fills and so on)

The code can never be changed once deployed. The only way to "update" is to deploy new code, which gets a new ID. That would strand the old contract's data and USDC, and break every client that knows its address.

## The fix: a proxy

Prism uses a proxy ([Proxy.sol](contracts/Proxy.sol), contract `PrismProxy`). Think of it as a reception desk:

- **The proxy** is the permanent front door. Its ID and EVM address never change, and **it holds all the data and all the USDC.** Users sign orders for the proxy's address, approve USDC to the proxy, and redeem from the proxy. The API and blocknode only talk to the proxy.
- **The implementation** ([PrismV2.sol](contracts/PrismV2.sol)) is a "brain" the proxy borrows. When a call comes in, the proxy runs PrismV2's code against *its own* storage (`delegatecall`).
- **Upgrading** means deploying a new brain and pointing the proxy at it. The address, data and funds stay in place.

```
Users / API  ──►  PrismProxy (permanent)  ──borrows code from──►  PrismV2 v1 (0.0.BBB)
                  holds data + USDC                               PrismV2 v2 (0.0.CCC) ← after upgrade
```

PrismV2 is a **UUPS** proxy: the upgrade function lives in the implementation and only the contract **owner** can call it. There is no separate proxy admin.

## Roles

| Role | Can | Signed by |
|---|---|---|
| Owner | upgrade; create, halt and resume markets; set operator, oracle, DAO and default rake; transfer ownership | the API's Hedera key, for market creation from the admin app |
| Oracle | halt, resolve and void markets | the API's Hedera key, for resolution from the admin app |
| Operator | call `settle` for matched orders | the API's Hedera key |
| DAO | receives rake | treasury account |

Markets are created and resolved from the admin app, exactly as with V1: the admin app calls the API, and the API signs `createMarket`, `resolveMarket` or `voidMarket` with its Hedera key (`<NET>_HEDERA_OPERATOR_*`). That key must therefore hold the owner, oracle and operator roles.

On mainnet this means a server key can also upgrade the contract. Whether that is acceptable, or whether market administration should get its own role so the owner can be a multisig, is an open decision recorded in `docs/MAINNET_READINESS.md`.

## First deployment

From `scs/scripts`, after `source ../loadEnv.sh <network>` and setting the `<NET>_PRISM_V2_*` role variables:

```bash
./0_compile.sh PrismV2
./0_compile.sh Proxy
npx tsx 0_deploy_v2.ts
```

The script deploys the implementation, deploys the proxy and initializes it in the same transaction, associates the proxy with USDC, then reads every setting back. It prints `verified: true` only if all checks pass.

The deployment account must be the configured owner, because associating USDC is owner-only.

Then configure the application with the **proxy**:

- `<NET>_SMART_CONTRACT_ID` = the proxy contract ID
- `<NET>_PRISM_V2_PROXY_ADDRESS` = the proxy's EVM address, exactly as `address(this)` reports it inside the contract. Confirm it on the mirror node (`/api/v1/contracts/<proxyId>`, field `evm_address`) rather than assuming the `0x0000…` long-zero form the deploy script prints; orders signed for the wrong address are rejected on chain.
- blocknode: `ABI_<NET>_<proxy id with underscores>` = the PrismV2 ABI (`contracts/out/PrismV2.abi`), so its events reach the API.

## Publishing an upgrade

1. **Edit and test** `contracts/PrismV2.sol` (and keep `foundry/src` in sync), then run `forge test`.
2. **Check storage layout** against the deployed version (see the rules below).
3. **Compile and deploy the new implementation:** `./0_compile.sh PrismV2`, then deploy the bytecode. It gets a new ID, for example `0.0.CCC`.
4. **Point the proxy at it.** The owner calls `upgradeToAndCall(newImplementation, data)` on the proxy:
   ```bash
   npx tsx 8_proxyChangeImplContract.ts <proxyId> 0.0.CCC [migrationDataHex]
   ```
   The script signs with the configured operator account, which must be the owner. `migrationDataHex` is an optional call (for example a `reinitializer` function) that runs in the same transaction as the upgrade.
5. **Verify** the ERC-1967 implementation slot on the mirror node, run a canary trade on testnet, and reconcile reserves before reopening traffic.

The API, CLOB and blocknode keep using the proxy, so their configuration doesn't change. Only update the blocknode ABI if the new version adds or changes events.

## Things that can catch you out

### Never reorder or remove storage variables

The proxy's storage is numbered slots. Slot 0 is whatever was declared first. If a new version adds a variable *above* `owner`, it reads `owner` from the wrong slot and you lose control of the contract.

**Rule:** only add new variables after `_reentrancyStatus`, and shrink the `__gap` array by the same number of slots. Never change the type or order of existing variables. Compare `forge inspect PrismV2 storage-layout` for the old and new versions before every upgrade.

### Constructors don't run on the proxy

A constructor writes to the implementation's own storage, never the proxy's. PrismV2 does all its setup in `initialize(...)`, which the proxy calls once at deployment, and its constructor only locks the implementation (`_disableInitializers`). A new version that needs to set fresh state must use a `reinitializer(n)` function passed as `migrationDataHex`, not a constructor.

### Associate USDC with the proxy, not the implementation

Hedera accounts, contracts included, must be associated with a token before they can hold it. The deploy script calls `associateCollateralToken()` on the proxy and checks the result. An upgrade keeps the association, because it belongs to the proxy.

### Protect the owner key

Whoever is the owner can swap in *any* code, including code that drains the USDC. With the API signing market creation, the owner is the API's key, so guard that key accordingly. Ownership changes use the two-step `transferOwnership`/`acceptOwnership` flow, so a mistyped address cannot take control.

### Try it on testnet first

Upgrade on testnet, then check that existing markets, balances and fills still read correctly through the proxy before touching mainnet.
