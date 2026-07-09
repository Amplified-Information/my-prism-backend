#!/bin/bash

# this script prints out all submitted orders and matched orders
# foreach accountId (.env file), this script prints detail on the open orders (unmatched) and active positions (matched), including dollar amount, number of YES, number of NO and qty
# GetUserPortfolio is specified in ../proto/api.proto
# If a marketId is resolved, this script also creates a file called "./out/resolve_{marketid}" with all matched orders for that market.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$API_DIR/proto"
ENV_FILE="$SCRIPT_DIR/.env"
usdc_decimals=$(grep -E '^USDC_DECIMALS=' "$ENV_FILE" | cut -d '=' -f2)
usdc_decimals=${usdc_decimals:-6}
OUT_DIR="$SCRIPT_DIR/out"

if ! command -v easyrpc &> /dev/null; then
  echo "easyrpc could not be found. Please install it before running this script."
  exit 1
fi

if ! command -v curl &> /dev/null; then
  echo "curl could not be found. Please install it before running this script."
  exit 1
fi

if [[ ! -d "$PROTO_DIR" ]]; then
  echo "proto directory not found at $PROTO_DIR"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env file not found at $ENV_FILE"
  exit 1
fi

mkdir -p "$OUT_DIR"

read -p "Enter the base URL [https://testnet.dev.prism.market]: " baseUrl
baseUrl=${baseUrl:-https://testnet.dev.prism.market}
echo "Base URL set to: $baseUrl"

read -p "Enter marketId (optional, press Enter to fetch all markets): " marketId

network="testnet"
case "$baseUrl" in
  *previewnet*) network="previewnet" ;;
  *mainnet*) network="mainnet" ;;
esac

grpc_addr="${baseUrl#*://}"
grpc_addr="${grpc_addr%%/}"
grpc_flags=(-w) # grpc-web
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

echo "Preloading market metadata cache from GetMarkets..."

mirror_base="https://${network}.mirrornode.hedera.com"

resolve_evm_address() {
  local account_id="$1"
  local account_json
  account_json=$(curl -sfL "$mirror_base/api/v1/accounts/$account_id") || return 1
  printf '%s\n' "$account_json" | sed -n 's/.*"evm_address"[[:space:]]*:[[:space:]]*"0x\{0,1\}\([0-9a-fA-F]\{40\}\)".*/\1/p' | head -n 1 | tr 'A-F' 'a-f'
}

declare -A market_statement_cache
declare -A market_contract_cache
declare -A market_state_cache

