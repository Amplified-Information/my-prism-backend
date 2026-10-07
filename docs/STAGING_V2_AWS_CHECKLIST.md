# Prism V2 staging environment checklist

Target: an isolated `staging.prism.market` environment in AWS that uses a new
Prism V2 deployment on Hedera testnet. The staging stack must not share compute,
databases, credentials, Terraform state, or application secrets with dev, UAT,
or production.

## Current blockers

1. The API and CLOB use the V2 protocol (see `PRISM_V2_ORDER_PROTOCOL.md`), but
   the web and admin clients still sign V1 orders, which the API now rejects.
2. Blocknode needs `ABI_TESTNET_<proxy id>` set to the PrismV2 ABI so V2 events
   reach the API. The API's testnet operator account must be the contract's
   settlement operator.
3. Environment loaders only accept `local`, `dev`, `uat`, `prod`, and `local2`.
4. There are no `.config.staging` files or `docker-compose-*.staging.yml`
   overrides. The base Compose files reference existing V1 image tags.
5. Terraform state is local and generated environment directories are ignored.
   A staging apply without a dedicated remote backend would be easy to lose or
   accidentally mix with another environment.
6. The deployment workflow uses long-lived AWS access keys and one shared S3
   deployment bucket. Staging should use a GitHub OIDC role and a staging-only
   bucket/prefix.

## Information required from the project owners

### AWS

- AWS account ID and region. Existing templates assume `us-east-1`.
- Route 53 hosted-zone ID for `prism.market` and confirmation that this account
  controls it.
- Whether staging should remain in the existing AWS account or a dedicated
  non-production AWS account. A dedicated account is preferred.
- Approved EC2 sizes and monthly budget. V1 parity uses three instances:
  `staging.proxy`, `staging.monolith`, and `staging.data`.
- A new encrypted EBS volume ID for the staging database. Do not reuse or attach
  a dev/UAT/prod volume.
- ACM certificate ARNs in the ALB region for `staging.prism.market` and
  `*.staging.prism.market`.
- The KMS key to encrypt SSM parameters, EBS, S3, logs, and Terraform state.
- The IAM principal allowed to run the first Terraform bootstrap.

### Hedera Prism V2 deployment

- Network (`testnet` for staging) and numeric chain ID.
- V2 implementation contract ID and EVM address.
- V2 proxy contract ID and EVM address. The proxy address is the
  `verifyingContract` included in every signed order.
- Testnet USDC/collateral token ID, EVM address, and decimals.
- Owner, settlement operator, oracle, and DAO account IDs/EVM addresses.
- Default rake in basis points and market-creation policy.
- Funded Hedera payer/operator account ID, key type, public key, and private key.
- HCS topic ID if the current HCS path remains in use.
- The final V2 ABI generated from the exact audited commit.

### Application and access

- Staging admin users and whether HTTP basic authentication is required.
- Staging sender email/SES identity and SMTP credentials, if email is enabled.
- Team/reviewer responsible for approving staging deployments.
- A GitHub token that can read the private PrismMarketLabs GHCR packages from
  EC2. Store it in staging SSM, not in the repository.
- Decision on local censored-word moderation. If adopted, no OpenAI key is
  required for staging.

## AWS resources to create

Use a unique `staging` name or tag on every resource.

- A dedicated Terraform state bucket and state key, with versioning, encryption,
  public access blocked, and state locking enabled.
- A separate VPC, two public subnets for the ALB, one or more private subnets,
  route tables, an internet gateway, and a NAT gateway. The existing template
  creates these per environment, so overlapping `10.0.0.0/16` CIDRs are safe
  only while the VPCs are not peered.
- A staging ALB, target group, HTTPS listener, and HTTP-to-HTTPS redirect.
- Route 53 aliases for at least `staging.prism.market` and
  `admin.staging.prism.market`. Add testnet/preview subdomains only when the UI
  actually serves them.
- Three staging EC2 instances and instance profiles matching the proxy,
  monolith, and data trust boundaries.
- A new encrypted EBS data volume and an AWS Backup vault/plan for staging.
- A staging deployment bucket such as `prismlabs-deployment-staging`.
- A staging image bucket or a strict `staging/` prefix with an IAM policy that
  cannot write dev/UAT/prod objects.
- CloudWatch log group `/prism/staging`, alarms, retention, and deletion
  protection as appropriate.
- SSM SecureString parameters under `/staging/*`. The instance roles must only
  read `/staging/*` and the one GHCR credential they require.

