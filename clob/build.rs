fn main() -> Result<(), Box<dyn std::error::Error>> {
   tonic_prost_build::configure()
        .build_server(true)
        .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
        // The API publishes orders with Go's encoding/json, which omits zero values
        // (side 0 = YES, action 0 = BUY, shares_filled 0, ...): default missing fields.
        .message_attribute(".", "#[serde(default)]")
        // .out_dir("src/gen")
        .compile_protos(
            &["proto/api.proto", "proto/clob.proto"],
            &["proto"],
        )?;
   Ok(())
}
