use futures_util::TryFutureExt;
use tonic::{Request, Response, Status};
use tokio_stream::wrappers::ReceiverStream;
use tokio::sync::mpsc;
use tokio::sync::oneshot;
use crate::orderbook::OrderBookService;
use crate::orderbook::proto::clob_internal_server::ClobInternalServer;
use crate::orderbook::proto::clob_public_server::ClobPublicServer;
use crate::orderbook::proto::{CreateOrderRequestClob, StdResponse, BookRequest, BookSnapshot, clob_public_server::{ClobPublic}, clob_internal_server::{ClobInternal}};
// use tonic_reflection::server::Builder as ReflectionBuilder;

#[derive(Debug, Clone)]
pub struct ClobService {
    order_book_service: OrderBookService,
}

impl ClobService {
    pub fn new(order_book_service: OrderBookService) -> Self {
        Self { order_book_service }
    }
}

// TODO - will want to remove ClobInternal completely
// --> enable Jetstream (durable consumer, ack, idempotent processing, message de-duplication)
// ack - API fires a message, a restarting CLOB will re-process any unacked messages
// idempotent processing - CLOB tracks processed message IDs to avoid duplicates
// message de-duplication - NATS Jetstream can be configured to drop duplicate messages based on IDs
// persistence + logging - Jetstream persists messages to disk, CLOB logs processing results for auditing
// all message payloads on NATS should conform to protobuf definitions
#[tonic::async_trait]
impl ClobInternal for ClobService {
    async fn create_order(
        &self,
        request: Request<CreateOrderRequestClob>,
    ) -> Result<Response<StdResponse>, Status> {
        let order = request.into_inner();
        
        let result = self.order_book_service.place_order(order).await;
        if let Err(e) = result {
            log::error!("Failed to place order: {}", e);
            return Err(Status::internal(e.to_string()));
        }
        let response = StdResponse {
            message: "success".to_string(),
            error_code: 0,
        };

        Ok(Response::new(response))
    }

    async fn create_market(
        &self,
        request: Request<crate::orderbook::proto::CreateMarketRequest>,
    ) -> Result<Response<crate::orderbook::proto::StdResponse>, Status> {
        
        // Guards
        let inner = request.into_inner();
        
        let result = self.order_book_service.add_market(inner.market_id.clone()).await;
        
        match result {
            Ok(success) if success => (),
            _ => {
                log::error!("Failed to add market");
                return Err(Status::internal(format!("WARN: could not add market {}. Does the market already exist?", inner.market_id)));
            }
        }
        let response = crate::orderbook::proto::StdResponse {
            message: "success".to_string(),
            error_code: 0,
        };

        Ok(Response::new(response))
    }

    async fn cancel_order(
        &self,
        request: Request<crate::orderbook::proto::CancelOrderRequest>,
    ) -> Result<Response<crate::orderbook::proto::StdResponse>, Status> {
        let inner = request.into_inner();

        let result = self.order_book_service.cancel_order(&inner.market_id, &inner.tx_id).await;

        match result {
            Ok(success) if success => (),
            _ => {
                log::error!("Failed to cancel order");
                return Err(Status::internal(format!("WARN: could not cancel order for market {}", inner.market_id)));
            }
        }
        let response = crate::orderbook::proto::StdResponse {
            message: "success".to_string(),
            error_code: 0,
        };

        Ok(Response::new(response))
    }

    async fn get_orders_for_user(
        &self,
        request: Request<crate::orderbook::proto::UserRequest>,
    ) -> Result<Response<crate::orderbook::proto::OrdersForUserResponse>, Status> {
        let inner = request.into_inner();

        let result = self.order_book_service.get_orders_for_user(&inner.evm_address).await;

        match result {
            Ok(orders) => {
                let response = crate::orderbook::proto::OrdersForUserResponse {
                    open_orders: orders,
                };
                Ok(Response::new(response))
            },
            Err(e) => {
                log::error!("Failed to get orders for user {}: {}", inner.evm_address, e);
                Err(Status::internal(e.to_string()))
            }
        }
    }
}

#[tonic::async_trait]
impl ClobPublic for ClobService {

