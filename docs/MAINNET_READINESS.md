# Prism v2 mainnet readiness

This repository is a **mainnet remediation worktree**, not evidence that the system is ready to hold mainnet funds. The v2 contract addresses the principal on-chain design defects identified in the Halborn report and internal review. The API, CLOB schema and Hedera submitter now use only the integer v2 protocol (`AuthorizationV2` and `PrismV2.settle`, see [PRISM_V2_ORDER_PROTOCOL.md](./PRISM_V2_ORDER_PROTOCOL.md)); the v1 order path has been removed. The web and admin clients still have to be ported. Release also requires testnet evidence and an independent re-audit of the final commit.

## Release boundary

Mainnet must use a clean `PrismV2` deployment and v2 authorizations. Do not upgrade the existing testnet proxy in place or accept legacy floating-point orders. Cancel every open v1 order before cutover and require every user to sign a new v2 authorization against the final chain ID and proxy address.

The signed authorization is:

```text
PrismAuthorization(
  uint8 version,
  uint256 chainId,
  address verifyingContract,
  address signer,
  uint128 marketId,
  uint128 txId,
  uint8 side,
  uint8 action,
  uint256 limitYesPrice,
  uint256 qtyShares,
  uint256 collateralCap,
  uint64 deadline
)
```

`version` is `2`. `side` is `YES=0, NO=1`; `action` is `BUY=0, SELL=1`. Price is an integer YES probability on a `1_000_000` scale. Shares and collateral use the collateral token's smallest unit. The signed message is the Hedera prefix `\x19Hedera Signed Message:\n44` followed by the base64 encoding of the 32-byte authorization struct hash.

## Implemented controls

- Complete-set accounting: opposite-side buys escrow exactly one collateral unit per complete set; opposite-side sells merge a set and release exactly one unit.
- Per-market and aggregate reserves, checked against the contract token balance after every settlement and redemption.
- Domain-bound contract authorizations include chain ID, verifying contract, signer, version, deadline, side, action, price, quantity and collateral cap. A matching Go encoder and signing-frame implementation is included for backend integration.
- A signer/transaction nonce is permanently bound to one authorization hash. Cancellations and cumulative partial fills are enforced on chain.
- Match IDs are idempotent on chain. The operator cannot replay a successful match.
- All four supported pairings have explicit accounting: opposite-side buy/buy, opposite-side sell/sell, YES buy/sell and NO buy/sell.
- Market creation cannot overwrite state. Markets can be halted, closed, resolved or voided. Resolution is restricted to the oracle and upgrades/administration to the owner.
- Rake is bounded and snapshotted when the market is created. Void redemption has no rake.
- ERC-20 movement uses `SafeERC20`; proxy initialization is atomic; implementation initializers are disabled; ownership transfer is two-step.
- The API verifies each authorization's signature, chain ID, proxy address, deadline, signer-to-account binding, on-chain market state and funding before accepting it, and persists every signed field.
- The CLOB matches in integer YES price, sizes each fill to the BUY collateral caps and the contract's rounding rule, drops orders near their deadline, and publishes one fill per message with a per-fill message ID.
- Settlement rebuilds both authorizations from the database, recomputes the collateral split, and submits `PrismV2.settle` under a deterministic match ID. A fill is finalized in the database exactly once, in the same transaction as both orders' fill state.
- Market creation and resolution stay in the admin app: the API signs `createMarket`, `resolveMarket` and `voidMarket` with its Hedera key, after checking the chain so a retry never submits twice.
- The order-ingress outbox prevents an accepted database order from disappearing when NATS is unavailable.
- NATS authentication, JetStream persistence and explicit settlement acknowledgements provide redelivery after process or host failure.
- AWS instance roles and security groups are split by service, and deployment polling always checks for a fresh image.

## Required release evidence

Every item below is a hard gate. Attach commands, transaction IDs, dashboards or reports to the release ticket.