## GitHub configuration

1. Create a protected GitHub Environment named `staging`.
2. Create an AWS IAM OIDC deployment role restricted to:
   `repo:PrismMarketLabs/prism-mainnet-ready:environment:staging`.
3. Add non-secret environment variables such as `AWS_REGION`,
   `AWS_ROLE_ARN`, `TF_STATE_BUCKET`, and `DEPLOYMENT_BUCKET`.
4. Replace `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in the deployment
   workflow with `aws-actions/configure-aws-credentials` using `role-to-assume`.
5. Give this repository Actions access to each existing private GHCR package,
   or publish V2 images under new package names. Organization Actions workflow
   permissions must allow `packages: write`.
6. Add branch protection requiring the API, CLOB, contract, and infrastructure
   validation checks before staging deployment.
7. Tag images with the commit SHA. Staging Compose overrides must deploy the
   approved SHA, never a mutable `latest` tag.

## Repository changes required

1. Add `staging` to every service's `VALID_ENVS` list.
2. Add non-secret `.config.staging` files for API, CLOB, proxy, DB, NATS,
   Redis, blocknode, and web services.
3. Add `docker-compose-proxy.staging.yml`,
   `docker-compose-monolith.staging.yml`, and
   `docker-compose-data.staging.yml`, with immutable V2 image tags.
4. Add a staging Terraform root with its own backend, EBS volume, certificates,
   deployment bucket, and `domain_name = "staging.prism.market"`.
5. Remove hard-coded Route 53 zone IDs and AWS account-specific resource names
   from the shared module; pass them as variables.
6. Done in this repository: the V2 order endpoint and integer protobuf fields,
   persistence of every signed field, the V2 outbox/NATS/CLOB messages,
   `PrismV2.settle` with deterministic match IDs, V2 market creation and
   resolution signed by the API, and V2 balance reads.
7. Configure blocknode with the PrismV2 ABI for the proxy (no code change).
8. Update the web and admin clients to construct and sign V2 authorizations as
   specified in `PRISM_V2_ORDER_PROTOCOL.md`.
9. Run database migrations on the empty staging database before starting API,
    CLOB, or blocknode.

## Staging secret namespace

Create only the parameters used by enabled staging features:

- `/staging/DB_PWORD`
- `/staging/NATS_USER`
- `/staging/NATS_PASSWORD`
- `/staging/REDIS_PASSWORD`
- `/staging/JWT_SECRET`
- `/staging/TESTNET_HEDERA_OPERATOR_KEY`
- `/staging/TESTNET_PRISM_TOKEN_HOT_PAYER_KEY` if rewards remain enabled
- `/staging/SMTP_PWORD` if email is enabled
- `/staging/READ_GHCR` or a narrowly scoped equivalent

Do not copy production values into the staging namespace. Disable mainnet and
previewnet in `AVAILABLE_NETWORKS`, `AVAILABLE_NETWORKS_ADMIN`, and blocknode
until those networks receive separate V2 deployments.

## Deployment order

1. Make all CI builds green and publish SHA-tagged images.
2. Deploy and initialize Prism V2 on Hedera testnet; verify roles, collateral,
   chain ID, proxy address, and upgrade controls.
3. Bootstrap the remote Terraform backend and apply the staging AWS root.
4. Add the `/staging/*` SSM parameters.
5. Upload staging Compose/config/bootstrap artifacts to the staging bucket.
6. Start data services, run migrations, then start monolith and proxy services.
7. Point Route 53 aliases at the staging ALB after ALB health checks pass.
8. Run an end-to-end test: create market, sign two V2 orders, partially fill,
   settle, reject replay, resolve, redeem, and reconcile API/DB/blocknode state.
9. Test backup restore, instance replacement, secret rotation, and rollback to
   the previous image SHA before treating staging as release-ready.

## Acceptance gates

- No staging IAM role can read `/dev/*`, `/uat/*`, or `/prod/*` parameters.
- No staging host can attach a non-staging EBS volume.
- Terraform plan contains only staging resources.
- CI uses short-lived AWS OIDC credentials.
- All deployed images are referenced by immutable SHA or digest.
- Legacy V1 prediction-intent and settlement paths cannot reach Prism V2.
- Contract proxy address and Hedera chain ID match every signed authorization.
- Replay, overfill, expired authorization, wrong-contract, and wrong-chain tests
  fail closed end to end.