    async fn health(
        &self,
        _request: Request<crate::orderbook::proto::Empty>,
    ) -> Result<Response<StdResponse>, Status> {
        let response = StdResponse {
            message: "OK".to_string(),
            error_code: 0,
        };
        Ok(Response::new(response))
    }

    async fn get_book(
        &self,
        _request: Request<BookRequest>,
    ) -> Result<Response<BookSnapshot>, Status> {

        let inner = _request.into_inner();

        let snapshot = self.order_book_service.get_book(&inner.market_id, inner.depth as usize).await;
        match snapshot {
            Ok(snapshot) => Ok(Response::new(snapshot)),
            Err(e) => {
                log::error!("Failed to get book snapshot: marketId={} {}", inner.market_id, e);
                Err(Status::internal(e.to_string()))
            }
        }
    }

    type StreamBookStream = ReceiverStream<Result<BookSnapshot, Status>>;
    async fn stream_book(
        &self,
        _request: Request<BookRequest>,
    ) -> Result<Response<Self::StreamBookStream>, Status> {
        let (tx, rx) = mpsc::channel(128);
        let order_book_service = self.order_book_service.clone();
        
        let inner = _request.into_inner();

        tokio::spawn(async move {
            loop {
                let snapshot = order_book_service.get_book(&inner.market_id, inner.depth as usize).await;

                let result = snapshot.map_err(|e| {
                     log::error!("Failed to get book snapshot: marketId={} {}", inner.market_id, e);
                    Status::internal(e.to_string())
                });

                if tx.send(result).await.is_err() {
                    break;
                }

                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        });

        Ok(Response::new(ReceiverStream::new(rx)))
    }

    async fn get_price(
        &self,
        request: Request<crate::orderbook::proto::MarketIdRequest>,
    ) -> Result<Response<crate::orderbook::proto::PriceUpdate>, Status> {
        let inner = request.into_inner();

        let price_update = self.order_book_service.get_price_update(&inner.market_id).await;
        match price_update {
            Ok(price_update) => Ok(Response::new(price_update)),
            Err(e) => {
                log::error!("Failed to get price: marketId={}, '{}'", inner.market_id, e);
                Err(Status::internal(e.to_string()))
            }
        }
    }

    type StreamPriceStream = ReceiverStream<Result<crate::orderbook::proto::PriceUpdate, Status>>;
    async fn stream_price(
        &self,
        request: Request<crate::orderbook::proto::MarketIdRequest>,
    ) -> Result<Response<Self::StreamPriceStream>, Status> {
        let (tx, rx) = mpsc::channel(128);
        let order_book_service = self.order_book_service.clone();
        let inner = request.into_inner();

        tokio::spawn(async move {
            loop {
                let price_update = order_book_service.get_price_update(&inner.market_id).await;
                let result = price_update.map_err(|e| {
                    log::error!("Failed to stream_price: {} {}", inner.market_id, e);
                    Status::internal(e.to_string())
                });

                if tx.send(result).await.is_err() {
                    break;
                }

                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        });

        Ok(Response::new(ReceiverStream::new(rx)))
    }
    
}

pub fn start_grpc(
    host: &str,
    port: &str,
    order_book_service: OrderBookService,
    ready_tx: Option<oneshot::Sender<()>>,
    ) -> impl Future<Output = Result<(), Box<dyn std::error::Error>>> {
    let addr = format!("{}:{}", host, port).parse().unwrap();
    log::info!("Starting gRPC server on {}", addr);

    // Notify that the gRPC server is ready
    if let Some(tx) = ready_tx {
        let _ = tx.send(());
    }

    tonic::transport::Server::builder()
        .add_service(ClobInternalServer::new(ClobService::new(order_book_service.clone())))
        .add_service(ClobPublicServer::new(ClobService::new(order_book_service)))
        // reflection support (tonic-reflection): 
        // .add_service(
        //     ReflectionBuilder::configure()
        //         .register_encoded_file_descriptor_set(crate::orderbook::proto::FILE_DESCRIPTOR_SET)
        //         .build()
        //         .unwrap()
        // )
        .serve(addr)
        .map_err(|e| {
            log::error!("Failed to start gRPC server: {}", e);
            Box::new(e) as Box<dyn std::error::Error>
        })
}
