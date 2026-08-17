#!/bin/bash

# 0. Prompt user to input the marketId (default: MARKET_ID from .env)
# 1. Print out all the orders from fillup_orders_{marketId} on its own table (time-ordered)
# 2. Print the match pairs table from gRPC GetPredictionIntentMatches.


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

total=$(wc -l < "$orders_file")
printf '\nOrders Ledger (time-ordered) - %s PrismPredictionIntents submitted\n' "$total"
printf '%-20s %5s %-3s %-5s %7s %-15s %-8s %8s %8s %8s %-36s %5s %s\n' \
	"SubmittedAtUTC" "Seq" "P/S" "Side" "AccIdx" "AccountID" "KeyType" "Price" "USD" "Qty" "TxID" "Err" "Message"
printf '%-20s %5s %-3s %-5s %7s %-15s %-8s %8s %8s %8s %-36s %5s %s\n' \
	"--------------" "---" "---" "----" "------" "---------" "-------" "-----" "---" "---" "----" "---" "-------"

while IFS=$'\t' read -r submitted_at seq side account_index account_id key_type price usd qty primary_secondary tx_id error_code response_message; do
	[[ -z "${submitted_at:-}" ]] && continue
	ts_disp="${submitted_at/T/ }"
	ts_disp="${ts_disp/Z/}"
	printf '%-20s %5s %-3s %-5s %7s %-15s %-8s %8s %8s %8s %-36s %5s %s\n' \
		"$ts_disp" \
		"${seq:-}" \
		"${primary_secondary:-}" \
		"${side:-}" \
		"${account_index:-}" \
		"${account_id:-}" \
		"${key_type:-}" \
		"${price:-}" \
		"${usd:-}" \
		"${qty:-}" \
		"${tx_id:-}" \
		"${error_code:-}" \
		"${response_message:-}"
done < <(tail -n +2 "$orders_file" | LC_ALL=C sort -t $'\t' -k1,1 -k2,2n)




### 2. Print matched pairs table
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

base_url_default="${BASE_URL:-$(env_get "BASE_URL") }"
base_url_default="${base_url_default% }"
if [[ -z "$base_url_default" ]]; then
	base_url_default="https://${net_from_env}.${enviro_from_env}.prism.market"
fi

read -p "Enter the base URL [$base_url_default]: " base_url
base_url="${base_url:-$base_url_default}"
if grep -qE '^BASE_URL=' "$ENV_FILE"; then
	sed -i "s|^BASE_URL=.*|BASE_URL=$base_url|" "$ENV_FILE"
else
	printf '\nBASE_URL=%s\n' "$base_url" >> "$ENV_FILE"
