#!/bin/bash

# script to prompt the user to top up all accounts
# 1. Print out the balances of USDC and HBAR for all accounts in .env
# 2. Tell the user to top up account in .env (0_ACCOUNT_ID)
# - ensure there's enough USDC in the account to top up all N accounts specified in .env (min 20 USDC per account, 20 HBAR per account)
# 3. Will send USDC and HBAR from account 0_ACCOUNT_ID to all accounts in .env (1_ACCOUNT_ID, 2_ACCOUNT_ID, etc.)
# 4. Print out the balances of USDC and HBAR for all accounts in .env after the top up

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
SCS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)/scs"

if [[ ! -f "$ENV_FILE" ]]; then
	echo ".env file not found at $ENV_FILE"
	exit 1
fi

if ! command -v hcli >/dev/null 2>&1; then
	echo "hcli could not be found. Please install it before running this script."
	echo "Install with: npm install -g @hiero-ledger/hiero-cli"
	exit 1
fi

if ! command -v node >/dev/null 2>&1; then
	echo "node could not be found. Please install it before running this script."
	exit 1
fi

if [[ ! -d "$SCS_DIR/node_modules" ]]; then
	echo "scs dependencies not found. Run: (cd $SCS_DIR && npm install)"
	exit 1
fi

env_get() {
	e2e_env_get "$1"
}

net_from_env=$(env_get "NET")
net_from_env=$(printf '%s' "$net_from_env" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
network=${net_from_env:-testnet}
case "$network" in
	testnet|previewnet|mainnet) ;;
	*)
		echo "Invalid or unsupported NET in $ENV_FILE: '$network'"
		echo "Use one of: testnet, previewnet, mainnet"
		exit 1
		;;
esac

network_upper=$(printf '%s' "$network" | tr '[:lower:]' '[:upper:]')
usdc_var_name="${network_upper}_USDC_ADDRESS"
usdc_token_id=$(env_get "$usdc_var_name")
if [[ -z "$usdc_token_id" ]]; then
	echo "Missing $usdc_var_name in $ENV_FILE"
	exit 1
fi

usdc_decimals=$(env_get "USDC_DECIMALS")
usdc_decimals=${usdc_decimals:-6}

declare -a account_ids
declare -a private_keys
declare -a key_types

for i in {0..9}; do
	account_ids[$i]="$(env_get "${i}_ACCOUNT_ID")"
	private_keys[$i]="$(env_get "${i}_PRIVATE_KEY")"
	key_types[$i]="$(env_get "${i}_KEY_TYPE")"
done

source_account="${account_ids[0]:-}"
source_private_key="${private_keys[0]:-}"
source_key_type_raw="${key_types[0]:-}"
if [[ -z "$source_account" || -z "$source_private_key" || -z "$source_key_type_raw" ]]; then
	echo "Missing 0_ACCOUNT_ID, 0_PRIVATE_KEY, or 0_KEY_TYPE in $ENV_FILE"
	exit 1
fi

source_key_type=$(printf '%s' "$source_key_type_raw" | tr '[:upper:]' '[:lower:]')
case "$source_key_type" in
	ed|ed25519) source_key_type="ed25519" ;;
	ecdsa|ecdsa_secp256k1) source_key_type="ecdsa" ;;
	*)
		echo "Unsupported 0_KEY_TYPE '$source_key_type_raw' (use ED25519 or ECDSA)"
		exit 1
		;;
esac

declare -a recipient_indices=()
declare -a transfer_indices=()
declare -a recipient_hbar_balances=()
declare -a recipient_usdc_balances=()
declare -a recipient_skip_transfer=()
for i in {1..9}; do
	if [[ -n "${account_ids[$i]:-}" ]]; then
		recipient_indices+=("$i")
	fi
done

