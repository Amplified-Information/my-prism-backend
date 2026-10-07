# Mainnet operations runbook

## Deploy

1. Freeze a reviewed commit and record all container digests.
2. Apply the reviewed Terraform plan to staging, then production. Do not reuse testnet keys or contract addresses.
3. Deploy and verify the `PrismV2` implementation. Construct the proxy with non-empty initializer calldata in the same transaction.
4. Associate the proxy with the pinned collateral token and verify the relationship independently. Never associate only the implementation.
5. Confirm the API's Hedera account holds the owner, oracle and operator roles: it signs market creation, resolution and settlement.
6. Independently compare proxy, implementation, collateral, chain ID, owner, operator, oracle, DAO and rake against the signed release manifest.
7. Configure the API with the proxy contract ID and proxy EVM address (`<NET>_SMART_CONTRACT_ID`, `<NET>_PRISM_V2_PROXY_ADDRESS`) and blocknode with the PrismV2 ABI. Start the data tier first. Confirm PostgreSQL, persistent JetStream and Redis health. Start blocknode, API and CLOB, then the proxy.
8. Submit one bounded canary market and execute all four pairing types with small values. Reconcile contract balances, reserves, positions, matches and database fills before opening traffic.

## Market lifecycle

Markets are managed from the admin app. The API signs each on-chain step with its Hedera key.

1. **Create:** the admin app's Create Market calls the API, which calls `createMarket` with the market's statement and close time, then adds the market to the CLOB and the database.
2. **Pause / suspend:** the admin app's toggles stop the API accepting orders for the market (database only).
3. **Resolve / void:** the admin app's Resolve calls the API, which calls `resolveMarket` (outcome 0 = NO, 1 = YES) or `voidMarket` (outcome 2), then records the outcome and closes the market on the CLOB. `resolveMarket` only succeeds after the market's close time; `voidMarket` can be used early.
4. **Redeem:** users redeem from their wallets. `Redeemed` events mark their orders redeemed.

Both create and resolve check the chain first, so retrying after a later failure (for example a database error) does not submit the transaction twice.

## Settlement incident

Each fill has a row in `matches` with its `match_id` and a `status`: `pending` (recorded), `submitted` (sent to Hedera; `tx_hash` holds the transaction ID), `finalized` (settled; both orders' fill state applied), or `failed` (the last attempt failed and JetStream will retry, up to 20 deliveries). `SELECT match_id, status, attempts, last_error FROM matches WHERE status <> 'finalized'` lists the work in flight.

1. Halt affected markets with the oracle or owner if accounting, signing or matching is suspect.
2. Stop new order admission. Preserve JetStream and database state; do not delete or manually acknowledge pending messages.
3. Compare each non-finalized match ID with `executedMatches(matchId)` and the authoritative Hedera receipt. A redelivered message whose match executed on chain is finalized without resubmission.
4. Redeliver only matches absent on chain. On-chain idempotency makes a duplicate successful match revert without moving funds.
5. Resume after reserve equality, queue age, failed matches and database fill state reconcile and two operators approve the action.

## Key compromise

- Operator: halt admission, rotate `operator`, revoke the old infrastructure secret and reconcile all matches since the last known-good time.
- Oracle: use owner control to halt affected markets and rotate `oracle`; do not resolve until the dispute process finishes.
- Owner/multisig: halt launch or all markets and follow the multisig recovery policy. Never transfer ownership to an unverified address; use the two-step acceptance flow.

## Backup restore test

At least monthly, restore the latest encrypted EBS/database backup into an isolated VPC. Start PostgreSQL and JetStream without application writers, verify schema migrations, count orders/matches/outbox rows, check representative hashes, then replay pending settlement messages against a test contract. Record recovery point and recovery time. A backup is not accepted until this restore succeeds.

## Upgrade

Compile the current and proposed implementations with the same toolchain, compare storage layouts, run the complete invariant suite, and obtain security review. Deploy the implementation, verify bytecode, then have the owner multisig call `upgradeToAndCall` on the proxy (see `scs/UPGRADING.md`). Re-run the canary reconciliation before restoring traffic.
