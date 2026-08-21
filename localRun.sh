#!/bin/bash

set -e

GITHUB_ORG="prismmarketlabs"
NAME="prism"



echo "Starting local DB..."
cd db
source loadEnv.sh local
docker rm prism-db --force
docker run --pull always -d --name "${NAME}-db" \
  -p 5432:5432 \
  -v /mnt/external/postgresdata:/var/lib/postgresql \
  -e POSTGRES_USER="${DB_UNAME}" \
  -e POSTGRES_PASSWORD="${DB_PWORD}" \
  -e POSTGRES_DB="${DB_NAME}" \
  ghcr.io/"${GITHUB_ORG}"/db:latest



echo "Starting local EventBus..."
cd ../eventbus
source loadEnv.sh local
docker rm "${NAME}-eventbus" --force
docker run --pull always -d --name "${NAME}-eventbus" \
  -p 4222:4222 -p 6222:6222 \
  ghcr.io/"${GITHUB_ORG}"/eventbus:latest



echo "Starting local Proxy..."
cd ../proxy
source loadEnv.sh local2
docker rm "${NAME}-proxy" --force
docker run --pull always -d --name "${NAME}-proxy" --network host \
  -p 9901:9901 -p 8090:8090 \
  -e ENVOY_HOST_CLOB="${ENVOY_HOST_CLOB}" \
  -e ENVOY_HOST_API="${ENVOY_HOST_API}" \
  -e ENVOY_HOST_WEB="${ENVOY_HOST_WEB}" \
  -e ENVOY_HOST_WEB_ADMIN="${ENVOY_HOST_WEB_ADMIN}" \
  -e ENVOY_HOST_WEB_LP="${ENVOY_HOST_WEB_LP}" \
  ghcr.io/"${GITHUB_ORG}"/proxy:latest






# echo "Starting local modsec..."
# cd ../modsec
# source loadEnv.sh local
# docker run --pull always -d --name "${NAME}-modsec" --network host \
#   -p 8090:8080 \
#   -e BACKEND=${MODSEC_BACKEND} \
#   -e PARANOIA=${MODSEC_PARANOIA} \
#   -e ANOMALY_INBOUND=${MODSEC_ANOMALY_INBOUND} \
#   -e ANOMALY_OUTBOUND=${MODSEC_ANOMALY_OUTBOUND} \
#   ghcr.io/"${GITHUB_ORG}"/modsec:latest





echo "Starting local blocknode..."
cd ../blocknode
source loadEnv.sh local
docker rm "${NAME}-blocknode" --force
docker run --pull always -d --name "${NAME}-blocknode" --network host \
  -e BN_QUERY_FREQ_SECS="${BN_QUERY_FREQ_SECS}" \
  -e BN_QUERY_LOOKBACK_SECS="${BN_QUERY_LOOKBACK_SECS}" \
  -e BN_SUPPORTED_NETWORKS="${BN_SUPPORTED_NETWORKS}" \
  -e BN_NATS_HOST="${BN_NATS_HOST}" \
  -e BN_NATS_PORT="${BN_NATS_PORT}" \
  -e BN_SMART_CONTRACT_IDS_PREVIEWNET="${BN_SMART_CONTRACT_IDS_PREVIEWNET}" \
  -e BN_SMART_CONTRACT_IDS_TESTNET="${BN_SMART_CONTRACT_IDS_TESTNET}" \
  -e BN_SMART_CONTRACT_IDS_MAINNET="${BN_SMART_CONTRACT_IDS_MAINNET}" \
  -e ABI_TESTNET_0_0_8946970="${ABI_TESTNET_0_0_8946970}" \
  -e ABI_TESTNET_0_0_8947052="${ABI_TESTNET_0_0_8947052}" \
  -e ABI_TESTNET_0_0_9070333="${ABI_TESTNET_0_0_9070333}" \
  -e ABI_TESTNET_0_0_9159758="${ABI_TESTNET_0_0_9159758}" \
  -e ABI_TESTNET_0_0_9167018="${ABI_TESTNET_0_0_9167018}" \
  -e ABI_TESTNET_0_0_9214025="${ABI_TESTNET_0_0_9214025}" \
  -e ABI_TESTNET_0_0_9385460="${ABI_TESTNET_0_0_9385460}" \
  -e ABI_TESTNET_0_0_9458377="${ABI_TESTNET_0_0_9458377}" \
  -e ABI_TESTNET_0_0_9502269="${ABI_TESTNET_0_0_9502269}" \
  -e ABI_TESTNET_0_0_9653861="${ABI_TESTNET_0_0_9653861}" \
  -e ABI_TESTNET_0_0_9792499="${ABI_TESTNET_0_0_9792499}" \
  -e ABI_TESTNET_0_0_9891475="${ABI_TESTNET_0_0_9891475}" \
  ghcr.io/"${GITHUB_ORG}"/blocknode:latest


docker ps
echo "All services started."
