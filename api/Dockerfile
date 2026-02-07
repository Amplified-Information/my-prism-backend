# BUILD stage
# cd prism
# cat ../docker-compose-monolith.yml | grep image:
# export VERSION=0.1.0
# docker build -f api/Dockerfile -t ghcr.io/prismmarketlabs/api:$VERSION .
# docker push ghcr.io/prismmarketlabs/api:$VERSION
# 
# source ./api/loadEnv.sh local
### keep in sync with main.go, docker-compose-monolith.yml, .config and .secrets and the run command in Dockerfile
# docker run -p 8888:8888 \
#   -e API_SELF_HOST=$API_SELF_HOST \
#   -e API_SELF_PORT=$API_SELF_PORT \
#   -e API_SELF_PORT_HEALTH=$API_SELF_PORT_HEALTH \
#   -e CLOB_HOST=$CLOB_HOST \
#   -e CLOB_PORT=$CLOB_PORT \
#   -e USDC_DECIMALS=$USDC_DECIMALS \
#   -e PREVIEWNET_USDC_ADDRESS=$PREVIEWNET_USDC_ADDRESS \
#   -e TESTNET_USDC_ADDRESS=$TESTNET_USDC_ADDRESS \
#   -e MAINNET_USDC_ADDRESS=$MAINNET_USDC_ADDRESS \
#   -e AVAILABLE_NETWORKS=$AVAILABLE_NETWORKS \
#   -e PREVIEWNET_SMART_CONTRACT_ID=$PREVIEWNET_SMART_CONTRACT_ID \
#   -e PREVIEWNET_HEDERA_OPERATOR_ID=$PREVIEWNET_HEDERA_OPERATOR_ID \
#   -e PREVIEWNET_HEDERA_OPERATOR_KEY_TYPE=$PREVIEWNET_HEDERA_OPERATOR_KEY_TYPE \
#   -e PREVIEWNET_PUBLIC_KEY=$PREVIEWNET_PUBLIC_KEY \
#   -e TESTNET_SMART_CONTRACT_ID=$TESTNET_SMART_CONTRACT_ID \
#   -e TESTNET_HEDERA_OPERATOR_ID=$TESTNET_HEDERA_OPERATOR_ID \
#   -e TESTNET_HEDERA_OPERATOR_KEY_TYPE=$TESTNET_HEDERA_OPERATOR_KEY_TYPE \
#   -e TESTNET_PUBLIC_KEY=$TESTNET_PUBLIC_KEY \
#   -e MAINNET_SMART_CONTRACT_ID=$MAINNET_SMART_CONTRACT_ID \
#   -e MAINNET_HEDERA_OPERATOR_ID=$MAINNET_HEDERA_OPERATOR_ID \
#   -e MAINNET_HEDERA_OPERATOR_KEY_TYPE=$MAINNET_HEDERA_OPERATOR_KEY_TYPE \
#   -e MAINNET_PUBLIC_KEY=$MAINNET_PUBLIC_KEY \
#   -e DB_HOST=$DB_HOST \
#   -e DB_PORT=$DB_PORT \
#   -e DB_UNAME=$DB_UNAME \
#   -e DB_NAME=$DB_NAME \
#   -e DB_MAX_ROWS=$DB_MAX_ROWS \
#   -e NATS_URL=$NATS_URL \
#   -e TIMESTAMP_ALLOWED_PAST_SECONDS=$TIMESTAMP_ALLOWED_PAST_SECONDS \
#   -e TIMESTAMP_ALLOWED_FUTURE_SECONDS=$TIMESTAMP_ALLOWED_FUTURE_SECONDS \
#   -e SEND_EMAIL=$SEND_EMAIL \
#   -e EMAIL_ADDRESS=$EMAIL_ADDRESS \
#   -e SMTP_ENDPOINT=$SMTP_ENDPOINT \
#   -e IAM_USERNAME=$IAM_USERNAME \
#   -e SMTP_USERNAME=$SMTP_USERNAME \
#   -e MARKET_CREATION_FEE_USDC=$MARKET_CREATION_FEE_USDC \
#   -e PREVIEWNET_TOKEN=$PREVIEWNET_TOKEN \
#   -e TESTNET_TOKEN=$TESTNET_TOKEN \
#   -e MAINNET_TOKEN=$MAINNET_TOKEN \
#   -e MIN_ORDER_SIZE_USD=$MIN_ORDER_SIZE_USDC \
#   -e CRON_STR=$CRON_STR \
#   \
#   -e DB_PWORD=$DB_PWORD \
#   -e PREVIEWNET_HEDERA_OPERATOR_KEY=$PREVIEWNET_HEDERA_OPERATOR_KEY \
#   -e TESTNET_HEDERA_OPERATOR_KEY=$TESTNET_HEDERA_OPERATOR_KEY \
#   -e MAINNET_HEDERA_OPERATOR_KEY=$MAINNET_HEDERA_OPERATOR_KEY \
#   -e SMTP_PWORD=$SMTP_PWORD \
#   ghcr.io/prismmarketlabs/api:$VERSION

