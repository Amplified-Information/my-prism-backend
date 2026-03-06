#!/bin/bash

set -e

echo "Starting local DB..."
cd db
source loadEnv.sh local
docker run -d \
  -p 5432:5432 \
  -v /mnt/external/postgresdata:/var/lib/postgresql \
  -e POSTGRES_USER="${DB_UNAME}" \
  -e POSTGRES_PASSWORD="${DB_PWORD}" \
  -e POSTGRES_DB="${DB_NAME}" \
  ghcr.io/prismmarketlabs/db:latest

echo "Starting local EventBus..."
cd ../eventbus
source loadEnv.sh local
docker run -d \
  -p 4222:4222 -p 6222:6222 \
  ghcr.io/prismmarketlabs/eventbus:latest

echo "Starting local Proxy..."
cd ../proxy
source loadEnv.sh local2
docker run -d --network host \
  -p 8090:8090 -p 9901:9901 \
  -e ENVOY_HOST_CLOB="${ENVOY_HOST_CLOB}" \
  -e ENVOY_HOST_API="${ENVOY_HOST_API}" \
  -e ENVOY_HOST_WEB="${ENVOY_HOST_WEB}" \
  -e ENVOY_HOST_WEB_ADMIN="${ENVOY_HOST_WEB_ADMIN}" \
  -e ENVOY_HOST_WEB_LP="${ENVOY_HOST_WEB_LP}" \
  ghcr.io/prismmarketlabs/proxy:latest

echo "All services started."
