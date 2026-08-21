#!/bin/bash

# this script prints out all submitted orders and matched orders
# foreach accountId (.env file), this script prints detail on the open orders (unmatched) and active positions (matched), including dollar amount, number of YES, number of NO and qty
# GetUserPortfolio is specified in ../proto/api.proto

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$API_DIR/proto"
source "$SCRIPT_DIR/shared.sh"
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

base_url_default="${BASE_URL:-$(grep -E '^BASE_URL=' "$ENV_FILE" | head -n1 | cut -d '=' -f2- | tr -d '[:space:]') }"
base_url_default="${base_url_default% }"
if [[ -z "$base_url_default" ]]; then
  base_url_default="https://testnet.dev.prism.market"
fi

read -p "Enter the base URL [$base_url_default]: " baseUrl
baseUrl=${baseUrl:-$base_url_default}
if grep -qE '^BASE_URL=' "$ENV_FILE"; then
  sed -i "s|^BASE_URL=.*|BASE_URL=$baseUrl|" "$ENV_FILE"
else
  printf '\nBASE_URL=%s\n' "$baseUrl" >> "$ENV_FILE"
fi
echo "Base URL set to: $baseUrl"

validate_admin_jwt() {
  local token="${1:-}"
  if [[ -z "$token" ]]; then
    echo "Error: missing ADMIN_BEARER_TOKEN. Run ./0_bearerToken.sh to generate a fresh ADMIN JWT." >&2
    return 1
  fi

  local payload
  payload=$(printf '%s' "$token" | cut -d '.' -f2)
  if [[ -z "$payload" || "$payload" == "$token" ]]; then
    echo "Error: ADMIN_BEARER_TOKEN is not a valid JWT format. Run ./0_bearerToken.sh to refresh it." >&2
    return 1
  fi

  local decoded_json
  decoded_json=$(python3 - "$payload" <<'PY'
import base64, json, sys
payload = sys.argv[1].strip()
if not payload:
    raise SystemExit(1)
pad = '=' * ((4 - len(payload) % 4) % 4)
try:
    raw = base64.urlsafe_b64decode(payload + pad)
except Exception:
    raise SystemExit(2)
try:
    obj = json.loads(raw.decode('utf-8'))
except Exception:
    raise SystemExit(3)
roles = obj.get('roles') or []
if isinstance(roles, str):
    roles = [roles]
roles = [str(r).upper() for r in roles]
if 'ADMIN' not in roles:
    raise SystemExit(f"JWT missing ADMIN role; roles={roles}")
if 'exp' in obj:
    import time
    try:
        exp = int(obj['exp'])
    except (TypeError, ValueError):
        raise SystemExit('JWT exp is not a valid integer')
    if exp < int(time.time()):
        raise SystemExit('JWT has expired')
print(json.dumps({'subject': obj.get('accountId') or obj.get('sub'), 'roles': roles}, separators=(',', ':')))
PY
)

  if [[ $? -ne 0 ]]; then
    echo "Error: ADMIN_BEARER_TOKEN is not a valid ADMIN JWT. Run ./0_bearerToken.sh to generate a fresh token." >&2
    return 1
  fi

  echo "JWT validated for ADMIN: $decoded_json"
  return 0
}

bearer_token=$(grep -E '^(ADMIN_BEARER_TOKEN|AUTH_BEARER_TOKEN|BEARER_TOKEN)=' "$ENV_FILE" | head -n1 | cut -d '=' -f2-)
bearer_token="${bearer_token#Bearer }"
if [[ -n "$bearer_token" ]]; then
  if validate_admin_jwt "$bearer_token"; then
    grpc_meta=(-H "authorization: $(e2e_bearer_header "$bearer_token")")
    echo "Using valid ADMIN JWT for privileged match/intents endpoints."
  else
    exit 1
  fi
else
  echo "Error: no ADMIN_BEARER_TOKEN found in $ENV_FILE. Run ./0_bearerToken.sh to generate a fresh ADMIN JWT." >&2
  exit 1
fi

read -p "Enter marketId (optional, press Enter to fetch all markets): " marketId

