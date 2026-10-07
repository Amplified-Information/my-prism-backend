use tokio::sync::RwLock;
use std::{sync::Arc, collections::{HashMap, HashSet}};
use once_cell::sync::Lazy;
use std::sync::Mutex;

// Global LUT to ensure unique tx_id's
static TX_ID_LUT: Lazy<Mutex<HashSet<String>>> = Lazy::new(|| Mutex::new(HashSet::new()));

pub mod proto {
    tonic::include_proto!("clob");
}
use proto::{CreateOrderRequestClob, BookSnapshot, OrderDetail};

use crate::matching::{self, Book, PRICE_SCALE};
use crate::nats;

#[derive(Debug, Clone)]
pub struct OrderBookService {
    order_books: Arc<RwLock<HashMap<String, Arc<RwLock<OrderBook>>>>>,
    nats_service: nats::NatsService,
}

impl OrderBookService {
    pub async fn new(nats_service: nats::NatsService) -> Self {
        Self {
            order_books: Arc::new(RwLock::new(HashMap::new())),
            nats_service,
        }
    }

    pub async fn add_market(&self, market_id: String) -> Result<bool, Box<dyn std::error::Error>> {
        // No guards for performance - assume validated upstream

        // prevent overwriting existing market
        if self.order_books.read().await.contains_key(&market_id.to_lowercase()) {
            log::warn!("WARN: Attempt to create a market ({}) which already exists in OrderBookService", market_id.to_ascii_lowercase());
            return Ok(false);
        }

        let mut order_books = self.order_books.write().await;
        order_books.insert(market_id.to_lowercase(), Arc::new(RwLock::new(OrderBook::new(&self.nats_service))));

        log::info!("New market \"{}\" added to OrderBookService", market_id.to_lowercase());
        Ok(true)
    }

    pub async fn order_exists(&self, tx_id: &str) -> bool {
        let lut = TX_ID_LUT.lock().unwrap();
        lut.contains(tx_id)
    }

    pub async fn place_order(&self, order: CreateOrderRequestClob) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // No guards for performance - assume validated upstream
        let order_books = self.order_books.read().await;
        if let Some(order_book) = order_books.get(&order.market_id.to_lowercase()) {
            let tx_id = order.tx_id.clone();
            let mut book = order_book.write().await;
            book.add_order(order).await;

            // Add tx_id to the LUT to avoid duplicate tx_ids
            let mut lut = TX_ID_LUT.lock().unwrap();
            lut.insert(tx_id);

            Ok(())
        } else {
            Err("Market not found".into())
        }
    }

    pub async fn get_book(&self, market_id: &str, depth: usize) -> Result<BookSnapshot, Box<dyn std::error::Error>> {
        // No guards for performance - assume validated upstream
        let order_books = self.order_books.read().await;
        if let Some(order_book) = order_books.get(&market_id.to_lowercase()) {
            let book = order_book.read().await;
            Ok(book.snapshot(depth))
        } else {
            Err("Market not found".into())
        }
    }

    pub async fn get_price_update(&self, market_id: &str) -> Result<proto::PriceUpdate, Box<dyn std::error::Error>> {
        // No guards for performance - assume validated upstream
        let order_books = self.order_books.read().await;
        if let Some(order_book) = order_books.get(&market_id.to_lowercase()) {
            let book = order_book.read().await;

            // Best bid is the highest YES price bid; best ask the lowest YES price ask.
            let best_bid = book.book.bids.iter().map(|o| o.limit_yes_price).max();
            let best_ask = book.book.asks.iter().map(|o| o.limit_yes_price).min();
            let to_price = |p: Option<u64>| p.map(|p| p as f64 / PRICE_SCALE as f64).unwrap_or(0.5);

            Ok(proto::PriceUpdate {
                price_bid_usd: to_price(best_bid),
                price_ask_usd: to_price(best_ask),
                timestamp_ms: chrono::Utc::now().timestamp_millis(),
            })
        } else {
            Err(format!("Market not found {}", market_id).into())
        }
    }

    pub async fn cancel_order(&self, market_id: &str, tx_id: &str) -> Result<bool, Box<dyn std::error::Error>> {
        // No guards for performance - assume validated upstream
        let order_books = self.order_books.read().await;
        if let Some(order_book) = order_books.get(&market_id.to_lowercase()) {
            let mut book = order_book.write().await;
            if book.book.remove(tx_id) {
                log::info!("Order with tx_id {} cancelled in market {}", tx_id, market_id);
                Ok(true)
            } else {
                log::warn!("Order with tx_id {} not found in market {}", tx_id, market_id);
                Ok(false)
            }
        } else {
            Err("Market not found".into())
        }
    }

    pub async fn get_orders_for_user(&self, evm_address: &str) -> Result<Vec<CreateOrderRequestClob>, Box<dyn std::error::Error>> {
        // No guards for performance - assume validated upstream
        let wanted = evm_address.trim_start_matches("0x").to_ascii_lowercase();
        let order_books = self.order_books.read().await;
        let mut user_orders = Vec::new();

        for (_market_id, order_book) in order_books.iter() {
            let book = order_book.read().await;
            user_orders.extend(
                book.book
                    .orders()
                    .filter(|o| o.evm_address.trim_start_matches("0x").eq_ignore_ascii_case(&wanted))
                    .cloned(),
            );
        }

        Ok(user_orders)
    }

    /// Collateral (smallest units) committed by resting orders: each order's unfilled
    /// shares valued at its limit, YES shares at the YES price and NO shares at its complement.
    pub async fn get_tv_pending_units(&self) -> Result<u128, Box<dyn std::error::Error>> {
        // No guards for performance - assume validated upstream
        let order_books = self.order_books.read().await;
        let mut total: u128 = 0;

        for (_market_id, order_book) in order_books.iter() {
            let book = order_book.read().await;
            for order in book.book.orders() {
                let token_price = if order.side == 0 { order.limit_yes_price } else { PRICE_SCALE - order.limit_yes_price.min(PRICE_SCALE) };
                total += matching::remaining_shares(order) as u128 * token_price as u128 / PRICE_SCALE as u128;
            }
        }
        log::info!("tv_pending (collateral units) across all markets: {}", total);
        Ok(total)
    }

    /// Unfilled shares resting on each side: (bids, asks).
    pub async fn get_market_depth_shares(&self, market_id: &str) -> Result<(u64, u64), Box<dyn std::error::Error>> {
        // No guards for performance - assume validated upstream
        let order_books = self.order_books.read().await;
        if let Some(order_book) = order_books.get(&market_id.to_lowercase()) {
            let book = order_book.read().await;
            let sum = |orders: &Vec<CreateOrderRequestClob>| orders.iter().fold(0u64, |acc, o| acc.saturating_add(matching::remaining_shares(o)));
            Ok((sum(&book.book.bids), sum(&book.book.asks)))
        } else {
            Err(format!("Market not found {}", market_id).into())
        }
    }

    pub async fn close_market(&self, market_id: &str) -> Result<bool, Box<dyn std::error::Error>> {
        // No guards for performance - assume validated upstream
        let mut order_books = self.order_books.write().await;
        if order_books.remove(&market_id.to_lowercase()).is_some() {
            log::info!("Market {} closed and removed from OrderBookService", market_id);
            Ok(true)
        } else {
            log::warn!("Attempt to close non-existent market {}", market_id);
            Ok(false)
        }
    }
}

