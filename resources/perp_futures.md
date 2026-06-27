# OLD - Generic orderbook

Off-chain order matching and on-chain settlement is a powerful approach for giving user trust in your trading platform. Users sign an order intent, which gets matched off-chain and settled on-chain. The market operator (Prism) cannot arbitrarily take funds from a user's account without their consent (i.e. their digital signature). Even with a digital signature, funds can only flow through the decentralized smart contract in a very specific, predefined way that can be publicly inspected. For example, it would not possible to send a user's funds to an arbitrary accountId.

Types of markets:
- **prediction markets (binary)** ✅ - exchange collateral tokens for position tokens on a binary event that occurs at some point in future
- **prediction markets (multiple-outcomes) 🧠🧠🧠** - exchange collateral tokens for position tokens on an event (with multiple outcomes) that occurs at some point in future
- **perpetual futures market** ✅ - exchange collateral tokens for position tokens on a market that never expires
- **perpetual futures market (leveraged)** 🧠 - exchange collateral tokens for position tokens on a market that never expires, with leverage
- **options market** 🧠🧠 - exchange collateral tokens for position tokens on an options market that expires, with x100 leverage (e.g. mirror CBOE rules)
- **etc.**

A more generic version of Prism's orderbook should support leverage - e.g. the perpetual futures market (leveraged) scenario above. Currently the CLOB does not support leverage-based trading. In future, the CLOB can be modified to support leveraged-based trading.

To support leverage, the CLOB order object (`CreateOrderRequestClob`) would be modified slightly to add an additional field called `leverage` (type float).

```proto
message CreateOrderRequestClob {
  string tx_id = 1 [json_name = "txId", (validate.rules).string = {pattern: "(?i)^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"} /* Strict RFC-9562-compliant UUIDv7 */];
  string net = 2 [json_name = "net"];
  string market_id = 3 [json_name = "marketId"];
  string account_id = 4 [json_name = "accountId"];
  double price_usd = 5 [json_name = "priceUsd"];
  double qty = 6 [json_name = "qty"];
  double qty_orig = 7 [json_name = "qtyOrig"]; // keep track of the original qty for signature validation
  string sig = 8 [json_name = "sig"];
  string public_key = 9 [json_name = "publicKey"]; // pass key info - i) avoid lookups ii) handle situation where user has changed their key
  string evm_address = 10 [json_name = "evmAddress"];
  int32 key_type = 11 [json_name = "keyType"];
  string primary_secondary = 12 [json_name = "primarySecondary", (validate.rules).string = {in: ["p", "s"]}];
  /////
  // --> add this field:
  /////
  float leverage = 13 [json_name = "leverage", (validate.rules).float = {gt: 0.0, lte: 100.0}];
}
```

The matching engine would then need to be updated to support leverage.

Additionally, the CLOB would need a number of extra configuration parameters:

```text
LIQUIDATION_PERCENT=98.0
PERCENT_FEE_ON_LIQUIDATION=5.0
```

For example, a user who opens a 3x leveraged position on Bitcoin at $100,000 would loose al their collateral (liquidated) at 98% of $66,666, or $67,333.33. The user would double the value of their collateral when the Bitcoin price is $133,333.

A 3x leverage position on one side should match with a 3x leverage position on the other side. Similarly, a x10 position on one side (e.g. BUY) should match with a x10 position on the other side (SELL). Otherwise, there are asymmetric risk and settlement issues as detailed below.

Were a 1x position to match with a 3x position, the following asymmetric risk and settlement issues arise:

- A 3x buyer should never fills against a 1x seller as leverage is a user intent — silently changing it would alter their risk profile without consent

- Liquidation thresholds differ: The 3x side can be liquidated much earlier than the 1x side, leading to unfair outcomes and unclear responsibility for margin calls.

- Payouts are mismatched: The 3x user risks less collateral per notional, but stands to lose it all faster, while the 1x user’s position is much safer. This creates an imbalance in risk/reward.

- Fee and reward distribution is unclear: On liquidation, it’s ambiguous how to split fees and remaining collateral between parties with different leverage.