# BUILD stage
FROM golang:1.25 AS builder

WORKDIR /app/api

# pre-reqs to run the genInterfaces.sh script:
RUN apt-get update
RUN go install github.com/sqlc-dev/sqlc/cmd/sqlc@v1.30.0
RUN apt-get install -y protobuf-compiler
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.10
RUN go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.5.1
RUN go install github.com/envoyproxy/protoc-gen-validate@v1.2.1

# install pg client tools (including pg_dump) to allow for DB debugging, migrations, and seeding:
RUN apt-get install -y ca-certificates curl gnupg
RUN curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
RUN CODENAME=$(grep VERSION_CODENAME /etc/os-release | cut -d= -f2)-pgdg && echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $CODENAME main" > /etc/apt/sources.list.d/pgdg.list
RUN apt-get update
RUN apt-get install -y postgresql-client-18

# install golang-migrate for DB migrations:
RUN curl -L https://github.com/golang-migrate/migrate/releases/download/v4.19.0/migrate.linux-amd64.tar.gz | tar xvz
RUN mv migrate ./migrate-tool

COPY ./api/go.mod ./api/go.sum ./
RUN go mod download

# copy all the API files:
COPY ./api /app/api
# don't forget to copy the clob's proto files and place in /app/clob
COPY ./clob/proto /app/clob/proto

# now generate the interfaces:
RUN sh /app/api/genInterfaces.sh

RUN go build -o main /app/api/server/

# RUN stage
# A minimal Debian 13 base image for the final stage
FROM debian:bookworm-slim

# install psql (PostgreSQL client tools)
RUN apt-get update && apt-get install -y postgresql-client
# need ca-certificates installed for sending emails via SMTP over TLS
RUN apt-get install -y ca-certificates && update-ca-certificates

WORKDIR /app

# copy the main binary
COPY --from=builder /app/api/main .

# copy the seed.sql to seed the initial DB, if needed
COPY --from=builder /app/api/db/seed.sql .

# copy the migrations files to migrate the DB, if needed
COPY --from=builder /app/api/db/migrations /app/db/migrations
COPY --from=builder /app/api/migrate-tool /app

# This section defines environment variables needed to run a database migration prior to starting the API server
# - DB_UNAME: The username for connecting to the database.
# - DB_PWORD: The password for connecting to the database.
# - DB_HOST: The hostname or IP address of the database server.
# - DB_PORT: The port number on which the database server is listening.
# - DB_NAME: The name of the database to connect to.
# These variables are initialized as empty strings and are set at runtime.
ENV DB_UNAME="" \
  DB_PWORD="" \
  DB_HOST="" \
  DB_PORT="" \
  DB_NAME=""

ENTRYPOINT ["sh", "-c", "\
  echo 'Running migrations...' && \
  export DB_URL=postgres://$DB_UNAME:$DB_PWORD@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=disable && \
  ./migrate-tool -database $DB_URL -path /app/db/migrations up && \
  echo 'Migrations completed.' && \
  echo 'Starting application...' && \
  \
  ./main \
"]
