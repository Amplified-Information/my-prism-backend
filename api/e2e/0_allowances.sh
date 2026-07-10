#!/bin/bash

# script to prompt the user to top up all accounts
# 1. Print out the balances of USDC and HBAR + USDC allowance on the smart contract (MARKET_ID) for all accounts in .env
# 2. Prompt the user for the target USDC allowance on the contract [20.00]
# 3. Set the allowance for all accounts in .env to the target amount (if current allowance is less than target)
# 4. Print out the updated balances of USDC and HBAR + USDC allowance on the smart contract (MARKET_ID) for all accounts in .env

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

if ! command -v hcli >/dev/null 2>&1; then
	echo "hcli could not be found. Please install it before running this script."
	echo "Install with: npm install -g @hiero-ledger/hiero-cli"
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

if ! command -v node >/dev/null 2>&1; then
	echo "node could not be found. Please install it before running this script."
	exit 1
fi

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

market_id_default=$(env_get "MARKET_ID")
if [[ -n "$market_id_default" ]]; then
	read -p "Enter marketId (UUID7) [$market_id_default]: " marketId
	marketId=${marketId:-$market_id_default}
else
	read -p "Enter marketId (UUID7): " marketId
fi

if [[ -z "$marketId" ]]; then
	echo "Error: marketId is required."
	exit 1
fi

