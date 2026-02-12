# Hedera-based prediction market

This project is divided into a number of folders:

deployable services:

- `clob`: an off-chain CLOB which matches cryptographically signed buy/sell order intents
- `api`: an API backend
- `web`: [`prism-front-end`](https://github.com/PrismMarketLabs/prism-front-end) - the main Lovable web app (Note: this is a git **submodule** to a *separate* front-end repo)
- `web.lp`: a landing page
- `web.eng`: an engineering front-end
- `web.uat`: a web app for the uat environment
- `proxy`: a proxy to marshall traffic
- `eventbus`: event bus for pub/sub message communication
- `mw`: middleware for web app (server-side control of preview links across social media platforms)

modular components:

- `scs`: on-chain smart contracts
- `infra`: infrastructure-as-code (AWS-orientated)
- `resources`: a version-controlled area to store artifacts, design files, images, etc.
- `scripts`: some general usage scripts

## build status (live):

https://github.com/PrismMarketLabs/prism/actions

![api](https://github.com/PrismMarketLabs/prism/actions/workflows/build-api.yml/badge.svg)
![clob](https://github.com/PrismMarketLabs/prism/actions/workflows/build-clob.yml/badge.svg)
![db](https://github.com/PrismMarketLabs/prism/actions/workflows/build-db.yml/badge.svg)
![eventbus](https://github.com/PrismMarketLabs/prism/actions/workflows/build-eventbus.yml/badge.svg)
![mw](https://github.com/PrismMarketLabs/prism/actions/workflows/build-mw.yml/badge.svg)
![proxy](https://github.com/PrismMarketLabs/prism/actions/workflows/build-proxy.yml/badge.svg)
![web](https://github.com/PrismMarketLabs/prism/actions/workflows/build-web__submodule__.yml/badge.svg)
![web.eng](https://github.com/PrismMarketLabs/prism/actions/workflows/build-web.eng.yml/badge.svg)
![web.lp](https://github.com/PrismMarketLabs/prism/actions/workflows/build-web.lp.yml/badge.svg)

## currently released (live):

To release a new version of a service, follow the release procedure here: https://github.com/PrismMarketLabs/prism?tab=readme-ov-file#release-procedure

`dev`

| [proxy](https://pl-deployment-badges.s3.amazonaws.com/dev/proxy.svg?nonce=1770842594) | [monolith](https://pl-deployment-badges.s3.amazonaws.com/dev/monolith.svg?nonce=1770842594) | [data](https://pl-deployment-badges.s3.amazonaws.com/dev/data.svg?nonce=1770842594) |
|---|---|---|
| ![proxy](https://pl-deployment-badges.s3.amazonaws.com/dev/proxy.svg?nonce=1770842594) | ![monolith](https://pl-deployment-badges.s3.amazonaws.com/dev/monolith.svg?nonce=1770842594) | ![data](https://pl-deployment-badges.s3.amazonaws.com/dev/data.svg?nonce=1770842594) |

`uat`

| [proxy](https://pl-deployment-badges.s3.amazonaws.com/uat/proxy.svg?nonce=1770842594) | [monolith](https://pl-deployment-badges.s3.amazonaws.com/uat/monolith.svg?nonce=1770842594) | [data](https://pl-deployment-badges.s3.amazonaws.com/uat/data.svg?nonce=1770842594) |
|---|---|---|
| ![proxy](https://pl-deployment-badges.s3.amazonaws.com/uat/proxy.svg?nonce=1770842594) | ![monolith](https://pl-deployment-badges.s3.amazonaws.com/uat/monolith.svg?nonce=1770842594) | ![data](https://pl-deployment-badges.s3.amazonaws.com/uat/data.svg?nonce=1770842594) |

`prod`

| [proxy](https://pl-deployment-badges.s3.amazonaws.com/prod/proxy.svg?nonce=1770842594) | [monolith](https://pl-deployment-badges.s3.amazonaws.com/prod/monolith.svg?nonce=1770842594) | [data](https://pl-deployment-badges.s3.amazonaws.com/prod/data.svg?nonce=1770842594) |
|---|---|---|
| ![proxy](https://pl-deployment-badges.s3.amazonaws.com/prod/proxy.svg?nonce=1770842594) | ![monolith](https://pl-deployment-badges.s3.amazonaws.com/prod/monolith.svg?nonce=1770842594) | ![data](https://pl-deployment-badges.s3.amazonaws.com/prod/data.svg?nonce=1770842594) |

*Note: see .git/hooks/pre-commit to see how to update the cache-busting nonce*

## Quickstart

To develop the application locally, edit `grpcClient.ts` and set the baseUrl to the dev environment:

`baseUrl: 'https://dev.prism.market:443'`

Install dependencies:

`npm i`

Generate TypeScript interfaces:

`npm run gen`

Run the web app (vite):

`npm run dev`

You can now open the application at:

`localhost:5173`

## Quickstart (docker-compose)

```bash
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

Access the application at:

| Environment | URI                        | Password? |
|-------------|----------------------------|-----------|
| `local`     | http://localhost:8090      | Y         |
| `dev`       | https://dev.prism.market   | Y         |
| `uat`       | https://uat.prism.market   | Y         |
| ...         | ...                        |           |
| `prod`      | https://prism.market       | N         |

## Quickstart (local machine)

To develop the application locally, start up each of the following services (in the order below) in a separate terminal window:

- `db`: see [db/README.md](db/README.md)
- `eventbus`: see [eventbus/README.md](eventbus/README.md)
- `api`: see [api/README.md](api/README.md)
- `clob`: see [clob/README.md](clob/README.md)
- `web`: see [web/README.md](web/README.md)
- `proxy`: see [proxy/README.md](proxy/README.md)

## database

Connect to the database as follows:

| environment | host       | port |
|-------------|------------|------|
| local       | localhost  | 5432 |
| dev         | localhost* | 9999 |
| uat         | localhost* | 9999 |
| ...         |            |      |
| prod        | localhost* | 9999 |

**via ssh tunnel - see instructions below to start an ssh tunnel to the environment you want to connect to*

To connect to a remote database (e.g. `dev`), in a separate terminal, open up an ssh tunnel:

```bash
# first, ensure you have added the keys for all the environments to your ssh agent
# these keys can be downloaded from the Prism Bitwarden account
ssh-add ~/Desktop/dev-bastion.pem
ssh-add ~/Desktop/dev.pem
ssh-add ~/Desktop/uat-bastion.pem
ssh-add ~/Desktop/uat.pem
ssh-add ~/Desktop/prod-bastion.pem
ssh-add ~/Desktop/prod.pem

#remove all keys with:
ssh-add -D

# You can now connect to a remote box using `ssh -A ...` and the ssh agent will automatically use the appropriate key you loaded into the ssh agent using the ssh-add command above

# example of setting up the tunnel for a remote db connection:
./bastions.sh # get the HOST
export HOST=ec2-44-222-140-176.compute-1.amazonaws.com # retrieve from the AWS EC2 web UI
ssh -A -L 9999:10.0.1.12:5432 -N admin@$HOST
```
Use the VSCode plugin called "Database Client"

![Database Client plugin](resources/db.png)

Login details:

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

1. tag the image
2. update the TAGS file
3. update the docker-compose-<SERVICE>.<ENV>.yml file
4. push the source code
5. login to the box (via bastion) and refresh the running image(s)

### 1. tag the image

View all the images here: https://github.com/orgs/PrismMarketLabs/packages

**Please do NOT push tagged images that were built locally/manually - only tag those images that were built via github Actions**

On your local machine, pull the image you want to tag (new: run `./tags.sh` to do this automatically):

```bash
## **Please note**: there is now a script to peform this more quickly:
# ./tag.sh
# follow the prompts

# first set these three env vars:
export IMAGE_SRC=ghcr.io/prismmarketlabs/web # web.eng
export IMAGE_DST=$IMAGE_SRC # ghcr.io/prismmarketlabs/web
# note: it is comment for IMAGE_SRC and IMAGE_DST to be the same
export VER_SRC=latest # or, a specific tag
export VER_DST=0.1.1


docker pull $IMAGE_SRC:$VER_SRC
# never add a tag to derived namespaces such as web.eng!
docker tag $IMAGE_SRC:$VER_SRC $IMAGE_DST:$VER_DST

docker images | grep $IMAGE_DST


# now do:
docker push $IMAGE_DST:$VER_DST
```

### 2. update the TAGS file

Update the VERSION file with a short description of the change

### 3. update the docker-compose-SERVICE.ENV.yml file

And update the docker-compose-SERVICE.ENV.yml with the new version.

### 4. push the source code

`git add .`

`git commit -m"..."`

`git push`

### 5. login to the box (via bastion) and refresh the running image

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
 aws ssm put-parameter --name "/$ENV/DB_PWORD" --value "XXXX" --type SecureString --overwrite
```

Retrieve all secrets:

```bash
export ENV=local
aws ssm get-parameters-by-path --path "/$ENV" | grep "Name"
```

Or...

```bash
aws ssm describe-parameters --query "Parameters[?Type=='SecureString'].Name" --output text
```

Retrieve a secret:

```bash
export ENV=local
aws ssm get-parameter --name "/$ENV/DB_PWORD" --with-decryption
```

Delete a secret:

```bash
export ENV=local
aws ssm delete-parameter --name "/$ENV/DB_PWORD"
```

### local

```bash
# load all config/secrets:
source ./api/loadEnv.sh local
source ./clob/loadEnv.sh local
source ./db/loadEnv.sh local
source ./eventbus/loadEnv.sh local
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

`sig` is calculated based on the payload below (alphabetical ordering). The payload to construct a sig is a subset of the fields in `PredictionIntentRequest` in `api.proto`.

```golang
type ObjForSigning struct {
  BuySell                uint8 // buy is 0xf0, sell is 0xf1. Note: '0' and '1' doesn't work for technical reasons - odd number of bits in the register doesn't play well with keccak hashing algos. In Solidity (and many other languages), a bool gets encoded as 0x00 or 0x01 (a single byte)
  CollateralUsdAbsScaled uint256 // uint256 may seem a lot, but kept this way to reduce on-chain casting to uint256 (e.g. ERC20)
  EvmAdd                 address/uint160 // a 20-byte EVM address is 160-bits. Note: the evmAddress is fixed. It is derived *once* at account creation.
  MarketIdUUID           uint128
  TxIdUUID               uint128
}
```

The marketId, the amount under consideration and the initiator account (immutable evmAddress) are assembled together for signing. This assembly design prevents others from sending signed txs to the API that could be used elsewhere, replayed, etc.

See: `assemblePayloadHexForSigning(...)` in ./web.eng/lib/utils.ts

See: `AssemblePayloadHexForSigning(...)` in ./api/server/lib/sign.go

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

2. create a token (classic) called "PARENT_REPO_TOKEN" (https://github.com/settings/tokens) with scopes: [repo]. Call it "repo_notifications"

ghp_******

3. Add this repo_notifications token to the prism-front-end submodule's repo (repository secrets): https://github.com/PrismMarketLabs/prism-front-end/settings/secrets/actions

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
