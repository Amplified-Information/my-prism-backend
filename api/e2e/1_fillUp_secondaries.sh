#!/bin/bash

# This script sells approximately (pseudo-random) 50% of the YES and NO tokens currently held (matched orders) for a given marketId (for each accountId in the .env file)
# When the script runs, prints a summary of all secondary sales submitted to the orderbook for matching
# After than, the script checks to see if any of the submitted secondary sales have been matched, and prints a summary of the matched orders
# The script uses the MARKET_ID from .env, and the accountIds from .env (0_ACCOUNT_ID, 1_ACCOUNT_ID, 2_ACCOUNT_ID, 3_ACCOUNT_ID, etc.)
# 1_fillUp.sh produces a file called ./out/fillup_orders* which provides a ledger of all primary orders already submitted
# append the ledger in out/fillup_orders with clearly marked secondary orders submitted by this script, so that 2_reconcile.sh can reconcile the total submitted orders (primary + secondary) against the API open/matched state

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$API_DIR/proto"
source "$SCRIPT_DIR/shared.sh"
ENV_FILE="$SCRIPT_DIR/.env"
SCS_DIR="$(cd "$API_DIR/.." && pwd)/scs"
OUT_DIR="$SCRIPT_DIR/out"

mkdir -p "$OUT_DIR"

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

if ! command -v curl >/dev/null 2>&1; then
	echo "curl could not be found. Please install it before running this script."
	exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
	echo "jq could not be found. Please install it before running this script."
	exit 1
fi

ts_node_bin="$SCS_DIR/node_modules/.bin/ts-node"
if [[ ! -x "$ts_node_bin" ]]; then
	echo "ts-node could not be found at $ts_node_bin. Install scs dependencies first."
	exit 1
fi

env_get() {
	e2e_env_get "$1"
}

fetch_user_portfolio_json() {
	local evm_address="$1"
	local payload
	local output=""
	local status=1
	local attempt
	local max_attempts=4

	payload=$(printf '{"evmAddress":"%s","net":"%s","marketId":"%s"}' "$evm_address" "$network" "$marketId")

	for ((attempt = 1; attempt <= max_attempts; attempt++)); do
		output=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "$payload" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetUserPortfolio 2>&1)
		status=$?
		if [[ $status -eq 0 && -n "$output" ]]; then
			printf '%s\n' "$output"
			return 0
		fi
		if (( attempt < max_attempts )); then
			echo "Warning: GetUserPortfolio transient failure for evm=$evm_address (attempt $attempt/$max_attempts, exit=$status). Retrying..." >&2
		fi
	done

	printf '%s\n' "$output"
	return 1
}

create_prediction_intent() {
	local account_index="$1"
	local price_usd="$2"
	local qty="$3"
	local primary_secondary="$4"
	local request_json

	request_json=$(cd "$SCS_DIR" && NODE_NO_WARNINGS=1 "$ts_node_bin" --esm scripts/e2e_create_prediction_intent.ts \
		"${private_keys[$account_index]}" \
		"${key_types[$account_index]}" \
		"${account_ids[$account_index]}" \
		"$marketId" \
		"$network" \
		"$price_usd" \
		"$qty" \
		"$primary_secondary") || return 1

	CREATE_LAST_TX_ID=$(printf '%s\n' "$request_json" | jq -r '.txId // empty')
	CREATE_LAST_RESPONSE_JSON=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "$request_json" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.CreatePredictionIntent)
	CREATE_LAST_ERROR_CODE=$(printf '%s\n' "$CREATE_LAST_RESPONSE_JSON" | jq -r '.errorCode // ""')
	CREATE_LAST_MESSAGE=$(printf '%s\n' "$CREATE_LAST_RESPONSE_JSON" | jq -r '.message // ""')
	printf '%s\n' "$CREATE_LAST_RESPONSE_JSON"
}

random_half_ratio() {
	awk -v seed="$RANDOM" 'BEGIN { srand(seed); printf "%.6f", 0.45 + rand() * 0.10 }'
}

scaled_to_qty() {
	local raw="$1"
	awk -v r="$raw" -v dec="$usdc_decimals" 'BEGIN { printf "%.6f", r / (10 ^ dec) }'
}