if [[ ! "$marketId" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-7[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ ]]; then
	echo "Error: invalid marketId format. Expected strict UUIDv7."
	exit 1
fi

network_upper=$(printf '%s' "$network" | tr '[:lower:]' '[:upper:]')
usdc_var_name="${network_upper}_USDC_ADDRESS"
usdc_token_id=$(env_get "$usdc_var_name")
if [[ -z "$usdc_token_id" ]]; then
	echo "Missing $usdc_var_name in $ENV_FILE"
	exit 1
fi
if [[ ! "$usdc_token_id" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	echo "Error: invalid USDC token id '$usdc_token_id' for network $network."
	exit 1
fi

usdc_decimals=$(env_get "USDC_DECIMALS")
usdc_decimals=${usdc_decimals:-6}

declare -a account_ids=()
declare -a private_keys=()
declare -a key_types=()
declare -a hbar_balances=()
declare -a usdc_balances=()
declare -a allowances=()
declare -a allowance_targets=()

loaded_accounts=0
for i in {0..9}; do
	private_key_value=$(env_get "${i}_PRIVATE_KEY")
	account_id_value=$(env_get "${i}_ACCOUNT_ID")
	key_type_value=$(env_get "${i}_KEY_TYPE")
	if [[ -n "$private_key_value" && -n "$account_id_value" && -n "$key_type_value" ]]; then
		private_keys[$i]="$private_key_value"
		account_ids[$i]="$account_id_value"
		key_types[$i]="$key_type_value"
		loaded_accounts=$((loaded_accounts + 1))
	fi
done

if [[ $loaded_accounts -eq 0 ]]; then
	echo "No private keys found in .env file."
	exit 1
fi

resolve_evm_address() {
	local account_id="$1"
	local mirror_base="https://${network}.mirrornode.hedera.com"
	local account_json
	account_json=$(curl -sfL "$mirror_base/api/v1/accounts/$account_id") || return 1
	printf '%s\n' "$account_json" | sed -n 's/.*"evm_address"[[:space:]]*:[[:space:]]*"0x\{0,1\}\([0-9a-fA-F]\{40\}\)".*/\1/p' | head -n 1 | tr 'A-F' 'a-f'
}

read_balance_line() {
	local account_id="$1"
	local balance_output hbar_balance usdc_balance
	balance_output=$(hcli account balance -a "$account_id")
	hbar_balance=$(printf '%s\n' "$balance_output" | sed -n 's/^.*Account Balance: \([0-9.][0-9.]*\) HBAR$/\1/p' | head -n 1)
	if [[ -z "$hbar_balance" ]]; then
		hbar_balance="0"
	fi
	usdc_balance=$(printf '%s\n' "$balance_output" | awk '/Balance: [0-9.]+ USDC/ { for (i = 1; i <= NF; i++) if ($i == "Balance:") sum += $(i + 1) } END { if (sum > 0) print sum; else print 0 }')
	printf '%s\t%s\n' "$hbar_balance" "$usdc_balance"
}

fetch_allowance() {
	local account_id="$1"
	local mirror_base="https://${network}.mirrornode.hedera.com"
	local allowance_url="$mirror_base/api/v1/accounts/$account_id/allowances/tokens?spender.id=eq:$spender_account_id&token.id=eq:$usdc_token_id"
	local allowance_output
	allowance_output=$(curl -sfL "$allowance_url") || return 1
	printf '%s\n' "$allowance_output" | sed -n 's/.*"amount"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -n 1
}

market_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"marketId\":\"$marketId\"}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetMarketById 2>/dev/null)
if [[ -z "$market_json" ]]; then
	echo "Error: failed to fetch market details for marketId $marketId."
	exit 1
fi
spender_account_id=$(printf '%s\n' "$market_json" | jq -r '.smartContractId // .smartContractID // .contractId // .contractID // ""')
if [[ -z "$spender_account_id" ]]; then
	echo "Error: failed to resolve spender smartContractId from market response."
	exit 1
fi
if [[ ! "$spender_account_id" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	echo "Error: invalid spender smartContractId '$spender_account_id' in market response."
	exit 1
fi

echo "Balances and current allowances for market $marketId (smartContractId=$spender_account_id)"
printf '\n%-15s %-8s %16s %16s %16s\n' "Account ID" "Key" "HBAR" "USDC" "Allowance"
printf '%-15s %-8s %16s %16s %16s\n' "----------" "---" "----" "----" "---------"
for i in "${!account_ids[@]}"; do
	account_id="${account_ids[$i]}"
	if [[ -z "$account_id" ]]; then
		continue
	fi
	IFS=$'\t' read -r hbar_balance usdc_balance < <(read_balance_line "$account_id")
	allowance_scaled=$(fetch_allowance "$account_id" || true)
	if [[ -z "$allowance_scaled" ]]; then
		allowance_scaled="0"
	fi
	allowance=$(awk -v raw="$allowance_scaled" -v dec="$usdc_decimals" 'BEGIN { printf "%.*f", dec, raw / (10 ^ dec) }')
	hbar_balances[$i]="$hbar_balance"
	usdc_balances[$i]="$usdc_balance"
	allowances[$i]="$allowance"
	printf '%-15s %-8s %16s %16s %16s\n' "$account_id" "${key_types[$i]}" "$hbar_balance" "$usdc_balance" "$allowance"
done

read -p "Enter USDC allowance per account [20]: " usdc_allowance
usdc_allowance=${usdc_allowance:-20}
if ! [[ "$usdc_allowance" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
	echo "Invalid allowance amount: $usdc_allowance"
	exit 1
fi

read -p "Proceed with setting allowances? [y/N]: " confirm
confirm=$(printf '%s' "$confirm" | tr '[:upper:]' '[:lower:]')
if [[ "$confirm" != "y" && "$confirm" != "yes" ]]; then
	echo "Aborted. No allowances were changed."
	exit 0
fi

usdc_allowance_scaled=$(awk -v amt="$usdc_allowance" -v d="$usdc_decimals" 'BEGIN { printf "%.0f", amt * (10 ^ d) }')

set_allowance_for_account() {
	local account_index="$1"
	local amount_scaled="$2"
	local contract_id_like
	contract_id_like() {
		local value="$1"
		if [[ "$value" =~ ^0x?[0-9a-fA-F]{40}$ ]]; then
			[[ "$value" == 0x* ]] || value="0x$value"
			printf '%s\n' "$value"
		else
			printf '%s\n' "$value"
		fi
	}
	(
		cd "$SCS_DIR"
		SOURCE_ACCOUNT="${account_ids[$account_index]}" \
		SOURCE_PRIVATE_KEY="${private_keys[$account_index]}" \
		SOURCE_KEY_TYPE="$(printf '%s' "${key_types[$account_index]}" | tr '[:upper:]' '[:lower:]')" \
		MARKET_CONTRACT_ID="$spender_account_id" \
		USDC_TOKEN_ID="$usdc_token_id" \
		USDC_ALLOWANCE_SCALED="$amount_scaled" \
		node --input-type=module <<'EOF'
import {
  AccountId,
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  PrivateKey,
  TokenId,
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

echo
echo "Setting allowances..."
for i in "${!account_ids[@]}"; do
	account_id="${account_ids[$i]}"
	[[ -z "$account_id" ]] && continue
	current_allowance="${allowances[$i]:-0}"
	if (( $(echo "$current_allowance >= $usdc_allowance" | bc -l) )); then
		echo "Skipping $account_id (current allowance $current_allowance >= $usdc_allowance)"
		continue
	fi
	echo "Setting allowance for $account_id ..."
	if ! set_allowance_for_account "$i" "$usdc_allowance_scaled"; then
		echo "Error: failed to set allowance for account $account_id"
		exit 1
	fi
done

echo 
echo "Pausing for 3 seconds to allow for consensus..."
sleep 3
echo "Updated allowance table"
printf '%-15s %-8s %16s %16s %16s\n' "Account ID" "Key" "HBAR" "USDC" "Allowance"
printf '%-15s %-8s %16s %16s %16s\n' "----------" "---" "----" "----" "---------"
for i in "${!account_ids[@]}"; do
	account_id="${account_ids[$i]}"
	if [[ -z "$account_id" ]]; then
		continue
	fi
	IFS=$'\t' read -r hbar_balance usdc_balance < <(read_balance_line "$account_id")
	allowance_scaled=$(fetch_allowance "$account_id" || true)
	if [[ -z "$allowance_scaled" ]]; then
		allowance_scaled="0"
	fi
	allowance=$(awk -v raw="$allowance_scaled" -v dec="$usdc_decimals" 'BEGIN { printf "%.*f", dec, raw / (10 ^ dec) }')
	printf '%-15s %-8s %16s %16s %16s\n' "$account_id" "${key_types[$i]}" "$hbar_balance" "$usdc_balance" "$allowance"
done

echo
echo "Allowance update completed successfully."
