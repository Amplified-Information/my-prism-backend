# cd blocknode
# export VERSION=latest
# docker build -t ghcr.io/prismmarketlabs/blocknode:$VERSION .
#
# docker push ghcr.io/prismmarketlabs/blocknode:$VERSION
# docker run --network host \
# -e BN_QUERY_FREQ_SECS=${BN_QUERY_FREQ_SECS} \
# -e BN_QUERY_LOOKBACK_SECS=${BN_QUERY_LOOKBACK_SECS} \
# -e BN_SUPPORTED_NETWORKS="${BN_SUPPORTED_NETWORKS}" \
# -e BN_NATS_HOST=${BN_NATS_HOST} \
# -e BN_NATS_PORT=${BN_NATS_PORT} \
# -e BN_SMART_CONTRACT_IDS_PREVIEWNET="${BN_SMART_CONTRACT_IDS_PREVIEWNET}" \
# -e BN_SMART_CONTRACT_IDS_TESTNET="${BN_SMART_CONTRACT_IDS_TESTNET}" \
# -e BN_SMART_CONTRACT_IDS_MAINNET="${BN_SMART_CONTRACT_IDS_MAINNET}" \
# -e ABI_TESTNET_0_0_8687256="${ABI_TESTNET_0_0_8687256}" \
# -e ABI_TESTNET_0_0_8688067="${ABI_TESTNET_0_0_8688067}" \
# ghcr.io/prismmarketlabs/blocknode:$VERSION
# 
# keep in sync with: .config, docker-compose-data.yml, src/index.ts, Dockerfile, localRun.sh

FROM node:24-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

RUN npm run build

# Expose port (if needed, adjust as necessary)
# EXPOSE 3000

# Set environment variables (optional)
# ENV NODE_ENV=production

# Start the application (adjust if your entry point is different)
CMD ["node", "dist/index.js"]