populate_market_cache() {
  local mkt="$1"
  local cached_statement="${market_statement_cache[$mkt]}"
  local cached_contract="${market_contract_cache[$mkt]}"
  local cached_state="${market_state_cache[$mkt]}"
  if [[ -n "$cached_statement" && -n "$cached_contract" && -n "$cached_state" ]]; then
    return 0
  fi

  local market_json
  market_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"marketId\":\"$mkt\"}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetMarketById 2>/dev/null)
  if [[ $? -ne 0 || -z "$market_json" ]]; then
    market_statement_cache[$mkt]="<statement unavailable>"
    market_contract_cache[$mkt]="<contractId unavailable>"
    market_state_cache[$mkt]="<state unavailable>"
    return 0
  fi

  local statement
  local contract_id
  local state
  statement=$(printf '%s\n' "$market_json" | jq -r '.statement // "<statement unavailable>"')
  contract_id=$(printf '%s\n' "$market_json" | jq -r '.smartContractId // .smartContractID // .contractId // .contractID // "<contractId unavailable>"')
  state=$(printf '%s\n' "$market_json" | jq -r '
    def has_text(v): (v != null and ((v | tostring) | length) > 0);
    if has_text(.resolvedAt // .resolved_at) then "resolved"
    elif ((.isSuspended // .is_suspended // false) == true) then "suspended"
    elif ((.isPaused // .is_paused // false) == true) then "paused"
    else "active"
    end
  ')
  market_statement_cache[$mkt]="$statement"
  market_contract_cache[$mkt]="$contract_id"
  market_state_cache[$mkt]="$state"
}

get_market_statement() {
  local mkt="$1"
  populate_market_cache "$mkt"
  printf '%s\n' "${market_statement_cache[$mkt]}"
}

get_market_contract_id() {
  local mkt="$1"
  populate_market_cache "$mkt"
  printf '%s\n' "${market_contract_cache[$mkt]}"
}

get_market_state() {
  local mkt="$1"
  populate_market_cache "$mkt"
  printf '%s\n' "${market_state_cache[$mkt]}"
}

preload_markets_cache() {
  local limit=100
  local offset=0
  local pages=0

  while :; do
    local markets_json
    markets_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"limit\":$limit,\"offset\":$offset}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetMarkets 2>/dev/null)
    if [[ $? -ne 0 || -z "$markets_json" ]]; then
      break
    fi

    local rows_in_page
    rows_in_page=$(printf '%s\n' "$markets_json" | jq -r '(.markets // []) | length')
    if [[ "$rows_in_page" == "0" ]]; then
      break
    fi

    while IFS=$'\t' read -r mid statement contract_id state; do
      [[ -z "$mid" ]] && continue
      market_statement_cache[$mid]="$statement"
      market_contract_cache[$mid]="$contract_id"
      market_state_cache[$mid]="$state"
    done < <(printf '%s\n' "$markets_json" | jq -r '
      .markets[]?
      | [
          .marketId,
          (.statement // "<statement unavailable>"),
          (.smartContractId // .smartContractID // .contractId // .contractID // "<contractId unavailable>"),
          (
            if ((.resolvedAt // .resolved_at // "") | tostring | length) > 0 then "resolved"
            elif ((.isSuspended // .is_suspended // false) == true) then "suspended"
            elif ((.isPaused // .is_paused // false) == true) then "paused"
            else "active"
            end
          )
        ]
      | @tsv
    ')

    if (( rows_in_page < limit )); then
      break
    fi

    offset=$((offset + limit))
    pages=$((pages + 1))
    if (( pages >= 40 )); then
      break
    fi
  done
}

preload_markets_cache

declare -a private_keys
declare -a account_ids
declare -a key_types

loaded_accounts=0
for i in {0..9}; do
  private_key_var="${i}_PRIVATE_KEY"
  private_key_value=$(grep -E "^${private_key_var}=" "$ENV_FILE" | cut -d '=' -f2)
  account_id_var="${i}_ACCOUNT_ID"
  account_id_value=$(grep -E "^${account_id_var}=" "$ENV_FILE" | cut -d '=' -f2)
  key_type_var="${i}_KEY_TYPE"
  key_type_value=$(grep -E "^${key_type_var}=" "$ENV_FILE" | cut -d '=' -f2)
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

# Echo all the *_ACCOUNT_ID variables to the console
for i in "${!account_ids[@]}"; do
  key_value="${private_keys[$i]}"
  key_tail="$key_value"
  if [[ ${#key_value} -gt 4 ]]; then
    key_tail="${key_value:$((${#key_value} - 4))}"
  fi
  echo "Loaded account: ${account_ids[$i]} (...${key_tail} - ${key_types[$i]})"
done



# loop through all loaded accounts and call the GetUserPortfolio RPC for each
declare -a summary_open_orders
declare -a summary_open_notional
declare -a summary_active_positions
declare -a summary_active_yes
declare -a summary_active_no

for i in "${!account_ids[@]}"; do
  account_id="${account_ids[$i]}"
  evm_address=$(resolve_evm_address "$account_id")
  if [[ -z "$evm_address" ]]; then
    echo "Error: failed to resolve evmAddress for account $account_id."
    continue
  fi

  payload=$(printf '{"evmAddress":"%s","net":"%s"}' "$evm_address" "$network")
  if [[ -n "$marketId" ]]; then
    payload=$(printf '{"evmAddress":"%s","net":"%s","marketId":"%s"}' "$evm_address" "$network" "$marketId")
  fi

  # Call GetUserPortfolio with retries to tolerate transient edge/network EOFs.
  echo "Calling GetUserPortfolio for account: $account_id"
  portfolio_tmp_file="$OUT_DIR/portfolio_${account_id}.json.tmp"
  portfolio_out_file="$OUT_DIR/portfolio_${account_id}.json"
  max_attempts=3
  attempt=1
  portfolio_ok=0
  while (( attempt <= max_attempts )); do
    err_file="$OUT_DIR/portfolio_${account_id}.err"
    if easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "$payload" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetUserPortfolio > "$portfolio_tmp_file" 2>"$err_file"; then
      if [[ -s "$portfolio_tmp_file" ]] && jq -e . "$portfolio_tmp_file" >/dev/null 2>&1; then
        mv "$portfolio_tmp_file" "$portfolio_out_file"
        portfolio_ok=1
        rm -f "$err_file"
        break
      fi
      echo "Warning: GetUserPortfolio returned invalid/empty JSON for $account_id (attempt $attempt/$max_attempts)."
    else
      echo "Warning: GetUserPortfolio RPC failed for $account_id (attempt $attempt/$max_attempts):"
      cat "$err_file"
    fi

    rm -f "$portfolio_tmp_file"
    attempt=$((attempt + 1))
  done

  if [[ $portfolio_ok -ne 1 ]]; then
    echo "Error: failed to fetch portfolio for account $account_id after $max_attempts attempts."
    rm -f "$portfolio_tmp_file"
    continue
  fi
  echo "Saved $OUT_DIR/portfolio_${account_id}.json"

  portfolio_file="$OUT_DIR/portfolio_${account_id}.json"
  if [[ ! -f "$portfolio_file" ]]; then
    echo "Error: expected portfolio file not found: $portfolio_file"
    continue
  fi

  if [[ -n "$marketId" ]]; then
    open_orders=$(jq -r --arg m "$marketId" '(.openPredictionIntents[$m].openPredictionIntents // []) | length' "$portfolio_file")
    open_notional=$(jq -r --arg m "$marketId" '[.openPredictionIntents[$m].openPredictionIntents[]? | ((.priceUsd | if . < 0 then -. else . end) * .qty)] | add // 0' "$portfolio_file")
    active_positions=$(jq -r --arg m "$marketId" 'if (.positions[$m] // null) == null then 0 else 1 end' "$portfolio_file")
    active_yes_raw=$(jq -r --arg m "$marketId" '.positions[$m].position.yes // "0"' "$portfolio_file")
    active_no_raw=$(jq -r --arg m "$marketId" '.positions[$m].position.no // "0"' "$portfolio_file")
  else
    open_orders=$(jq -r '[.openPredictionIntents // {} | to_entries[]? | (.value.openPredictionIntents // []) | length] | add // 0' "$portfolio_file")
    open_notional=$(jq -r '[.openPredictionIntents // {} | to_entries[]? | .value.openPredictionIntents[]? | ((.priceUsd | if . < 0 then -. else . end) * .qty)] | add // 0' "$portfolio_file")
    active_positions=$(jq -r '(.positions // {}) | keys | length' "$portfolio_file")
    active_yes_raw=$(jq -r '[.positions // {} | to_entries[]? | (.value.position.yes // "0" | tonumber)] | add // 0' "$portfolio_file")
    active_no_raw=$(jq -r '[.positions // {} | to_entries[]? | (.value.position.no // "0" | tonumber)] | add // 0' "$portfolio_file")
  fi

  active_yes=$(awk -v raw="$active_yes_raw" -v dec="$usdc_decimals" 'BEGIN { printf "%.5f", raw / (10 ^ dec) }')
  active_no=$(awk -v raw="$active_no_raw" -v dec="$usdc_decimals" 'BEGIN { printf "%.5f", raw / (10 ^ dec) }')
  open_notional_fmt=$(awk -v v="$open_notional" 'BEGIN { printf "%.5f", v }')

  summary_open_orders[$i]="$open_orders"
  summary_open_notional[$i]="$open_notional_fmt"
  summary_active_positions[$i]="$active_positions"
  summary_active_yes[$i]="$active_yes"
  summary_active_no[$i]="$active_no"
done

printf '\nPortfolio Summary (%s)\n' "$network"
printf '%-15s %-8s %12s %12s %12s %12s %12s\n' "Account ID" "Key" "OpenOrders" "OpenUSD" "ActPos" "ActYES" "ActNO"
printf '%-15s %-8s %12s %12s %12s %12s %12s\n' "----------" "---" "----------" "-------" "------" "------" "-----"
for i in "${!account_ids[@]}"; do
  printf '%-15s %-8s %12s %12s %12s %12s %12s\n' \
    "${account_ids[$i]}" \
    "${key_types[$i]}" \
    "${summary_open_orders[$i]:-0}" \
    "${summary_open_notional[$i]:-0.00000}" \
    "${summary_active_positions[$i]:-0}" \
    "${summary_active_yes[$i]:-0.00000}" \
    "${summary_active_no[$i]:-0.00000}"
done

if [[ -z "$marketId" ]]; then
  printf '\nPortfolio Summary By Market (%s)\n' "$network"

  declare -A market_ids_set
  for i in "${!account_ids[@]}"; do
    account_id="${account_ids[$i]}"
    portfolio_file="$OUT_DIR/portfolio_${account_id}.json"
    if [[ ! -f "$portfolio_file" ]]; then
      continue
    fi

    while IFS= read -r m; do
      [[ -z "$m" ]] && continue
      market_ids_set[$m]=1
    done < <(jq -r '
      [
        ((.openPredictionIntents // {}) | keys[]?),
        ((.positions // {}) | keys[]?)
      ]
      | flatten
      | unique
      | .[]
    ' "$portfolio_file")
  done

  # sort market_ids_set
  sorted_market_ids=($(printf '%s\n' "${!market_ids_set[@]}" | sort))
  printf '*** Found %d unique markets across %d accounts.\n' "${#sorted_market_ids[@]}" "$loaded_accounts"
  printf 'Looping through all markets and providing a summary...'

  for mkt in "${sorted_market_ids[@]}"; do
    declare -a market_rows=()
    active_row_count=0

    for i in "${!account_ids[@]}"; do
      account_id="${account_ids[$i]}"
      portfolio_file="$OUT_DIR/portfolio_${account_id}.json"
      if [[ ! -f "$portfolio_file" ]]; then
        continue
      fi

      row_open_orders=$(jq -r --arg m "$mkt" '(.openPredictionIntents[$m].openPredictionIntents // []) | length' "$portfolio_file")
      row_open_usd=$(jq -r --arg m "$mkt" '[.openPredictionIntents[$m].openPredictionIntents[]? | ((.priceUsd | if . < 0 then -. else . end) * .qty)] | add // 0' "$portfolio_file")
      row_active_pos=$(jq -r --arg m "$mkt" 'if (.positions[$m] // null) == null then 0 else 1 end' "$portfolio_file")
      row_active_yes_raw=$(jq -r --arg m "$mkt" '.positions[$m].position.yes // "0"' "$portfolio_file")
      row_active_no_raw=$(jq -r --arg m "$mkt" '.positions[$m].position.no // "0"' "$portfolio_file")

      row_active_yes=$(awk -v raw="$row_active_yes_raw" -v dec="$usdc_decimals" 'BEGIN { printf "%.5f", raw / (10 ^ dec) }')
      row_active_no=$(awk -v raw="$row_active_no_raw" -v dec="$usdc_decimals" 'BEGIN { printf "%.5f", raw / (10 ^ dec) }')
      row_open_usd_fmt=$(awk -v v="$row_open_usd" 'BEGIN { printf "%.5f", v }')

      row_has_activity=$(awk -v oo="$row_open_orders" -v ou="$row_open_usd" -v ap="$row_active_pos" -v ay="$row_active_yes_raw" -v an="$row_active_no_raw" 'BEGIN { if ((oo + 0) != 0 || (ou + 0) != 0 || (ap + 0) != 0 || (ay + 0) != 0 || (an + 0) != 0) print 1; else print 0 }')
      if [[ "$row_has_activity" != "1" ]]; then
        continue
      fi

      printf -v row_line '%-15s %-8s %10s %12s %10s %12s %12s' \
        "$account_id" \
        "${key_types[$i]}" \
        "$row_open_orders" \
        "$row_open_usd_fmt" \
        "$row_active_pos" \
        "$row_active_yes" \
        "$row_active_no"
      market_rows+=("$row_line")
      active_row_count=$((active_row_count + 1))
    done

    if [[ $active_row_count -eq 0 ]]; then
      continue
    fi

    statement=$(get_market_statement "$mkt")
    contract_id=$(get_market_contract_id "$mkt")
    market_state=$(get_market_state "$mkt")
    printf '\nMarket: %s\n' "$mkt"
    printf 'Statement: %s\n' "$statement"
    printf 'State: %s\n' "$market_state"
    printf 'Smart Contract Id: %s\n' "$contract_id"
    printf '%-15s %-8s %10s %12s %10s %12s %12s\n' "Account ID" "Key" "OpenOrd" "OpenUSD" "ActPos" "ActYES" "ActNO"
    printf '%-15s %-8s %10s %12s %10s %12s %12s\n' "----------" "---" "-------" "-------" "------" "------" "-----"

    for row_line in "${market_rows[@]}"; do
      printf '%s\n' "$row_line"
    done
  done
fi




# For every matched order, print a table with:
# If the market is resolved, also create a file called "./out/resolve_{marketid}"
# timestamp, account_id, market_id, tx_id, tx_hash, qty, price_usd, side, primary_secondary.
echo -e "-------------------------------------------\n"
printf '\nMatched Orders\n'
printf '%-20s %-15s %-36s %-15s %-36s %-40s %12s %10s %-6s %-10s\n' "TimestampUTC" "AccountID" "MarketID" "IsResolved" "TxID (can be duplicate)" "TxHash" "Qty" "PriceUSD" "Side" "Prim/Sec"
printf '%-20s %-15s %-36s %-15s %-36s %-40s %12s %10s %-6s %-10s\n' "------------" "----------" "---------" "---------" "-----" "-------" "---" "--------" "----" "--------"

declare -A tx_hashes_json_cache
declare -A matched_market_set
declare -A resolve_file_initialized
matched_rows=0
matched_intents_total=0
selected_market_intents_total=0
for i in "${!account_ids[@]}"; do
  account_id="${account_ids[$i]}"
  portfolio_file="$OUT_DIR/portfolio_${account_id}.json"

  # Some API paths may scope matchedPredictionIntents when marketId is provided.
  # To avoid dropping matched rows, fetch an unfiltered snapshot for matched section.
  if [[ -n "$marketId" ]]; then
    evm_address=$(resolve_evm_address "$account_id")
    if [[ -n "$evm_address" ]]; then
      matched_payload=$(printf '{"evmAddress":"%s","net":"%s"}' "$evm_address" "$network")
      matched_tmp_file="$OUT_DIR/portfolio_matched_${account_id}.json.tmp"
      matched_out_file="$OUT_DIR/portfolio_matched_${account_id}.json"
      if easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "$matched_payload" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetUserPortfolio > "$matched_tmp_file" 2>/dev/null; then
        if [[ -s "$matched_tmp_file" ]] && jq -e . "$matched_tmp_file" >/dev/null 2>&1; then
          mv "$matched_tmp_file" "$matched_out_file"
          portfolio_file="$matched_out_file"
        else
          rm -f "$matched_tmp_file"
        fi
      else
        rm -f "$matched_tmp_file"
      fi
    fi
  fi

  if [[ ! -f "$portfolio_file" ]]; then
    continue
  fi

  while IFS=$'\t' read -r row_market_id tx_id raw_price primary_secondary fallback_qty generated_at; do
    [[ -z "$row_market_id" || -z "$tx_id" ]] && continue
    matched_intents_total=$((matched_intents_total + 1))
    matched_market_set[$row_market_id]=1
    if [[ -n "$marketId" && "$row_market_id" == "$marketId" ]]; then
      selected_market_intents_total=$((selected_market_intents_total + 1))
    fi
    if [[ -n "$marketId" && "$row_market_id" != "$marketId" ]]; then
      continue
    fi

    row_resolved_marker=""
    row_market_state=$(get_market_state "$row_market_id")
    if [[ "$row_market_state" == "resolved" ]]; then
      row_resolved_marker="R"
    fi

    resolve_file="$OUT_DIR/resolve_${row_market_id}"
    if [[ "$row_resolved_marker" == "R" && -z "${resolve_file_initialized[$row_market_id]:-}" ]]; then
      : > "$resolve_file"
      printf '%-20s %-15s %-36s %-15s %-36s %-40s %12s %10s %-6s %-10s\n' "TimestampUTC" "AccountID" "MarketID" "IsResolved" "TxID (can be duplicate)" "TxHash" "Qty" "PriceUSD" "Side" "Prim/Sec" >> "$resolve_file"
      printf '%-20s %-15s %-36s %-15s %-36s %-40s %12s %10s %-6s %-10s\n' "------------" "----------" "---------" "---------" "-----" "-------" "---" "--------" "----" "--------" >> "$resolve_file"
      resolve_file_initialized[$row_market_id]=1
    fi

    price_fmt=$(awk -v v="$raw_price" 'BEGIN { printf "%.3f", v + 0 }')
    side="BUY"
    if awk -v v="$raw_price" 'BEGIN { exit !(v + 0 < 0) }'; then
      side="SELL"
    fi
    if [[ -z "$primary_secondary" ]]; then
      primary_secondary="?"
    fi

    timestamp_utc=""
    if [[ -n "$generated_at" ]]; then
      timestamp_utc=$(date -u -d "$generated_at" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null)
      if [[ -z "$timestamp_utc" ]]; then
        timestamp_utc=$(printf '%s' "$generated_at" | sed -E 's/[[:space:]]+\+0000([[:space:]]+\+0000)?$//')
        timestamp_utc=$(printf '%s' "$timestamp_utc" | sed -E 's/\.([0-9]{1,9})$//')
      fi
    fi

    if [[ -z "${tx_hashes_json_cache[$tx_id]}" ]]; then
      tx_hashes_json_cache[$tx_id]=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"txId\":\"$tx_id\"}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetTxHashes 2>/dev/null)
    fi
    tx_hashes_json="${tx_hashes_json_cache[$tx_id]}"

    emitted_hash_row=0
    while IFS=$'\t' read -r tx_hash matched_qty; do
      [[ -z "$tx_hash" ]] && continue
      matched_qty_fmt=$(awk -v v="$matched_qty" 'BEGIN { printf "%.4f", v + 0 }')
      printf '%-20s %-15s %-36s %-15s %-36s %-40s %12s %10s %-6s %-10s\n' \
        "$timestamp_utc" \
        "$account_id" \
        "$row_market_id" \
        "$row_resolved_marker" \
        "$tx_id" \
        "$tx_hash" \
        "$matched_qty_fmt" \
        "$price_fmt" \
        "$side" \
        "$primary_secondary"
      if [[ "$row_resolved_marker" == "R" ]]; then
        printf '%-20s %-15s %-36s %-15s %-36s %-40s %12s %10s %-6s %-10s\n' \
          "$timestamp_utc" \
          "$account_id" \
          "$row_market_id" \
          "$row_resolved_marker" \
          "$tx_id" \
          "$tx_hash" \
          "$matched_qty_fmt" \
          "$price_fmt" \
          "$side" \
          "$primary_secondary" >> "$resolve_file"
      fi
      matched_rows=$((matched_rows + 1))
      emitted_hash_row=1
    done < <(printf '%s\n' "$tx_hashes_json" | jq -r '.txHashes[]? | [.txHash, .qty] | @tsv')

    if [[ $emitted_hash_row -eq 0 ]]; then
      fallback_qty_fmt=$(awk -v v="$fallback_qty" 'BEGIN { printf "%.4f", v + 0 }')
      printf '%-20s %-15s %-36s %-15s %-36s %-66s %12s %10s %-6s %-10s\n' \
        "$timestamp_utc" \
        "$account_id" \
        "$row_market_id" \
        "$row_resolved_marker" \
        "$tx_id" \
        "<no tx hash>" \
        "$fallback_qty_fmt" \
        "$price_fmt" \
        "$side" \
        "$primary_secondary"
      if [[ "$row_resolved_marker" == "R" ]]; then
        printf '%-20s %-15s %-36s %-15s %-36s %-66s %12s %10s %-6s %-10s\n' \
          "$timestamp_utc" \
          "$account_id" \
          "$row_market_id" \
          "$row_resolved_marker" \
          "$tx_id" \
          "<no tx hash>" \
          "$fallback_qty_fmt" \
          "$price_fmt" \
          "$side" \
          "$primary_secondary" >> "$resolve_file"
      fi
      matched_rows=$((matched_rows + 1))
    fi
  done < <(jq -r '
    (.matchedPredictionIntents // {})
    | to_entries[]?
    | .key as $marketId
    | (.value.matchedPredictionIntents // [])[]?
    | [
        $marketId,
        (.txId // ""),
        (.priceUsd // 0),
        (.primarySecondary // ""),
        (.qty // 0),
        (.generatedAt // "")
      ]
    | @tsv
  ' "$portfolio_file")
done

if [[ $matched_rows -eq 0 ]]; then
  printf 'No matched orders found from matchedPredictionIntents for the selected scope.\n'
  if [[ $matched_intents_total -eq 0 ]]; then
    printf 'Hint: matchedPredictionIntents is empty in GetUserPortfolio responses for the selected scope.\n'
  else
    if [[ -n "$marketId" && $selected_market_intents_total -eq 0 ]]; then
      printf 'Hint: selected marketId %s has no matchedPredictionIntents.\n' "$marketId"
      available_matched_markets=$(printf '%s\n' "${!matched_market_set[@]}" | sort | tr '\n' ' ')
      if [[ -n "$available_matched_markets" ]]; then
        printf 'Matched intents are available for markets: %s\n' "$available_matched_markets"
      fi
    else
      printf 'Hint: matchedPredictionIntents exists, but no rows passed the current market filter.\n'
    fi
  fi
fi
