use crate::{constants, orderbook::{OrderBookService, proto::{ClobMatch, CreateOrderRequestClob}}};
use async_nats::{jetstream, ServerAddr};
use futures_util::StreamExt;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct NatsService {
    pub(crate) nats_client: async_nats::Client,
    jetstream: jetstream::Context,
}

impl NatsService {
    pub async fn new(nats_host: &str, nats_port: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let nats_address = format!("{}:{}", nats_host, nats_port);
        log::info!("NATS \t Connecting to: {}", nats_address);
        let user = std::env::var("NATS_USER").map_err(|_| "NATS_USER is required")?;
        let password = std::env::var("NATS_PASSWORD").map_err(|_| "NATS_PASSWORD is required")?;
        let nats_client = async_nats::ConnectOptions::new()
            .user_and_password(user, password)
            .name("prism-clob")
            .connect(nats_address.parse::<ServerAddr>()?)
            .await?;
        let jetstream = jetstream::new(nats_client.clone());
        Ok(Self { nats_client, jetstream })
    }

    pub async fn subscribe_and_place_orders(
        service: &NatsService,
        order_book_service: OrderBookService,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        log::info!("NATS \t Listening on: \"{}\"", constants::CLOB_ORDERS);

        let stream = service.jetstream.get_stream("CLOB_ORDERS").await?;
        let consumer = stream
            .get_or_create_consumer(
                "clob-orderbook-v1",
                jetstream::consumer::pull::Config {
                    durable_name: Some("clob-orderbook-v1".to_string()),
                    filter_subject: constants::CLOB_ORDERS.to_string(),
                    ack_policy: jetstream::consumer::AckPolicy::Explicit,
                    ack_wait: Duration::from_secs(30),
                    max_deliver: 20,
                    ..Default::default()
                },
            )
            .await?;
        let mut subscriber = consumer.messages().await?;

        while let Some(message) = subscriber.next().await {
            let message = message?;
            match serde_json::from_slice::<CreateOrderRequestClob>(&message.payload) {
                Ok(order) => {
                    // Check if the order with the same txId already exists
                    if order_book_service.order_exists(&order.tx_id).await {
                        log::warn!("Duplicate order txId detected: {}. Order not entered into the orderbook.", order.tx_id);
                        message.ack().await?;
                    } else {
                        if let Err(err) = order_book_service.place_order(order).await {
                            log::error!("Failed to place order; message will be redelivered: {}", err);
                            continue;
                        }
                        // Keep non-Send service errors out of the future state before awaiting the ack.
                        message.ack().await?;
                    }
                }
                Err(err) => {
                    log::error!(
                        "Failed to deserialize message payload: {:?}, error: {}",
                        message.payload, err
                    );
                    // Poison messages cannot succeed on retry.
                    message.ack().await?;
                }
            }
        }

        Ok(())
    }

    // TODO - should we be using NATS rather than a direct call?
    // pub async fn subscribe_and_cancel_orders(
    //     nats: &async_nats::Client,
    //     order_book_service: OrderBookService,
    // ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    //     log::info!("NATS \t Listening on: \"{}\"", constants::NATS_CLOB_CANCEL_ORDERS);

    //     let mut subscriber = nats.subscribe(constants::NATS_CLOB_CANCEL_ORDERS.to_string()).await?;

    //     while let Some(message) = subscriber.next().await {
    //         match serde_json::from_slice::<crate::proto::CancelOrderRequest>(&message.payload) {
    //             Ok(cancel_request) => {
    //                 let _ = order_book_service.cancel_order(&cancel_request.market_id, &cancel_request.tx_id)
    //                     .await;
    //             }
    //             Err(err) => {
    //                 log::error!(
    //                     "Failed to deserialize cancel order message payload: {:?}, error: {}",
    //                     message.payload, err
    //                 );
    //             }
    //         }
    //     }

    //     Ok(())
    // }

    /// Publishes one fill for settlement. The message ID is unique per fill (it includes
    /// both orders' pre-fill share counts), so JetStream drops a duplicate publish.
    pub async fn publish_match(&self, m: &ClobMatch) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let bid = m.bid.as_ref().ok_or("match without bid")?;
        let ask = m.ask.as_ref().ok_or("match without ask")?;
        let payload = serde_json::to_vec(m)?;
        let message_id = format!(
            "{}:{}:{}:{}:{}",
            m.market_id, bid.tx_id, ask.tx_id, bid.shares_filled, ask.shares_filled,
        );
        let mut headers = async_nats::HeaderMap::new();
        headers.insert("Nats-Msg-Id", message_id);
        self.jetstream
            .publish_with_headers(constants::CLOB_MATCHES_SETTLE, headers, payload.into())
            .await?
            .await?;
        log::info!("NATS Published MATCH bid={} ask={} market_id={}", bid.tx_id, ask.tx_id, m.market_id);
        Ok(())
    }

    /// The book has already applied the fill, so keep trying; if publication still fails
    /// the fill is lost until the API rebuilds the book from settled state on restart.
    pub async fn publish_match_with_retry(&self, m: &ClobMatch) {
        let mut delay = Duration::from_millis(200);
        for attempt in 1..=5 {
            let result = self.publish_match(m).await.map_err(|e| e.to_string());
            match result {
                Ok(()) => return,
                Err(e) => {
                    log::error!("NATS	Failed to publish match (attempt {attempt}): {e}");
                    tokio::time::sleep(delay).await;
                    delay *= 2;
                }
            }
        }
        log::error!(
            "CRITICAL: match not published and will not settle until the CLOB is rebuilt: market_id={} bid={} ask={}",
            m.market_id,
            m.bid.as_ref().map(|o| o.tx_id.as_str()).unwrap_or(""),
            m.ask.as_ref().map(|o| o.tx_id.as_str()).unwrap_or(""),
        );
    }
}
