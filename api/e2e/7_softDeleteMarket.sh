#!/bin/bash

# script to delete a market
# call DeleteMarket (api.proto)
# use the MARKET_ID from .env
# default rpc endpoint is testnet.dev.prism.market:443

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$API_DIR/proto"
source "$SCRIPT_DIR/shared.sh"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
	echo ".env file not found at $ENV_FILE"
	exit 1
fi

if [[ ! -d "$PROTO_DIR" ]]; then
	echo "proto directory not found at $PROTO_DIR"
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

market_id_default=$(env_get "MARKET_ID")
if [[ -n "$market_id_default" ]]; then
	read -p "Enter marketId to delete (UUID7) [$market_id_default]: " market_id
	market_id=${market_id:-$market_id_default}
else
	read -p "Enter marketId to delete (UUID7): " market_id
fi

if [[ -z "$market_id" ]]; then
	echo "Error: marketId is required."
	exit 1
fi

if [[ ! "$market_id" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-7[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ ]]; then
	echo "Error: invalid marketId format. Expected strict UUIDv7."
	exit 1
fi

net_from_env=$(env_get "NET")
enviro_from_env=$(env_get "ENVIRO")
net_from_env=$(printf '%s' "$net_from_env" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
enviro_from_env=$(printf '%s' "$enviro_from_env" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
net_from_env=${net_from_env:-testnet}
enviro_from_env=${enviro_from_env:-dev}
base_url_default="${BASE_URL:-$(env_get "BASE_URL") }"
base_url_default="${base_url_default% }"
if [[ -z "$base_url_default" ]]; then
	base_url_default="https://${net_from_env}.${enviro_from_env}.prism.market"
fi

read -p "Enter base URL [$base_url_default]: " baseUrl
baseUrl=${baseUrl:-$base_url_default}
if grep -qE '^BASE_URL=' "$ENV_FILE"; then
	sed -i "s|^BASE_URL=.*|BASE_URL=$baseUrl|" "$ENV_FILE"
else
	printf '\nBASE_URL=%s\n' "$baseUrl" >> "$ENV_FILE"
fi
echo "Base URL set to: $baseUrl"

bearer_token=$(env_get "ADMIN_BEARER_TOKEN")
bearer_token="${bearer_token#Bearer }"
if [[ -z "$bearer_token" ]]; then
	bearer_token=$(env_get "AUTH_BEARER_TOKEN")
fi
if [[ -z "$bearer_token" ]]; then
	bearer_token=$(env_get "BEARER_TOKEN")
fi
if [[ -z "$bearer_token" && -n "${PRISM_ADMIN_JWT:-}" ]]; then
	bearer_token="$PRISM_ADMIN_JWT"
fi
if [[ -z "$bearer_token" ]]; then
	echo "No ADMIN_BEARER_TOKEN found in $ENV_FILE"
	read -p "Enter admin Bearer JWT token (or press Enter to abort): " bearer_token
fi
if [[ -z "$bearer_token" ]]; then
	echo "Error: admin Bearer JWT token is required for DeleteMarket (ADMIN role required)."
	echo "Run ./0_bearerToken.sh to generate a fresh token and save ADMIN_BEARER_TOKEN to .env"
	exit 1
fi

grpc_addr="${baseUrl#*://}"
grpc_addr="${grpc_addr%%/}"
grpc_flags=(-w)
grpc_meta=(-H "authorization: $(e2e_bearer_header "$bearer_token")")
if [[ "$baseUrl" == https://* ]]; then
	grpc_flags=(-w --tls)
	if [[ "$grpc_addr" != *:* ]]; then
		grpc_addr="${grpc_addr}:443"
	fi
fi

e2e_configure_proxy "$baseUrl"
echo "Preflight: checking grpc-web Health on $grpc_addr..."
if ! easyrpc c "${grpc_flags[@]}" -a "$grpc_addr" -d '{}' -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.Health >/dev/null 2>&1; then
	echo "grpc-web preflight failed for $grpc_addr"
	exit 1
fi

echo
echo "About to call DeleteMarket for marketId: $market_id"
read -p "Type D to confirm: " confirm_delete
if [[ "$confirm_delete" != "D" ]]; then
	echo "Aborted. No delete call was made."
	exit 0
fi

echo "Calling DeleteMarket on $grpc_addr..."
rpc_err_file=$(mktemp)
delete_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"marketId\":\"$market_id\"}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.DeleteMarket 2>"$rpc_err_file") || true

if [[ -z "$delete_json" ]]; then
	rpc_err=$(cat "$rpc_err_file")
	rm -f "$rpc_err_file"
	echo "Error: DeleteMarket RPC failed"
	if [[ -n "$rpc_err" ]]; then
		echo "$rpc_err"
	fi
	exit 1
fi
rm -f "$rpc_err_file"

error_code=$(printf '%s\n' "$delete_json" | jq -r '.errorCode // .error_code // 0')
message=$(printf '%s\n' "$delete_json" | jq -r '.message // ""')

if [[ "$error_code" != "0" ]]; then
	echo "DeleteMarket returned errorCode=$error_code message='${message}'"
	exit 1
fi

echo "DeleteMarket succeeded: ${message:-ok}"

