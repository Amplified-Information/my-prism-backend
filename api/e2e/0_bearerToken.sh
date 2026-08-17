#!/bin/bash

# get a bearer token for the admin user and store it in the .env file (ADMIN_BEARER_TOKEN=)
# ApiAuth.GetChallenge
# ApiAuth.VerifyChallenge
# print the bearer token for the admin user

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$API_DIR/proto"
ENV_FILE="$SCRIPT_DIR/.env"
WEB_ADMIN_DIR="$(cd "$API_DIR/.." && pwd)/web.admin"

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

if ! command -v curl >/dev/null 2>&1; then
	echo "curl could not be found. Please install it before running this script."
	exit 1
fi

if ! command -v node >/dev/null 2>&1; then
	echo "node could not be found. Please install it before running this script."
	exit 1
fi

if ! command -v protoc >/dev/null 2>&1; then
	echo "protoc could not be found. Please install protobuf-compiler."
	exit 1
fi

if [[ ! -d "$WEB_ADMIN_DIR/node_modules" ]]; then
	echo "web.admin dependencies not found. Run: (cd $WEB_ADMIN_DIR && npm install)"
	exit 1
fi

net_from_env=$(grep -E '^NET=' "$ENV_FILE" | head -n1 | cut -d '=' -f2- | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
enviro_from_env=$(grep -E '^ENVIRO=' "$ENV_FILE" | head -n1 | cut -d '=' -f2- | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
net_from_env=${net_from_env:-testnet}
enviro_from_env=${enviro_from_env:-dev}
base_url_default="${BASE_URL:-$(grep -E '^BASE_URL=' "$ENV_FILE" | head -n1 | cut -d '=' -f2- | tr -d '[:space:]') }"
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

network="testnet"
case "$baseUrl" in
	*previewnet*) network="previewnet" ;;
	*mainnet*) network="mainnet" ;;
esac

grpc_addr="${baseUrl#*://}"
grpc_addr="${grpc_addr%%/}"
grpc_flags=(-w)
if [[ "$baseUrl" == https://* ]]; then
	grpc_flags=(-w --tls)
	if [[ "$grpc_addr" != *:* ]]; then
		grpc_addr="${grpc_addr}:443"
	fi
elif [[ "$grpc_addr" != *:* ]]; then
	grpc_addr="${grpc_addr}:8888"
fi

echo "Preflight: checking grpc-web Health on $grpc_addr..."
if ! easyrpc c "${grpc_flags[@]}" -a "$grpc_addr" -d '{}' -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.Health >/dev/null 2>&1; then
	echo "grpc-web preflight failed for $grpc_addr"
	exit 1
fi

admin_account_id=$(grep -E '^0_ACCOUNT_ID=' "$ENV_FILE" | cut -d '=' -f2-)
admin_private_key=$(grep -E '^0_PRIVATE_KEY=' "$ENV_FILE" | cut -d '=' -f2-)
admin_key_type_raw=$(grep -E '^0_KEY_TYPE=' "$ENV_FILE" | cut -d '=' -f2-)

if [[ -z "$admin_account_id" || -z "$admin_private_key" || -z "$admin_key_type_raw" ]]; then
	echo "Error: expected 0_ACCOUNT_ID, 0_PRIVATE_KEY, 0_KEY_TYPE in $ENV_FILE"
	exit 1
fi

admin_key_type_upper=$(printf '%s' "$admin_key_type_raw" | tr '[:lower:]' '[:upper:]')
admin_key_type=""
case "$admin_key_type_upper" in
	ECDSA|ECDSA_SECP256K1) admin_key_type="ecdsa" ;;
	ED|ED25519) admin_key_type="ed25519" ;;
esac
if [[ -z "$admin_key_type" ]]; then
	echo "Error: unsupported 0_KEY_TYPE '$admin_key_type_raw' (use ECDSA or ED25519)."
	exit 1
fi

challenge_json=$(easyrpc c "${grpc_flags[@]}" -a "$grpc_addr" -d "{\"accountId\":\"$admin_account_id\",\"network\":\"$network\"}" -i "$PROTO_DIR" -p api.proto api.ApiAuth.GetChallenge 2>/dev/null)
if [[ -z "$challenge_json" ]]; then
	echo "Error: ApiAuth.GetChallenge failed"
	exit 1
fi

challenge_error_code=$(printf '%s\n' "$challenge_json" | jq -r '.errorCode // 1')
challenge=$(printf '%s\n' "$challenge_json" | jq -r '.message // ""')
if [[ "$challenge_error_code" != "0" || -z "$challenge" || "$challenge" == "null" ]]; then
	echo "Error: ApiAuth.GetChallenge returned errorCode=$challenge_error_code message='$challenge'"
	exit 1
fi

