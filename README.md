# Hedera-based prediction market

> The v2 mainnet remediation work and mandatory launch gates are documented in [docs/MAINNET_READINESS.md](docs/MAINNET_READINESS.md). The legacy API/CLOB submitter is not yet integrated with v2 and must not be used on mainnet.

This project is divided into a number of folders:

deployable services:

- `clob`: an off-chain CLOB which matches cryptographically signed buy/sell order intents
- `api`: an API backend
- `web`: [`prism-front-end`](https://github.com/PrismMarketLabs/prism-front-end) - the main Lovable web app (Note: this is a git **submodule** to a *separate* front-end repo)
- `web.lp`: a separate landing page [`prism-landing-page-v2`](https://github.com/PrismMarketLabs/prism-landing-page-v2)
- `web.admin`: a separate web app for administrating Prism [`prism-front-end`](https://github.com/PrismMarketLabs/prism-admin) (Note: this is a git **submodule** to a *separate* front-end repo)
- `proxy`: a proxy to marshall traffic
- `modsec`: modsecurity filtering for Prism
- `eventbus`: event bus for pub/sub message communication
- `blocknode`: a node to listen to smart contract events on smart contracts of interest. Fires NATS events.
- `redis`: a general purpose memory cache for use by Prism
- ~~`mw`: middleware for web app (server-side control of preview links across social media platforms)~~

modular components:

- `scs`: on-chain smart contracts
- `infra`: infrastructure-as-code (AWS-orientated)
- `resources`: a version-controlled area to store artifacts, design files, images, etc.
- `scripts`: some general usage scripts

## Prism accountIds on Hedera

Foreach network {previewnet, testnet, mainnet}:

**Accounts:**
- API operator account (NOT multi-sig)
- treasury account (**multi-sig**)
- hot payer account (NOT multi-sig)

// m of n for multi-sig:
- accountId1
- ...
- accountIdN

**Tokens:**
- PRISM token

**Smart contracts:**
- PRISM smart contract (**multi-sig**)
- Vesting contract?
- Payment splitter?
- ???

**HCS topics**
- PRISM hcs


**WIP:**

| network    | operatorAccountId |
| -----------|-------------------|
| testnet    | 0.0.
| mainnet    |



## real-time application observability

https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups

You need to have an AWS account with the correct permissions - reach out to CTO or CEO to gain access

## build status (live):

https://github.com/PrismMarketLabs/prism/actions

![api](https://github.com/PrismMarketLabs/prism/actions/workflows/build-api.yml/badge.svg)
![clob](https://github.com/PrismMarketLabs/prism/actions/workflows/build-clob.yml/badge.svg)
![db](https://github.com/PrismMarketLabs/prism/actions/workflows/build-db.yml/badge.svg)
![eventbus](https://github.com/PrismMarketLabs/prism/actions/workflows/build-eventbus.yml/badge.svg)
![modsec](https://github.com/PrismMarketLabs/prism/actions/workflows/build-modsec.yml/badge.svg)
![mw](https://github.com/PrismMarketLabs/prism/actions/workflows/build-mw.yml/badge.svg)
![proxy](https://github.com/PrismMarketLabs/prism/actions/workflows/build-proxy.yml/badge.svg)
![redis](https://github.com/PrismMarketLabs/prism/actions/workflows/build-redis.yml/badge.svg)
![web](https://github.com/PrismMarketLabs/prism/actions/workflows/build-web__submodule__.yml/badge.svg)
![web.admin](https://github.com/PrismMarketLabs/prism/actions/workflows/build-web.admin__submodule__.yml/badge.svg)
![web.lp](https://github.com/PrismMarketLabs/prism/actions/workflows/build-web.lp__submodule__.yml/badge.svg)

## currently released (live):

Below is a comprehensive and up-to-date (live) view of the version of all services that are currently deployed across the different environments.

To release a new version of a service, follow the release procedure here: https://github.com/PrismMarketLabs/prism?tab=readme-ov-file#release-procedure

`dev`

| [proxy](https://pl-deployment-badges.s3.amazonaws.com/dev/proxy.svg) | [monolith](https://pl-deployment-badges.s3.amazonaws.com/dev/monolith.svg) | [data](https://pl-deployment-badges.s3.amazonaws.com/dev/data.svg) |
|---|---|---|
| ![proxy](https://pl-deployment-badges.s3.amazonaws.com/dev/proxy.svg) | ![monolith](https://pl-deployment-badges.s3.amazonaws.com/dev/monolith.svg) | ![data](https://pl-deployment-badges.s3.amazonaws.com/dev/data.svg) |

<!-- `uat`

| [proxy](https://pl-deployment-badges.s3.amazonaws.com/uat/proxy.svg) | [monolith](https://pl-deployment-badges.s3.amazonaws.com/uat/monolith.svg) | [data](https://pl-deployment-badges.s3.amazonaws.com/uat/data.svg) |
|---|---|---|
| ![proxy](https://pl-deployment-badges.s3.amazonaws.com/uat/proxy.svg) | ![monolith](https://pl-deployment-badges.s3.amazonaws.com/uat/monolith.svg) | ![data](https://pl-deployment-badges.s3.amazonaws.com/uat/data.svg) | -->

`prod`

| [proxy](https://pl-deployment-badges.s3.amazonaws.com/prod/proxy.svg) | [monolith](https://pl-deployment-badges.s3.amazonaws.com/prod/monolith.svg) | [data](https://pl-deployment-badges.s3.amazonaws.com/prod/data.svg) |
|---|---|---|
| ![proxy](https://pl-deployment-badges.s3.amazonaws.com/prod/proxy.svg) | ![monolith](https://pl-deployment-badges.s3.amazonaws.com/prod/monolith.svg) | ![data](https://pl-deployment-badges.s3.amazonaws.com/prod/data.svg) |

## Prism domain names

Access the application at:

| Environment | URI                        | Password? |
|-------------|----------------------------|-----------|
| `local`     | http://prism.local:8090    | Y         |
| `dev`       | https://dev.prism.market   | Y         |
| `uat`       | https://uat.prism.market   | Y         |
| ...         | ...                        |           |
| `prod`      | https://prism.market       | N         |

## Quickstart

Add the following to your /etc/hosts file:

```bash
# see: envoy.tmpl.yaml
127.0.0.1 prism.local
127.0.0.1 admin.prism.local
127.0.0.1 previewnet.prism.local
127.0.0.1 testnet.prism.local
127.0.0.1 mainnet.prism.local
```

```bash
# ensure docker is installed on your machine and `docker compose` is available

# convenience script to start db, eventbus, proxy, blocknode:
./localRun.sh
docker ps

# convenience script to stop db, eventbus, proxy, blocknode:
./localStop.sh
docker ps


###
# Alternatively, run manually:
###
# load all env vars
source ./api/loadEnv.sh local
source ./clob/loadEnv.sh local
source ./db/loadEnv.sh local
source ./eventbus/loadEnv.sh local
source ./proxy/loadEnv.sh local # local2
# source ./web/loadEnv.sh local # note: the web app is zero config

# now do:
docker compose -f docker-compose-proxy.yml up -d
docker compose -f docker-compose-data.yml up -d
docker compose -f docker-compose-monolith.yml up -d
```

## Start web apps

There are 3 web apps:

- `web`
- `web.lp` - landing page
- `web.admin` - admin page

Open a separate tab for each web app:

**web**

`cd web && npm install && npm gen`

`npm run dev`

If required, you can optionally edit `grpcClient.ts` and set the baseUrl to the dev environment. For example: `baseUrl: 'https://dev.prism.market:443'`

**web.lp**

`web.lp && npm gen && npm install`

`npm run dev`

**web.admin**

`npm.admin && npm gen && npm install`

`npm run dev`

Can now access the three web applications at:

| app       | URL                              |
|-----------|----------------------------------|
| web.lp    | http://prism.local:8090/         |
| web       | http://testnet.prism.local:8090/ |
| web.admin | http://admin.prism.local:8090/   |

## Manual start (local development)

To develop the application locally, start up each of the following services (in the order below) in a separate terminal window:

- `db`: see [db/README.md](db/README.md)
- `eventbus`: see [eventbus/README.md](eventbus/README.md)
- `api`: see [api/README.md](api/README.md)
- `clob`: see [clob/README.md](clob/README.md)
- `web`: see [web/README.md](web/README.md)
- `proxy`: see [proxy/README.md](proxy/README.md)

## login to EC2 boxes with SSM

Run the utility script:

`./ec2_instanceIds.sh`

And follow the instructions

Once you connect, do:

`sudo su - admin`

## connect to a database (local, dev, uat, prod, etc.)

Connect to the database as follows:

database

`aws ssm start-session --target $EC2ID --document-name AWS-StartPortForwardingSession --parameters "portNumber"=["5432"],"localPortNumber"=["9999"] --profile prism --region us-east-1`

Use the VSCode plugin called "Database Client"

![Database Client plugin](resources/db.png)

Login details:

Now that the tunnel is running, you can now connect to the remote Postgresql database on localhost port 9999 as shown:

![login details](<resources/loginInfo.png>)

## yaak/Postman

Please use [yaak](https://yaak.app/) (gRPC protocol) for graphical requests to the following services:

- `api`
- `clob`

There is a yaak collection checked in `yaak.json`

## Sync

Note on syncing:

The following files and documentation notes MUST be kept in sync. If you add/remove/change a config or secret, please ensure it's documented and is reflected everywhere else.

`docker-compose-data.yml`
 - db/Dockerfile (including the run command documentation)
 - db/.config*
 - db/.secrets
 - eventbus/Dockerfile (including the run command documentation)
 - eventbus/.config*
 - eventbus/.secrets
 - blocknode/.config*

`docker-compose-monolith.yml`
 - api/Dockerfile (including the run command documentation)
 - api/.config*
 - api/.secrets
 - main.go
 - clob/Dockerfile (including the run command documentation)
 - clob/.config*
 - clob/.secrets
 - main.rs

`docker-compose-proxy.yml`
 - proxy/Dockerfile (including the run command documentation)
 - proxy/.config*
 - proxy/.secrets (if applicable)

## Infra components

Infra design:

![alt text](resources/Predict.drawio.png)

AWS (dev):

![alt text](resources/awsEC2.png)

For further information, see the infra [README](infra/README.md)

## Docker container registry

Please use ghcr (Github container registry) only for images.

https://github.com/orgs/PrismMarketLabs/packages

Create a PAT here: https://github.com/settings/tokens/new - check `read:packages`, `write:packages` and `delete:packages`

Call the token "PACKAGE_RW"

```bash
 export PAT=ghp_...
echo $PAT | docker login ghcr.io -u zoikhash --password-stdin # note: use your github username, "zoikhash" in this case
# you may have to install `pass` and `docker-credential-pass`
# or delete '{ "credsStore": "pass" }' from ~/.docker/config.json
```

Docker build instructions are at the top of the Dockerfiles

```bash
docker build -t ghcr.io/prismmarketlabs/envoy:0.1.0 . # Note the org name is all lowercase. Note the verison number
docker push ghcr.io/prismmarketlabs/envoy:0.1.0
```

```bash
export PAT=<personal_access_token>
echo $PAT | docker login ghcr.io --username MuzanHash --password-stdin

# example push:
docker push ghcr.io/NAMESPACE/IMAGE_NAME:v0.0.3
```

All (tagged) images should be pushed to this location.

All images **must** use [semantic versioning](https://semver.org/).

## Versioning

Each service MUST be versioned.

Semver (semantic versioning) MUST be used.

For example, version a docker image using the service NAME and the latest VERSION:

```bash
export NAME=ghcr.io/prismmarketlabs/api
export VERSION=0.1.0
```

*Note: NAME must be one of {api, clob, db, eventbus, proxy, web, web.eng}*

`docker build -t ghcr.io/prismmarketlabs/${NAME}$:${VERSION} .`

`docker push ghcr.io/prismmarketlabs/${NAME}:$(VERSION)`

*Note: the latest version doesn't just get deployed automatically - a release is assembled together using a number of known-to-be stable service versions*

*Note: version numbers should never go down, always advancing*

## Releases/deployments

All releases are specified in `docker-compose-SERVICE.ENV.yml` override files.

[Semantic versioning](https://semver.org/) **must** be used.

There is an **intentional separation** between **configuration** (`.config.ENV`) and **secrets** (`secrets`):

```bash
# Safe to check-in these files
.config
.config.local
.config.dev
.config.prod
```

```bash
# Safe to check-in these files, however, do NOT check in the secret itself. Only checkin the references to the secret on `aws ssm`
.secrets # environment is handled by `source loadEnv.sh local`
```

**N.B. do NOT check in secrets - only check-in references to secrets**

## Release procedure

### Automatic release procedure:

- `cd prism`
- ensure all changes are checked in
- ~~pull any changes in the sub-modules (e.g. `cd web.lp` `git pull`)~~
- observe a green build for the service you're interested in releasing: https://github.com/prismmarketlabs/prism/actions
- after a green build, an (untagged) image should now be available in https://github.com/orgs/PrismMarketLabs/packages
- run `./registry_tag.sh` for each of the (untagged, `latest`) services you wish to tag
- follow the interactive prompts. *note: registry_tag.sh automatically increments the patch version for you. You can (optionally) update the major and minor versions, as appropriate*
- wait for the deployment to `dev` (it takes about 30 seconds to 60 seconds for the AWS EC2 instance to pick up the change)
- monitor logs for an appropriate burn-in period

Roll-back procedure:

- In the event of observing an error, if possible, roll back to the previous version by reverting the version number to the previous number that was running nominally
- check in the change to the `docker-compose-*.yml` file(s) as appropriate
- wait for the deployment to complete (it takes about 30 seconds to 60 seconds for the AWS EC2 instance to pick up the change)
- monitor logs for an appropriate burn-in period
- **Note**: some application versions cannot be rolled back - developers should design their applications so that they can be rolled back (e.g. always include database down migrations)
- If the application still cannot be rolled back, you must fix-forward the error with a new patched release

To elevate to a higher environment (e.g. `prod`):

- open the `docker-compose-*.yml` file for a lower environment that you are happy with: copy the stable version
- **make sure the version you have copied is stable in a lower environment and is compatible with all other services in the Prism application**
- carefully paste this version into `docker-compose-*.prod.yml`
- check in changes to the `docker-compose-*.prod.yml` file
- wait for the deployment to `prod` (it takes about 30 seconds to 60 seconds for the AWS EC2 instance to pick up the change)
- monitor logs for an appropriate burn-in period

### reload a service (keep the same version)

Login to the box directly.

e.g. reload `modsec`:

```bash
./0_pull_latest.sh 
source 1_loadEnvVars.sh <ENV>
docker compose pull modsec && docker compose up -d --force-recreate modsec
```

### free up disk space

`docker image prune -a -f`


### Manual release procedure:

1. tag the image
2. update the docker-compose-<SERVICE>.<ENV>.yml file
3. push the source code
4. login to the box (via `aws ssm`) and refresh the running image(s)

### 1. tag the image

View all the images here: https://github.com/orgs/PrismMarketLabs/packages

For security reasons, **please do NOT push tagged images that were built locally/manually - only tag those images that were built via github Actions**

### 2. update the docker-compose-SERVICE.ENV.yml file

And update the docker-compose-SERVICE.ENV.yml with the new version.

### 3. push the source code

`git add .`

`git commit -m"..."`

`git push`

```bash
## **Please note**: there is now a script to peform this more quickly:
# ./registry_tag.sh
# follow the prompts

# first set these three env vars:
export IMAGE_SRC=ghcr.io/prismmarketlabs/web # web.eng
export IMAGE_DST=$IMAGE_SRC # ghcr.io/prismmarketlabs/web
# note: it is comment for IMAGE_SRC and IMAGE_DST to be the same
export VER_SRC=latest # or, a specific tag
export VER_DST=0.1.1


docker pull $IMAGE_SRC:$VER_SRC
docker tag $IMAGE_SRC:$VER_SRC $IMAGE_DST:$VER_DST

docker images | grep $IMAGE_DST


# now do:
docker push $IMAGE_DST:$VER_DST
```

### 4. login to the box (via aws ssm) and refresh the running image

```bash
./0_pull_latest.sh
source ./1_loadEnvVars.sh
./2_dockerComposeUp.sh
# may need to:
docker compose restart
```

View running versions/tags/docker image shas:

`docker compose ps -q | xargs docker inspect --format '{{.Name}} {{.Config.Image}} {{.Image}}'`

### AWS secrets

Use `aws ssm` to store and retrieve secrets for a particular environment.

View all secrets

```bash
cat `find . -name ".secrets*"` | sort | uniq

aws ssm describe-parameters --parameter-filters Key=Type,Values=SecureString | grep "Name" | grep local
```

Store a secret:

```bash
export ENV=local
 aws ssm put-parameter --name "/$ENV/DB_PWORD" --value "XXXX" --type SecureString --overwrite --profile prism --region us-east-1
```

Retrieve all secrets:

```bash
export ENV=local
aws ssm get-parameters-by-path --path "/$ENV" --profile prism --region us-east-1 | grep "Name"
```

Or...

```bash
# view all secrets:
aws ssm describe-parameters --query "Parameters[?Type=='SecureString'].Name" --output json  --profile prism --region us-east-1 | jq -r '.[]' | sort | jq -R . | jq -s .

# or:
aws ssm describe-parameters --query "Parameters[?Type=='SecureString'].Name" --output text
```



Retrieve a secret:

```bash
export ENV=local
aws ssm get-parameter --name "/$ENV/DB_PWORD" --with-decryption --profile prism --region us-east-1
```

Delete a secret:

```bash
export ENV=local
aws ssm delete-parameter --name "/$ENV/DB_PWORD" --profile prism --region us-east-1
```

### local

```bash
# run manually
# load all config/secrets:
source ./api/loadEnv.sh local
source ./clob/loadEnv.sh local
source ./db/loadEnv.sh local
source ./eventbus/loadEnv.sh local
source ./blocknode/loadEnv.sh local
source ./proxy/loadEnv.sh local

docker compose -f docker-compose-proxy.yml up -d
docker compose -f docker-compose-monolith.yml up -d
docker compose -f docker-compose-data.yml up -d
```

### dev

Login to each of the dev boxes. Run:

```bash
# On Proxy:
source ./proxy/loadEnv.sh dev
docker compose -f docker-compose-proxy.yml -f docker-compose-proxy.dev.yml up -d
# On Monolith:
source ./api/loadEnv.sh dev
source ./clob/loadEnv.sh dev
docker compose -f docker-compose-monolith.yml -f docker-compose-monolith.dev.yml up -d
# On Data:
source ./db/loadEnv.sh dev
source ./eventbus/loadEnv.sh dev
docker compose -f docker-compose-data.yml -f docker-compose-data.dev.yml up -d
```

### prod

Login to each of the prod boxes. Run:

```bash
# On Proxy:
docker compose -f docker-compose-proxy.yml -f docker-compose-proxy.prod.yml up -d
# On Monolith:
source ./api/loadEnv.sh prod
source ./clob/loadEnv.sh prod
docker compose -f docker-compose-monolith.yml -f docker-compose-monolith.prod.yml up -d
# On Data
source ./db/loadEnv.sh prod
source ./eventbus/loadEnv.sh prod
docker compose -f docker-compose-data.yml -f docker-compose-data.prod.yml up -d
```

### docker

View container CPU/memory usage:

`docker stats`

View the env vars available in an image:

`docker run --env-file .config.local --rm ghcr.io/prismmarketlabs/db:$VERSION env`

In your Dockerfiles, try to avoid:

- ARG
- ENV
- "latest" images - use a specific version

### Screencast transcode

Reduce to 480p:

`ffmpeg -i 'Screencast from 2025-11-17 14-14-57.webm' -vf scale=1280:-1 -c:v libvpx-vp9 -crf 32 -b:v 0 -c:a libopus output.webm`

### diff

`gvimdiff`

### kubernetes

*Note: in the future, we may move to k8s*

The deployment prodecure would change in this case.

## hts

[Hedera Token Service](https://hedera.com/token-service) (hts) offers many potential advantages:

Potential advantages:

- near-zero tx fees (there may be interesting economic effects flowing from this)
- security: fewer lines of smart contract code (native tokens are at the protocol level, smart contract interfaces built rigorously by Hedera)
- ability to "pre-approve" funds up to a certain amount (as opposed to user having to "deposit" funds)
- no token association UX flow needed
- small dollar txs may encourage bots! (there may be a SPAM issue with this though...)
- etc.

Potential disadvantages:

- UI experience for the user due to [hts] token association requirements
- cluttering of user wallet with tokens (possible to use a single Fungible/NFT token?)
- ERC20-style smart contracts may cost more
- ERC20-style smart contracts may be incompatible with ed25519 key
- etc.

## Digital signatures

Every transaction initiated by the user has a digital signature.

**Orders** are PrismV2 authorizations: an integer struct binding the chain ID, the PrismV2 proxy address, the signer, market, txId, side, action, limit YES price, quantity, collateral cap and deadline. The user signs the base64 of its keccak256 struct hash with their Hedera wallet, and the contract re-verifies the signature through the Hedera Account Service at settlement.

See [docs/PRISM_V2_ORDER_PROTOCOL.md](docs/PRISM_V2_ORDER_PROTOCOL.md) for the exact encoding, a reference vector and the API request format.

See: `AuthorizationV2` in ./api/server/lib/authorization_v2.go

See: `authorizationHash(...)` and `authorizationMessage(...)` in ./scs/contracts/PrismV2.sol

**Comments signature scheme**

```go
// signature format for comments:
commentPayload := fmt.Sprintf("%s:%s:%s", req.MarketId, req.AccountId, req.Content)

// TODO

```


**Order cancel signature scheme**

// TODO


## Add a submodule to your monorepo (web)

`web` is a submodule

`prism-front-end` is being developed separately in its own separate repo.

```bash
cd prism
# add the submodule and make it available in the "web" folder
git submodule add git@github.com:PrismMarketLabs/prism-front-end.git web
```

1. add the following notification github workflow to prism-front-end (.github/workflows/notify-parent.yml):

```yml
# .github/workflows/notify-parent.yml
name: Notify Parent Repo

on:
  push:
    branches: [main] # or your default branch

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Call parent repo workflow
        run: |
          curl -X POST \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer ${{ secrets.PARENT_REPO_TOKEN }}" \
            https://api.github.com/repos/PrismMarketLabs/prism/dispatches \
            -d '{"event_type":"web-submodule-updated"}'
```

2. create a token (classic) (https://github.com/settings/tokens) with scopes: [repo]. Call it "repo_notifications"

ghp_******

3. Add this repo_notifications token ("PARENT_REPO_TOKEN") to the prism-front-end submodule's repo (repository secrets): 
- https://github.com/PrismMarketLabs/prism-front-end/settings/secrets/actions
- https://github.com/PrismMarketLabs/prism-admin/settings/secrets/actions

4. Add the following to the standard build-web.yml (rename it build-web__submodule__.yml to be explicit about it being a submodule):

```yml
on:
  repository_dispatch:
    types: [web-submodule-updated]
  push:
    paths:
      - 'web/**'



...


  steps:
  - name: Checkout code
    uses: actions/checkout@v3
    with:
      submodules: true  # Fetch submodules
      token: ${{ secrets.READ_REPO }}  # N.B. need a repository secret (repo scope)

   # also need an *additional* step to pull the latest changes from all submodules, ensuring we have the latest code before building the Docker image:
  - name: Update submodules to latest commit
    run: |
      git submodule update --remote --recursive
...

```

5. Create another token called "READ_REPO":

- https://github.com/settings/tokens

- add it to the prism-front-end so the prism github Action can pull in the submodule code

- https://github.com/PrismMarketLabs/prism/settings/secrets/actions

- "Repository secrets": "READ_REPO" xxxxxxxx

6. Note: may need to do the following to update the "web" submodule:

`git submodule update --remote -- web`

discard those submodule pointer drifts by checking each submodule back to the superproject’s recorded commit, then re-run status to confirm a clean tree:

`git submodule update --checkout -- web web.admin web.lp && git status --short && git submodule status`

Maybe this will work if things get out of sync (origin/main still points to the old missing submodule SHAs; the fix is staged locally but not committed/pushed. Commit those three gitlink updates and pushing to main so Actions can fetch valid refs):

```bash
git diff --cached --submodule=log -- web web.admin web.lp && git commit -m "Fix submodule refs for CI checkout" && git push origin main

git status --short && git rev-parse --short HEAD && git ls-tree HEAD web web.admin web.lp
```

## Matching and settlement

The CLOB keeps one book per market, quoted in YES price. Bids are BUY YES or SELL NO; asks are SELL YES or BUY NO, so every bid/ask pair is one of PrismV2's four pairings (mint a complete set, merge one, or transfer YES or NO shares). A fill executes at the resting order's limit and is sized so each BUY stays within its signed collateral cap.

For each fill the CLOB publishes one `ClobMatch` (bid, ask, shares, price, collateral split) on `clob.matches.settle`. The API rebuilds both signed authorizations from the database and submits `PrismV2.settle` under a deterministic match ID, so a redelivered fill can never settle twice.

See [docs/PRISM_V2_ORDER_PROTOCOL.md](docs/PRISM_V2_ORDER_PROTOCOL.md) and [scs/UPGRADING.md](scs/UPGRADING.md).
