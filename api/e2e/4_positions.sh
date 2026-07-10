#!/bin/bash

# 0. Prompt user to input the marketId (default: MARKET_ID from .env)
# 1. Print out all the orders from fillup_orders_{marketId} on its own table (time-ordered)
# 2. Now print another table with all the matched orders. I am interested in the QtyOrig, QtyMatched and QtyRemaining. PriceUSDOnMatch. PotentialWinnings ($) for that partial match if the prediction is correct. Also, the dollar value of the partial match at current market price.


set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
OUT_DIR="$SCRIPT_DIR/out"

if [[ ! -f "$ENV_FILE" ]]; then
	echo ".env file not found at $ENV_FILE"
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

marketId_default=$(env_get "MARKET_ID")
if [[ -n "$marketId_default" ]]; then
	read -r -p "Enter the marketId (UUID) [$marketId_default]: " marketId
	marketId=${marketId:-$marketId_default}
else
	read -r -p "Enter the marketId (UUID): " marketId
fi

if [[ -z "$marketId" ]]; then
	echo "marketId is required."
	exit 1
fi

if [[ ! $marketId =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
	echo "Invalid marketId format. Please provide a valid UUID."
	exit 1
fi

echo "Using marketId: $marketId"






### step 1:
orders_file="$OUT_DIR/fillup_orders_${marketId}.tsv"
if [[ ! -f "$orders_file" ]]; then
	echo "Orders file not found: $orders_file"
	exit 1
fi

if [[ $(wc -l < "$orders_file") -le 1 ]]; then
	echo "No orders found in $orders_file"
	exit 0
fi

printf '\nOrders Ledger (time-ordered)\n'
printf '%-20s %5s %-5s %7s %-15s %-8s %8s %8s %8s %-3s %-36s %5s %s\n' \
	"SubmittedAtUTC" "Seq" "Side" "AccIdx" "AccountID" "KeyType" "Price" "USD" "Qty" "P/S" "TxID" "Err" "Message"
printf '%-20s %5s %-5s %7s %-15s %-8s %8s %8s %8s %-3s %-36s %5s %s\n' \
	"--------------" "---" "----" "------" "---------" "-------" "-----" "---" "---" "---" "----" "---" "-------"

while IFS=$'\t' read -r submitted_at seq side account_index account_id key_type price usd qty primary_secondary tx_id error_code response_message; do
	[[ -z "${submitted_at:-}" ]] && continue
	ts_disp="${submitted_at/T/ }"
	ts_disp="${ts_disp/Z/}"
	printf '%-20s %5s %-5s %7s %-15s %-8s %8s %8s %8s %-3s %-36s %5s %s\n' \
		"$ts_disp" \
		"${seq:-}" \
		"${side:-}" \
		"${account_index:-}" \
		"${account_id:-}" \
		"${key_type:-}" \
		"${price:-}" \
		"${usd:-}" \
		"${qty:-}" \
		"${primary_secondary:-}" \
		"${tx_id:-}" \
		"${error_code:-}" \
		"${response_message:-}"
done < <(tail -n +2 "$orders_file" | LC_ALL=C sort -t $'\t' -k1,1 -k2,2n)




### 2. Print matched orders table
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

API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$API_DIR/proto"
if [[ ! -d "$PROTO_DIR" ]]; then
	echo "proto directory not found at $PROTO_DIR"
	exit 1
fi

net_from_env=$(env_get "NET")
enviro_from_env=$(env_get "ENVIRO")
net_from_env=$(printf '%s' "$net_from_env" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
enviro_from_env=$(printf '%s' "$enviro_from_env" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
net_from_env=${net_from_env:-testnet}
enviro_from_env=${enviro_from_env:-dev}
network="$net_from_env"
mirror_base="https://${network}.mirrornode.hedera.com"

base_url="https://${net_from_env}.${enviro_from_env}.prism.market"
grpc_addr="${base_url#*://}"
grpc_addr="${grpc_addr%%/}"
grpc_flags=(-w --tls)
if [[ "$grpc_addr" != *:* ]]; then
	grpc_addr="${grpc_addr}:443"
fi

basic_auth_user=$(env_get "BASIC_AUTH_USER")
basic_auth_pass=$(env_get "BASIC_AUTH_PASS")
grpc_meta=()
if [[ -n "$basic_auth_user" || -n "$basic_auth_pass" ]]; then
	basic_auth_b64=$(printf '%s:%s' "$basic_auth_user" "$basic_auth_pass" | base64 | tr -d '\n')
	grpc_meta=(-H "authorization=Basic $basic_auth_b64")
fi

resolve_evm_address() {
	local account_id="$1"
	local account_json
	account_json=$(curl -sfL "$mirror_base/api/v1/accounts/$account_id") || return 1
	printf '%s\n' "$account_json" | sed -n 's/.*"evm_address"[[:space:]]*:[[:space:]]*"0x\{0,1\}\([0-9a-fA-F]\{40\}\)".*/\1/p' | head -n 1 | tr 'A-F' 'a-f'
}

fetch_user_portfolio_json() {
	local evm_address="$1"
	local payload
	payload=$(printf '{"evmAddress":"%s","net":"%s","marketId":"%s"}' "$evm_address" "$network" "$marketId")
	easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "$payload" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetUserPortfolio
}

declare -A qty_orig_by_tx
while IFS=$'\t' read -r _submitted_at _seq _side _account_index _account_id _key_type _price _usd qty _ps tx_id _error_code _message; do
	[[ -z "${tx_id:-}" ]] && continue
	qty_orig_by_tx["$tx_id"]="${qty:-0}"
done < <(tail -n +2 "$orders_file")

current_yes_price=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"marketId\":\"$marketId\"}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetMarketById 2>/dev/null | jq -r '.priceUsd // .priceUSD // empty' 2>/dev/null || true)

printf '\nMatched Orders (from gRPC GetUserPortfolio)\n'
printf '%-20s %-15s %-36s %9s %11s %9s %12s %15s %14s\n' "TimestampUTC" "AccountID" "TxID" "QtyOrig" "QtyMatched" "QtyRem" "PriceMatch" "PotentialWin($)" "ValueNow($)"
printf '%-20s %-15s %-36s %9s %11s %9s %12s %15s %14s\n' "------------" "----------" "----" "-------" "----------" "------" "----------" "---------------" "-----------"

matched_rows=0
declare -A tx_hashes_cache

for i in {0..9}; do
	account_id_var="${i}_ACCOUNT_ID"
	account_id=$(env_get "$account_id_var")
	[[ -z "$account_id" ]] && continue

	evm_address=$(resolve_evm_address "$account_id" 2>/dev/null || true)
	if [[ -z "$evm_address" ]]; then
		echo "Warning: could not resolve EVM address for $account_id; skipping"
		continue
	fi

	portfolio_json=$(fetch_user_portfolio_json "$evm_address" 2>/dev/null || true)
	if [[ -z "$portfolio_json" ]]; then
		echo "Warning: GetUserPortfolio failed for $account_id; skipping"
		continue
	fi

	while IFS=$'\t' read -r generated_at tx_id raw_price fallback_qty; do
		[[ -z "${tx_id:-}" ]] && continue

		qty_orig_raw="${qty_orig_by_tx[$tx_id]:-$fallback_qty}"

		if [[ -z "${tx_hashes_cache[$tx_id]:-}" ]]; then
			tx_hashes_cache[$tx_id]=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"txId\":\"$tx_id\"}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetTxHashes 2>/dev/null || printf '{}')
		fi
		tx_hashes_json="${tx_hashes_cache[$tx_id]}"
		matched_qty_raw=$(printf '%s\n' "$tx_hashes_json" | jq -r '[.txHashes[]?.qty] | add // 0')
		if ! awk -v v="$matched_qty_raw" 'BEGIN { exit !(v + 0 > 0) }'; then
			matched_qty_raw="$fallback_qty"
		fi

		matched_qty=$(awk -v m="$matched_qty_raw" -v o="$qty_orig_raw" 'BEGIN { x=m+0; y=o+0; if (x > y && y > 0) x=y; if (x < 0) x=0; printf "%.6f", x }')
		qty_rem=$(awk -v o="$qty_orig_raw" -v m="$matched_qty" 'BEGIN { r=(o+0)-(m+0); if (r < 0) r=0; printf "%.6f", r }')

		price_abs=$(awk -v p="$raw_price" 'BEGIN { x=p+0; if (x < 0) x=-x; printf "%.6f", x }')
		side="BUY"
		if awk -v p="$raw_price" 'BEGIN { exit !((p + 0) < 0) }'; then
			side="SELL"
		fi

		potential_win=$(awk -v q="$matched_qty" -v p="$price_abs" 'BEGIN { v=(q+0)*(1-(p+0)); if (v < 0) v=0; printf "%.4f", v }')
		value_now="n/a"
		if [[ -n "$current_yes_price" ]]; then
			if [[ "$side" == "BUY" ]]; then
				value_now=$(awk -v q="$matched_qty" -v p="$current_yes_price" 'BEGIN { v=(q+0)*(p+0); if (v < 0) v=0; printf "%.4f", v }')
			else
				value_now=$(awk -v q="$matched_qty" -v p="$current_yes_price" 'BEGIN { v=(q+0)*(1-(p+0)); if (v < 0) v=0; printf "%.4f", v }')
			fi
		fi

		timestamp_utc=$(date -u -d "$generated_at" +"%Y-%m-%d %H:%M:%S" 2>/dev/null || true)
		if [[ -z "$timestamp_utc" ]]; then
			timestamp_utc=$(printf '%s' "$generated_at" | sed -E 's/[[:space:]]+\+0000([[:space:]]+\+0000)?$//' | sed -E 's/\.([0-9]{1,9})$//')
		fi

		qty_orig_fmt=$(awk -v v="$qty_orig_raw" 'BEGIN { printf "%.4f", v + 0 }')
		qty_matched_fmt=$(awk -v v="$matched_qty" 'BEGIN { printf "%.4f", v + 0 }')
		qty_rem_fmt=$(awk -v v="$qty_rem" 'BEGIN { printf "%.4f", v + 0 }')
		price_match_fmt=$(awk -v v="$price_abs" 'BEGIN { printf "$%.3f", v + 0 }')
		potential_win_fmt=$(awk -v v="$potential_win" 'BEGIN { printf "$%.4f", v + 0 }')
		value_now_fmt="n/a"
		if [[ "$value_now" != "n/a" ]]; then
			value_now_fmt=$(awk -v v="$value_now" 'BEGIN { printf "$%.4f", v + 0 }')
		fi

		printf '%-20s %-15s %-36s %9s %11s %9s %12s %15s %14s\n' \
			"$timestamp_utc" \
			"$account_id" \
			"$tx_id" \
			"$qty_orig_fmt" \
			"$qty_matched_fmt" \
			"$qty_rem_fmt" \
			"$price_match_fmt" \
			"$potential_win_fmt" \
			"$value_now_fmt"

		matched_rows=$((matched_rows + 1))
	 done < <(printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '
		(.matchedPredictionIntents[$m].matchedPredictionIntents // [])[]?
		| [(.generatedAt // ""), (.txId // ""), (.priceUsd // 0), (.qty // 0)]
		| @tsv
	')
done

if [[ $matched_rows -eq 0 ]]; then
	echo "No matched orders returned by GetUserPortfolio for marketId=$marketId"
fi
