# CLOB

A Rust-based CLOB

```text
BIDS (Buy Orders - Highest Price First):
Price: 0.52 → Queue: [Order1, Order2, Order3]  ← Best Bid
Price: 0.51 → Queue: [Order4]
Price: 0.50 → Queue: [Order5, Order6]

ASKS (Sell Orders - Lowest Price First):  
Price: -0.48 → Queue: [Order7, Order8]      ← Best Ask (closest to 0)
Price: -0.49 → Queue: [Order9]
Price: -0.50 → Queue: [Order10, Order11]
```

## State Representation

The OrderBook state looks like this:

**Key Properties**

- Price-Time Priority: Orders at the same price level are served FIFO via VecDeque
- Efficient Lookup: BTreeMap provides O(log n) price level access
- Automatic Sorting: Best bid/ask prices are efficiently accessible
- Signed Price System: Positive = buy, negative = sell (unique approach)
- Memory Efficient: Empty price levels are cleaned up via cleanup_empty_levels()

**State Access Methods**

- best_bid_mut(): Gets highest positive price (best buy order)
- best_ask_mut(): Gets highest negative price (best sell order, closest to 0)
- snapshot_top(depth): Returns top N price levels for each side
- Orders within each price level maintain strict time priority (FIFO)

This format enables efficient matching, maintains market integrity with price-time priority, and provides fast access to the best available prices on both sides of the book.

### Quickstart

`cd clob`

`cargo build`

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
export PRICE_USD=0.5000005
export MARKET_LIMIT=limit
export QTY=1.5
UUID7=$(printf '%08x-%04x-7%03x-%x%03x-%012x\n' \
  $(( $(date +%s%3N) >> 16 )) \
  $(( $(date +%s%3N) & 0xFFFF )) \
  $(( $(date +%s%3N) & 0x0FFF )) \
  $(( 8 + RANDOM % 4 )) \
  $(( RANDOM & 0x0FFF )) \
  $(( RANDOM<<24 | RANDOM<<12 | RANDOM )) )

grpcurl -plaintext -import-path ./proto -proto ./proto/clob.proto -d '{"txId":"'$UUID7'","net":"'$NET'","marketId":"'$UUID7'","accountId":"'$ACCOUNTID'","marketLimit":"'$MARKET_LIMIT'","priceUsd":'$PRICE_USD',"qty":'$QTY'}' localhost:50051 clob.Clob/PlaceOrder
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
