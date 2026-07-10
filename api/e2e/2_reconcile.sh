#!/bin/bash

# 0. load the state from 1_fillUp.sh
# 1. foreach accountId, retrieve the latest portfolio for the marketId
# 2. 
#  - Check the values in the portfolio tally (100% accuracy) with the YES/NO orders just submitted
#  - Ensure the position tokens (YES or NO) are correct and fully accounted for in the marketId for all accountIds
#  - Any mis-match in position tokens (YES or NO) or collateral tokens should result in a clear error output and exit the script with a non-zero exit code
# 3. Display the results on a table (split the output between orders still sitting on the orderbook and those orders which have fully matched and have settled on-chain)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$API_DIR/proto"
OUT_DIR="$SCRIPT_DIR/out"
STATE_FILE_DEFAULT="$OUT_DIR/fillup_state_latest.env"
ENV_FILE="$SCRIPT_DIR/.env"

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

if ! command -v easyrpc &> /dev/null; then
  echo "easyrpc could not be found. Please install it before running this script."
  exit 1
fi

if ! command -v curl &> /dev/null; then
  echo "curl could not be found. Please install it before running this script."
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "jq could not be found. Please install it before running this script."
  exit 1
fi

if [[ ! -d "$PROTO_DIR" ]]; then
  echo "proto directory not found at $PROTO_DIR"
  exit 1
fi

read -p "Enter fill-up state file [$STATE_FILE_DEFAULT]: " state_file
state_file=${state_file:-$STATE_FILE_DEFAULT}
if [[ ! -f "$state_file" ]]; then
  echo "State file not found: $state_file"
  echo "Run ./1_fillUp.sh first to generate it under ./out"
  exit 1
fi