#[derive(Debug)]
pub struct OrderBook {
    book: Book,
    nats_service: Arc<nats::NatsService> // wrap in arc to make cloning cheap
}

impl OrderBook {
    pub fn new(nats_service: &nats::NatsService) -> Self {
        Self {
            book: Book::default(),
            nats_service: Arc::new(nats_service.clone()),
        }
    }

    pub async fn add_order(&mut self, order: CreateOrderRequestClob) {
        // No guards for performance - assume validated upstream

        // Do not log the complete order: it contains a reusable signature.
        log::info!("CREATE tx_id={} market_id={} account_id={}", order.tx_id, order.market_id, order.account_id);

        let now = chrono::Utc::now().timestamp().max(0) as u64;
        let matches = self.book.add(order, now);

        // Publish while holding the book lock so fills reach settlement in the order
        // they happened. Each fill has a deterministic message ID, so a retry is deduplicated.
        for m in matches {
            log::info!(
                "MATCH market_id={} bid={} ask={} shares={} price={}",
                m.market_id,
                m.bid.as_ref().map(|o| o.tx_id.as_str()).unwrap_or(""),
                m.ask.as_ref().map(|o| o.tx_id.as_str()).unwrap_or(""),
                m.fill_shares,
                m.execution_yes_price,
            );
            self.nats_service.publish_match_with_retry(&m).await;
        }
    }

    pub fn snapshot(&self, depth: usize) -> BookSnapshot {
        // No guards for performance - assume validated upstream
        let effective_depth = if depth == 0 { usize::MAX } else { depth }; // depth = 0 -> return everything

        let detail = |order: &CreateOrderRequestClob| OrderDetail {
            tx_id: order.tx_id.clone(),
            account_id: order.account_id.clone(),
            limit_yes_price: order.limit_yes_price,
            shares_remaining: matching::remaining_shares(order),
            side: order.side,
            action: order.action,
        };

        let mut bids: Vec<&CreateOrderRequestClob> = self.book.bids.iter().collect();
        let mut asks: Vec<&CreateOrderRequestClob> = self.book.asks.iter().collect();
        bids.sort_by(|a, b| b.limit_yes_price.cmp(&a.limit_yes_price)); // best (highest) bid first
        asks.sort_by_key(|o| o.limit_yes_price); // best (lowest) ask first

        BookSnapshot {
            bids: bids.into_iter().take(effective_depth).map(|o| detail(o)).collect(),
            asks: asks.into_iter().take(effective_depth).map(|o| detail(o)).collect(),
        }
    }
}
