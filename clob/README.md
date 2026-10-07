# CLOB

A Rust-based CLOB

## Example book

One book per market, quoted as an integer YES price (`1_000_000` = 1.0). Shares are in
the collateral token's smallest unit (`1_000_000` = 1 share for USDC).

```text
BIDS (buy YES exposure: BUY YES or SELL NO) - highest YES price first
520000 → [Order1, Order2, Order3]  ← best bid
510000 → [Order4]

ASKS (sell YES exposure: SELL YES or BUY NO) - lowest YES price first
480000 → [Order7, Order8]          ← best ask
490000 → [Order9]
```

A bid and an ask trade when the bid's limit is at or above the ask's, at the resting
order's limit. Every bid/ask pair is one of PrismV2's settlement pairings.

## State and matching

- Each market's book holds bid and ask vectors of signed V2 orders with their cumulative
  fill state (`shares_filled`, `collateral_filled`). The matcher is in `src/matching.rs`
  and is unit tested (`cargo test`).
- Price-time priority: best price first; a stable sort keeps arrival order within a price.
- Each fill is sized so that both legs pay a positive amount under the contract's rounding
  (`floor(shares × price / 1e6)` for YES, the rest for NO), and each BUY stays within its
  signed collateral cap.
- Self-trades (same EVM address or account) are skipped. Orders within 30 s of their
  deadline are dropped.
- Every fill is published, in order, as one `ClobMatch` on `clob.matches.settle` with a
  per-fill message ID. The API settles it with `PrismV2.settle`.
- On restart the API rebuilds the book from the database (`TriggerRecreateClob`),
  counting fills that are still being settled.

### Quickstart

`cd clob`

`cargo build` # this also generates interfaces based on the protobuf defs

```bash
source loadEnv.sh local
cargo run
```

And create some markets (with known market_ids):

```bash
cd clob
export SERVER=dev.prism.market:8090 # 54.210.115.180:8090 # localhost:50051
export AUTH="-H \"authorization: Basic $(echo -n 'admin:XXXX' | base64)\""
grpcurl $AUTH -plaintext -import-path ./proto -proto ./proto/clob.proto -d '{"market_id":"0189c0a8-7e80-7e80-8000-000000000001","net":"testnet"}' $SERVER clob.Clob/AddMarket
grpcurl $AUTH -plaintext -import-path ./proto -proto ./proto/clob.proto -d '{"market_id":"0189c0a8-7e80-7e80-8000-000000000002","net":"testnet"}' $SERVER clob.Clob/AddMarket
grpcurl $AUTH -plaintext -import-path ./proto -proto ./proto/clob.proto -d '{"market_id":"0189c0a8-7e80-7e80-8000-000000000003","net":"testnet"}' $SERVER clob.Clob/AddMarket
grpcurl $AUTH -plaintext -import-path ./proto -proto ./proto/clob.proto -d '{"market_id":"0189c0a8-7e80-7e80-8000-000000000004","net":"testnet"}' $SERVER clob.Clob/AddMarket
grpcurl $AUTH -plaintext -import-path ./proto -proto ./proto/clob.proto -d '{"market_id":"0189c0a8-7e80-7e80-8000-000000000005","net":"testnet"}' $SERVER clob.Clob/AddMarket
# this should error (duplicate market_id):
grpcurl $AUTH -plaintext -import-path ./proto -proto ./proto/clob.proto -d '{"market_id":"0189c0a8-7e80-7e80-8000-000000000001","net":"testnet"}' $SERVER clob.Clob/AddMarket
```

grpc call to remote `dev` environment (needs auth):

```bash
# GetBook
grpcurl -H "authorization: Basic $(echo -n 'admin:********' | base64)" -plaintext -import-path ./proto  -proto ./proto/clob.proto -d '{"marketId":"0189c0a8-7e80-7e80-8000-000000000001","depth":10,"net":"testnet"}' dev.prism.market:443 clob.Clob/GetBook

# AddMarket
grpcurl -H "authorization: Basic $(echo -n 'admin:********' | base64)" -plaintext -import-path ./proto -proto ./proto/clob.proto -d '{"market_id":"0189c0a8-7e80-7e80-8000-000000000001","net":"testnet"}' dev.prism.market:443 clob.Clob/AddMarket

# etc.
```

**Note:**

There is a [yaak](https://yaak.app/) collection avaiable - see `yaak.json`


### commands

**check gRPC server is listening**

`netstat -tuln | grep 50051`

**Place an order:**

```bash
export ACCOUNTID="0.0.12345"
export NET="testnet"
UUID7=$(printf '%08x-%04x-7%03x-%x%03x-%012x\n' \
  $(( $(date +%s%3N) >> 16 )) \
  $(( $(date +%s%3N) & 0xFFFF )) \
  $(( $(date +%s%3N) & 0x0FFF )) \
  $(( 8 + RANDOM % 4 )) \
  $(( RANDOM & 0x0FFF )) \
  $(( RANDOM<<24 | RANDOM<<12 | RANDOM )) )
export MARKET_ID=...   # an existing market on the CLOB
export DEADLINE=$(( $(date +%s) + 3600 ))

# BUY YES 1.5 shares at YES 0.50, spending at most 0.75 USDC. Orders placed directly
# on the CLOB skip the API's checks and will not settle; use this only for local testing.
grpcurl -plaintext -import-path ./proto -proto ./proto/clob.proto -d '{"txId":"'$UUID7'","net":"'$NET'","marketId":"'$MARKET_ID'","accountId":"'$ACCOUNTID'","evmAddress":"0000000000000000000000000000000000003039","side":0,"action":0,"limitYesPrice":"500000","qtyShares":"1500000","collateralCap":"750000","deadline":"'$DEADLINE'"}' localhost:50051 clob.ClobInternal/CreateOrder
```

**View full orderbook (non-streaming):**

```bash
export DEPTH=5
grpcurl -plaintext -import-path ./proto  -proto ./proto/clob.proto -d '{"depth":'$DEPTH'}' localhost:50051 clob.Clob/GetBook
```

**View full orderbook (streaming):**

```bash
export DEPTH=5
grpcurl -plaintext -import-path ./proto  -proto ./proto/clob.proto -d '{"depth":'$DEPTH'}' localhost:50051 clob.Clob/StreamBook
```

## simulator

```bash
cd simulator
npm i
npm run gen # generate protobufs
npx run sim # run simulator
```