signature_b64=$(cd "$WEB_ADMIN_DIR" && node -e "const {PrivateKey}=require('@hashgraph/sdk'); const {keccak256}=require('ethers'); const challenge=process.argv[1]; const privateKeyRaw=process.argv[2]; const keyTypeRaw=process.argv[3]; const keyType=String(keyTypeRaw||'').toUpperCase(); const pk=(keyType==='ECDSA'||keyType==='ECDSA_SECP256K1')?PrivateKey.fromStringECDSA(privateKeyRaw):PrivateKey.fromStringED25519(privateKeyRaw); const digestHex=keccak256(Buffer.from(challenge)); const digest=Buffer.from(digestHex.slice(2),'hex'); const digestBase64=digest.toString('base64'); const prefixed=Buffer.from('\\x19Hedera Signed Message:\\n44'+digestBase64,'utf8'); const signature=pk.sign(prefixed); process.stdout.write(Buffer.from(signature).toString('base64'));" -- "$challenge" "$admin_private_key" "$admin_key_type_upper")
if [[ -z "$signature_b64" ]]; then
	echo "Error: failed to sign challenge"
	exit 1
fi

verify_req_text=$(mktemp)
verify_req_pb=$(mktemp)
grpc_web_frame=$(mktemp)
verify_headers=$(mktemp)
verify_body=$(mktemp)

cat > "$verify_req_text" <<EOF
challenge_response_base64: "$signature_b64"
payload: "$challenge"
challenge_request {
  account_id: "$admin_account_id"
  network: "$network"
}
EOF

if ! protoc --encode=api.VerifyChallengeRequest -I "$PROTO_DIR" "$PROTO_DIR/api.proto" < "$verify_req_text" > "$verify_req_pb"; then
	echo "Error: failed to encode VerifyChallenge request"
	rm -f "$verify_req_text" "$verify_req_pb" "$grpc_web_frame" "$verify_headers" "$verify_body"
	exit 1
fi

req_len=$(wc -c < "$verify_req_pb" | tr -d ' ')
req_len_hex=$(printf '%08x' "$req_len")
printf '\x00' > "$grpc_web_frame"
printf "\\x${req_len_hex:0:2}\\x${req_len_hex:2:2}\\x${req_len_hex:4:2}\\x${req_len_hex:6:2}" >> "$grpc_web_frame"
cat "$verify_req_pb" >> "$grpc_web_frame"

verify_url="$baseUrl/api.ApiAuth/VerifyChallenge"
if ! curl -sS -D "$verify_headers" -o "$verify_body" \
  -H 'content-type: application/grpc-web+proto' \
  -H 'x-grpc-web: 1' \
  -H 'x-user-agent: grpc-web-javascript/0.1' \
  --data-binary @"$grpc_web_frame" \
  "$verify_url" >/dev/null; then
	echo "Error: ApiAuth.VerifyChallenge grpc-web request failed"
	rm -f "$verify_req_text" "$verify_req_pb" "$grpc_web_frame" "$verify_headers" "$verify_body"
	exit 1
fi

auth_header=$(grep -i '^authorization:' "$verify_headers" | head -n1 | sed -E 's/^[Aa]uthorization:[[:space:]]*//; s/\r$//')
admin_bearer_token=$(printf '%s\n' "$auth_header" | sed -E 's/^[Bb]earer[[:space:]]+//')

if [[ -z "$admin_bearer_token" ]]; then
	echo "Error: failed to extract JWT from ApiAuth.VerifyChallenge response headers"
	echo "Response headers:"
	sed -n '1,80p' "$verify_headers"
	echo
	echo "Debugging VerifyChallenge with easyrpc..."
	set +e
	verify_debug=$(easyrpc c "${grpc_flags[@]}" -a "$grpc_addr" -d "{\"challengeResponseBase64\":\"$signature_b64\",\"payload\":\"$challenge\",\"challengeRequest\":{\"accountId\":\"$admin_account_id\",\"network\":\"$network\"}}" -i "$PROTO_DIR" -p api.proto api.ApiAuth.VerifyChallenge 2>&1)
	set -e
	printf '%s\n' "$verify_debug"
	rm -f "$verify_req_text" "$verify_req_pb" "$grpc_web_frame" "$verify_headers" "$verify_body"
	exit 1
fi

rm -f "$verify_req_text" "$verify_req_pb" "$grpc_web_frame" "$verify_headers" "$verify_body"

verify_message="Challenge verified successfully"

if [[ -z "$admin_bearer_token" || "$admin_bearer_token" == "null" ]]; then
	echo "Error: token missing in VerifyChallenge response"
	exit 1
fi

if grep -qE '^ADMIN_BEARER_TOKEN=' "$ENV_FILE"; then
	sed -i "s|^ADMIN_BEARER_TOKEN=.*|ADMIN_BEARER_TOKEN=$admin_bearer_token|" "$ENV_FILE"
else
	printf '\nADMIN_BEARER_TOKEN=%s\n' "$admin_bearer_token" >> "$ENV_FILE"
fi

echo "VerifyChallenge message: ${verify_message:-ok}"
echo "Authorization header: $auth_header"
echo "ADMIN_BEARER_TOKEN saved to $ENV_FILE"
echo "Bearer token (admin): $admin_bearer_token"