- [ ] Pin and review the collateral token address, Hedera chain ID, proxy, implementation, owner, operator, oracle, DAO and rake for the production deployment.
- [ ] Verify the proxy has an explicit Hedera token relationship with the pinned collateral token before enabling trades.
- [ ] **Open decision:** the API signs market creation (owner-only) and resolution (oracle-only), so today the API's key must be the owner, which can also upgrade the contract. Either accept that, or add a separate market-admin role to PrismV2 so the owner can be a multisig as required below.
- [ ] Put owner and oracle administration behind independently controlled multisig accounts. Keep the settlement operator separate and rotateable.
- [ ] Confirm `<NET>_PRISM_V2_PROXY_ADDRESS` equals the address the contract sees as `address(this)` (the mirror node's `evm_address` for the proxy), and that every role address is the account's `msg.sender` address (its EVM alias if it has one).
- [ ] Run `forge fmt --check`, `forge build --sizes`, all unit/fuzz/invariant tests, static analysis and storage-layout comparison on the final commit.
- [ ] Generate a Go authorization hash/message and prove exact equality with Solidity for fixed golden vectors and randomized vectors. (Go now matches independent ethers vectors for the struct hash, signing message, match ID and `settle` calldata in `api/server/lib/settlement_v2_test.go`; the Solidity comparison and randomized vectors remain.)
- [ ] Run API, CLOB, blocknode and migration tests in CI using the production protocol configuration. (The v1 order endpoints and settlement path have been removed.)
- [ ] Test full and partial matches for all four pairings on Hedera testnet with real signatures and the production collateral-token behavior.
- [ ] Test duplicate delivery, NATS restart, API restart, operator timeout, ambiguous transaction receipt, reverted settlement and reconciliation after each failure.
- [ ] Prove that database fill state advances only after an on-chain match is final, and that replaying every message produces no additional transfer.
- [ ] Apply Terraform to a clean staging account, inspect the plan, verify service-to-service reachability and prove unrelated ports are blocked.
- [ ] Enable encrypted automated EBS/database backups, then restore into an isolated environment and compare application-level row counts and checksums.
- [ ] Run load and soak tests at projected peak traffic, including a Hedera slowdown, and set alerts for queue age, pending/failed settlements, reserve mismatch, RPC errors and disk pressure.
- [ ] Complete incident, pause, key-rotation, oracle-dispute and rollback runbooks. Conduct one operator exercise.
- [ ] Obtain an independent re-audit of the final source and deployed bytecode. Resolve every critical/high finding and document accepted lower-severity risks.
- [ ] Freeze the release commit and deploy only images pinned by immutable digest. Verify deployed bytecode and publish addresses and ABIs.

## Four-week execution plan

Week 1 freezes the v2 protocol, replaces the public protobuf/CLOB/Hedera v1 path with integer v2 fields, compiles the complete repository and deploys the clean testnet stack. Week 2 runs end-to-end pairing, replay, failure-injection, migration and infrastructure tests. Week 3 is reserved for the independent re-audit and remediation, while operations completes restore and incident exercises. Week 4 is a release freeze, final regression, signer/order reset, multisig ceremony and staged mainnet deployment.

Four weeks is feasible only with dedicated contract, backend/CLOB, infrastructure and QA/security owners working in parallel, immediate auditor availability, and no major redesign from the re-audit. A critical finding in week 3, failed restore test, unresolved accounting invariant or missing end-to-end v2 client is a launch stop.

## Known boundaries

The web and admin applications are separate submodules and are not present in this source archive. They must be updated to construct, sign and display v2 integer authorizations as specified in [PRISM_V2_ORDER_PROTOCOL.md](./PRISM_V2_ORDER_PROTOCOL.md). Blocknode needs the PrismV2 ABI configured for the proxy so v2 events reach the API. Live AWS resources, Hedera accounts, multisig configuration, production secrets, backups, monitoring destinations and deployed bytecode cannot be validated from this repository.
