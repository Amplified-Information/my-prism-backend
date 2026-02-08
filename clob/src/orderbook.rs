use tokio::sync::RwLock;
use std::{sync::Arc, collections::{HashMap, HashSet}};
use once_cell::sync::Lazy;
use std::sync::Mutex;
use log;

// Global LUT to ensure unique tx_id's
static TX_ID_LUT: Lazy<Mutex<HashSet<String>>> = Lazy::new(|| Mutex::new(HashSet::new()));

pub mod proto {
    tonic::include_proto!("clob");
}
use proto::{CreateOrderRequestClob, BookSnapshot, OrderDetail};

use crate::{nats};

#[derive(Debug, Clone)]
pub struct OrderBookService {
    order_books: Arc<RwLock<HashMap<String, Arc<RwLock<OrderBook>>>>>,
    nats_service: nats::NatsService,
}

impl OrderBookService {
    pub async fn new(nats_service: nats::NatsService) -> Self {
        
        Self {
            order_books: Arc::new(RwLock::new(HashMap::new())),
            nats_service, // Initialize NATS service here
        }
    }

    pub async fn add_market(&self, market_id: String) -> Result<bool, Box<dyn std::error::Error>> {
        // No guards for performance - assume validated upstream

        // prevent overwriting existing market
        // let poly_id = net.clone() + ":" + &market_id;   // <hederaNet>:<UUID>
        if self.order_books.read().await.contains_key(&market_id.to_lowercase()) {
            log::warn!("WARN: Attempt to create a market ({}) which already exists in OrderBookService", market_id.to_ascii_lowercase());
            return Ok(false);
        }

        let mut order_books = self.order_books.write().await;
        order_books.insert(market_id.to_lowercase(), Arc::new(RwLock::new(OrderBook::new(&self.nats_service))));

        log::info!("New market \"{}\" added to OrderBookService", market_id.to_lowercase());
        return Ok(true);
    }

    // pub async fn remove_market(&self, market_id: &str) {
    // // Guards
    // if !is_valid_market_id(market_id.clone()) {
    //     log::error!("Invalid market_id format: {}", market_id);
    //     return;
    // }
    //     let mut order_books = self.order_books.write().await;
    //     order_books.remove(market_id);
    // }

    pub async fn order_exists(&self, tx_id: &str) -> bool {
        let lut = TX_ID_LUT.lock().unwrap();
        lut.contains(tx_id)
    }

    pub async fn place_order(&self, order: CreateOrderRequestClob) -> Result<(), Box<dyn std::error::Error>> {
        // No guards for performance - assume validated upstream
        let order_books = self.order_books.read().await;
        if let Some(order_book) = order_books.get(&order.market_id.to_lowercase()) {
            let tx_id = order.tx_id.clone();
            let mut book = order_book.write().await;
            book.add_order(order).await;

            // Add tx_id to the LUT to avoid duplicate tx_ids
            let mut lut = TX_ID_LUT.lock().unwrap();
            lut.insert(tx_id);

            // return OK
            Ok(())
        } else {
            Err("Market not found".into())
        }
    }

    pub async fn get_book(&self, market_id: &str, depth: usize) -> Result<BookSnapshot, Box<dyn std::error::Error>> {
        // No guards for performance - assume validated upstream

        let order_books: tokio::sync::RwLockReadGuard<'_, HashMap<String, Arc<RwLock<OrderBook>>>> = self.order_books.read().await;
        // let poly_id = net.to_string() + ":" + market_id;   // <hederaNet>:<UUID>
        if let Some(order_book) = order_books.get(&market_id.to_string()) {
            let book = order_book.read().await;
            Ok(book.snapshot(depth))
        } else {
            Err("Market not found".into())
        }
    }

    // pub fn start_periodic_scan(&self, market_id: &str, duration_seconds: u64) -> Result<impl Future<Output = Result<(), Box<dyn std::error::Error>>>, Box<dyn std::error::Error>> {
    //     let order_books = self.order_books.clone();
    //     let market_id = market_id.to_string().to_lowercase();

    //     if let Some(order_book) = order_books.blocking_read().get(&market_id.to_lowercase()) {
    //         let order_book = Arc::clone(order_book);
    //         Ok(async move {
    //             let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(duration_seconds));
    //             loop {
    //                 interval.tick().await;
    //                 let mut book = order_book.write().await;
    //                 book.scan_for_matches().await;
    //             }
    //         })
    //     } else {
    //         Err("Market not found".into())
    //     }
    // }

