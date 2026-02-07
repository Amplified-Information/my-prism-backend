pub mod api {
    tonic::include_proto!("api");
}
use api::api_service_internal_client::ApiServiceInternalClient;

pub async fn recreate_orderbook(api_host: &str, api_port: &str) -> Result<bool, Box<dyn std::error::Error>> {
    /////
    // Re-create the clob after restart:
    /////
    // Make a one-time gRPC call to the API to recreate the orderbooks from existing orders (resolved_at = NULL) in the DB
    let mut client = match ApiServiceInternalClient::connect(
        format!("http://{}:{}", api_host, api_port)
    ).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Failed to connect to API service: {}", e);
            // return false;
            return Err(e.into());
        }
    };

    let response = client.trigger_recreate_clob(api::Empty {}).await;
    match response {
        Ok(res) => {
            println!("trigger_recreate_clob response: {:?}", res.into_inner());
        }
        Err(e) => {
            eprintln!("Error calling trigger_recreate_clob: {}", e);
            // exit the application if we cannot recreate the clob
            return Err(e.into());
        }
    }
    drop(client); // close the api gRPC connection
    return Ok(true);
}