- Market manipulation risk: A high-leverage user could intentionally match with low-leverage users to exploit liquidation mechanics.

- Accounting complexity: Tracking PnL, margin, and settlement for mismatched leverage pairs is much more complex and error-prone.

For these reasons, matching only identical leverage levels keeps the system fair, predictable, and simple to settle.

In effect, a set of leverage levels would be pre-defined (e.g. `{x1, x3, x5, x10, x50}`) resulting in a separate bucket (on the same market, same orderbook) for each amount of leverage.

On order entry, an order would get liquidated according to the following formula:

```bash

# 3x leveraged long on Bitcoin price (current price = 100,00)

liq_price = entry_price (1  - (LIQUIDATION_PERCENT/100) / LEVERAGE)

liq_price = entry_price * (1 - (0.98 / 3.0))

liq_price = 100000 * (1 - (0.98 / 3.0))

liq_price = 67333.33
```

### Cascade risk

The main operational concern is a liquidation cascade at high leverage tiers. If price drops 2%, all 50x longs liquidate simultaneously. That selling pressure could then move price another 2%, cascading into 10x positions. A liquidation engine should:

Process liquidations in price order (worst first), not in bulk. Publish each liquidation to NATS as it happens so downstream settlement can keep up. Optionally enforce a circuit breaker - if X% of a leverage tier is liquidated within N seconds, pause new orders for that tier.

### Leveraged orderbook implementation

Rather than one buy_orders/sell_orders per OrderBook, bucket by leverage:

```rust
buy_orders: HashMap<u32, Vec<CreateOrderRequestClob>>,   // key: leverage * 10 (e.g. 30, 50, 100, 500)
sell_orders: HashMap<u32, Vec<CreateOrderRequestClob>>,
leveraged_positions: Vec<LeveragedPosition>,

// note: leverage key is an integer (scaled) which avoids float comparison issues in the hashmap
```

Modify orderbook.rs as follows:

