# Prism V2 Staging Deployment Guide

## Purpose

This runbook explains how to deploy Prism V2 to Hedera testnet and connect it to an isolated AWS environment served at `staging.prism.market`.

The API and CLOB now speak only the V2 order protocol ([PRISM_V2_ORDER_PROTOCOL.md](./PRISM_V2_ORDER_PROTOCOL.md)) and settle through `PrismV2.settle`. The V1 order and settlement path has been removed. **The web and admin apps must ship their V2 clients before staging can take orders**: until then the API rejects every order they send.

The request path will be:

```text
staging.prism.market
        |
        v
Route 53 -> AWS ALB -> proxy/web/API
                            |
                            v
                    Hedera testnet
                            |
                            v
                    Prism V2 proxy
```

`staging.prism.market` does not connect directly to the contract. The backend connects to Hedera and submits transactions to the V2 proxy.

## 1. Prepare the Hedera testnet deployment

The following values are required:

```bash
HEDERA_NETWORK_SELECTED=testnet
TESTNET_HEDERA_OPERATOR_ID=0.0.x
TESTNET_HEDERA_OPERATOR_KEY_TYPE=ecdsa # or ed25519
TESTNET_USDC_ADDRESS=0.0.429274        # confirm this is the intended test token

TESTNET_PRISM_V2_OWNER_ID=0.0.x
TESTNET_PRISM_V2_OPERATOR_ID=0.0.x
TESTNET_PRISM_V2_ORACLE_ID=0.0.x
TESTNET_PRISM_V2_DAO_ID=0.0.x
TESTNET_PRISM_V2_RAKE_BPS=200
```

Use separate accounts for the following responsibilities:

- **Owner:** Controls UUPS upgrades. Do not store this key on an application server.
- **Operator:** Submits settlements. The operator key belongs in the staging AWS secret namespace.
- **Oracle:** Resolves and voids markets.
- **DAO:** Receives protocol fees.
- **Deployment payer:** Pays for contract deployment and must have sufficient testnet HBAR.

Never send or commit private keys. The deployment operator key can be entered without placing it in shell history:

```bash
read -rsp "Testnet deployment key: " TESTNET_HEDERA_OPERATOR_KEY
echo
export TESTNET_HEDERA_OPERATOR_KEY
```

## 2. Compile and deploy Prism V2

From the repository:

```bash
cd "/path/to/prism-mainnet-ready/scs"

npm ci
solc --version
```

Use Solidity `0.8.30`, matching `PrismV2.sol`.

Export the non-secret deployment configuration:

```bash
export HEDERA_NETWORK_SELECTED=testnet
export TESTNET_HEDERA_OPERATOR_ID="0.0.x"
export TESTNET_HEDERA_OPERATOR_KEY_TYPE="ecdsa"
export TESTNET_USDC_ADDRESS="0.0.429274"

export TESTNET_PRISM_V2_OWNER_ID="0.0.x"
export TESTNET_PRISM_V2_OPERATOR_ID="0.0.x"
export TESTNET_PRISM_V2_ORACLE_ID="0.0.x"
export TESTNET_PRISM_V2_DAO_ID="0.0.x"
export TESTNET_PRISM_V2_RAKE_BPS="200"
```

The Hedera deployment operator must be the configured V2 owner. The deployment uses
that authority to associate the proxy account with USDC immediately after creation.

Deploy the implementation and proxy:

```bash
cd scripts

./0_compile.sh PrismV2
./0_compile.sh Proxy
npx tsx 0_deploy_v2.ts | tee /tmp/prism-v2-testnet-deployment.json
```

The deployment script performs the following operations:

1. Deploys the Prism V2 implementation.
2. Deploys the ERC-1967 proxy.
3. Initializes the proxy atomically through its constructor.
4. Calls the owner-only collateral association function on the proxy.
5. Queries Hedera contract information and requires the expected USDC relationship.
6. Reads back the collateral, owner, operator, oracle, DAO, and rake.
7. Produces `verified: true` only when every post-deployment check passes.

Preserve the resulting deployment record:

```json
{
  "implementationId": "0.0.x",
  "implementationAddress": "0x...",
  "proxyId": "0.0.y",
  "proxyAddress": "0x...",
  "collateralId": "0.0.429274",
  "collateralAssociated": true,
  "verified": true
}
```