next_sequence_from_ledger() {
	local ledger_file="$1"
	awk -F '\t' 'NR > 1 && $2 ~ /^[0-9]+$/ { if ($2 > max) max = $2 } END { print max + 1 }' "$ledger_file"
}

append_ledger_row() {
	local seq="$1"
	local side="$2"
	local account_index="$3"
	local price="$4"
	local usd="$5"
	local qty="$6"
	local primary_secondary="$7"
	local tx_id="$8"
	local error_code="$9"
	local response_message="${10}"

	printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
		"$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
		"$seq" \
		"$side" \
		"$account_index" \
		"${account_ids[$account_index]}" \
		"${key_types[$account_index]}" \
		"$price" \
		"$usd" \
		"$qty" \
		"$primary_secondary" \
		"$tx_id" \
		"$error_code" \
		"$response_message" >> "$orders_latest_file"
}

marketId=$(env_get "MARKET_ID")
if [[ -z "$marketId" ]]; then
	echo "MARKET_ID is missing from $ENV_FILE"
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

read -p "Enter the base URL [$base_url_default]: " baseUrl
baseUrl=${baseUrl:-$base_url_default}
if grep -qE '^BASE_URL=' "$ENV_FILE"; then
	sed -i "s|^BASE_URL=.*|BASE_URL=$baseUrl|" "$ENV_FILE"
else
	printf '\nBASE_URL=%s\n' "$baseUrl" >> "$ENV_FILE"
fi
echo "Base URL set to: $baseUrl"

network="$net_from_env"
case "$network" in
	testnet|previewnet|mainnet) ;;
	*) network="testnet" ;;
esac

usdc_decimals=$(env_get "USDC_DECIMALS")
usdc_decimals=${usdc_decimals:-6}

grpc_addr="${baseUrl#*://}"
grpc_addr="${grpc_addr%%/}"
grpc_flags=(-w)
grpc_meta=()
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

mirror_base="https://${network}.mirrornode.hedera.com"

orders_market_file="$OUT_DIR/fillup_orders_${marketId}.tsv"
orders_latest_file="$OUT_DIR/fillup_orders_latest.tsv"

if [[ ! -f "$orders_latest_file" ]]; then
	echo "Order ledger not found at $orders_latest_file"
	echo "Run ./1_fillUp.sh first to generate the primary order ledger."
	exit 1
fi

declare -a private_keys
declare -a account_ids
declare -a key_types

loaded_accounts=0
for i in {0..9}; do
	private_key_var="${i}_PRIVATE_KEY"
	private_key_value=$(env_get "$private_key_var")
	account_id_var="${i}_ACCOUNT_ID"
	account_id_value=$(env_get "$account_id_var")
	key_type_var="${i}_KEY_TYPE"
	key_type_value=$(env_get "$key_type_var")
	if [[ -n "$private_key_value" && -n "$account_id_value" && -n "$key_type_value" ]]; then
		private_keys[$i]="$private_key_value"
		account_ids[$i]="$account_id_value"
		key_types[$i]="$key_type_value"
		loaded_accounts=$((loaded_accounts + 1))
	fi
done

if [[ $loaded_accounts -eq 0 ]]; then
	echo "No private keys/accounts found in $ENV_FILE"
	exit 1
fi

echo "Loaded accounts:"
for i in "${!account_ids[@]}"; do
	printf '  %s (%s)\n' "${account_ids[$i]}" "${key_types[$i]}"
done

next_seq=$(next_sequence_from_ledger "$orders_latest_file")
if [[ -z "$next_seq" || ! "$next_seq" =~ ^[0-9]+$ ]]; then
	echo "Failed to determine next sequence number from $orders_latest_file"
	exit 1
fi

echo
echo "Submitting pseudo-random ~50% secondary sales for marketId=$marketId on $network"

declare -a submitted_rows
declare -a submitted_account
declare -a submitted_tx
declare -a submitted_error
declare -a submitted_token