network="testnet"
case "$baseUrl" in
  *previewnet*) network="previewnet" ;;
  *mainnet*) network="mainnet" ;;
esac

grpc_addr="${baseUrl#*://}"
grpc_addr="${grpc_addr%%/}"
grpc_flags=(-w) # grpc-web
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
  market_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"marketId\":\"$mkt\"}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetMarketById 2>/dev/null || true)
  if [[ -z "$market_json" || "$market_json" == "null" ]]; then
    echo "Warning: skipping market $mkt in cache population because GetMarketById returned empty/null payload." >&2
    market_statement_cache[$mkt]="<statement unavailable>"
    market_contract_cache[$mkt]="<contractId unavailable>"
    market_state_cache[$mkt]="<state unavailable>"
    return 0
  fi

  if ! printf '%s\n' "$market_json" | jq -e 'type == "object"' >/dev/null 2>&1; then
    echo "Warning: skipping market $mkt in cache population because GetMarketById response was not valid JSON object." >&2
    market_statement_cache[$mkt]="<statement unavailable>"
    market_contract_cache[$mkt]="<contractId unavailable>"
    market_state_cache[$mkt]="<state unavailable>"
    return 0
  fi

  local statement
  local contract_id
  local state
  statement=$(printf '%s\n' "$market_json" | jq -r '.statement // "<statement unavailable>"' 2>/dev/null || printf '<statement unavailable>')
  contract_id=$(printf '%s\n' "$market_json" | jq -r '.smartContractId // .smartContractID // .contractId // .contractID // "<contractId unavailable>"' 2>/dev/null || printf '<contractId unavailable>')
  state=$(printf '%s\n' "$market_json" | jq -r '
    def has_text(v): (v != null and ((v | tostring) | length) > 0);
    if has_text(.resolvedAt // .resolved_at) then "resolved"
    elif ((.isSuspended // .is_suspended // false) == true) then "suspended"
    elif ((.isPaused // .is_paused // false) == true) then "paused"
    else "active"
    end
  ' 2>/dev/null || printf 'active')
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
  local limit=$PAGE_LIMIT
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
    ' 2>/dev/null || true)

    offset=$((offset + rows_in_page))
    pages=$((pages + 1))
    if (( pages >= MAX_PAGES )); then
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

  # Call the GetUserPortfolio RPC for the current account
  echo "Calling GetUserPortfolio for account: $account_id"
  printf 'Command: easyrpc c %q ' "${grpc_flags[@]}"
  printf -- '-a %q -d %q -i %q -p %q %s\n' "$grpc_addr" "$payload" "$PROTO_DIR" "api.proto" "api.ApiServicePublic.GetUserPortfolio"
  echo
  if ! easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "$payload" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetUserPortfolio > "$OUT_DIR/portfolio_${account_id}.json" 2>"$OUT_DIR/portfolio_${account_id}.err"; then
    echo "Warning: skipping account $account_id because GetUserPortfolio failed or returned a truncated response. See $OUT_DIR/portfolio_${account_id}.err for details."
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

      row_open_orders=$(jq -r --arg m "$mkt" '(.openPredictionIntents[$m].openPredictionIntents // []) | length' "$portfolio_file" 2>/dev/null || printf '0')
      row_open_usd=$(jq -r --arg m "$mkt" '[.openPredictionIntents[$m].openPredictionIntents[]? | ((.priceUsd | if . < 0 then -. else . end) * .qty)] | add // 0' "$portfolio_file" 2>/dev/null || printf '0')
      row_active_pos=$(jq -r --arg m "$mkt" 'if (.positions[$m] // null) == null then 0 else 1 end' "$portfolio_file" 2>/dev/null || printf '0')
      row_active_yes_raw=$(jq -r --arg m "$mkt" '.positions[$m].position.yes // "0"' "$portfolio_file" 2>/dev/null || printf '0')
      row_active_no_raw=$(jq -r --arg m "$mkt" '.positions[$m].position.no // "0"' "$portfolio_file" 2>/dev/null || printf '0')

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
# account_id, market_id, tx_id, tx_hash, qty, price_usd, side, primary_secondary.
format_utc_timestamp() {
  local timestamp="$1"
  if [[ -z "$timestamp" ]]; then
    printf '%s\n' '<unknown>'
    return
  fi

  date -u -d "$timestamp" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || printf '%s\n' "$timestamp"
}

format_match_timestamp_utc() {
  local created_at="$1"
  local tx_hash="$2"

  if [[ -n "$created_at" ]]; then
    format_utc_timestamp "$created_at"
    return
  fi

  if [[ "$tx_hash" =~ @([0-9]+)\.([0-9]+)$ ]]; then
    local seconds="${BASH_REMATCH[1]}"
    local utc_seconds
    utc_seconds=$(date -u -d "@$seconds" '+%Y-%m-%dT%H:%M:%S' 2>/dev/null) || {
      printf '%s\n' '<unknown>'
      return
    }
    printf '%sZ\n' "$utc_seconds"
    return
  fi

  printf '%s\n' '<unknown>'
}

account_id_from_tx_hash() {
  local tx_hash="$1"
  if [[ "$tx_hash" =~ ^([0-9]+\.[0-9]+\.[0-9]+)@ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  fi
}

echo -e "-------------------------------------------\n"
printf '\nMatched Orders\n'
printf '%-15s %-36s %-20s %-8s %-36s %-36s %12s %10s %-6s %-10s\n' "AccountID" "MarketID" "Timestamp UTC" "Resolved" "TxID (can be duplicate)" "TxHash" "Qty" "PriceUSD" "Side" "Prim/Sec"
printf '%-15s %-36s %-20s %-8s %-36s %-36s %12s %10s %-6s %-10s\n' "----------" "---------" "-------------" "--------" "-----" "-------" "---" "--------" "----" "--------"

# Build tx_id metadata from prediction intents so we can render account/price/side fields.
declare -A tx_account_map
declare -A tx_price_map
declare -A tx_primary_secondary_map
intents_fetch_failed=0
intents_rows_total=0
intent_lookup_limit=$PAGE_LIMIT
intent_lookup_offset=0
intent_lookup_pages=0
while :; do
  intents_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"limit\":$intent_lookup_limit,\"offset\":$intent_lookup_offset}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetAllPredictionIntents 2>/dev/null)
  if [[ $? -ne 0 || -z "$intents_json" ]]; then
    intents_fetch_failed=1
    break
  fi

  intents_in_page=$(printf '%s\n' "$intents_json" | jq -r '(.predictionIntents // []) | length')
  intents_rows_total=$((intents_rows_total + intents_in_page))
  if [[ "$intents_in_page" == "0" ]]; then
    break
  fi

  while IFS=$'\t' read -r itx iacct iprice ips; do
    [[ -z "$itx" ]] && continue
    tx_account_map[$itx]="$iacct"
    tx_price_map[$itx]="$iprice"
    tx_primary_secondary_map[$itx]="$ips"
  done < <(printf '%s\n' "$intents_json" | jq -r '.predictionIntents[]? | [.txId, .accountId, .priceUsd, .primarySecondary] | @tsv')

  IFS=$'\t' read -r intents_has_more intent_lookup_offset < <(e2e_page_state "$intents_json" "$intents_in_page" "$intent_lookup_offset" "$intent_lookup_limit")
  [[ "$intents_has_more" == "true" ]] || break

  intent_lookup_pages=$((intent_lookup_pages + 1))
  if (( intent_lookup_pages >= MAX_PAGES )); then
    break
  fi
done

declare -A loaded_account_set
for i in "${!account_ids[@]}"; do
  loaded_account_set["${account_ids[$i]}"]=1
done

declare -A tx_hashes_json_cache
matches_fetch_failed=0
matches_rows_total=0
match_lookup_limit=$PAGE_LIMIT
match_lookup_offset=0
match_lookup_pages=0
matched_rows=0
while :; do
  matches_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"limit\":$match_lookup_limit,\"offset\":$match_lookup_offset}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetAllMatches 2>/dev/null)
  if [[ $? -ne 0 || -z "$matches_json" ]]; then
    matches_fetch_failed=1
    break
  fi

  rows_in_page=$(printf '%s\n' "$matches_json" | jq -r '(.matches // []) | length')
  matches_rows_total=$((matches_rows_total + rows_in_page))
  if [[ "$rows_in_page" == "0" ]]; then
    break
  fi

  while IFS=$'\037' read -r row_market_id row_created_at tx1 qty1 tx2 qty2 price1 price2; do
    [[ -z "$row_market_id" ]] && continue
    if [[ -n "$marketId" && "$row_market_id" != "$marketId" ]]; then
      continue
    fi

    row_resolved_marker=""
    row_market_state=$(get_market_state "$row_market_id")
    if [[ "$row_market_state" == "resolved" ]]; then
      row_resolved_marker="R"
    fi

    for leg in 1 2; do
      if [[ "$leg" == "1" ]]; then
        tx_id="$tx1"
        fallback_qty="$qty1"
        match_price="$price1"
      else
        tx_id="$tx2"
        fallback_qty="$qty2"
        match_price="$price2"
      fi
      [[ -z "$tx_id" ]] && continue

      account_id="${tx_account_map[$tx_id]}"
      if [[ -z "$account_id" ]]; then
        account_id="<unknown>"
      fi
      raw_price="${tx_price_map[$tx_id]}"
      if [[ -z "$raw_price" ]]; then
        raw_price="$match_price"
      fi
      if [[ -n "$raw_price" ]]; then
        price_fmt=$(awk -v v="$raw_price" 'BEGIN { printf "%.3f", v + 0 }')
        side="BUY"
        if awk -v v="$raw_price" 'BEGIN { exit !(v + 0 < 0) }'; then
          side="SELL"
        fi
      else
        price_fmt="<unknown>"
        side="?"
      fi
      primary_secondary="${tx_primary_secondary_map[$tx_id]}"
      if [[ -z "$primary_secondary" ]]; then
        primary_secondary="?"
      fi

      if [[ -z "${tx_hashes_json_cache[$tx_id]}" ]]; then
        tx_hashes_json_cache[$tx_id]=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"txId\":\"$tx_id\"}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetTxHashes 2>/dev/null)
      fi
      tx_hashes_json="${tx_hashes_json_cache[$tx_id]}"

      if [[ "$account_id" == "<unknown>" ]]; then
        first_tx_hash=$(printf '%s\n' "$tx_hashes_json" | jq -r '.txHashes[0].txHash // empty' 2>/dev/null || true)
        hash_account_id=$(account_id_from_tx_hash "$first_tx_hash")
        if [[ -n "$hash_account_id" ]]; then
          account_id="$hash_account_id"
        fi
      fi

      # Keep output scoped to loaded accounts when the account can be identified.
      if [[ "$account_id" != "<unknown>" && -z "${loaded_account_set[$account_id]}" ]]; then
        continue
      fi

      emitted_hash_row=0
      while IFS=$'\t' read -r tx_hash matched_qty; do
        [[ -z "$tx_hash" ]] && continue
        match_timestamp_utc=$(format_match_timestamp_utc "$row_created_at" "$tx_hash")
        matched_qty_fmt=$(awk -v v="$matched_qty" 'BEGIN { printf "%.4f", v + 0 }')
        printf '%-15s %-36s %-20s %-8s %-36s %-36s %12s %10s %-6s %-10s\n' \
          "$account_id" \
          "$row_market_id" \
          "$match_timestamp_utc" \
          "$row_resolved_marker" \
          "$tx_id" \
          "$tx_hash" \
          "$matched_qty_fmt" \
          "$price_fmt" \
          "$side" \
          "$primary_secondary"
        matched_rows=$((matched_rows + 1))
        emitted_hash_row=1
      done < <(printf '%s\n' "$tx_hashes_json" | jq -r '.txHashes[]? | [.txHash, .qty] | @tsv')

      if [[ $emitted_hash_row -eq 0 ]]; then
        fallback_qty_fmt=$(awk -v v="$fallback_qty" 'BEGIN { printf "%.4f", v + 0 }')
        printf '%-15s %-36s %-20s %-8s %-36s %-36s %12s %10s %-6s %-10s\n' \
          "$account_id" \
          "$row_market_id" \
          "$(format_match_timestamp_utc "$row_created_at" "")" \
          "$row_resolved_marker" \
          "$tx_id" \
          "<no tx hash>" \
          "$fallback_qty_fmt" \
          "$price_fmt" \
          "$side" \
          "$primary_secondary"
        matched_rows=$((matched_rows + 1))
      fi
    done
  done < <(printf '%s\n' "$matches_json" | jq -r '
    .matches[]?
    | [
        .marketId,
        (.createdAt // .created_at // ""),
        .txId1,
        .qty1,
        .txId2,
        .qty2,
        (.priceUsd1 // ""),
        (.priceUsd2 // "")
      ]
    | map(tostring)
    | join("\u001f")
  ')

  IFS=$'\t' read -r matches_has_more match_lookup_offset < <(e2e_page_state "$matches_json" "$rows_in_page" "$match_lookup_offset" "$match_lookup_limit")
  [[ "$matches_has_more" == "true" ]] || break

  match_lookup_pages=$((match_lookup_pages + 1))
  if (( match_lookup_pages >= MAX_PAGES )); then
    break
  fi
done

if [[ $matched_rows -eq 0 ]]; then
  if [[ -n "$marketId" ]]; then
    scoped_matches_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"marketId\":\"$marketId\",\"limit\":$PAGE_LIMIT,\"offset\":0}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetPredictionIntentMatches 2>/dev/null || printf '{}')
    scoped_rows=$(printf '%s\n' "$scoped_matches_json" | jq -r '(.matches // []) | length' 2>/dev/null || printf '0')
    if [[ "$scoped_rows" != "0" ]]; then
      printf 'Fallback: GetPredictionIntentMatches returned %s row(s) for market %s.\n' "$scoped_rows" "$marketId"
      while IFS=$'\037' read -r s_market_id s_created_at s_tx1 s_qty1 s_tx2 s_qty2 s_price1 s_price2; do
        [[ -z "$s_market_id" ]] && continue
        printf '%-15s %-36s %-20s %-8s %-36s %-36s %12s %10s %-6s %-10s\n' \
          "${tx_account_map[$s_tx1]:-${tx_account_map[$s_tx2]:-<unknown>}}" \
          "$s_market_id" \
          "$(format_utc_timestamp "$s_created_at")" \
          "" \
          "${s_tx1}" \
          "<match-via-market-scope>" \
          "$(awk -v v="${s_qty1:-0}" 'BEGIN { printf "%.4f", v + 0 }')" \
          "$(awk -v v="${s_price1:-0}" 'BEGIN { printf "%.3f", v + 0 }')" \
          "$(awk -v v="${s_price1:-0}" 'BEGIN { if (v + 0 < 0) print "SELL"; else print "BUY" }')" \
          "?"
      done < <(printf '%s\n' "$scoped_matches_json" | jq -r '
        .matches[]?
        | [
            .marketId,
            (.createdAt // .created_at // ""),
            .txId1,
            .qty1,
            .txId2,
          .qty2,
          (.priceUsd1 // ""),
          (.priceUsd2 // "")
          ]
        | map(tostring)
        | join("\u001f")
      ')
      matched_rows=$((matched_rows + 1))
    fi
  fi

  if [[ $matched_rows -eq 0 ]]; then
    printf 'No matched orders found from grpc endpoints for the selected scope.\n'
    if [[ $matches_fetch_failed -eq 1 ]]; then
      printf 'Hint: GetAllMatches returned no payload or failed on this endpoint.\n'
    elif [[ $matches_rows_total -eq 0 ]]; then
      printf 'Hint: GetAllMatches returned zero matches on this endpoint/network.\n'
    fi

    if [[ $intents_fetch_failed -eq 1 ]]; then
      printf 'Hint: GetAllPredictionIntents returned no payload or failed on this endpoint.\n'
    fi

    if [[ -n "$marketId" ]]; then
      printf 'Hint: market-scoped GetPredictionIntentMatches also returned no rows for marketId=%s.\n' "$marketId"
    fi
  fi
fi
