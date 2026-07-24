#!/bin/bash

# this script is used once a new smart contract is deployed and the Prism services have been configured to point to the new contract address. 
# this script sets an allowance for the contract to spend USDC on behalf of the account.
# - get the latest smart contract form api.proto MacroMetadata endpoint (print out the address of the contract)
# - give a spender allowance of $5 from account 0_ACCOUNT_ID to the smart contract

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$API_DIR/proto"
SCS_DIR="$(cd "$API_DIR/.." && pwd)/scs"

if [[ ! -f "$ENV_FILE" ]]; then
	echo ".env file not found at $ENV_FILE"
	exit 1
fi

for dependency in easyrpc jq node curl; do
	if ! command -v "$dependency" >/dev/null 2>&1; then
		echo "$dependency could not be found. Please install it before running this script."
		exit 1
	fi
done

if [[ ! -d "$PROTO_DIR" ]]; then
	echo "proto directory not found at $PROTO_DIR"
	exit 1
fi

if [[ ! -d "$SCS_DIR/node_modules" ]]; then
	echo "scs dependencies not found. Run: (cd $SCS_DIR && npm install)"
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

net_from_env=$(env_get "NET")
enviro_from_env=$(env_get "ENVIRO")
net_from_env=$(printf '%s' "$net_from_env" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
enviro_from_env=$(printf '%s' "$enviro_from_env" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
network=${net_from_env:-testnet}
enviro=${enviro_from_env:-dev}

case "$network" in
	testnet|previewnet|mainnet) ;;
	*)
		echo "Invalid or unsupported NET in $ENV_FILE: '$network'"
		echo "Use one of: testnet, previewnet, mainnet"
		exit 1
		;;
esac

base_url_default="https://${network}.${enviro}.prism.market"
read -p "Enter base URL [$base_url_default]: " baseUrl
baseUrl=${baseUrl:-$base_url_default}
echo "Base URL set to: $baseUrl"

