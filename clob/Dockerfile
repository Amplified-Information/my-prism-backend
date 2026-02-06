# cd prism
# cat ../docker-compose-monolith.yml | grep image:
# export VERSION=0.1.0
# docker build -f clob/Dockerfile -t ghcr.io/prismmarketlabs/clob:$VERSION .
# docker push ghcr.io/prismmarketlabs/clob:$VERSION
# 
# source loadEnv.sh local
### keep in sync with main.rs, docker-compose-monolith.yml, .config and .secrets and the run command in clob Dockerfile
# docker run -p 50051:50051 -e CLOB_SELF_HOST=${CLOB_SELF_HOST} -e CLOB_SELF_PORT=$CLOB_SELF_PORT -e API_HOST=${API_HOST} -e API_PORT=${API_PORT} -e CLOB_MATCHING_INTERVAL_SECONDS=$CLOB_MATCHING_INTERVAL_SECONDS -e NATS_HOST=$NATS_HOST -e NATS_PORT=$NATS_PORT ghcr.io/prismmarketlabs/clob:$VERSION

# BUILD stage
FROM rust:latest AS builder

WORKDIR /app/clob

RUN apt-get update
RUN apt-get install -y protobuf-compiler

COPY ./clob /app/clob
COPY ./api/proto/api.proto /app/clob/proto/api.proto

RUN cargo build --release

# RUN stage
# A minimal Debian 13 base image for the final stage
FROM debian:bookworm-slim

WORKDIR /app

COPY --from=builder /app/clob/target/release/clob /app/clob

ENTRYPOINT ["/app/clob"]