    pub async fn get_price_update(&self, market_id: &str) -> Result<proto::PriceUpdate, Box<dyn std::error::Error>> {
        // No guards for performance - assume validated upstream

        let order_books = self.order_books.read().await;
        // let poly_id = net.to_string() + ":" + market_id;   // <hederaNet>:<UUID>
        if let Some(order_book) = order_books.get(&market_id.to_lowercase()) {
            let book = order_book.read().await;

            // Determine the latest price from the order book
            let best_bid = book.buy_orders.iter().map(|o| o.price_usd).max_by(|a, b| a.partial_cmp(b).unwrap());
            let best_ask = book.sell_orders.iter().map(|o| o.price_usd).min_by(|a, b| a.partial_cmp(b).unwrap());

            // let latest_price = match (best_bid, best_ask) {
            //     (Some(bid), Some(ask)) => (bid + ask) / 2.0, // Midpoint
            //     (Some(bid), None) => bid,
            //     (None, Some(ask)) => ask,
            //     (None, None) => 0.5, // No orders
            // };

            let best_bid = best_bid.unwrap_or(0.5);
            let best_ask = best_ask.unwrap_or(0.5);

            let price_update = proto::PriceUpdate {
                price_bid_usd: best_bid,
                price_ask_usd: best_ask,
                timestamp_ms: chrono::Utc::now().timestamp_millis(),
            };

            Ok(price_update)
        } else {
            Err(format!("Market not found {}", market_id).into())
        }
    }

    pub async fn cancel_order(&self, market_id: &str, tx_id: &str) -> Result<bool, Box<dyn std::error::Error>> {
        // No guards for performance - assume validated upstream

        let order_books = self.order_books.read().await;
        if let Some(order_book) = order_books.get(&market_id.to_lowercase()) {
            let mut book = order_book.write().await;

            // Try to find and remove the order from buy orders
            if let Some(pos) = book.buy_orders.iter().position(|o| o.tx_id == tx_id) {
                book.buy_orders.remove(pos);

                log::info!("Order with tx_id {} cancelled from buy orders in market {}", tx_id, market_id);
                return Ok(true);
            }

            // Try to find and remove the order from sell orders
            if let Some(pos) = book.sell_orders.iter().position(|o| o.tx_id == tx_id) {
                book.sell_orders.remove(pos);

                log::info!("Order with tx_id {} cancelled from sell orders in market {}", tx_id, market_id);
                return Ok(true);
            }

            log::warn!("Order with tx_id {} not found in market {}", tx_id, market_id);
            Ok(false)
        } else {
            Err("Market not found".into())
        }
    }

    pub async fn get_orders_for_user(&self, evm_address: &str) -> Result<Vec<CreateOrderRequestClob>, Box<dyn std::error::Error>> {
        // No guards for performance - assume validated upstream

        let order_books = self.order_books.read().await;
        let mut user_orders = Vec::new();

        for (_market_id, order_book) in order_books.iter() {
            let book = order_book.read().await;

            // Check buy orders
            for order in &book.buy_orders {
                if order.account_id.eq_ignore_ascii_case(evm_address) {
                    user_orders.push(order.clone());
                }
            }

            // Check sell orders
            for order in &book.sell_orders {
                if order.account_id.eq_ignore_ascii_case(evm_address) {
                    user_orders.push(order.clone());
                }
            }
        }

        Ok(user_orders)
    }
}

#[derive(Debug)]
pub struct OrderBook {
    buy_orders: Vec<CreateOrderRequestClob>,
    sell_orders: Vec<CreateOrderRequestClob>,
    nats_service: Arc<nats::NatsService> // wrap in arc to make cloning cheap
}

impl OrderBook {
    pub fn new(nats_service: &nats::NatsService) -> Self {
        Self {
            buy_orders: Vec::new(),
            sell_orders: Vec::new(),
            nats_service: Arc::new(nats_service.clone()),
        }
    }

    pub async fn add_order(&mut self, order: CreateOrderRequestClob) {
        // No guards for performance - assume validated upstream

        log::info!("CREATE \t CreateOrderRequestClob: {:?}", order); // Log the incoming order

        if order.price_usd < 0.0 {
            Self::match_order(&self.nats_service, order, &mut self.buy_orders, &mut self.sell_orders).await;
        } else {
            Self::match_order(&self.nats_service, order, &mut self.sell_orders, &mut self.buy_orders).await;
        }
    }