Use the **proxy ID and proxy address** throughout the application. Do not configure the application with the implementation ID or implementation address.

Hedera testnet uses EVM chain ID `296`. Every V2 signed order must bind both chain ID `296` and the proxy EVM address as `verifyingContract`.

Reference: [Hedera Hardhat and Ethers.js documentation](https://docs.hedera.com/hedera/tutorials/smart-contracts/hscs-workshop/hardhat)

## 3. Configure the application for Prism V2

The API and CLOB integration is in this repository:

- The API accepts signed V2 authorizations, verifies the signature, domain, funding and on-chain market state, and persists every signed field.
- Orders flow through the outbox, NATS and the CLOB as integers. The CLOB matches in YES price, caps fills to each BUY's collateral cap and the contract's rounding, and publishes one `clob.matches.settle` message per fill.
- The API settles each fill with `PrismV2.settle`, using a deterministic match ID checked against `executedMatches`, and finalizes the fill in the database exactly once.
- Market creation and resolution work as before: the admin app calls the API, and the API signs `createMarket`, `resolveMarket` or `voidMarket` on PrismV2.
- Migration `000061` adds the V2 columns and closes any V1 orders still open.

Still required before staging can trade:

- **Web and admin apps:** construct and sign V2 authorizations as specified in [PRISM_V2_ORDER_PROTOCOL.md](./PRISM_V2_ORDER_PROTOCOL.md). Users approve USDC to the proxy, and redeem from it.
- **Blocknode:** no code change, but set `ABI_TESTNET_<proxy id with underscores>` to the PrismV2 ABI so V2 events (`MarketStateChanged`, `Redeemed`, `AuthorizationFilled`, `MatchSettled`, …) reach the API.
- **API account roles:** the API signs settlement, market creation and resolution with `TESTNET_HEDERA_OPERATOR_ID/KEY`, so that account must be the contract's operator, owner and oracle. The current `api/.config` uses `0.0.7090546`, while `scs/.config` gives all the roles to `0.0.5852902`. Either run the API as `0.0.5852902`, or deploy with the API's account in those roles.

The staging contract configuration:

```bash
HEDERA_NETWORK_SELECTED=testnet
AVAILABLE_NETWORKS=testnet
AVAILABLE_NETWORKS_ADMIN=testnet

TESTNET_SMART_CONTRACT_ID=0.0.y                 # the proxy contract ID
TESTNET_PRISM_V2_PROXY_ADDRESS=<40 hex chars>   # the proxy EVM address users sign as verifyingContract
TESTNET_USDC_ADDRESS=0.0.429274
# TESTNET_CHAIN_ID=296                          # optional; 296 is the default
```

`TESTNET_SMART_CONTRACT_ID` must contain the **proxy contract ID**. Take `TESTNET_PRISM_V2_PROXY_ADDRESS` from the mirror node's `evm_address` for the proxy, because that is what `address(this)` returns on chain. The API logs a warning at startup for any network in `AVAILABLE_NETWORKS` without a complete configuration, and refuses orders on it.

## 4. Create an isolated AWS staging environment

Create separate staging resources with a unique `staging` name or tag:

- Dedicated Terraform state, encryption, versioning, and state locking.
- Separate VPC, public and private subnets, security groups, route tables, internet gateway, and NAT gateway.
- Separate Application Load Balancer and target group.
- Separate EC2 instances for the proxy, application, and data tiers.
- New encrypted EBS database volume. Do not attach a dev, UAT, or production volume.
- Separate S3 deployment bucket or strictly isolated staging prefix.
- SSM parameters under `/staging/*`.
- CloudWatch log group `/prism/staging` with retention and alarms.
- ACM certificate covering both:
  - `staging.prism.market`
  - `*.staging.prism.market`
- Route 53 aliases pointing the staging names to the staging ALB.

Do not reuse development, UAT, or production databases, secrets, IAM roles, or Terraform state.

See [`STAGING_V2_AWS_CHECKLIST.md`](./STAGING_V2_AWS_CHECKLIST.md) for the detailed infrastructure and information checklist.

## 5. Store staging secrets

Create the following AWS SSM `SecureString` parameters, plus any optional parameters required by enabled staging features:

```text
/staging/DB_PWORD
/staging/NATS_USER
/staging/NATS_PASSWORD
/staging/REDIS_PASSWORD
/staging/JWT_SECRET
/staging/TESTNET_HEDERA_OPERATOR_KEY
/staging/READ_GHCR
```

If rewards or email are enabled, also create:

```text
/staging/TESTNET_PRISM_TOKEN_HOT_PAYER_KEY
/staging/SMTP_PWORD
```

The key stored under `/staging/TESTNET_HEDERA_OPERATOR_KEY` must belong to the V2 settlement **operator**, not the upgrade owner.

The staging instance roles must be restricted to `/staging/*` and must not be able to read `/dev/*`, `/uat/*`, or `/prod/*`.

## 6. Connect GitHub Actions to staging AWS

Create a protected GitHub Environment named `staging`.

Create an AWS OIDC deployment role restricted to the repository and environment:

```text
repo:PrismMarketLabs/prism-mainnet-ready:environment:staging
```

This allows GitHub Actions to receive short-lived AWS credentials rather than storing long-lived AWS access keys in GitHub.

Add these non-secret variables to the `staging` GitHub Environment:

```text
AWS_REGION
AWS_ROLE_ARN
TF_STATE_BUCKET
DEPLOYMENT_BUCKET
```

The deployment workflow must include:

```yaml
permissions:
  contents: read
  id-token: write

jobs:
  deploy:
    environment: staging
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: ${{ vars.AWS_REGION }}
```

References:

- [GitHub OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc)
- [AWS guidance for GitHub OIDC roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html)

## 7. Fix GitHub Container Registry permissions

The smart contract workflow passes. Application image builds currently reach GitHub Container Registry and fail with:

```text
permission_denied: write_package
```

For every existing Prism package, including `api`, `clob`, `blocknode`, `db`, `eventbus`, `proxy`, `redis`, `modsec`, and the web packages:

1. Open the package under the `PrismMarketLabs` organization.
2. Open **Package settings**.
3. Locate **Manage Actions access**.
4. Add `PrismMarketLabs/prism-mainnet-ready`.
5. Grant the repository **Write** access.

The organization Actions settings must also permit read and write workflow access.

Rerun the workflows after changing package access. Deploy container images by commit SHA or digest. Do not deploy the mutable `latest` tag.

## 8. Deployment order

Use this sequence:

1. Complete and test the V2 web and admin integration, and configure the blocknode ABI.
2. Make all GitHub checks pass.
3. Publish commit-SHA-tagged container images.
4. Deploy and verify Prism V2 on Hedera testnet.
5. Apply the isolated staging Terraform stack.
6. Populate the `/staging/*` SSM parameters.
7. Upload staging Compose, configuration, and bootstrap artifacts to the staging deployment bucket.
8. Start PostgreSQL, Redis, and NATS.
9. Run database migrations against the empty staging database.
10. Start blocknode, API, and CLOB.
11. Start the proxy and web services.
12. Confirm that all ALB health checks pass.
13. Point the Route 53 aliases for `staging.prism.market` at the staging ALB.
14. Run the V2 end-to-end validation suite.

## 9. Required end-to-end validation

Validate the complete V2 lifecycle:

1. Create a market in the admin app.
2. Construct and sign two V2 authorizations.
3. Match and settle the orders.
4. Partially fill an authorization, then fill its permitted remainder.
5. Confirm that a replayed match fails.
6. Confirm that overfilling fails.
7. Confirm that an expired authorization fails.
8. Confirm that a signature for the wrong chain fails.
9. Confirm that a signature for the wrong proxy address fails.
10. Resolve the market.
11. Redeem positions.
12. Reconcile balances and events across the contract, API, database, CLOB, and blocknode.

Also verify:

- Staging IAM roles cannot read non-staging parameters.
- No staging host can attach a non-staging EBS volume.
- The Terraform plan contains only staging resources.
- GitHub uses short-lived AWS OIDC credentials.
- Every deployed image uses an immutable SHA tag or digest.
- The legacy V1 path cannot reach the V2 contract.
- The chain ID and proxy address in every authorization match the deployed contract.
- Backup restore, instance replacement, secret rotation, and image rollback work as documented.

## Current critical path

The contract, API and CLOB are ready for a testnet deployment once the Hedera payer and role IDs are available. The remaining critical work is the V2 web and admin clients and the isolated AWS staging definitions.
