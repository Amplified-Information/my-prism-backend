#!/bin/bash

# create a market via API CreateMarket (gRPC) and echo the marketId and contract address for the new market
# create the market using 0_ACCOUNT_ID in .env (the ADMIN account)
# use the ADMIN_BEARER_TOKEN in .env for authentication - if ADMIN_BEARER_TOKEN fails, prompt the user to run 0_bearerToken.sh to get a new token and update .env

# Use the following params to create the market (CreateMarketv2Request in api.proto):
# - market_id: generate a new UUID7
# - net: testnet (default)
# - statement: today's date/time - format is "2026-07-10 09:10:55"
# - closes_at: UTC ISO 8601 (Zulu time only) - 30 days from now
# - description: "Test market created via API CreateMarket (gRPC) - $(date)"
# - rules: "Rules for the test market created via API CreateMarket (gRPC) - $(date)"
# - category_ids: [1]
# - img_chunk: Use the file at ./prism_test.png (base64 encode)
# - img_file_name: "test.png"
# - img_mime_type: "image/png"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$API_DIR/proto"
ENV_FILE="$SCRIPT_DIR/.env"
IMG_FILE="$SCRIPT_DIR/prism_test.png"

if [[ ! -f "$ENV_FILE" ]]; then
	echo ".env file not found at $ENV_FILE"
	exit 1
fi

if [[ ! -d "$PROTO_DIR" ]]; then
	echo "proto directory not found at $PROTO_DIR"
	exit 1
fi

if [[ ! -f "$IMG_FILE" ]]; then
	echo "Image file not found at $IMG_FILE"
	exit 1
fi

if ! command -v easyrpc >/dev/null 2>&1; then
	echo "easyrpc could not be found. Please install it before running this script."
	exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
	echo "jq could not be found. Please install it before running this script."
	exit 1
fi

if ! command -v date >/dev/null 2>&1; then
	echo "date could not be found. Please install coreutils before running this script."
	exit 1
fi

if ! command -v base64 >/dev/null 2>&1; then
	echo "base64 could not be found. Please install coreutils before running this script."
	exit 1
fi

env_get() {
	local key="$1"
	awk -F '=' -v k="$key" '
		$1==k {
			val=substr($0, index($0, "=")+1)
			sub(/^[[:space:]]+/, "", val)
			sub(/[[:space:]]+$/, "", val)
			print val
			exit
		}
	' "$ENV_FILE"
}

generate_uuid7() {
	local ms hex_ts rand16 rand64 version_and_rand variant_and_rand rand_tail
	ms=$(date +%s%3N)
	hex_ts=$(printf '%012x' "$ms")
	rand16=$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n')
	rand64=$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')
	version_and_rand="7${rand16:0:3}"
	variant_and_rand=$(printf '%x%s' $((8 + 0x${rand16:3:1} % 4)) "${rand64:0:3}")
	rand_tail="${rand64:3:12}"
	printf '%s-%s-%s-%s-%s\n' "${hex_ts:0:8}" "${hex_ts:8:4}" "$version_and_rand" "$variant_and_rand" "$rand_tail"
}

net_from_env=$(grep -E '^NET=' "$ENV_FILE" | head -n1 | cut -d '=' -f2- | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
enviro_from_env=$(grep -E '^ENVIRO=' "$ENV_FILE" | head -n1 | cut -d '=' -f2- | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
net_from_env=${net_from_env:-testnet}
enviro_from_env=${enviro_from_env:-dev}
base_url_default="${BASE_URL:-$(env_get "BASE_URL") }"
base_url_default="${base_url_default% }"
if [[ -z "$base_url_default" ]]; then
	base_url_default="https://${net_from_env}.${enviro_from_env}.prism.market"
fi

read -p "Enter BASE_URL [$base_url_default]: " baseUrl
baseUrl=${baseUrl:-$base_url_default}
if [[ -n "${BASE_URL:-}" ]]; then
	echo "Using BASE_URL from environment as default: $baseUrl"
fi
if grep -qE '^BASE_URL=' "$ENV_FILE"; then
	sed -i "s|^BASE_URL=.*|BASE_URL=$baseUrl|" "$ENV_FILE"
else
	printf '\nBASE_URL=%s\n' "$baseUrl" >> "$ENV_FILE"
fi

echo "Base URL set to: $baseUrl"

network="$net_from_env"
case "$network" in
	mainnet|testnet|previewnet) ;;
	*) network="testnet" ;;
esac

bearer_token=$(grep -E '^(ADMIN_BEARER_TOKEN|AUTH_BEARER_TOKEN|BEARER_TOKEN)=' "$ENV_FILE" | head -n1 | cut -d '=' -f2-)
if [[ -z "$bearer_token" && -n "${PRISM_ADMIN_JWT:-}" ]]; then
	bearer_token="$PRISM_ADMIN_JWT"
fi
if [[ -z "$bearer_token" ]]; then
	echo "No ADMIN_BEARER_TOKEN found in $ENV_FILE"
	read -p "Enter admin Bearer JWT token (or press Enter to abort): " bearer_token
fi
if [[ -z "$bearer_token" ]]; then
	echo "Error: admin Bearer JWT token is required for CreateMarketv2 (ADMIN role required)."
	echo "Run ./0_bearerToken.sh to generate a fresh token and save ADMIN_BEARER_TOKEN to .env"
	exit 1