fi
echo "Base URL set to: $base_url"
grpc_addr="${base_url#*://}"
grpc_addr="${grpc_addr%%/}"
grpc_flags=(-w)
if [[ "$base_url" == https://* ]]; then
	grpc_flags=(-w --tls)
	if [[ "$grpc_addr" != *:* ]]; then
		grpc_addr="${grpc_addr}:443"
	fi
elif [[ "$grpc_addr" != *:* ]]; then
	grpc_addr="${grpc_addr}:8888"
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
	easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "$payload" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetUserPortfolio 2>/dev/null
}

fetch_market_json() {
	local payload
	payload=$(printf '{"marketId":"%s"}' "$marketId")
	easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "$payload" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetMarketById 2>/dev/null || printf '{}'
}

declare -A qty_orig_by_tx
declare -A account_by_tx
declare -A side_by_tx
declare -A ps_by_tx
declare -A entry_price_abs_by_tx
declare -A portfolio_json_by_account_id
declare -A evm_address_by_account_id
while IFS=$'\t' read -r _submitted_at _seq _side _account_index _account_id _key_type _price _usd qty _ps tx_id _error_code _message; do
	[[ -z "${tx_id:-}" ]] && continue
	qty_orig_by_tx["$tx_id"]="${qty:-0}"
	account_by_tx["$tx_id"]="${_account_id:-}"
	side_by_tx["$tx_id"]="${_side:-BUY}"
	ps_by_tx["$tx_id"]="${_ps:-?}"
	entry_price_abs_by_tx["$tx_id"]=$(awk -v p="${_price:-0}" 'BEGIN { v=p+0; if (v < 0) v = -v; printf "%.6f", v }')
done < <(tail -n +2 "$orders_file")

declare -A open_tx_current
for i in {0..9}; do
	account_id_var="${i}_ACCOUNT_ID"
	account_id=$(env_get "$account_id_var")
	[[ -z "$account_id" ]] && continue
	evm_address=$(resolve_evm_address "$account_id" 2>/dev/null || true)
	[[ -z "$evm_address" ]] && continue
	portfolio_json=$(fetch_user_portfolio_json "$evm_address")
	[[ -z "$portfolio_json" ]] && continue
	portfolio_json_by_account_id["$account_id"]="$portfolio_json"
	evm_address_by_account_id["$account_id"]="$evm_address"
	while IFS= read -r open_tx_id; do
		[[ -z "$open_tx_id" ]] && continue
		open_tx_current["$open_tx_id"]=1
	done < <(printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '.openPredictionIntents[$m].openPredictionIntents[]?.txId // empty')
done

market_json=$(fetch_market_json)
market_outcome=$(printf '%s\n' "$market_json" | jq -r '.outcome // empty' 2>/dev/null || true)
market_resolved_at=$(printf '%s\n' "$market_json" | jq -r '.resolvedAt // empty' 2>/dev/null || true)
if [[ -z "$market_json" || "$market_json" == '{}' ]]; then
	echo "Warning: GetMarketById returned empty data; continuing without market resolution info."
	market_is_resolved=false
else
	market_is_resolved=false
	if [[ -n "$market_resolved_at" && -n "$market_outcome" ]]; then
		market_is_resolved=true
	fi
fi
market_is_resolved=false
if [[ -n "$market_resolved_at" && -n "$market_outcome" ]]; then
	market_is_resolved=true
fi

matched_rows=0
matched_groups=0
declare -A cumulative_pair_by_tx
tmp_match_pairs_file=$(mktemp)
trap 'rm -f "$tmp_match_pairs_file"' EXIT

limit=1000
offset=0
while true; do
	matches_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"marketId\":\"$marketId\",\"limit\":$limit,\"offset\":$offset}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetPredictionIntentMatches 2>/dev/null || printf '{}')

	while IFS=$'\t' read -r matched_at tx_id1 qty1 tx_id2 qty2 price_usd price_usd1 price_usd2; do
		if [[ -n "${qty_orig_by_tx[$tx_id1]:-}" || -n "${qty_orig_by_tx[$tx_id2]:-}" ]]; then
			printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$matched_at" "$tx_id1" "$qty1" "$tx_id2" "$qty2" "$price_usd" "$price_usd1" "$price_usd2" >> "$tmp_match_pairs_file"
		fi
	done < <(printf '%s\n' "$matches_json" | jq -r '.matches[]? | [(.matchedAt // ""), (.txId1 // ""), (.qty1 // 0), (.txId2 // ""), (.qty2 // 0), (.priceUsd // 0), (.priceUsd1 // ""), (.priceUsd2 // "")] | @tsv')

	page_count=$(printf '%s\n' "$matches_json" | jq -r '(.matches // []) | length')
	if [[ -z "$page_count" || "$page_count" -lt "$limit" ]]; then
		break
	fi
	offset=$((offset + limit))
done

printf '\nMatch Pairs (txId1 <-> txId2 from GetPredictionIntentMatches)\n'
printf '%-20s %-38s %-38s %9s %12s %9s %9s %10s %10s %12s %12s %12s %12s\n' "TimestampUTC" "TxID1" "TxID2" "Qty" "PriceMatch" "QtyOrig1" "QtyOrig2" "QtyRem1" "QtyRem2" "PriceOrig1" "PriceOrig2" "price_usd1" "price_usd2"
printf '%-20s %-38s %-38s %9s %12s %9s %9s %10s %10s %12s %12s %12s %12s\n' "------------" "-----" "-----" "---" "----------" "--------" "--------" "-------" "-------" "----------" "----------" "----------" "----------"

pair_rows=0
while IFS=$'\t' read -r matched_at tx_id1 qty1_raw tx_id2 qty2_raw price_raw price_usd1_raw price_usd2_raw; do
	[[ -z "${tx_id1:-}" || -z "${tx_id2:-}" ]] && continue

	qty_orig1_raw="${qty_orig_by_tx[$tx_id1]:-}"
	qty_orig2_raw="${qty_orig_by_tx[$tx_id2]:-}"
	tx1_prefix="?"
	tx2_prefix="?"
	tx1_ps="?"
	tx2_ps="?"
	if [[ "${side_by_tx[$tx_id1]:-}" == "BUY" ]]; then
		tx1_prefix="Y"
	elif [[ "${side_by_tx[$tx_id1]:-}" == "SELL" ]]; then
		tx1_prefix="N"
	fi
	if [[ "${side_by_tx[$tx_id2]:-}" == "BUY" ]]; then
		tx2_prefix="Y"
	elif [[ "${side_by_tx[$tx_id2]:-}" == "SELL" ]]; then
		tx2_prefix="N"
	fi
	if [[ -n "${ps_by_tx[$tx_id1]:-}" ]]; then
		tx1_ps=$(printf '%s' "${ps_by_tx[$tx_id1]}" | tr '[:upper:]' '[:lower:]')
	fi
	if [[ -n "${ps_by_tx[$tx_id2]:-}" ]]; then
		tx2_ps=$(printf '%s' "${ps_by_tx[$tx_id2]}" | tr '[:upper:]' '[:lower:]')
	fi
	tx_id1_disp="${tx1_prefix}${tx1_ps}:${tx_id1}"
	tx_id2_disp="${tx2_prefix}${tx2_ps}:${tx_id2}"
	qty_orig1_fmt="-"
	qty_orig2_fmt="-"
	price_orig1_fmt="-"
	price_orig2_fmt="-"
	price_usd1_fmt="-"
	price_usd2_fmt="-"
	[[ -n "$qty_orig1_raw" ]] && qty_orig1_fmt=$(awk -v v="$qty_orig1_raw" 'BEGIN { printf "%.4f", v + 0 }')
	[[ -n "$qty_orig2_raw" ]] && qty_orig2_fmt=$(awk -v v="$qty_orig2_raw" 'BEGIN { printf "%.4f", v + 0 }')
	if [[ -n "${entry_price_abs_by_tx[$tx_id1]:-}" ]]; then
		price_orig1_fmt=$(awk -v v="${entry_price_abs_by_tx[$tx_id1]}" 'BEGIN { printf "$%.3f", v + 0 }')
	fi
	if [[ -n "${entry_price_abs_by_tx[$tx_id2]:-}" ]]; then
		price_orig2_fmt=$(awk -v v="${entry_price_abs_by_tx[$tx_id2]}" 'BEGIN { printf "$%.3f", v + 0 }')
	fi
	[[ -n "$price_usd1_raw" ]] && price_usd1_fmt=$(awk -v v="$price_usd1_raw" 'BEGIN { printf "$%.3f", v + 0 }')
	[[ -n "$price_usd2_raw" ]] && price_usd2_fmt=$(awk -v v="$price_usd2_raw" 'BEGIN { printf "$%.3f", v + 0 }')

	# A match fills both intents by the same amount: the lower side of qty1/qty2.
	match_qty_raw=$(awk -v a="$qty1_raw" -v b="$qty2_raw" 'BEGIN { x=a+0; y=b+0; if (x < y) m=x; else m=y; if (m < 0) m=0; printf "%.6f", m }')
	match_qty_fmt=$(awk -v v="$match_qty_raw" 'BEGIN { printf "%.4f", v + 0 }')

	qty_rem1_fmt="-"
	if [[ -n "$qty_orig1_raw" ]]; then
		orig1="$qty_orig1_raw"
		prev1="${cumulative_pair_by_tx[$tx_id1]:-0}"
		eff1=$(awk -v m="$match_qty_raw" -v o="$orig1" -v c="$prev1" 'BEGIN { rem=(o+0)-(c+0); if (rem < 0) rem = 0; x=m+0; if (x > rem) x=rem; if (x < 0) x=0; printf "%.6f", x }')
		new1=$(awk -v c="$prev1" -v e="$eff1" 'BEGIN { printf "%.6f", (c + 0) + (e + 0) }')
		cumulative_pair_by_tx["$tx_id1"]="$new1"
		qty_rem1_fmt=$(awk -v o="$orig1" -v c="$new1" 'BEGIN { r=(o+0)-(c+0); if (r < 0) r = 0; printf "%.4f", r }')
	fi

	qty_rem2_fmt="-"
	if [[ -n "$qty_orig2_raw" ]]; then
		orig2="$qty_orig2_raw"
		prev2="${cumulative_pair_by_tx[$tx_id2]:-0}"
		eff2=$(awk -v m="$match_qty_raw" -v o="$orig2" -v c="$prev2" 'BEGIN { rem=(o+0)-(c+0); if (rem < 0) rem = 0; x=m+0; if (x > rem) x=rem; if (x < 0) x=0; printf "%.6f", x }')
		new2=$(awk -v c="$prev2" -v e="$eff2" 'BEGIN { printf "%.6f", (c + 0) + (e + 0) }')
		cumulative_pair_by_tx["$tx_id2"]="$new2"
		qty_rem2_fmt=$(awk -v o="$orig2" -v c="$new2" 'BEGIN { r=(o+0)-(c+0); if (r < 0) r = 0; printf "%.4f", r }')
	fi

	timestamp_utc=$(date -u -d "$matched_at" +"%Y-%m-%d %H:%M:%S" 2>/dev/null || true)
	if [[ -z "$timestamp_utc" ]]; then
		timestamp_utc=$(printf '%s' "$matched_at" | sed -E 's/[[:space:]]+\+0000([[:space:]]+\+0000)?$//' | sed -E 's/\.([0-9]{1,9})$//')
	fi

	price_match_fmt=$(awk -v v="$price_raw" 'BEGIN { p=v+0; if (p < 0) p = -p; printf "$%.3f", p }')

	printf '%-20s %-38s %-38s %9s %12s %9s %9s %10s %10s %12s %12s %12s %12s\n' \
		"$timestamp_utc" "$tx_id1_disp" "$tx_id2_disp" "$match_qty_fmt" "$price_match_fmt" "$qty_orig1_fmt" "$qty_orig2_fmt" "$qty_rem1_fmt" "$qty_rem2_fmt" "$price_orig1_fmt" "$price_orig2_fmt" "$price_usd1_fmt" "$price_usd2_fmt"

	pair_rows=$((pair_rows + 1))
done < <(LC_ALL=C sort -t $'\t' -k1,1 -k2,2 -k4,4 "$tmp_match_pairs_file")

if [[ $pair_rows -eq 0 ]]; then
	echo "No relevant match pairs returned by GetPredictionIntentMatches for this ledger scope"
else
	printf 'match pair rows printed: %d\n' "$pair_rows"
fi

printf '\nYES/NO Positions By Account\n'
printf '%-15s %-40s %12s %12s %15s\n' "AccountID" "EVMAddress" "YES" "NO" "ClaimableUSD"
printf '%-15s %-40s %12s %12s %15s\n' "---------" "----------" "---" "--" "------------"
for i in {0..9}; do
	account_id_var="${i}_ACCOUNT_ID"
	account_id=$(env_get "$account_id_var")
	[[ -z "$account_id" ]] && continue
	portfolio_json="${portfolio_json_by_account_id[$account_id]:-}"
	evm_address="${evm_address_by_account_id[$account_id]:-}"
	yes_qty=$(printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '.positions[$m].position.yes // 0' 2>/dev/null || printf '0')
	no_qty=$(printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '.positions[$m].position.no // 0' 2>/dev/null || printf '0')
	yes_fmt=$(awk -v v="$yes_qty" 'BEGIN { printf "%.0f", v + 0 }')
	no_fmt=$(awk -v v="$no_qty" 'BEGIN { printf "%.0f", v + 0 }')
	claimable_fmt="notResolved"
	if [[ "$market_is_resolved" == true ]]; then
		if [[ "$market_outcome" == "1" ]]; then
			claimable_fmt=$(awk -v v="$yes_qty" 'BEGIN { printf "$%.2f", (v + 0) / 1000000 }')
		elif [[ "$market_outcome" == "0" ]]; then
			claimable_fmt=$(awk -v v="$no_qty" 'BEGIN { printf "$%.2f", (v + 0) / 1000000 }')
		fi
	fi
	printf '%-15s %-40s %12s %12s %15s\n' "$account_id" "${evm_address:--}" "$yes_fmt" "$no_fmt" "$claimable_fmt"
done
