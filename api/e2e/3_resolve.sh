#!/bin/bash

# 0. Prompt user input.
# 1. Resolve market via API ResolveMarket (gRPC).
# 2. Foreach accountId, call redeem.
# 3. Check USDC deltas per account.
# 4. Ensure contract collateral drained.
# 5. Ensure collateral accounting.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$API_DIR/proto"
source "$SCRIPT_DIR/shared.sh"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env file not found at $ENV_FILE"
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

if [[ ! -d "$PROTO_DIR" ]]; then
  echo "proto directory not found at $PROTO_DIR"
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
read -p "Enter marketId to resolve [${market_id_default}]: " marketId
marketId=${marketId:-$market_id_default}
if [[ -z "$marketId" ]]; then
  echo "marketId is required"
  exit 1
fi

if [[ ! $marketId =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "Invalid marketId format."
  exit 1
fi

read -p "Resolve outcome (type YES or NO): " resolveMarketInput
resolveMarketInputUpper=$(printf '%s' "$resolveMarketInput" | tr '[:lower:]' '[:upper:]')
if [[ "$resolveMarketInputUpper" != "YES" && "$resolveMarketInputUpper" != "NO" ]]; then
  echo "Invalid input. Please type YES or NO."
  exit 1
fi

# ResolveMarketRequest.outcome: 0 = NO wins, 1 = YES wins, 2 = 50/50 cancel.
outcome=1
if [[ "$resolveMarketInputUpper" == "NO" ]]; then
  outcome=0
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

bearer_token=$(grep -E '^(ADMIN_BEARER_TOKEN|AUTH_BEARER_TOKEN|BEARER_TOKEN)=' "$ENV_FILE" | head -n1 | cut -d '=' -f2-)
if [[ -z "$bearer_token" && -n "${PRISM_ADMIN_JWT:-}" ]]; then
  bearer_token="$PRISM_ADMIN_JWT"
fi
if [[ -z "$bearer_token" ]]; then
  read -p "Enter admin Bearer JWT token: " bearer_token
fi
if [[ -z "$bearer_token" ]]; then
  echo "Error: admin Bearer JWT token is required for ResolveMarket (ADMIN role required)."
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
if ! easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d '{}' -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.Health >/dev/null 2>&1; then
  echo "grpc-web preflight failed for $grpc_addr"
  exit 1
fi

echo "Calling ResolveMarket for marketId=$marketId outcome=$outcome on $grpc_addr..."
rpc_err_file=$(mktemp)
resolve_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"marketId\":\"$marketId\",\"outcome\":$outcome}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.ResolveMarket 2>"$rpc_err_file")
rpc_status=$?
if [[ $rpc_status -ne 0 || -z "$resolve_json" ]]; then
  rpc_err=$(cat "$rpc_err_file")
  rm -f "$rpc_err_file"
  echo "Error: ResolveMarket RPC failed"
  if [[ -n "$rpc_err" ]]; then
    echo "$rpc_err"
  fi
  exit 1
fi
rm -f "$rpc_err_file"

error_code=$(printf '%s\n' "$resolve_json" | jq -r '.errorCode // 0')
message=$(printf '%s\n' "$resolve_json" | jq -r '.message // ""')

if [[ "$error_code" != "0" ]]; then
  echo "ResolveMarket returned errorCode=$error_code message='$message'"
  exit 1
fi

echo "ResolveMarket succeeded: ${message:-ok}"