fi

grpc_addr="${baseUrl#*://}"
grpc_addr="${grpc_addr%%/}"
grpc_flags=(-w)
grpc_meta=(-H "authorization=Bearer $bearer_token")

if [[ "$baseUrl" == https://* ]]; then
	grpc_flags=(-w --tls)
	if [[ "$grpc_addr" != *:* ]]; then
		grpc_addr="${grpc_addr}:443"
	fi
elif [[ "$grpc_addr" != *:* ]]; then
	grpc_addr="${grpc_addr}:8888"
fi

echo "Preflight: checking grpc-web Health on $grpc_addr..."
health_attempt=1
health_max_attempts=4
health_backoff=1
health_err_file=$(mktemp)
while (( health_attempt <= health_max_attempts )); do
	if easyrpc c "${grpc_flags[@]}" -a "$grpc_addr" -d '{}' -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.Health >/dev/null 2>"$health_err_file"; then
		rm -f "$health_err_file"
		break
	fi

	echo "grpc-web preflight attempt $health_attempt/$health_max_attempts failed for $grpc_addr"
	if [[ -s "$health_err_file" ]]; then
		cat "$health_err_file"
	fi

	if (( health_attempt == health_max_attempts )); then
		rm -f "$health_err_file"
		echo "Preflight failed after $health_max_attempts attempts."
		echo "This is usually network/edge reachability (e.g., i/o timeout) rather than payload/auth."
		exit 1
	fi

	echo "Retrying preflight in ${health_backoff}s..."
	sleep "$health_backoff"
	if (( health_backoff < 8 )); then
		health_backoff=$((health_backoff * 2))
	fi
	health_attempt=$((health_attempt + 1))
done

market_id=$(generate_uuid7)
if [[ ! "$market_id" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-7[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ ]]; then
	echo "Error: failed to generate a valid UUIDv7 marketId: $market_id"
	exit 1
fi

statement_now=$(date '+%Y-%m-%d %H:%M:%S')
closes_at_utc=$(date -u -d '+30 days' '+%Y-%m-%dT%H:%M:%S.000Z')
description="Test market created via API CreateMarket (gRPC) - ${statement_now}"
rules="Rules for the test market created via API CreateMarket (gRPC) - ${statement_now}"
img_b64=$(base64 -w 0 "$IMG_FILE")

payload=$(jq -cn \
	--arg marketId "$market_id" \
	--arg net "$network" \
	--arg statement "$statement_now" \
	--arg closesAt "$closes_at_utc" \
	--arg description "$description" \
	--arg rules "$rules" \
	--arg imgChunk "$img_b64" \
	'{
		marketId: $marketId,
		net: $net,
		statement: $statement,
		closesAt: $closesAt,
		description: $description,
		rules: $rules,
		categoryIds: [1],
		imgChunk: $imgChunk,
		imgFileName: "test.png",
		imgMimeType: "image/png"
	}'
)

echo "Creating a test market... Using CreateMarketv2 with marketId=$market_id on $grpc_addr..."
rpc_err_file=$(mktemp)
create_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "$payload" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.CreateMarketv2 2>"$rpc_err_file") || true

if [[ -z "$create_json" ]]; then
	rpc_err=$(cat "$rpc_err_file")
	rm -f "$rpc_err_file"
	echo "Error: CreateMarketv2 RPC failed"
	if [[ -n "$rpc_err" ]]; then
		echo "$rpc_err"
	fi
	echo "If this is auth-related, run ./0_bearerToken.sh and update ADMIN_BEARER_TOKEN in $ENV_FILE"
	exit 1
fi
rm -f "$rpc_err_file"

market_response_id=$(printf '%s\n' "$create_json" | jq -r '.marketResponse.marketId // .market_response.market_id // empty')
market_response_scid=$(printf '%s\n' "$create_json" | jq -r '.marketResponse.smartContractId // .market_response.smart_contract_id // empty')
remaining_allowance=$(printf '%s\n' "$create_json" | jq -r '.remainingAllowance // .remaining_allowance // empty')

if [[ -z "$market_response_id" ]]; then
	echo "CreateMarketv2 returned unexpected response:"
	printf '%s\n' "$create_json" | jq .
	echo "If this is auth-related, run ./0_bearerToken.sh and refresh ADMIN_BEARER_TOKEN"
	exit 1
fi

if grep -qE '^MARKET_ID=' "$ENV_FILE"; then
	sed -i "s|^MARKET_ID=.*|MARKET_ID=$market_response_id|" "$ENV_FILE"
else
	printf '\nMARKET_ID=%s\n' "$market_response_id" >> "$ENV_FILE"
fi

echo
echo "CreateMarketv2 succeeded"
echo "Market ID: $market_response_id"
echo "Smart Contract ID: ${market_response_scid:-<pending>}"
if [[ -n "$remaining_allowance" ]]; then
	echo "Remaining allowance(raw): $remaining_allowance"
fi
echo "Saved MARKET_ID to $ENV_FILE"
base_url_clean="${baseUrl%/}"
echo "Market URL: ${base_url_clean}/market/${market_response_id}"