```rust
const LIQUIDATION_THRESHOLD: f64 = 0.98;
const LIQUIDATION_EXCHANGE_FEE: f64 = 0.01;
const LIQUIDATION_PROVIDER_FEE: f64 = 0.01;

#[derive(Debug, Clone)]
pub struct LeveragedPosition {
    pub id: String,
    pub market_id: String,
    pub taker_account_id: String,     // the user who submitted the incoming order
    pub provider_account_id: String,  // the resting-order counterparty
    pub taker_tx_id: String,
    pub provider_tx_id: String,
    pub entry_price_usd: f64,         // absolute value at match
    pub qty: f64,                     // matched quantity
    pub leverage: f64,
    pub taker_collateral: f64,        // entry_price_usd * qty / leverage
    pub is_long: bool,                // taker is the YES/buy side
    pub liquidation_price: f64,       // pre-computed at match time
}

...


impl OrderBook {
    pub fn new(nats_service: &nats::NatsService) -> Self {
        Self {
            buy_orders: Vec::new(),
            sell_orders: Vec::new(),
            leveraged_positions: Vec::new(),
            nats_service: Arc::new(nats_service.clone()),
        }
    }

    fn create_leveraged_position(incoming: &CreateOrderRequestClob, existing: &CreateOrderRequestClob, qty_matched: f64) -> LeveragedPosition {
        let entry_price = existing.price_usd.abs();
        let taker_collateral = entry_price * qty_matched / incoming.leverage;
        let is_long = incoming.price_usd > 0.0;
        let liquidation_price = if is_long {
            entry_price * (1.0 - LIQUIDATION_THRESHOLD / incoming.leverage)
        } else {
            entry_price * (1.0 + LIQUIDATION_THRESHOLD / incoming.leverage)
        };
        LeveragedPosition {
            id: uuid::Uuid::new_v4().to_string(),
            market_id: incoming.market_id.clone(),
            taker_account_id: incoming.account_id.clone(),
            provider_account_id: existing.account_id.clone(),
            taker_tx_id: incoming.tx_id.clone(),
            provider_tx_id: existing.tx_id.clone(),
            entry_price_usd: entry_price,
            qty: qty_matched,
            leverage: incoming.leverage,
            taker_collateral,
            is_long,
            liquidation_price,
        }
    }

    pub async fn check_liquidations(&mut self) {
        let best_bid = self.buy_orders.iter().map(|o| o.price_usd).fold(f64::NEG_INFINITY, f64::max);
        let best_ask = self.sell_orders.iter().map(|o| o.price_usd.abs()).fold(f64::INFINITY, f64::min);

        let mut to_liquidate: Vec<usize> = Vec::new();
        for (idx, pos) in self.leveraged_positions.iter().enumerate() {
            let liquidated = if pos.is_long {
                best_bid != f64::NEG_INFINITY && best_bid <= pos.liquidation_price
            } else {
                best_ask != f64::INFINITY && best_ask >= pos.liquidation_price
            };
            if liquidated {
                to_liquidate.push(idx);
            }
        }

        // Drain in reverse to preserve indices
        for idx in to_liquidate.into_iter().rev() {
            let pos = self.leveraged_positions.remove(idx);
            let exchange_fee = pos.taker_collateral * LIQUIDATION_EXCHANGE_FEE;
            let provider_fee = pos.taker_collateral * LIQUIDATION_PROVIDER_FEE;
            log::info!(
                "LIQUIDATION\t Position {} liquidated. taker={} provider={} exchange_fee=${:.4} provider_fee=${:.4}",
                pos.id, pos.taker_account_id, pos.provider_account_id, exchange_fee, provider_fee
            );
            let nats_clone = self.nats_service.clone();
            tokio::spawn(async move {
                if let Err(e) = nats_clone.publish_liquidation(&pos, exchange_fee, provider_fee).await {
                    log::error!("NATS\tFailed to publish liquidation: {}", e);
                }
            });
        }
    }
...

// and modify the matching engine to support leverage:

impl OrderBook {
    pub fn new(nats_service: &nats::NatsService) -> Self {
        Self {
            buy_orders: Vec::new(),
            sell_orders: Vec::new(),
            leveraged_positions: Vec::new(),
            nats_service: Arc::new(nats_service.clone()),
        }
    }

    fn create_leveraged_position(incoming: &CreateOrderRequestClob, existing: &CreateOrderRequestClob, qty_matched: f64) -> LeveragedPosition {
        let entry_price = existing.price_usd.abs();
        let taker_collateral = entry_price * qty_matched / incoming.leverage;
        let is_long = incoming.price_usd > 0.0;
        let liquidation_price = if is_long {
            entry_price * (1.0 - LIQUIDATION_THRESHOLD / incoming.leverage)
        } else {
            entry_price * (1.0 + LIQUIDATION_THRESHOLD / incoming.leverage)
        };
        LeveragedPosition {
            id: uuid::Uuid::new_v4().to_string(),
            market_id: incoming.market_id.clone(),
            taker_account_id: incoming.account_id.clone(),
            provider_account_id: existing.account_id.clone(),
            taker_tx_id: incoming.tx_id.clone(),
            provider_tx_id: existing.tx_id.clone(),
            entry_price_usd: entry_price,
            qty: qty_matched,
            leverage: incoming.leverage,
            taker_collateral,
            is_long,
            liquidation_price,
        }
    }

    pub async fn check_liquidations(&mut self) {
        let best_bid = self.buy_orders.iter().map(|o| o.price_usd).fold(f64::NEG_INFINITY, f64::max);
        let best_ask = self.sell_orders.iter().map(|o| o.price_usd.abs()).fold(f64::INFINITY, f64::min);

        let mut to_liquidate: Vec<usize> = Vec::new();
        for (idx, pos) in self.leveraged_positions.iter().enumerate() {
            let liquidated = if pos.is_long {
                best_bid != f64::NEG_INFINITY && best_bid <= pos.liquidation_price
            } else {
                best_ask != f64::INFINITY && best_ask >= pos.liquidation_price
            };
            if liquidated {
                to_liquidate.push(idx);
            }
        }

        // Drain in reverse to preserve indices
        for idx in to_liquidate.into_iter().rev() {
            let pos = self.leveraged_positions.remove(idx);
            let exchange_fee = pos.taker_collateral * LIQUIDATION_EXCHANGE_FEE;
            let provider_fee = pos.taker_collateral * LIQUIDATION_PROVIDER_FEE;
            log::info!(
                "LIQUIDATION\t Position {} liquidated. taker={} provider={} exchange_fee=${:.4} provider_fee=${:.4}",
                pos.id, pos.taker_account_id, pos.provider_account_id, exchange_fee, provider_fee
            );
            let nats_clone = self.nats_service.clone();
            tokio::spawn(async move {
                if let Err(e) = nats_clone.publish_liquidation(&pos, exchange_fee, provider_fee).await {
                    log::error!("NATS\tFailed to publish liquidation: {}", e);
                }
            });
        }
    }

```