grpc_addr="${baseUrl#*://}"
grpc_addr="${grpc_addr%%/}"
grpc_flags=(-w)
grpc_meta=()
if [[ "$baseUrl" == https://* ]]; then
	grpc_flags=(-w --tls)
	if [[ "$grpc_addr" != *:* ]]; then
		grpc_addr="${grpc_addr}:443"
	fi
elif [[ "$grpc_addr" != *:* ]]; then
	grpc_addr="${grpc_addr}:8888"
fi

echo "Preflight: checking grpc-web Health on $grpc_addr..."
if ! easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d '{}' -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.Health >/dev/null 2>&1; then
	echo "grpc-web preflight failed for $grpc_addr"
	exit 1
fi

macro_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d '{}' -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.MacroMetadata 2>/dev/null)
if [[ -z "$macro_json" ]]; then
	echo "Error: failed to fetch MacroMetadata."
	exit 1
fi

spender_account_id=$(printf '%s\n' "$macro_json" | jq -r --arg net "$network" '.smartContractIds[$net] // .smart_contract_ids[$net] // ""')
if [[ -z "$spender_account_id" ]]; then
	echo "Error: failed to resolve smartContractId from MacroMetadata for network $network."
	exit 1
fi

if [[ ! "$spender_account_id" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	echo "Error: invalid smartContractId '$spender_account_id' from MacroMetadata."
	exit 1
fi

network_upper=$(printf '%s' "$network" | tr '[:lower:]' '[:upper:]')
usdc_var_name="${network_upper}_USDC_ADDRESS"
usdc_token_id=$(env_get "$usdc_var_name")
if [[ -z "$usdc_token_id" ]]; then
	usdc_token_id=$(printf '%s\n' "$macro_json" | jq -r --arg net "$network" '.usdcTokenIds[$net] // .usdc_token_ids[$net] // ""')
fi
if [[ -z "$usdc_token_id" ]]; then
	echo "Error: failed to resolve USDC token id for network $network."
	exit 1
fi
if [[ ! "$usdc_token_id" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	echo "Error: invalid USDC token id '$usdc_token_id' for network $network."
	exit 1
fi

usdc_decimals=$(env_get "USDC_DECIMALS")
usdc_decimals=${usdc_decimals:-$(printf '%s\n' "$macro_json" | jq -r '.usdcDecimals // .usdc_decimals // 6')}

account_id=$(env_get "0_ACCOUNT_ID")
private_key=$(env_get "0_PRIVATE_KEY")
key_type=$(env_get "0_KEY_TYPE")

if [[ -z "$account_id" || -z "$private_key" || -z "$key_type" ]]; then
	echo "Error: missing 0_ACCOUNT_ID, 0_PRIVATE_KEY, or 0_KEY_TYPE in $ENV_FILE."
	exit 1
fi

if [[ ! "$account_id" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	echo "Error: invalid 0_ACCOUNT_ID '$account_id' in $ENV_FILE."
	exit 1
fi

fetch_allowance() {
	local mirror_base="https://${network}.mirrornode.hedera.com"
	local allowance_url="$mirror_base/api/v1/accounts/$account_id/allowances/tokens?spender.id=eq:$spender_account_id&token.id=eq:$usdc_token_id"
	local allowance_output
	allowance_output=$(curl -sfL "$allowance_url") || return 1
	printf '%s\n' "$allowance_output" | sed -n 's/.*"amount"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -n 1
}

current_allowance_scaled=$(fetch_allowance || true)
if [[ -z "$current_allowance_scaled" ]]; then
	current_allowance_scaled="0"
fi

current_allowance=$(awk -v raw="$current_allowance_scaled" -v dec="$usdc_decimals" 'BEGIN { printf "%.*f", dec, raw / (10 ^ dec) }')
target_allowance=5
target_allowance_scaled=$(awk -v amt="$target_allowance" -v d="$usdc_decimals" 'BEGIN { printf "%.0f", amt * (10 ^ d) }')

echo "Resolved smart contract id: $spender_account_id"
echo "Current allowance to $spender_account_id: $current_allowance USDC"
echo "Target allowance: $target_allowance USDC"

if awk -v current="$current_allowance" -v target="$target_allowance" 'BEGIN { exit !(current >= target) }'; then
	echo "Skipping allowance update because current allowance is already at or above $target_allowance USDC."
	exit 0
fi

set_allowance_for_account() {
	local amount_scaled="$1"
	(
		cd "$SCS_DIR"
		SOURCE_ACCOUNT="$account_id" \
		SOURCE_PRIVATE_KEY="$private_key" \
		SOURCE_KEY_TYPE="$(printf '%s' "$key_type" | tr '[:upper:]' '[:lower:]')" \
		MARKET_CONTRACT_ID="$spender_account_id" \
		USDC_TOKEN_ID="$usdc_token_id" \
		USDC_ALLOWANCE_SCALED="$amount_scaled" \
		NETWORK="$network" \
		node --input-type=module <<'EOF'
import {
  AccountId,
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  PrivateKey,
} from '@hashgraph/sdk'

const sourceAccount = process.env.SOURCE_ACCOUNT
const sourcePrivateKeyRaw = process.env.SOURCE_PRIVATE_KEY
const sourceKeyType = process.env.SOURCE_KEY_TYPE
const marketContractId = process.env.MARKET_CONTRACT_ID
const usdcTokenId = process.env.USDC_TOKEN_ID
const usdcAllowanceScaled = BigInt(process.env.USDC_ALLOWANCE_SCALED || '0')
const network = process.env.NETWORK || 'testnet'

const toContractId = (value) => {
	if (/^0x?[0-9a-fA-F]{40}$/.test(value)) {
		return ContractId.fromSolidityAddress(value.startsWith('0x') ? value : `0x${value}`)
	}
	return ContractId.fromString(value)
}

let client
let sourcePrivateKey

try {
	if (network === 'mainnet') client = Client.forMainnet()
	else if (network === 'previewnet') client = Client.forPreviewnet()
	else client = Client.forTestnet()

	if (sourceKeyType === 'ecdsa') sourcePrivateKey = PrivateKey.fromStringECDSA(sourcePrivateKeyRaw)
	else sourcePrivateKey = PrivateKey.fromStringED25519(sourcePrivateKeyRaw)

	client.setOperator(AccountId.fromString(sourceAccount), sourcePrivateKey)

	const approveTx = await new ContractExecuteTransaction()
		.setContractId(toContractId(usdcTokenId))
		.setGas(10_000_000)
		.setFunction(
			'approve',
			new ContractFunctionParameters()
				.addAddress(toContractId(marketContractId).toEvmAddress())
				.addUint256(usdcAllowanceScaled.toString())
		)
		.execute(client)
	const receipt = await approveTx.getReceipt(client)
	console.log(`approve status: ${receipt.status.toString()}`)
} finally {
	if (client) {
		client.close()
	}
}
EOF
	)
}

echo "Setting allowance..."
if ! set_allowance_for_account "$target_allowance_scaled"; then
	echo "Error: failed to set allowance for account $account_id"
	exit 1
fi

echo "Waiting 3 seconds for consensus..."
sleep 3

updated_allowance_scaled=$(fetch_allowance || true)
if [[ -z "$updated_allowance_scaled" ]]; then
	updated_allowance_scaled="0"
fi
updated_allowance=$(awk -v raw="$updated_allowance_scaled" -v dec="$usdc_decimals" 'BEGIN { printf "%.*f", dec, raw / (10 ^ dec) }')

echo "Updated allowance to $spender_account_id: $updated_allowance USDC"

