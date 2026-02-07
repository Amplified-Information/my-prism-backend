use crate::{constants, orderbook::{OrderBookService, proto::CreateOrderRequestClob}};
use async_nats::ServerAddr;
use futures_util::StreamExt;

#[derive(Debug, Clone)]
pub struct NatsService {
    pub(crate) nats_client: async_nats::Client
}

impl NatsService {
    pub async fn new(nats_host: &str, nats_port: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let nats_address = format!("{}:{}", nats_host, nats_port);
        log::info!("NATS \t Connecting to: {}", nats_address);
        let _nats_client = async_nats::connect(nats_address.parse::<ServerAddr>()?).await?;
        Ok(Self { nats_client: _nats_client })
    }

    pub async fn subscribe_and_place_orders(
        nats: &async_nats::Client,
        order_book_service: OrderBookService,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        log::info!("NATS \t Listening on: \"{}\"", constants::CLOB_ORDERS);

        let mut subscriber = nats.subscribe(constants::CLOB_ORDERS.to_string()).await?;

        while let Some(message) = subscriber.next().await {
            match serde_json::from_slice::<CreateOrderRequestClob>(&message.payload) {
                Ok(order) => {
                    // Check if the order with the same txId already exists
                    if order_book_service.order_exists(&order.tx_id).await {
                        log::warn!("Duplicate order txId detected: {}. Order not entered into the orderbook.", order.tx_id);
                    } else {
                        let _ = order_book_service.place_order(order).await;
                    }
                }
                Err(err) => {
                    log::error!(
                        "Failed to deserialize message payload: {:?}, error: {}",
                        message.payload, err
                    );
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

    pub async fn publish_match(&self, is_partial_match: bool, yes_side_pos_price_usd: &CreateOrderRequestClob, no_side_neg_price_usd: &CreateOrderRequestClob) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let orders: Vec<CreateOrderRequestClob> = vec![yes_side_pos_price_usd.clone(), no_side_neg_price_usd.clone()]; // Create a vector of CreateOrderRequestClob
        let payload = serde_json::to_vec(&orders).unwrap();
        let _ = self.nats_client.publish(if is_partial_match { constants::CLOB_MATCHES_PARTIAL } else { constants::CLOB_MATCHES_FULL }, payload.into()).await;
        log::info!("NATS \t Published MATCH - YES: {:?} NO: {:?}", yes_side_pos_price_usd, no_side_neg_price_usd);
        Ok(())
    }
}
