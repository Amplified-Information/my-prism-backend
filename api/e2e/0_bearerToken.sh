#!/bin/bash

# Get a bearer token for the admin user via gRPC-web using easyrpc.
# The script:
#   1) fetches a challenge from ApiAuth.GetChallenge
#   2) signs it with the admin private key
#   3) verifies the signature with ApiAuth.VerifyChallenge
#   4) stores the resulting ADMIN_BEARER_TOKEN in .env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$API_DIR/proto"
ENV_FILE="$SCRIPT_DIR/.env"
source "$SCRIPT_DIR/shared.sh"
E2E_NODE_MODULES_DIR="$SCRIPT_DIR/node_modules"
EASYRPC_BIN="${EASYRPC_BIN:-/usr/bin/easyrpc}"

require_commands() {
  local command_name
  for command_name in jq curl node protoc; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
      echo "Error: required command not found: $command_name"
      exit 1
    fi
  done
  if [[ ! -x "$EASYRPC_BIN" ]]; then
    echo "Error: easyrpc not found at $EASYRPC_BIN"
    exit 1
  fi
}

run_easyrpc() {
  local rc

  "$EASYRPC_BIN" c "${grpc_flags[@]}" \
    -a "$grpc_addr" \
    -i "$PROTO_DIR" \
    -p api.proto \
    "$@"
  rc=$?
  if [[ "$rc" -ne 0 ]]; then
    echo "easyrpc exit code: $rc" >&2
  fi
  return "$rc"
}

sign_challenge() {
  local challenge="$1"
  local private_key="$2"
  local key_type="$3"

  (
    cd "$SCRIPT_DIR"
    node - "$challenge" "$private_key" "$key_type" <<'NODE'
const { PrivateKey } = require('@hashgraph/sdk');
const { keccak256 } = require('ethers');

const challenge = process.argv[2];
const privateKeyRaw = process.argv[3];
const keyTypeRaw = (process.argv[4] || '').toUpperCase();
const keyType = keyTypeRaw === 'ECDSA' || keyTypeRaw === 'ECDSA_SECP256K1' ? 'ECDSA' : 'ED25519';

const pk = keyType === 'ECDSA'
  ? PrivateKey.fromStringECDSA(privateKeyRaw)
  : PrivateKey.fromStringED25519(privateKeyRaw);

const digestHex = keccak256(Buffer.from(challenge));
const digest = Buffer.from(digestHex.slice(2), 'hex');
const digestBase64 = digest.toString('base64');
const prefixed = Buffer.from('\x19Hedera Signed Message:\n44' + digestBase64, 'utf8');
const signature = pk.sign(prefixed);
process.stdout.write(Buffer.from(signature).toString('base64'));
NODE
  )
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env file not found at $ENV_FILE"
  exit 1
fi

if [[ ! -d "$PROTO_DIR" ]]; then
  echo "proto directory not found at $PROTO_DIR"
  exit 1
fi

require_commands

if [[ ! -d "$E2E_NODE_MODULES_DIR" ]]; then
  echo "api/e2e dependencies not found. Run: (cd $SCRIPT_DIR && npm install)"
  exit 1
fi

base_url_default="${BASE_URL:-$(e2e_env_get BASE_URL | tr -d '[:space:]')}"
if [[ -z "$base_url_default" ]]; then
  base_url_default="https://testnet.dev.prism.market"
fi

read -p "Enter BASE_URL [$base_url_default]: " baseUrl
baseUrl="${baseUrl:-$base_url_default}"
if grep -qE '^BASE_URL=' "$ENV_FILE"; then
  sed -i "s|^BASE_URL=.*|BASE_URL=$baseUrl|" "$ENV_FILE"
else
  printf '\nBASE_URL=%s\n' "$baseUrl" >> "$ENV_FILE"
fi

echo "BASE_URL set to: $baseUrl"

network="testnet"
case "$baseUrl" in
  *previewnet*) network="previewnet" ;;
  *mainnet*) network="mainnet" ;;
  *) network="testnet" ;;
esac

grpc_addr="${baseUrl#*://}"
grpc_addr="${grpc_addr%%/}"
grpc_flags=(-w)