submitted_count=0
submitted_success=0
accounts_total=${#account_ids[@]}
account_progress=0

for i in "${!account_ids[@]}"; do
	account_id="${account_ids[$i]}"
	account_progress=$((account_progress + 1))
	echo "[submit $account_progress/$accounts_total] Account $account_id: resolving EVM address..."
	evm_address=$(e2e_resolve_evm_address "$account_id" || true)
	if [[ -z "$evm_address" ]]; then
		echo "Warning: failed to resolve evmAddress for account $account_id; skipping."
		continue
	fi

	echo "[submit $account_progress/$accounts_total] Account $account_id: fetching portfolio..."
	portfolio_json=$(fetch_user_portfolio_json "$evm_address" || true)
	if [[ -z "$portfolio_json" ]]; then
		echo "Warning: failed to fetch portfolio for account $account_id; skipping."
		continue
	fi

	error_code=$(printf '%s\n' "$portfolio_json" | jq -r '.errorCode // "0"' 2>/dev/null || printf '1')
	if [[ "$error_code" != "0" ]]; then
		message=$(printf '%s\n' "$portfolio_json" | jq -r '.message // ""' 2>/dev/null || true)
		echo "Warning: GetUserPortfolio error for account $account_id (errorCode=$error_code message='$message'); skipping."
		continue
	fi

	yes_raw=$(printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '.positions[$m].position.yes // "0"' 2>/dev/null)
	no_raw=$(printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '.positions[$m].position.no // "0"' 2>/dev/null)
	yes_raw=${yes_raw:-0}
	no_raw=${no_raw:-0}
	echo "[submit $account_progress/$accounts_total] Account $account_id: YES=$yes_raw NO=$no_raw"

	for token in YES NO; do
		held_raw="$yes_raw"
		if [[ "$token" == "NO" ]]; then
			held_raw="$no_raw"
		fi

		if ! [[ "$held_raw" =~ ^[0-9]+$ ]]; then
			held_raw=0
		fi
		if [[ "$held_raw" == "0" ]]; then
			continue
		fi

		ratio=$(random_half_ratio)
		sell_raw=$(awk -v r="$held_raw" -v f="$ratio" 'BEGIN { v = int(r * f); if (r > 0 && v < 1) v = 1; if (v > r) v = r; printf "%.0f", v }')
		if [[ -z "$sell_raw" || "$sell_raw" == "0" ]]; then
			continue
		fi

		qty=$(scaled_to_qty "$sell_raw")
		abs_price=$(awk -v seed="$RANDOM" 'BEGIN { srand(seed); printf "%.3f", 0.45 + rand() * 0.10 }')

		# YES secondary sell is submitted as a sell intent (negative price); NO secondary sell as buy intent (positive price).
		if [[ "$token" == "YES" ]]; then
			price=$(awk -v p="$abs_price" 'BEGIN { printf "%.3f", -1 * p }')
			side="SELL"
		else
			price="$abs_price"
			side="BUY"
		fi

		notional_usd=$(awk -v p="$price" -v q="$qty" 'BEGIN { ap = (p < 0 ? -p : p); printf "%.6f", ap * q }')
		echo "[submit $account_progress/$accounts_total] Account $account_id token=$token side=$side qty=$qty price=$price: submitting CreatePredictionIntent..."

		create_prediction_intent "$i" "$price" "$qty" "s" >/dev/null || {
			echo "PANIC: CreatePredictionIntent failed for account $account_id token=$token side=$side qty=$qty price=$price" >&2
			echo "PANIC: transport or API error returned by CreatePredictionIntent; aborting run." >&2
			exit 1
		}

		if [[ -z "$CREATE_LAST_TX_ID" || "$CREATE_LAST_TX_ID" == "null" || "$CREATE_LAST_TX_ID" == "" ]]; then
			echo "PANIC: CreatePredictionIntent returned no txId for account $account_id token=$token side=$side qty=$qty price=$price" >&2
			echo "PANIC: API response: $CREATE_LAST_RESPONSE_JSON" >&2
			exit 1
		fi

		if [[ "$CREATE_LAST_ERROR_CODE" != "0" ]]; then
			echo "PANIC: CreatePredictionIntent returned errorCode=$CREATE_LAST_ERROR_CODE for account $account_id token=$token side=$side qty=$qty price=$price" >&2
			echo "PANIC: API message: $CREATE_LAST_MESSAGE" >&2
			exit 1
		fi

		row="$(printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s' "$account_id" "$token" "$held_raw" "$sell_raw" "$qty" "$price" "$side" "$CREATE_LAST_TX_ID" "$CREATE_LAST_ERROR_CODE" "$CREATE_LAST_MESSAGE")"
		submitted_rows+=("$row")
		submitted_account+=("$account_id")
		submitted_tx+=("$CREATE_LAST_TX_ID")
		submitted_error+=("$CREATE_LAST_ERROR_CODE")
		submitted_token+=("$token")

		append_ledger_row "$next_seq" "$side" "$i" "$price" "$notional_usd" "$qty" "s" "$CREATE_LAST_TX_ID" "$CREATE_LAST_ERROR_CODE" "$CREATE_LAST_MESSAGE"
		next_seq=$((next_seq + 1))

		submitted_count=$((submitted_count + 1))
		if [[ "$CREATE_LAST_ERROR_CODE" == "0" ]]; then
			submitted_success=$((submitted_success + 1))
			echo "[submit $account_progress/$accounts_total] Account $account_id token=$token: submitted txId=$CREATE_LAST_TX_ID"
		else
			echo "[submit $account_progress/$accounts_total] Account $account_id token=$token: API returned errorCode=$CREATE_LAST_ERROR_CODE"
		fi
	done
done

if [[ "$submitted_count" == "0" ]]; then
	echo "No secondary orders were submitted (no sellable YES/NO inventory found for marketId=$marketId)."
	exit 0
fi

echo
printf 'Secondary submissions: %d total, %d successful\n' "$submitted_count" "$submitted_success"
printf '%-15s %-5s %12s %12s %12s %8s %-6s %-36s %-6s %s\n' "AccountID" "Tok" "HeldRaw" "SellRaw" "Qty" "Price" "Side" "TxID" "Err" "Message"
printf '%-15s %-5s %12s %12s %12s %8s %-6s %-36s %-6s %s\n' "--------" "---" "-------" "-------" "---" "-----" "----" "----" "---" "-------"
for row in "${submitted_rows[@]}"; do
	IFS=$'\t' read -r account_id token held_raw sell_raw qty price side tx_id err msg <<< "$row"
	printf '%-15s %-5s %12s %12s %12s %8s %-6s %-36s %-6s %s\n' "$account_id" "$token" "$held_raw" "$sell_raw" "$qty" "$price" "$side" "$tx_id" "$err" "$msg"
done

declare -A account_has_success
for idx in "${!submitted_account[@]}"; do
	if [[ "${submitted_error[$idx]}" == "0" ]]; then
		account_has_success["${submitted_account[$idx]}"]=1
	fi
done

echo
echo "Fetching GetPredictionIntentMatches for submitted secondary txIds..."

declare -A secondary_tx_lookup
declare -A matched_qty_by_tx
declare -A matched_rows_by_tx

for idx in "${!submitted_tx[@]}"; do
	if [[ "${submitted_error[$idx]}" != "0" ]]; then
		continue
	fi
	tx_id="${submitted_tx[$idx]}"
	[[ -z "$tx_id" ]] && continue
	secondary_tx_lookup["$tx_id"]=1
	matched_qty_by_tx["$tx_id"]=0
	matched_rows_by_tx["$tx_id"]=0
done

if [[ ${#secondary_tx_lookup[@]} -gt 0 ]]; then
	echo "Tracking ${#secondary_tx_lookup[@]} successful secondary txIds in match history..."
	limit=$PAGE_LIMIT
	offset=0
	page=0
	while true; do
		page=$((page + 1))
		echo "[matches page $page] Fetching offset=$offset limit=$limit..."
		matches_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"marketId\":\"$marketId\",\"limit\":$limit,\"offset\":$offset}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetPredictionIntentMatches 2>/dev/null || printf '{}')

		while IFS=$'\t' read -r tx_id1 qty1 tx_id2 qty2; do
			if [[ -n "${secondary_tx_lookup[$tx_id1]:-}" ]]; then
				prev_qty="${matched_qty_by_tx[$tx_id1]:-0}"
				matched_qty_by_tx["$tx_id1"]=$(awk -v a="$prev_qty" -v b="$qty1" 'BEGIN { printf "%.6f", (a + 0) + (b + 0) }')
				matched_rows_by_tx["$tx_id1"]=$(( ${matched_rows_by_tx[$tx_id1]:-0} + 1 ))
			fi

			if [[ -n "${secondary_tx_lookup[$tx_id2]:-}" ]]; then
				prev_qty="${matched_qty_by_tx[$tx_id2]:-0}"
				matched_qty_by_tx["$tx_id2"]=$(awk -v a="$prev_qty" -v b="$qty2" 'BEGIN { printf "%.6f", (a + 0) + (b + 0) }')
				matched_rows_by_tx["$tx_id2"]=$(( ${matched_rows_by_tx[$tx_id2]:-0} + 1 ))
			fi
		done < <(printf '%s\n' "$matches_json" | jq -r '.matches[]? | [(.txId1 // ""), (.qty1 // 0), (.txId2 // ""), (.qty2 // 0)] | @tsv')

		page_count=$(printf '%s\n' "$matches_json" | jq -r '(.matches // []) | length')
		echo "[matches page $page] Received $page_count rows"
		if [[ -z "$page_count" || "$page_count" -eq 0 ]]; then
			break
		fi
		offset=$((offset + page_count))
	done
fi

echo
echo "Secondary order status summary"
printf '%-15s %-5s %-36s %12s %12s %12s %9s %-8s %-6s\n' "AccountID" "Tok" "TxID" "SubmittedQty" "MatchedQty" "OpenQty" "Rows" "Status" "Err"
printf '%-15s %-5s %-36s %12s %12s %12s %9s %-8s %-6s\n' "--------" "---" "----" "------------" "----------" "-------" "----" "------" "---"

total_submitted_qty=0
total_matched_qty=0
for row in "${submitted_rows[@]}"; do
	IFS=$'\t' read -r account_id token held_raw sell_raw qty price side tx_id err msg <<< "$row"

	if [[ "$err" != "0" || -z "$tx_id" ]]; then
		status="fail"
		matched_qty_fmt="-"
		open_qty_fmt="-"
		rows_fmt="-"
	else
		matched_qty_raw="${matched_qty_by_tx[$tx_id]:-0}"
		rows_count="${matched_rows_by_tx[$tx_id]:-0}"

		matched_effective=$(awk -v s="$qty" -v m="$matched_qty_raw" 'BEGIN { x=m+0; if (x < 0) x=0; if (x > s) x=s; printf "%.6f", x }')
		open_qty=$(awk -v s="$qty" -v m="$matched_effective" 'BEGIN { o=(s+0)-(m+0); if (o < 0) o=0; printf "%.6f", o }')

		total_submitted_qty=$(awk -v a="$total_submitted_qty" -v b="$qty" 'BEGIN { printf "%.6f", (a + 0) + (b + 0) }')
		total_matched_qty=$(awk -v a="$total_matched_qty" -v b="$matched_effective" 'BEGIN { printf "%.6f", (a + 0) + (b + 0) }')

		matched_qty_fmt="$matched_effective"
		open_qty_fmt="$open_qty"
		rows_fmt="$rows_count"

		if awk -v o="$open_qty" 'BEGIN { exit ((o + 0) <= 0.0000005 ? 0 : 1) }'; then
			status="filled"
		elif awk -v m="$matched_effective" 'BEGIN { exit ((m + 0) > 0.0000005 ? 0 : 1) }'; then
			status="partial"
		else
			status="open"
		fi
	fi

	printf '%-15s %-5s %-36s %12s %12s %12s %9s %-8s %-6s\n' "$account_id" "$token" "$tx_id" "$qty" "$matched_qty_fmt" "$open_qty_fmt" "$rows_fmt" "$status" "$err"
done

echo
echo "Secondary totals"
echo "Submitted qty: $total_submitted_qty"
echo "Matched qty:   $total_matched_qty"
echo "Open qty:      $(awk -v s="$total_submitted_qty" -v m="$total_matched_qty" 'BEGIN { o=(s+0)-(m+0); if (o < 0) o=0; printf "%.6f", o }')"

echo
echo "Appended secondary orders to: $orders_latest_file"
if [[ -f "$orders_market_file" ]]; then
	echo "Market-specific order ledger: $orders_market_file"
fi

