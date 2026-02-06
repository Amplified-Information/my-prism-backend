fn main() -> Result<(), Box<dyn std::error::Error>> {
   tonic_prost_build::configure()
        .build_server(true)
        .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
        // .out_dir("src/gen")
        .compile_protos(
            &["proto/api.proto", "proto/clob.proto"],
            &["proto"],
        )?;
   Ok(())
}