    async fn match_order(nats_service: &nats::NatsService, mut incoming_order: CreateOrderRequestClob, opposite_orders: &mut Vec<CreateOrderRequestClob>, same_side_orders: &mut Vec<CreateOrderRequestClob>) {
        // No guards for performance - assume validated upstream

        opposite_orders.sort_by(|a, b| b.price_usd.partial_cmp(&a.price_usd).unwrap());

        let i = 0;
        while i < opposite_orders.len() {
            let existing_order = &mut opposite_orders[i];
            // Match based on price constraints
            if (incoming_order.price_usd > 0.0 && incoming_order.price_usd >= existing_order.price_usd) ||
               (incoming_order.price_usd < 0.0 && existing_order.price_usd >= incoming_order.price_usd.abs()) {

                let orc2= existing_order.clone();
                if incoming_order.qty <= existing_order.qty {
                    // FULL match!
                    existing_order.qty -= incoming_order.qty;
                    if existing_order.qty == 0.0 {
                        opposite_orders.remove(i);
                    }

                    log::info!("MATCH \t OrderRequestClob: {:?}", incoming_order);
                    
                    // Notify NATS of full match - spawn to fire/forget
                    let orc1 = incoming_order.clone();
                    let nats_clone = nats_service.clone();
                    tokio::spawn(async move {
                        // ensure the positive price order is always first!
                        let (first, second) = if orc1.price_usd >= 0.0 {
                            (&orc1, &orc2)
                        } else {
                            (&orc2, &orc1)
                        };
                        if let Err(e) = nats_clone.publish_match(false, first, second).await {
                            log::error!("NATS\tFailed to publish match: {}", e);
                        }
                    });
                    
                    return;
                } else {
                    // PARTIAL match
                    incoming_order.qty -= existing_order.qty;
                    opposite_orders.remove(i);

                    log::info!("MATCH_PARTIAL \t Remaining incoming order quantity: {}", incoming_order.qty);
                    
                     // Notify NATS of partial match - spawn to fire/forget
                    let orc1 = incoming_order.clone();
                    let nats_clone = nats_service.clone();
                    tokio::spawn(async move {
                        // ensure the positive price order is always first!
                        let (first, second) = if orc1.price_usd >= 0.0 {
                            (&orc1, &orc2)
                        } else {
                            (&orc2, &orc1)
                        };
                        if let Err(e) = nats_clone.publish_match(true, first, second).await {
                            log::error!("NATS\tFailed to publish (partial) match: {}", e);
                        }
                    });
                    continue; // Continue searching for additional matches (partial match)
                }
            } else {
                // No match possible due to price constraint
                break;
            }
        }

        // If no match, add to the respective order book // log::info!("No match found, adding to same side orders: {:?}", incoming_order);
        same_side_orders.push(incoming_order);
    }

    pub fn snapshot(&self, depth: usize) -> BookSnapshot {
        // No guards for performance - assume validated upstream

        let effective_depth = if depth == 0 { usize::MAX } else { depth }; // depth = 0 -> return everything

        BookSnapshot {
            bids: self.buy_orders.iter().map(|order| OrderDetail {
                tx_id: order.tx_id.clone(),
                account_id: order.account_id.clone(),
                price_usd: order.price_usd,
                qty: order.qty,
            }).collect(),
            asks: self.sell_orders.iter().map(|order| OrderDetail {
                tx_id: order.tx_id.clone(),
                account_id: order.account_id.clone(),
                price_usd: order.price_usd,
                qty: order.qty,
            }).take(effective_depth).collect(),
        }
    }

    // // Scan to find matches in the order book
    // // This function runs periodically
    // pub async fn scan_for_matches(&mut self) {
    //     log::info!("SCAN \t Scanning orderbook for matches...");

    //     // Sort buy orders by price descending (highest first)
    //     self.buy_orders.sort_by(|a, b| b.price_usd.partial_cmp(&a.price_usd).unwrap());
    //     // Sort sell orders by price ascending (lowest first)
    //     self.sell_orders.sort_by(|a, b| a.price_usd.partial_cmp(&b.price_usd).unwrap());

    //     // Attempt to match all sell orders with buy orders
    //     let mut i = 0;
    //     while i < self.sell_orders.len() {
    //         let sell_order = self.sell_orders[i].clone();

    //         // Check if the sell order can be matched with the highest buy order
    //         if let Some(highest_buy_order) = self.buy_orders.first() {
    //             if sell_order.price_usd.abs() <= highest_buy_order.price_usd {
    //                 self.sell_orders.remove(i);
    //                 Self::match_order(&self.nats_service, sell_order, &mut self.buy_orders, &mut self.sell_orders).await;
    //                 continue; // Recheck the current index after removal
    //             }
    //         }

    //         i += 1; // Move to the next sell order if no match
    //     }

    //     // Attempt to match all buy orders with sell orders
    //     let mut i = 0;
    //     while i < self.buy_orders.len() {
    //         let buy_order = self.buy_orders[i].clone();

    //         // Check if the buy order can be matched with the lowest sell order
    //         if let Some(lowest_sell_order) = self.sell_orders.first() {
    //             if buy_order.price_usd >= lowest_sell_order.price_usd.abs() {
    //                 self.buy_orders.remove(i);
    //                 Self::match_order(&self.nats_service, buy_order, &mut self.sell_orders, &mut self.buy_orders).await;
    //                 continue; // Recheck the current index after removal
    //             }
    //         }

    //         i += 1; // Move to the next buy order if no match
    //     }

    //     log::info!("SCAN \t Complete.");
    // }
}
