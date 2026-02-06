mod grpc_service;
mod nats;
mod orderbook;
mod constants;
pub mod utils;
pub mod recreate_orderbook;
use tokio::sync::oneshot;

pub mod clob {
    tonic::include_proto!("clob");
}

use orderbook::OrderBookService;
use simple_logger::SimpleLogger;


#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    SimpleLogger::new().init().unwrap();

    // keep in sync with main.rs, docker-compose-monolith.yml, .config and .secrets and the run command in clob Dockerfile
    let port = std::env::var("CLOB_SELF_PORT").unwrap_or_else(|_| panic!("Failed to read env var CLOB_SELF_PORT"));
    let host = std::env::var("CLOB_SELF_HOST").unwrap_or_else(|_| panic!("Failed to read env var CLOB_SELF_HOST"));
    let api_host: String = std::env::var("API_HOST").unwrap_or_else(|_| panic!("Failed to read env var API_HOST"));
    let api_port: String = std::env::var("API_PORT").unwrap_or_else(|_| panic!("Failed to read env var API_PORT"));
    let nats_host: String = std::env::var("NATS_HOST").unwrap_or_else(|_| panic!("Failed to read env var NATS_HOST"));
    let nats_port: String = std::env::var("NATS_PORT").unwrap_or_else(|_| panic!("Failed to read env var NATS_PORT"));
    // let clob_matching_interval_seconds: u64 = std::env::var("CLOB_MATCHING_INTERVAL_SECONDS").unwrap_or_else(|_| "5".to_string()).parse().unwrap_or_else(|_| panic!("Failed to read env var CLOB_MATCHING_INTERVAL_SECONDS"));

    // init NATS service
    let nats_service = nats::NatsService::new(&nats_host, &nats_port).await
        .expect("Failed to initialize NATS service");
    
    // init orderbook service
    let order_book_service = OrderBookService::new(nats_service.clone()).await;

    // Start the periodic orderbook scan
    // TODO - re-enable
    // let order_book_service_for_scan = order_book_service.clone();
    // let orderbook_scan_task = tokio::spawn(async move {
    //     log::info!("Starting periodic orderbook scan...");
    //     let result = order_book_service_for_scan.start_periodic_scan(clob_matching_interval_seconds).await;
    //     if let Err(e) = result {
    //         log::error!("Orderbook scan failed: {}", e);
    //     }
    // });

    // NATS: listen for new orders to add to orderbook
    let order_book_service_for_nats = order_book_service.clone();
    let nats_task = tokio::spawn(async move {
        let result = nats::NatsService::subscribe_and_place_orders(&nats_service.nats_client, order_book_service_for_nats).await;
        if let Err(e) = result {
            log::error!("NATS subscription failed: {}", e);
        }
    });

    /////
    // Finally, start the gRPC server
    /////
    let (grpc_ready_tx, grpc_ready_rx) = oneshot::channel();
    let order_book_service_for_grpc = order_book_service.clone();
    let grpc_server_task = tokio::spawn(async move {
        log::info!("Starting gRPC server on {}:{}", host, port);
        let result = grpc_service::start_grpc(&host, &port, order_book_service_for_grpc, Some(grpc_ready_tx)).await;
        
        if let Err(e) = result {
            log::error!("gRPC server failed: {}", e);
        }
    });

    grpc_ready_rx.await.expect("Failed to receive gRPC ready signal");
    log::info!("gRPC server is now up-and-running");
    // Attempt to re-create the orderbook once gRPC server is up-and-running:
    let result = recreate_orderbook::recreate_orderbook(&api_host, &api_port).await;
    match result {
        Ok(true) => log::info!("Orderbook re-creation successfully completed."),
        Ok(false) => {
            log::error!("Orderbook re-creation returned false");
            std::process::exit(1);
        },
        Err(e) => {
            log::error!("Failed to re-create orderbook: {}", e);
            std::process::exit(1);
        }
    }
    
    // Run all tasks concurrently
    let _ = tokio::try_join!(/*orderbook_scan_task,*/ grpc_server_task, nats_task);

    Ok(())
}