marketId=$(env_get "MARKET_ID")
net_from_env=$(env_get "NET")
enviro_from_env=$(env_get "ENVIRO")
net_from_env=$(printf '%s' "$net_from_env" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
enviro_from_env=$(printf '%s' "$enviro_from_env" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
net_from_env=${net_from_env:-testnet}
enviro_from_env=${enviro_from_env:-dev}
baseUrl="https://${net_from_env}.${enviro_from_env}.prism.market"

source "$state_file"

if [[ -z "$marketId" ]]; then
  echo "MARKET_ID is missing from .env at $ENV_FILE"
  exit 1
fi

network="$net_from_env"

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

declare -a account_ids
declare -a key_types
declare -a submitted_order_count
declare -a submitted_qty_raw
declare -a submitted_notional_usd
declare -a submitted_buy_qty_raw
declare -a submitted_sell_qty_raw
declare -a matched_qty_from_ledger
declare -a matched_buy_qty_from_ledger
declare -a matched_sell_qty_from_ledger
declare -a expected_open_buy_qty
declare -a expected_open_sell_qty
declare -a expected_open_collateral
declare -a summary_active_yes_qty
declare -a summary_active_no_qty
declare -a portfolio_json_by_index
declare -a prefetched_open_orders
declare -a prefetched_matched_orders
declare -A account_index_by_id
declare -A run_tx_by_account
declare -A run_tx_side_by_account
declare -A run_tx_qty_by_account
declare -A run_tx_price_by_account
declare -A tx_hashes_json_cache

### Functions

add_float() {
  local a="$1"
  local b="$2"
  awk -v x="$a" -v y="$b" 'BEGIN { printf "%.6f", x + y }'
}

resolve_evm_address() {
  local account_id="$1"
  local mirror_base="https://${network}.mirrornode.hedera.com"
  local account_json
  account_json=$(curl -sfL "$mirror_base/api/v1/accounts/$account_id") || return 1
  printf '%s\n' "$account_json" | sed -n 's/.*"evm_address"[[:space:]]*:[[:space:]]*"0x\{0,1\}\([0-9a-fA-F]\{40\}\)".*/\1/p' | head -n 1 | tr 'A-F' 'a-f'
}

fetch_user_portfolio_json() {
  local evm_address="$1"
  local output=""
  local status=1
  local attempt
  local max_attempts=4

  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    output=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"evmAddress\":\"$evm_address\",\"net\":\"$network\",\"marketId\":\"$marketId\"}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetUserPortfolio 2>&1)
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

print_portfolio_summary_table() {
  printf '\n%-15s %12s %16s %12s %12s\n' "Account ID" "OpenOrders" "MatchedOrders" "YES" "NO"
  printf '%-15s %12s %16s %12s %12s\n' "----------" "----------" "-------------" "----" "--"
  for i in "${loaded_indices[@]}"; do
    account_id="${account_ids[$i]}"
    [[ -z "$account_id" ]] && continue
    printf '%-15s %12s %16s %12s %12s\n' \
      "$account_id" \
      "${prefetched_open_orders[$i]:-0}" \
      "${prefetched_matched_orders[$i]:-0}" \
      "${summary_active_yes_qty[$i]:-0}" \
      "${summary_active_no_qty[$i]:-0}"
  done
}

build_expected_open_state_from_ledger() {
  local orders_file_path="$1"
  local tolerance="$2"
  local tmp_dir events_file

  for i in "${loaded_indices[@]}"; do
    submitted_order_count[$i]=0
    submitted_qty_raw[$i]="0"
    submitted_notional_usd[$i]="0"
    submitted_buy_qty_raw[$i]="0"
    submitted_sell_qty_raw[$i]="0"
    matched_qty_from_ledger[$i]="0"
    matched_buy_qty_from_ledger[$i]="0"
    matched_sell_qty_from_ledger[$i]="0"
    expected_open_buy_qty[$i]="0"
    expected_open_sell_qty[$i]="0"
    expected_open_collateral[$i]="0"
  done

  tmp_dir=$(mktemp -d)
  events_file="$tmp_dir/events.tsv"
  : > "$events_file"

  while IFS=$'\t' read -r submitted_at seq side account_index account_id key_type price usd qty primary_secondary tx_id error_code response_message; do
    [[ "$submitted_at" == "submitted_at" ]] && continue
    [[ -z "$account_id" || -z "$qty" ]] && continue

    idx="${account_index_by_id[$account_id]}"
    [[ -z "$idx" ]] && continue

    if [[ -n "$tx_id" && "$tx_id" != "null" ]]; then
      run_tx_by_account["$idx|$tx_id"]=1
    fi

    [[ "$error_code" != "0" ]] && continue

    if [[ -n "$tx_id" && "$tx_id" != "null" ]]; then
      run_tx_side_by_account["$idx|$tx_id"]="$side"
      run_tx_qty_by_account["$idx|$tx_id"]="$qty"
      run_tx_price_by_account["$idx|$tx_id"]="$price"
    fi

    submitted_order_count[$idx]=$(( ${submitted_order_count[$idx]:-0} + 1 ))
    submitted_qty_raw[$idx]=$(add_float "${submitted_qty_raw[$idx]:-0}" "$qty")
    spent_usd=$(awk -v p="$price" -v q="$qty" 'BEGIN { ap = (p < 0 ? -p : p); if (p >= 0) s = ap * q; else s = (1 - ap) * q; if (s < 0) s = 0; printf "%.6f", s }')
    submitted_notional_usd[$idx]=$(add_float "${submitted_notional_usd[$idx]:-0}" "$spent_usd")

    if [[ "$side" == "BUY" ]]; then
      submitted_buy_qty_raw[$idx]=$(add_float "${submitted_buy_qty_raw[$idx]:-0}" "$qty")
    elif [[ "$side" == "SELL" ]]; then
      submitted_sell_qty_raw[$idx]=$(add_float "${submitted_sell_qty_raw[$idx]:-0}" "$qty")
    fi

    printf '%s\t%s\t%s\t%s\t%s\n' "$seq" "$idx" "$side" "$price" "$qty" >> "$events_file"
  done < "$orders_file_path"

  declare -a book_buy_idx book_buy_price book_buy_qty book_buy_orig_qty book_buy_seq
  declare -a book_sell_idx book_sell_abs_price book_sell_qty book_sell_orig_qty book_sell_seq
  local_best_match_tolerance="$tolerance"

  while IFS=$'\t' read -r seq idx side price qty; do
    [[ -z "$idx" || -z "$side" || -z "$qty" ]] && continue
    incoming_qty="$qty"
    incoming_orig_qty="$qty"

    if [[ "$side" == "BUY" ]]; then
      incoming_price="$price"
      while (( $(echo "$incoming_qty > $local_best_match_tolerance" | bc -l) )); do
        best_j=-1
        best_abs_price=""
        best_seq=0
        for ((j = 0; j < ${#book_sell_idx[@]}; j++)); do
          sell_qty="${book_sell_qty[$j]:-0}"
          (( $(echo "$sell_qty <= $local_best_match_tolerance" | bc -l) )) && continue
          sell_abs_price="${book_sell_abs_price[$j]}"
          (( $(echo "$incoming_price < $sell_abs_price" | bc -l) )) && continue
          sell_seq="${book_sell_seq[$j]}"
          if [[ $best_j -lt 0 ]] || (( $(echo "$sell_abs_price < $best_abs_price" | bc -l) )) || { (( $(echo "$sell_abs_price == $best_abs_price" | bc -l) )) && [[ "$sell_seq" -lt "$best_seq" ]]; }; then
            best_j=$j
            best_abs_price="$sell_abs_price"
            best_seq="$sell_seq"
          fi
        done

        [[ $best_j -lt 0 ]] && break

        existing_qty="${book_sell_qty[$best_j]}"
        fill_qty=$(awk -v x="$incoming_qty" -v y="$existing_qty" 'BEGIN { if (x < y) printf "%.6f", x; else printf "%.6f", y }')
        incoming_qty=$(awk -v a="$incoming_qty" -v f="$fill_qty" 'BEGIN { printf "%.6f", a - f }')
        book_sell_qty[$best_j]=$(awk -v a="$existing_qty" -v f="$fill_qty" 'BEGIN { printf "%.6f", a - f }')

        existing_idx="${book_sell_idx[$best_j]}"
        matched_qty_from_ledger[$idx]=$(add_float "${matched_qty_from_ledger[$idx]:-0}" "$fill_qty")
        matched_qty_from_ledger[$existing_idx]=$(add_float "${matched_qty_from_ledger[$existing_idx]:-0}" "$fill_qty")
        matched_buy_qty_from_ledger[$idx]=$(add_float "${matched_buy_qty_from_ledger[$idx]:-0}" "$fill_qty")
        matched_sell_qty_from_ledger[$existing_idx]=$(add_float "${matched_sell_qty_from_ledger[$existing_idx]:-0}" "$fill_qty")
      done

      if (( $(echo "$incoming_qty > $local_best_match_tolerance" | bc -l) )); then
        book_buy_idx+=("$idx")
        book_buy_price+=("$incoming_price")
        book_buy_qty+=("$incoming_qty")
        book_buy_orig_qty+=("$incoming_orig_qty")
        book_buy_seq+=("$seq")
      fi
    else
      incoming_abs_price=$(awk -v p="$price" 'BEGIN { if (p < 0) p = -p; printf "%.6f", p }')
      while (( $(echo "$incoming_qty > $local_best_match_tolerance" | bc -l) )); do
        best_j=-1
        best_buy_price=""
        best_seq=0
        for ((j = 0; j < ${#book_buy_idx[@]}; j++)); do
          buy_qty="${book_buy_qty[$j]:-0}"
          (( $(echo "$buy_qty <= $local_best_match_tolerance" | bc -l) )) && continue
          buy_price="${book_buy_price[$j]}"
          (( $(echo "$buy_price < $incoming_abs_price" | bc -l) )) && continue
          buy_seq="${book_buy_seq[$j]}"
          if [[ $best_j -lt 0 ]] || (( $(echo "$buy_price > $best_buy_price" | bc -l) )) || { (( $(echo "$buy_price == $best_buy_price" | bc -l) )) && [[ "$buy_seq" -lt "$best_seq" ]]; }; then
            best_j=$j
            best_buy_price="$buy_price"
            best_seq="$buy_seq"
          fi
        done

        [[ $best_j -lt 0 ]] && break

        existing_qty="${book_buy_qty[$best_j]}"
        fill_qty=$(awk -v x="$incoming_qty" -v y="$existing_qty" 'BEGIN { if (x < y) printf "%.6f", x; else printf "%.6f", y }')
        incoming_qty=$(awk -v a="$incoming_qty" -v f="$fill_qty" 'BEGIN { printf "%.6f", a - f }')
        book_buy_qty[$best_j]=$(awk -v a="$existing_qty" -v f="$fill_qty" 'BEGIN { printf "%.6f", a - f }')

        existing_idx="${book_buy_idx[$best_j]}"
        matched_qty_from_ledger[$idx]=$(add_float "${matched_qty_from_ledger[$idx]:-0}" "$fill_qty")
        matched_qty_from_ledger[$existing_idx]=$(add_float "${matched_qty_from_ledger[$existing_idx]:-0}" "$fill_qty")
        matched_sell_qty_from_ledger[$idx]=$(add_float "${matched_sell_qty_from_ledger[$idx]:-0}" "$fill_qty")
        matched_buy_qty_from_ledger[$existing_idx]=$(add_float "${matched_buy_qty_from_ledger[$existing_idx]:-0}" "$fill_qty")
      done

      if (( $(echo "$incoming_qty > $local_best_match_tolerance" | bc -l) )); then
        book_sell_idx+=("$idx")
        book_sell_abs_price+=("$incoming_abs_price")
        book_sell_qty+=("$incoming_qty")
        book_sell_orig_qty+=("$incoming_orig_qty")
        book_sell_seq+=("$seq")
      fi
    fi
  done < <(sort -t $'\t' -k1,1n "$events_file")

  for i in "${loaded_indices[@]}"; do
    expected_open_buy_qty[$i]="0"
    expected_open_sell_qty[$i]="0"
    expected_open_collateral[$i]="0"
  done

  for ((j = 0; j < ${#book_buy_idx[@]}; j++)); do
    idx="${book_buy_idx[$j]}"
    qty_rem="${book_buy_qty[$j]:-0}"
    if (( $(echo "$qty_rem > $local_best_match_tolerance" | bc -l) )); then
      px="${book_buy_price[$j]}"
      expected_open_buy_qty[$idx]=$(add_float "${expected_open_buy_qty[$idx]:-0}" "$qty_rem")
      spend_open=$(awk -v p="$px" -v q="$qty_rem" 'BEGIN { ap = (p < 0 ? -p : p); s = ap * q; if (s < 0) s = 0; printf "%.6f", s }')
      expected_open_collateral[$idx]=$(add_float "${expected_open_collateral[$idx]:-0}" "$spend_open")
    fi
  done

  for ((j = 0; j < ${#book_sell_idx[@]}; j++)); do
    idx="${book_sell_idx[$j]}"
    qty_rem="${book_sell_qty[$j]:-0}"
    if (( $(echo "$qty_rem > $local_best_match_tolerance" | bc -l) )); then
      ap="${book_sell_abs_price[$j]}"
      expected_open_sell_qty[$idx]=$(add_float "${expected_open_sell_qty[$idx]:-0}" "$qty_rem")
      spend_open=$(awk -v ap="$ap" -v q="$qty_rem" 'BEGIN { s = (1 - ap) * q; if (s < 0) s = 0; printf "%.6f", s }')
      expected_open_collateral[$idx]=$(add_float "${expected_open_collateral[$idx]:-0}" "$spend_open")
    fi
  done

  rm -rf "$tmp_dir"

  echo "Loaded exact submitted orders ledger: $orders_file_path"
  echo "Computed overlap matches from ledger using price-time priority."
}

### 0. load the state from 1_fillUp.sh

mapfile -t loaded_indices < <(compgen -A variable account_id_ | sed -n 's/^account_id_//p' | sort -n)
for i in "${loaded_indices[@]}"; do
  account_var="account_id_${i}"
  key_type_var="key_type_${i}"
  orders_var="submitted_order_count_${i}"
  qty_var="submitted_qty_raw_${i}"
  notional_var="submitted_notional_usd_${i}"

  account_ids[$i]="${!account_var}"
  key_types[$i]="${!key_type_var}"
  submitted_order_count[$i]="${!orders_var}"
  submitted_qty_raw[$i]="${!qty_var}"
  submitted_notional_usd[$i]="${!notional_var}"
  submitted_buy_qty_raw[$i]="0"
  submitted_sell_qty_raw[$i]="0"
  account_index_by_id["${account_ids[$i]}"]="$i"
done

orders_file_path="${orders_file:-$OUT_DIR/fillup_orders_${marketId}.tsv}"
tolerance_qty="0.000500"

echo "Using state file: $state_file"
echo "Run timestamp: ${run_timestamp:-unknown}"
echo "Reconciling market: $marketId on network: $network"

if [[ -f "$orders_file_path" ]]; then
  build_expected_open_state_from_ledger "$orders_file_path" "$tolerance_qty"
else
  echo "Warning: order ledger not found ($orders_file_path). Falling back to aggregate totals in state file."
fi






### 1. fetch latest portfolios

printf '\nFetching latest portfolios (market=%s)...\n' "$marketId"
prefetch_failed=0
declare -a prefetch_failed_accounts
for i in "${loaded_indices[@]}"; do
  account_id="${account_ids[$i]}"
  [[ -z "$account_id" ]] && continue

  evm_address=$(resolve_evm_address "$account_id")
  if [[ -z "$evm_address" ]]; then
    echo "Error: failed to resolve evmAddress for account $account_id via https://${network}.mirrornode.hedera.com."
    prefetch_failed=1
    prefetch_failed_accounts+=("$account_id")
    continue
  fi

  portfolio_output=$(fetch_user_portfolio_json "$evm_address")
  portfolio_status=$?
  portfolio_json="$portfolio_output"
  if [[ $portfolio_status -ne 0 || -z "$portfolio_json" ]]; then
    echo "Error: failed to fetch portfolio for account $account_id (evm=$evm_address, easyrpc exit=$portfolio_status)."
    if [[ -n "$portfolio_output" ]]; then
      printf '%s\n' "$portfolio_output" | tail -n 2
    fi
    prefetch_failed=1
    prefetch_failed_accounts+=("$account_id")
    continue
  fi

  portfolio_error_code=$(printf '%s\n' "$portfolio_json" | jq -r '.errorCode // ""' 2>/dev/null)
  if [[ -n "$portfolio_error_code" && "$portfolio_error_code" != "0" ]]; then
    portfolio_message=$(printf '%s\n' "$portfolio_json" | jq -r '.message // ""' 2>/dev/null)
    echo "Error: failed to fetch portfolio for account $account_id (evm=$evm_address, errorCode=$portfolio_error_code message='$portfolio_message')."
    prefetch_failed=1
    prefetch_failed_accounts+=("$account_id")
    continue
  fi

  portfolio_json_by_index[$i]="$portfolio_json"
  prefetched_open_orders[$i]=$(printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '(.openPredictionIntents[$m].openPredictionIntents // []) | length')
  prefetched_matched_orders[$i]=$(printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '
    ((.openPredictionIntents[$m].openPredictionIntents // []) | map(.txId) | map(select(. != null and . != "")) | unique) as $openTxIds
    | (.matchedPredictionIntents[$m].matchedPredictionIntents // [])
    | map(.txId)
    | map(select(. != null and . != ""))
    | unique
    | map(select((. as $tx | $openTxIds | index($tx)) | not))
    | length
  ')
  active_yes_raw=$(printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '.positions[$m].position.yes // "0"')
  active_no_raw=$(printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '.positions[$m].position.no // "0"')
  summary_active_yes_qty[$i]=$(awk -v raw="$active_yes_raw" -v d="$usdc_decimals" 'BEGIN { printf "%.5f", raw / (10 ^ d) }')
  summary_active_no_qty[$i]=$(awk -v raw="$active_no_raw" -v d="$usdc_decimals" 'BEGIN { printf "%.5f", raw / (10 ^ d) }')
done

if [[ $prefetch_failed -ne 0 ]]; then
  echo "Portfolio prefetch failed for one or more accounts: ${prefetch_failed_accounts[*]}"
  exit 1
fi
printf '\033[32m✓\033[0m Fetched portfolios for all accounts\n'

### Portfolio summary table
print_portfolio_summary_table

echo
echo "Legend:"
echo "- OpenOrders: current count of open intents on the orderbook for this market/account."
echo "- MatchedOrders: distinct submitted txIds that appear matched for this market/account and are no longer still open."






### 2. reconcile submitted-vs-open/matched intent conservation against API
echo 
printf '\nReconciling submitted intents vs API open/matched state (market=%s)...\n' "$marketId"
echo
echo "SubmittedOrders: successful intents submitted in this run from the saved ledger of transactions generated by 1_fillUp.sh"
printf '%-15s %15s %12s %12s %12s %12s %12s %12s %12s %12s\n' "Account ID" "SubmittedOrders" "ExpectedBUY" "OpenBUY" "ActiveYES" "dBUY" "ExpectedSELL" "OpenSELL" "ActiveNO" "dSELL"
printf '%-15s %15s %12s %12s %12s %12s %12s %12s %12s %12s\n' "----------" "---------------" "------" "-------" "------" "----" "-------" "--------" "-----" "----"

reconcile_failed=0
for i in "${loaded_indices[@]}"; do
  account_id="${account_ids[$i]}"
  [[ -z "$account_id" ]] && continue

  portfolio_json="${portfolio_json_by_index[$i]}"
  if [[ -z "$portfolio_json" ]]; then
    echo "Error: missing prefetched portfolio for account $account_id."
    reconcile_failed=1
    continue
  fi

  open_buy_qty="0"
  open_sell_qty="0"
  open_collateral="0"
  expected_open_buy_qty_api="0"
  expected_open_sell_qty_api="0"
  expected_open_collateral_api="0"

  while IFS=$'\t' read -r open_tx_id open_price open_qty; do
    [[ -z "$open_tx_id" ]] && continue
    [[ -z "${run_tx_by_account[$i|$open_tx_id]}" ]] && continue
    if (( $(echo "$open_price >= 0" | bc -l) )); then
      open_buy_qty=$(add_float "$open_buy_qty" "$open_qty")
      open_spend=$(awk -v p="$open_price" -v q="$open_qty" 'BEGIN { ap = (p < 0 ? -p : p); s = ap * q; if (s < 0) s = 0; printf "%.6f", s }')
    else
      open_sell_qty=$(add_float "$open_sell_qty" "$open_qty")
      open_spend=$(awk -v p="$open_price" -v q="$open_qty" 'BEGIN { ap = (p < 0 ? -p : p); s = (1 - ap) * q; if (s < 0) s = 0; printf "%.6f", s }')
    fi
    open_collateral=$(add_float "$open_collateral" "$open_spend")
  done < <(printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '.openPredictionIntents[$m].openPredictionIntents[]? | [.txId, .priceUsd, .qty] | @tsv')

  for tx_key in "${!run_tx_qty_by_account[@]}"; do
    [[ "$tx_key" != "$i|"* ]] && continue
    tx_id="${tx_key#${i}|}"
    tx_side="${run_tx_side_by_account[$tx_key]:-}"
    tx_qty="${run_tx_qty_by_account[$tx_key]:-0}"
    tx_price="${run_tx_price_by_account[$tx_key]:-0}"

    if [[ -z "${tx_hashes_json_cache[$tx_id]:-}" ]]; then
      tx_hashes_json_cache[$tx_id]=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"txId\":\"$tx_id\"}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetTxHashes 2>/dev/null || printf '{}')
    fi

    tx_matched_qty=$(printf '%s\n' "${tx_hashes_json_cache[$tx_id]}" | jq -r '[.txHashes[]?.qty] | add // 0')
    tx_matched_capped=$(awk -v m="$tx_matched_qty" -v o="$tx_qty" 'BEGIN { v = m + 0; lim = o + 0; if (lim > 0 && v > lim) v = lim; if (v < 0) v = 0; printf "%.6f", v }')
    tx_open_rem=$(awk -v o="$tx_qty" -v m="$tx_matched_capped" 'BEGIN { v = (o + 0) - (m + 0); if (v < 0 && v > -0.000001) v = 0; if (v < 0) v = 0; printf "%.6f", v }')

    if [[ "$tx_side" == "BUY" ]]; then
      expected_open_buy_qty_api=$(add_float "$expected_open_buy_qty_api" "$tx_open_rem")
      rem_spend=$(awk -v p="$tx_price" -v q="$tx_open_rem" 'BEGIN { ap = (p < 0 ? -p : p); s = ap * q; if (s < 0) s = 0; printf "%.6f", s }')
    else
      expected_open_sell_qty_api=$(add_float "$expected_open_sell_qty_api" "$tx_open_rem")
      rem_spend=$(awk -v p="$tx_price" -v q="$tx_open_rem" 'BEGIN { ap = (p < 0 ? -p : p); s = (1 - ap) * q; if (s < 0) s = 0; printf "%.6f", s }')
    fi
    expected_open_collateral_api=$(add_float "$expected_open_collateral_api" "$rem_spend")
  done

  active_yes_qty=$(awk -v v="${summary_active_yes_qty[$i]:-0}" 'BEGIN { printf "%.6f", v }')
  active_no_qty=$(awk -v v="${summary_active_no_qty[$i]:-0}" 'BEGIN { printf "%.6f", v }')

  submitted_orders="${submitted_order_count[$i]:-0}"
  expected_buy_qty="$expected_open_buy_qty_api"
  expected_sell_qty="$expected_open_sell_qty_api"
  expected_collateral="$expected_open_collateral_api"

  delta_buy_qty=$(awk -v s="$expected_buy_qty" -v a="$open_buy_qty" 'BEGIN { printf "%.6f", s - a }')
  delta_sell_qty=$(awk -v s="$expected_sell_qty" -v a="$open_sell_qty" 'BEGIN { printf "%.6f", s - a }')
  abs_delta_buy_qty=$(awk -v d="$delta_buy_qty" 'BEGIN { if (d < 0) d = -d; printf "%.6f", d }')
  abs_delta_sell_qty=$(awk -v d="$delta_sell_qty" 'BEGIN { if (d < 0) d = -d; printf "%.6f", d }')
  max_abs_delta=$(awk -v a="$abs_delta_buy_qty" -v b="$abs_delta_sell_qty" 'BEGIN { if (a > b) printf "%.6f", a; else printf "%.6f", b }')

  delta_collateral=$(awk -v s="$expected_collateral" -v a="$open_collateral" 'BEGIN { printf "%.6f", s - a }')
  abs_delta_collateral=$(awk -v d="$delta_collateral" 'BEGIN { if (d < 0) d = -d; printf "%.6f", d }')

  disp_submitted_buy_qty=$(awk -v v="$expected_buy_qty" 'BEGIN { printf "%.5f", v }')
  disp_open_buy_qty=$(awk -v v="$open_buy_qty" 'BEGIN { printf "%.5f", v }')
  disp_active_yes_qty=$(awk -v v="$active_yes_qty" 'BEGIN { printf "%.5f", v }')
  disp_delta_buy_qty=$(awk -v v="$delta_buy_qty" 'BEGIN { printf "%.5f", v }')
  disp_submitted_sell_qty=$(awk -v v="$expected_sell_qty" 'BEGIN { printf "%.5f", v }')
  disp_open_sell_qty=$(awk -v v="$open_sell_qty" 'BEGIN { printf "%.5f", v }')
  disp_active_no_qty=$(awk -v v="$active_no_qty" 'BEGIN { printf "%.5f", v }')
  disp_delta_collateral=$(awk -v v="$delta_collateral" 'BEGIN { printf "%.5f", v }')

  printf '%-15s %15d %12s %12s %12s %12s %12s %12s %12s %12s\n' "$account_id" "$submitted_orders" "$disp_submitted_buy_qty" "$disp_open_buy_qty" "$disp_active_yes_qty" "$disp_delta_buy_qty" "$disp_submitted_sell_qty" "$disp_open_sell_qty" "$disp_active_no_qty" "$disp_delta_collateral"

  if (( $(echo "$abs_delta_collateral > $tolerance_qty" | bc -l) )) || (( $(echo "$max_abs_delta > $tolerance_qty" | bc -l) )); then
    echo "Error: reconciliation mismatch for $account_id (|deltaCol|=$abs_delta_collateral, |deltaBuy|=$abs_delta_buy_qty, |deltaSell|=$abs_delta_sell_qty, tolerance=$tolerance_qty)."
    reconcile_failed=1
  fi
done

### 3. final status
if [[ $reconcile_failed -ne 0 ]]; then
  printf '\033[31m❌\033[0m Reconciliation failed. API open intents do not match ledger-derived expected open intents.\n'
  exit 1
fi

echo "Legend:"
echo "* ExpectedBUY: amount the script believes should still be open after reconciliation: submitted BUY quantity minus BUY quantity already matched on-chain."
echo "* OpenBUY: what the API currently reports as open BUY quantity in the user portfolio for that market."
echo "* ActiveYES: whether the user currently has an active YES position for this market (0 or 1)."
echo "* dBUY: the discrepancy between ExpectedBUY and OpenBUY."
echo "* ExpectedSELL: amount the script believes should still be open after reconciliation: submitted SELL quantity minus SELL quantity already matched on-chain."
echo "* OpenSELL: what the API currently reports as open SELL quantity in the user portfolio for that market."
echo "* ActiveNO: whether the user currently has an active NO position for this market (0 or 1)."
echo "* dSELL: the discrepancy between ExpectedSELL and OpenSELL."
echo

printf '\033[32m✅\033[0m Reconciliation passed for all accounts (within tolerance %s).\n' "$tolerance_qty"