if [[ "$baseUrl" == https://* ]]; then
  grpc_flags=(-w --tls)
  [[ "$grpc_addr" == *:* ]] || grpc_addr="${grpc_addr}:443"
fi

if [[ "$grpc_addr" == *":8888" ]]; then
  echo "Error: direct gRPC target ':8888' is not allowed. Use the proxy address from BASE_URL."
  exit 1
fi

echo "gRPC-web address: $grpc_addr"

health_url="${baseUrl%/}/health"
echo "Preflight: checking HTTP health on $health_url..."
curl --fail --silent --show-error --max-time 5 "$health_url" >/dev/null

grpc_health_url="${baseUrl%/}/api.ApiServicePublic/Health"
echo "Preflight: checking gRPC-web API readiness on $grpc_health_url..."
grpc_health_tmp="$(mktemp)"
printf '\x00\x00\x00\x00\x00' | curl --fail --silent --show-error --max-time 5 \
  "$grpc_health_url" \
  -H 'content-type: application/grpc-web+proto' \
  -H 'x-grpc-web: 1' \
  -H 'x-user-agent: grpc-web-javascript/0.1' \
  --data-binary @- >"$grpc_health_tmp"

if ! xxd -p "$grpc_health_tmp" | tr -d '\n' | grep -q '677270632d7374617475733a30'; then
  echo "Error: gRPC-web API preflight failed (grpc-status != 0)"
  echo "Hex response:"
  xxd -p "$grpc_health_tmp"
  rm -f "$grpc_health_tmp"
  exit 1
fi
rm -f "$grpc_health_tmp"

admin_account_id="$(e2e_env_get 0_ACCOUNT_ID)"
admin_private_key="$(e2e_env_get 0_PRIVATE_KEY)"
admin_key_type_raw="$(e2e_env_get 0_KEY_TYPE)"

if [[ -z "$admin_account_id" || -z "$admin_private_key" || -z "$admin_key_type_raw" ]]; then
  echo "Error: expected 0_ACCOUNT_ID, 0_PRIVATE_KEY, 0_KEY_TYPE in $ENV_FILE"
  exit 1
fi

admin_key_type_upper="$(printf '%s' "$admin_key_type_raw" | tr '[:lower:]' '[:upper:]')"
case "$admin_key_type_upper" in
  ECDSA|ECDSA_SECP256K1) admin_key_type="ecdsa" ;;
  ED|ED25519) admin_key_type="ed25519" ;;
  *) echo "Error: unsupported 0_KEY_TYPE '$admin_key_type_raw' (use ECDSA or ED25519)."; exit 1 ;;
esac

echo "Requesting challenge from ApiAuth.GetChallenge..."
challenge_json=$(run_easyrpc \
  -d "{\"accountId\":\"$admin_account_id\",\"network\":\"$network\"}" \
  api.ApiAuth.GetChallenge)

challenge_error_code="$(printf '%s\n' "$challenge_json" | jq -r '((.errorCode // .error_code) // 0) | tostring')"
challenge="$(printf '%s\n' "$challenge_json" | jq -r '.message // ""')"

if [[ "$challenge_error_code" != "0" || -z "$challenge" || "$challenge" == "null" ]]; then
  echo "Error: ApiAuth.GetChallenge returned errorCode=$challenge_error_code message='$challenge'"
  echo "$challenge_json"
  exit 1
fi

echo "Challenge received: $challenge"

echo "Signing challenge with admin private key..."
signature_b64="$(sign_challenge "$challenge" "$admin_private_key" "$admin_key_type_upper")"
if [[ -z "$signature_b64" ]]; then
  echo "Error: failed to sign challenge"
  exit 1
fi

verify_payload=$(jq -n \
  --arg challengeResponseBase64 "$signature_b64" \
  --arg payload "$challenge" \
  --arg accountId "$admin_account_id" \
  --arg network "$network" \
  '{
    challengeResponseBase64: $challengeResponseBase64,
    payload: $payload,
    challengeRequest: {
      accountId: $accountId,
      network: $network
    }
  }')

echo "Verifying challenge with ApiAuth.VerifyChallenge..."
verify_json=$(run_easyrpc -H "x-e2e-cli: 1" -d "$verify_payload" api.ApiAuth.VerifyChallenge)
verify_error_code="$(printf '%s\n' "$verify_json" | jq -r '((.errorCode // .error_code) // 1) | tostring')"
verify_message="$(printf '%s\n' "$verify_json" | jq -r '.message // ""')"

if [[ "$verify_error_code" != "0" || -z "$verify_message" || "$verify_message" == "null" ]]; then
  echo "Error: ApiAuth.VerifyChallenge returned errorCode=$verify_error_code message='$verify_message'"
  echo "$verify_json"
  exit 1
fi

echo "VerifyChallenge message: $verify_message"

if [[ "$verify_message" != Bearer\ * ]]; then
  echo "Error: VerifyChallenge did not return a bearer token in message."
  echo "Raw response:"
  echo "$verify_json"
  exit 1
fi
auth_header="$verify_message"
bearer_token="${auth_header#Bearer }"

if grep -q '^ADMIN_BEARER_TOKEN=' "$ENV_FILE"; then
  sed -i "s|^ADMIN_BEARER_TOKEN=.*|ADMIN_BEARER_TOKEN=$bearer_token|" "$ENV_FILE"
else
  printf '\nADMIN_BEARER_TOKEN=%s\n' "$bearer_token" >> "$ENV_FILE"
fi

echo "ADMIN_BEARER_TOKEN saved to $ENV_FILE"
echo "Bearer token (admin): $auth_header"