recipient_count=${#recipient_indices[@]}
if (( recipient_count == 0 )); then
	echo "No recipient accounts found (expected 1_ACCOUNT_ID..9_ACCOUNT_ID in $ENV_FILE)."
	exit 1
fi

read -p "Enter HBAR top-up per recipient [20]: " hbar_topup
hbar_topup=${hbar_topup:-20}
read -p "Enter USDC top-up per recipient [20]: " usdc_topup
usdc_topup=${usdc_topup:-20}

if ! [[ "$hbar_topup" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
	echo "Invalid HBAR amount: $hbar_topup"
	exit 1
fi
if ! [[ "$usdc_topup" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
	echo "Invalid USDC amount: $usdc_topup"
	exit 1
fi

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

print_balances_table() {
	local label="$1"
	echo
	echo "$label"
	printf '%-15s %-8s %16s %16s\n' "Account ID" "Key" "HBAR" "USDC"
	printf '%-15s %-8s %16s %16s\n' "----------" "---" "----" "----"
	for i in {0..9}; do
		account_id="${account_ids[$i]:-}"
		[[ -z "$account_id" ]] && continue
		IFS=$'\t' read -r bal_hbar bal_usdc < <(read_balance_line "$account_id")
		printf '%-15s %-8s %16s %16s\n' "$account_id" "${key_types[$i]:-}" "$bal_hbar" "$bal_usdc"
	done
}

print_balances_table "Balances before top-up"

for idx in "${recipient_indices[@]}"; do
	recipient_account="${account_ids[$idx]}"
	IFS=$'\t' read -r recipient_hbar recipient_usdc < <(read_balance_line "$recipient_account")
	recipient_hbar_balances[$idx]="$recipient_hbar"
	recipient_usdc_balances[$idx]="$recipient_usdc"

	if (( $(echo "$recipient_hbar > $hbar_topup" | bc -l) )) && (( $(echo "$recipient_usdc > $usdc_topup" | bc -l) )); then
		recipient_skip_transfer[$idx]="1"
	else
		recipient_skip_transfer[$idx]="0"
		transfer_indices+=("$idx")
	fi
done

transfer_count=${#transfer_indices[@]}
needed_hbar=$(awk -v n="$transfer_count" -v a="$hbar_topup" 'BEGIN { printf "%.6f", n * a }')
needed_usdc=$(awk -v n="$transfer_count" -v a="$usdc_topup" 'BEGIN { printf "%.6f", n * a }')
IFS=$'\t' read -r source_hbar source_usdc < <(read_balance_line "$source_account")

if (( $(echo "$source_hbar < $needed_hbar" | bc -l) )); then
	echo "Source account $source_account has insufficient HBAR ($source_hbar). Required: $needed_hbar"
	echo "Please top up 0_ACCOUNT_ID first, then rerun."
	exit 1
fi

if (( $(echo "$source_usdc < $needed_usdc" | bc -l) )); then
	echo "Source account $source_account has insufficient USDC ($source_usdc). Required: $needed_usdc"
	echo "Please top up 0_ACCOUNT_ID first, then rerun."
	exit 1
fi

usdc_topup_scaled=$(awk -v amt="$usdc_topup" -v d="$usdc_decimals" 'BEGIN { printf "%.0f", amt * (10 ^ d) }')

echo
echo "Top-up plan"
echo "Network: $network"
echo "USDC token: $usdc_token_id"
echo "Source account: $source_account"
echo "Recipients: $recipient_count"
echo "Recipients to transfer: $transfer_count"
echo "HBAR each: $hbar_topup"
echo "USDC each: $usdc_topup"
echo "USDC each (scaled): $usdc_topup_scaled"
echo "Recipient status:"
for idx in "${recipient_indices[@]}"; do
	recipient_account="${account_ids[$idx]}"
	recipient_hbar="${recipient_hbar_balances[$idx]:-0}"
	recipient_usdc="${recipient_usdc_balances[$idx]:-0}"
	if [[ "${recipient_skip_transfer[$idx]:-0}" == "1" ]]; then
		echo "- $recipient_account HBAR=$recipient_hbar USDC=$recipient_usdc (skipping)"
	else
		echo "- $recipient_account HBAR=$recipient_hbar USDC=$recipient_usdc"
	fi
done

if (( transfer_count == 0 )); then
	echo "All recipients already exceed both top-up thresholds; no transfers needed."
	# print_balances_table "Balances after top-up"
	# echo
	# echo "Top-up completed successfully."
	exit 0
fi

read -p "Proceed with transfers? [y/N]: " confirm
confirm=$(printf '%s' "$confirm" | tr '[:upper:]' '[:lower:]')
if [[ "$confirm" != "y" && "$confirm" != "yes" ]]; then
	echo "Aborted. No transfers were made."
	exit 0
fi

transfer_one_recipient() {
	local to_account="$1"
	(
		cd "$SCS_DIR"
		SOURCE_ACCOUNT="$source_account" \
		SOURCE_PRIVATE_KEY="$source_private_key" \
		SOURCE_KEY_TYPE="$source_key_type" \
		TO_ACCOUNT="$to_account" \
		NETWORK="$network" \
		HBAR_AMOUNT="$hbar_topup" \
		USDC_TOKEN_ID="$usdc_token_id" \
		USDC_AMOUNT_SCALED="$usdc_topup_scaled" \
		node --input-type=module <<'EOF'
import {
	AccountId,
	Client,
	Hbar,
	PrivateKey,
	TokenId,
	TransferTransaction,
} from '@hashgraph/sdk'

const sourceAccount = process.env.SOURCE_ACCOUNT
const sourcePrivateKeyRaw = process.env.SOURCE_PRIVATE_KEY
const sourceKeyType = process.env.SOURCE_KEY_TYPE
const toAccount = process.env.TO_ACCOUNT
const network = process.env.NETWORK
const hbarAmount = Number(process.env.HBAR_AMOUNT)
const usdcTokenId = process.env.USDC_TOKEN_ID
const usdcAmountScaled = Number(process.env.USDC_AMOUNT_SCALED)

let client
try {
	if (network === 'mainnet') client = Client.forMainnet()
	else if (network === 'previewnet') client = Client.forPreviewnet()
	else client = Client.forTestnet()

	let sourcePrivateKey
	if (sourceKeyType === 'ecdsa') sourcePrivateKey = PrivateKey.fromStringECDSA(sourcePrivateKeyRaw)
	else sourcePrivateKey = PrivateKey.fromStringED25519(sourcePrivateKeyRaw)

	client.setOperator(AccountId.fromString(sourceAccount), sourcePrivateKey)

	const hbarTx = await new TransferTransaction()
		.addHbarTransfer(AccountId.fromString(sourceAccount), new Hbar(-hbarAmount))
		.addHbarTransfer(AccountId.fromString(toAccount), new Hbar(hbarAmount))
		.execute(client)
	const hbarReceipt = await hbarTx.getReceipt(client)

	const usdcTx = await new TransferTransaction()
		.addTokenTransfer(TokenId.fromString(usdcTokenId), AccountId.fromString(sourceAccount), -usdcAmountScaled)
		.addTokenTransfer(TokenId.fromString(usdcTokenId), AccountId.fromString(toAccount), usdcAmountScaled)
		.execute(client)
	const usdcReceipt = await usdcTx.getReceipt(client)

	console.log(`HBAR transfer status: ${hbarReceipt.status.toString()}`)
	console.log(`USDC transfer status: ${usdcReceipt.status.toString()}`)
} finally {
	if (client) {
		client.close()
	}
}
EOF
	)
}

for idx in "${transfer_indices[@]}"; do
	recipient_account="${account_ids[$idx]}"
	echo "Transferring to $recipient_account ..."
	if ! transfer_one_recipient "$recipient_account"; then
		echo "Error: transfer failed for recipient $recipient_account"
		exit 1
	fi
done


echo "Waiting 3 seconds for consensus before printing final balances..."
sleep 3

print_balances_table "Balances after top-up"
echo
echo "Top-up completed successfully."
