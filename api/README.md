## Quickstart

```bash
# make sure GOPATH is available
echo $GOPATH

# make sure Go version is >1.22
go version

# generate sqlc and protobuf interfaces
cd api
./genInterfaces.sh

# run the server:
cd api
source loadEnv.sh local
go run ./server/
```

**Note:**

There is a [yaak](https://yaak.app/) collection avaiable - see `yaak.json`

## start from scratch

```bash
cd api
go mod init api # module name is 'api'
go mod tidy

# use Envoy’s PGV
mkdir -p proto/validate
curl -sSL https://raw.githubusercontent.com/envoyproxy/protoc-gen-validate/main/validate/validate.proto -o proto/validate/validate.proto

mkdir -p proto/google


# now generate the interface
cd api
./genInterfaces.sh
```


## easyrpc

Using easyrpc to make connections to the API via cli

https://github.com/heartandu/easyrpc

**Note on REST vs gRPC and gRPC-web**

gRPC is an eficient client-server data transfer protocol which features:
- efficient bi-directional information flows
- data streaming (upload and download)
- strict unambiguous interfaces (as defined in .proto files)
- uniformity in data messaging whether uploading, downloading, deleting, etc. - the protocol doesn't care about your intention

One of the big practical problems with gRPC is that it relies on http2 protocol - some network infra (e.g. load balancers, proxies, firewalls, etc.) don't support and/or block http2 and/or gRPC connections. Also, not every browser supports http2, though this is probably less of the case nowadays.

gRPC-web is a protocol which converts raw gRPC request/responses/streams to a http1 compatible format

**We use grpc-web** for this project

Upsides:
- compatibility with network infra
- retain all the benefits of working with gRPC with strong typing in frontend

Downsides:
- streaming is not true streaming as updates are sent periodically, as opposed to when something happens
- additional processing step in the Envoy proxy

REST

Particular set of verbs (GET, POST, PUT, PATCH, DELETE, etc.) and conventions (e.g. body params, query params) for clients to interact with web applications

Upsides:
- well-known and widely used
- network infra compatibility
- OpenAPI is well-known

Downsides:
- ambiguity - even OpenAPI specs can be ambiguous - complex data types
- arbitrariness - GET params not encrypted, whereas POST params are, etc. A lot of tricks-of-the-trade you need to know
- streaming not supported
- inefficient - data objects are verbose and bulky (as opposed to binary objects in gRPC)

### easyrpc commands

Note: Use the `-w` switch and `easyrpc` will automatically translate the gRPC to gRPC-web 

Note: If querying against localhost:8888, omit the `--tls` option

Note: reflection is not enabled on the API. So you must provide `easyrpc` with the .proto definitions

Note: if you are unsure what parameters to send (`-d`), check the .proto file.


```bash

easyrpc c -w --tls -a dev.prism.market:443 -d '{"marketId":"019be174-5df0-761e-ac62-f65602d7e16a","limit":100,"offset":0}' -i ./proto -p api.proto api.ApiServicePublic.GetComments

TO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FROM=$(date -u -d "-5 minutes" +"%Y-%m-%dT%H:%M:%SZ")
easyrpc c -a localhost:8090 -w -i ./api/proto -p api.proto -d '{"marketId":"","net":"testnet","resolution":"hour","from":"'$FROM'","to":"'$TO'"}' api.ApiServicePublic.PriceHistory

### auth:

# get a challenge:
easyrpc c -a localhost:8888 -i ./api/proto -p api.proto -d '{"accountId":"0.0.7090546","network":"testnet"}' api.ApiAuth.GetChallenge


# Create market with image upload:

echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ZcAAAAASUVORK5CYII=" | base64 -d > x.png
BASE64_STR=$(base64 -w 0 x.png)
echo $BASE64_STR

sudo apt-get install pipx
pipx install uuid7
UUID7=$(uuid7)
echo $UUID7

easyrpc c -a localhost:8888 -i ./api/proto -p api.proto -d '{"marketId":"","net":"testnet","statement":"some statement","description":"some description","img_chunk":"'$BASE64_STR'","img_file_name":"imgFn.png","img_mime_type":"image/png"}' api.ApiServicePublic.CreateMarketv2




### OLD grpcurl commands
###
# note: grpcurl does not support grpc-web!
###

export API_PORT=8888

export PAYLOAD="{}"
grpcurl -plaintext -import-path ./proto -proto api.proto -d $PAYLOAD localhost:$API_PORT api.ApiService.GetMarketById

export PAYLOAD='{"market_id":"0189c0a8-7e80-7e80-8000-000000000002"}'
grpcurl -plaintext -import-path ./proto -proto api.proto -d $PAYLOAD localhost:$API_PORT api.ApiService.GetMarketById

export PAYLOAD='{"limit":10,"offset":0}'
grpcurl -plaintext -import-path ./proto -proto api.proto -d $PAYLOAD localhost:$API_PORT api.ApiService.GetMarkets




grpcurl -plaintext -import-path ./proto -proto ./proto/api.proto -d '{}' localhost:8888 api.ApiService/AvailableNetworks





grpcurl -plaintext -import-path ./proto -proto ./proto/api.proto -d '{"market_id":"0189c0a8-7e80-7e80-8000-000000000003","net":"testnet","offset":0,"limit":1000,"resolution":"minute","from":"2025-12-30T10:00:00Z","to":"2025-12-30T17:55:00Z"}' localhost:8888 api.ApiService/PriceHistory




grpcurl -plaintext -import-path ./proto -proto ./proto/api.proto -d '{"market_id":"0189c0a8-7e80-7e80-8000-000000000003","offset":0,"limit":1000}' localhost:8888 api.ApiService/GetComments






grpcurl -plaintext -import-path ./proto -proto ./proto/api.proto -d '{"market_id":"0189c0a8-7e80-7e80-8000-000000000003","accountId":"0.0.1234","content":"Hello, world","sig":"some_sig_here","publicKey":"public_key_here","keyType":1}' localhost:8888 api.ApiService/CreateComment
```

# Database

A postgres database.

Manual database queries are not permitted.

Changes to the database structure can only be done using .sql migration files (up/down).

For every .sql up file, a corresponding down .sql file MUST be provided. This ensures we can safely release/rollback the database.

- Step 1 (optional): If you need a new table or want to modify an existing table, create a database migration up/down definition (api/dp/migrations)

- Step 2: define the desired db queries - annotate your new db queries with an `sqlc` interface def using the `sql` DSL language.

- Step 3: generate the Golang database interfaces

## Step 1: Database migrations

Use golang-migrate cli tool

`brew install golang-migrate` (Mac)

To install the cli tool on Linux:

```bash
curl -L https://github.com/golang-migrate/migrate/releases/download/v4.19.0/migrate.linux-amd64.tar.gz | tar xvz
sudo mv migrate /usr/local/bin/
migrate -version
```

### new migration

```bash
cd api
migrate create -ext sql -dir db/migrations -seq first_table # sequential numbering (not default date-based)
```

### migration up

```bash
cd api
source ./loadEnv.sh local
DB_URL=postgres://$DB_UNAME:$DB_PWORD@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=disable
echo $DB_URL


migrate -database $DB_URL -path db/migrations up
```

### migration down

Ty and make your migrations idempotent!

Please test the up/downs in lower envs!

[Best practices](https://github.com/golang-migrate/migrate/blob/master/MIGRATIONS.md)

```bash
cd api

source ./loadEnv.sh local
DB_URL=postgres://$DB_UNAME:$DB_PWORD@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=disable
echo $DB_URL
migrate -database $DB_URL -path db/migrations down
```








## Step 2: define the desired db queries - annotate with an sqlc interface def

0. If you haven't already, install the sqlc tooling:

`go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest`

`sqlc version`

1. Retrieve the latest a database schema (this must be done after a database migration):

```bash
cd api

source ./loadEnv.sh local
DB_URL=postgres://$DB_UNAME:$DB_PWORD@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=disable
echo $DB_URL

pg_dump $DB_URL --schema-only | sed '/^\\/d' > ./db/schema.sql
```

2. sqlc queries

All queries must go in `api/queries/*.sql`

Add a new query to an existing file, or create a new query file, as appropriate.

Use the sqlc annotation language to annotate your query.



## Step 3: generate the Golang database interfaces

Can now generate the sqlc interfaces:

```bash
cd api/db
sqlc generate
```

Or, just run the convenience script:

```bash
cd api

./generateInterfaces.sh # generates sqlc interfaces as well as protobuf interfaces
```








# seed the database

Add test data to `seed.sql`

Run:

```bash
cd api
source loadEnv.sh local
DB_URL=postgres://$DB_UNAME:$DB_PWORD@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=disable

cd api/db
psql $DB_URL -f seed.sql
```

N.B. Do NOT run on prod!







# OLD

```bash
# Now do a gRPC call:
PRICE_USD=0.42
N_SHARES=22.2
UTC=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
ACCOUNT_ID=0.0.7090546
BUYSELL=0
SIG=xxxxxxxxxxxxxxxxxxxxx
UUID7=$(printf '%08x-%04x-7%03x-%x%03x-%012x\n' \
  $(( $(date +%s%3N) >> 16 )) \
  $(( $(date +%s%3N) & 0xFFFF )) \
  $(( $(date +%s%3N) & 0x0FFF )) \
  $(( 8 + RANDOM % 4 )) \
  $(( RANDOM & 0x0FFF )) \
  $(( RANDOM<<24 | RANDOM<<12 | RANDOM )) )
```

Create `SIG`:

Ensure openssl and jq are available:

`which openssl jq`

```bash
grpcurl -plaintext -import-path ./proto -proto api.proto -d '{"txid": "'$UUID7'", "marketId": "'$UUID7'", "accountId": "'$ACCOUNT_ID'", "buySell": '$BUYSELL', "sig": "'$SIG'", "priceUsd": '$PRICE_USD', "nShares": '$N_SHARES', "sig": "'$SIG'", "generated_at": "'$UTC'"}' localhost:8888 api.ApiService.PredictIntent
# notice how the validation takes place!

```

Or...

Grab the JSON.stringified payload from the console.log:

```bash
export API_PORT=8888
export PAYLOAD='{"txid":"019a2bc2-d729-7407-acb7-fff6e81daa11","marketId":"019a2bc2-d729-7407-acb8-003b2e4fe475","generated_at":"2025-10-28T16:59:40.713Z","accountId":"0.0.7090546","buySell":"buy","priceUsd":0.5,"nShares":10,"sig":""}'

grpcurl -plaintext -import-path ./proto -proto api.proto -d $PAYLOAD localhost:$API_PORT api.ApiService.PredictIntent
```