```rust
// nats.rs - publish liquidation events to NATS:
// subject: "clob.liquidations"
pub async fn publish_liquidation(&self, pos: &LeveragedPosition, exchange_fee: f64, provider_fee: f64) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let payload = serde_json::json!({
            "positionId":         pos.id,
            "marketId":           pos.market_id,
            "takerAccountId":     pos.taker_account_id,
            "providerAccountId":  pos.provider_account_id,
            "takerTxId":          pos.taker_tx_id,
            "providerTxId":       pos.provider_tx_id,
            "entryPriceUsd":      pos.entry_price_usd,
            "qty":                pos.qty,
            "leverage":           pos.leverage,
            "takerCollateral":    pos.taker_collateral,
            "exchangeFee":        exchange_fee,
            "providerFee":        provider_fee,
            "isLong":             pos.is_long,
            "liquidationPrice":   pos.liquidation_price,
            "timestampMs":        chrono::Utc::now().timestamp_millis(),
        });
        let payload_bytes = serde_json::to_vec(&payload)?;
        let _ = self.nats_client.publish(constants::CLOB_LIQUIDATIONS, payload_bytes.into()).await;
        log::info!("NATS\tPublished LIQUIDATION - Position: {} Market: {}", pos.id, pos.market_id);
        Ok(())
    }
```

### Implementation costs

The cost of implementation (time) is reasonable.

The existing off-chain orderbook should be modified for a perpetual futures scenario:

- market never expires
- modify CLOB to support leverage buckets (off-chain)
- on-chain settlement of orders with leveraged bucket params

Implementation of proof-of-concept: 1 week

Testing and verification of PoC: 1 week

Productionising proof-of-concept: 1 month

### Implementation risks

The following risks (in order of perceived probability):

- Unforeseen errors
- front-end wallet UX niggles
- smart contract complexity and delays
- clob bugs - memory leaks, performance issues
- etc.

-------------

## Fresh perspective

**Above information is now stale**

Below is a draft collection of thoughts on a perp futures marketsplace on Hedera


The original idea was to have markets with isolated margin for leverage which fragments liq. Liquidity is a scarce commodity and we should maximise the use of it, not fragment it. More desirable to have a single liquidity pool (for collateral). Liq pool providers earn yield.

Multiple markets (say a handful initially) - all use the same liq pool

Funding is needed to anchor perp price to spot. LP vault may receive or pay funding depending on imbalance

Assume: isolated margin is not desirable due to liquidity being a scarce resource - we want to make the most of any liquidity we have.

CLOB should match order intent (including leveraged order intents) and utilise the liq pool

Robust **risk management** system needs to be in place

Robust **liquidation** system needs to be in place

Hypothesis: max leverage of x1.3? This is desirable for the following reasons:
    - takes a lot of the edge off our risk and makes risk management a bit less risky
    - 1.3 is a conservative risk parameter that significantly reduces the chance of cascading liquidations and large bad debts, at the cost of making the market less attractive to traders seeking high leverage
    - x1.3 leverage is often sufficient for a funding-rate arbitrage strategy
    - x1.3 repels market manipulators as it may not be not worth the effort
    - x1.3 gives confidence to holders that the risk of being wiped out may be lower

    - attract funding rate traders and bots: using 1.3× leverage might increase the return on your committed capital to roughly 13% before borrowing costs, fees, and slippage.
    - Funding rates can flip sign, basis can widen, and exchange-specific margin requirements can change. Running close to the maximum leverage leaves less room for adverse moves. x1.3 attenuates adverse moves and liquidit cascades.
    - Imperfect hedging, liquidation rules, and transaction costs can materially affect profitability

The perp'd asset itself should be exportable (+ importable) via CLPR

Design a funding rate mechanism for perp pricing

Use Hyperliq itself for the price?

**Pricing**

last trade price,  index price, mark price (liquidations), funding price:

- last trade price: Price of the most recent executed trade (easily manipulated - used for charts, ticker display)
- index price: external reference price, usually aggregated from multiple spot exchanges
- mark price: fair price derived from an index and/or premium can also include moving av (manip resistant - used for liquidations, unrealized PnL)
- funding price: price or premium used to compute funding payments (based on mark/index data and time averaging so manip resistant - used for calculating funding rates)

`premium = (mark price - index price) / index price`

Non-copyrighted, reliable pricing source (especially unlisted tickers, obscure exchanges)
    - use prediction markets t+5min price? Auction.
    - **net position in/out costs should be x10 cheaper on Hedera than Hyperliquid**
    - Niche: 
    - signed data feeds (Binance, etc.)
    - become the authoritative data source
    - anti-manip protections (e.g. someone could own a large stake in the prediction adjudication mechanism)
        - combine multiple sources
        - TWAP
        - abnormality filter
        - oracle sigs
        - cross-check with orderbook
        - auction? (settlement window)
        - digital identity + stake?


So, build a clob with leverage capability and includes an on-chain liq pool

- risk engine
- funding engine
- liquidation engine

CLOB (central limit order book) -> price formation
Off-chain order submission + matching -> speed
On-chain settlement layer -> trust + finality
Shared liquidity pool (vault) -> provides leverage + absorbs PnL
No isolated margin -> all traders share risk pool

**pooled margin**

Instead of each user posting margin per position, users deposit capital into a shared liquidity pool.
The pool acts as:
- counterparty to trades (synthetically)
- insurance buffer
- margin backing for leverage

`Pool Equity = Deposits + PnL from traders - Losses`

Traders do NOT directly hold margin in isolation. There is no isolated liquidation engine per account balance sheet. Risk is evaluated against pool solvency

The margin pool is the counterparty of last resort.

The pool is the clearing house!

System level controls for managing risk:

- global hard constraints `Total exposure ≤ Pool Equity × max leverage factor`
    If breached:
    - block new orders
    - reduce allowed size
    - increase margin requirements dynamically
- dynamic maintainence buffer `Effective margin requirement = function(volatility, exposure)`
    If vol spikes:
    - leverage reduces automatically
    - trading becomes more expensive (higher implicit margin requirement)
- socialized loss (if needed)
If pool becomes undercollateralized, losses are shared across all LPs or insurance fund absorbs first



Advantages of such a system:

- Very high capital efficiency
- No fragmented margin accounts
- Simple UX (like "balance + position")
- Fast matching (off-chain CLOB)
- Deep liquidity (pooled)

Risks
1. Correlation risk (fatal in crashes)
If everyone is long, the pool is short -> crash -> pool absorbs losses

2. Bank-run dynamics

If users fear insolvency:
- withdraw liquidity
- reduces margin buffer
- accelerates collapse

3. Oracle + manipulation coupling

Since liquidation is pool-based, mark/index manipulation becomes systemic risk

Risk mitigations:

- Risk engines which exposure caps per market, dynamic leverage curves. Position limits: per-user, per-market,
per-leverage tier
- Circuit breakers to halt trading during dislocations
- Insurance fund to absorb tail losses before LPs
- Soft liquidation (instead of hard liquidation) - gradually reduce positions to avoid cascade events