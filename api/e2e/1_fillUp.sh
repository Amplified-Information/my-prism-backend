#!/bin/bash

# This script runs e2e tests for the API
# 0. pre-reqs - must have hcli, easyrpc installed and configured, must have a .env file with private keys and accountIds for the test wallets, must have at least 10 HBAR and 10 USDC in each wallet.
# 1. prompt the user to provide the marketId (must be a UUID7)
# 2. prompt user for the base url (e.g. https://testnet.dev.prism.market)
# 3. prompt the user for the dollar range [0.1, 0.2]
# 3a. prompt the user for the number of buy and sell orders to create (between 10 and 20 each)
# 4. read private keys from the .env file
# 5. ensure there is enough HBAR and USDC in each wallet to run the tests (at least 10 HBAR and 10 USDC). Also, ensure there is enough USDC spender allowance for the smart contract associated with the input marketId. If not, print a warning message and exit the script.
# 6. CreatePredictionIntents: fill up the orderbook with some orders (between 10 and 20 buys, between 10 and 20 sells). Choose a mid-market price at random (between 0.2 and 0.8 - e.g. 0.23).
# 7. GetUserPortfolio: foreach accountId, get the number of open orders (sitting on orderbook) and active positions (matched) 
# 8. Generate a state file to ./out/ for consumption by 2_reconcile.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$API_DIR/proto"
ENV_FILE="$SCRIPT_DIR/.env"
SCS_DIR="$(cd "$API_DIR/.." && pwd)/scs"
OUT_DIR="$SCRIPT_DIR/out"

mkdir -p "$OUT_DIR"


### 0 pre-reqs
# Check if hcli is installed
if ! command -v hcli &> /dev/null; then
    echo "hcli could not be found. Please install it before running this script."
    echo "Install with: npm install -g @hiero-ledger/hiero-cli"
    exit 1
fi

if ! command -v easyrpc &> /dev/null; then
  echo "easyrpc could not be found. Please install it before running this script."
  echo "https://github.com/heartandu/easyrpc"
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

ts_node_bin="$SCS_DIR/node_modules/.bin/ts-node"
if [[ ! -x "$ts_node_bin" ]]; then
  echo "ts-node could not be found at $ts_node_bin. Install scs dependencies first."
  exit 1
fi

if [[ ! -d "$PROTO_DIR" ]]; then
  echo "proto directory not found at $PROTO_DIR"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env file not found at $ENV_FILE"
  echo "Copy .env.example to .env and fill in the private keys and accountIds for the test wallets."
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









### 1
marketId_default=$(env_get "MARKET_ID")
if [[ -n "$marketId_default" ]]; then
  read -p "Enter the marketId (UUID7) [$marketId_default]: " marketId
  marketId=${marketId:-$marketId_default}
else
  read -p "Enter the marketId (UUID7): " marketId
  marketId=${marketId}
fi

orders_file="$OUT_DIR/fillup_orders_${marketId}.tsv"
orders_latest_file="$OUT_DIR/fillup_orders_latest.tsv"

# Validate the marketId format (UUID7)
if [[ ! $marketId =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "Invalid marketId format. Please provide a valid UUID7."
  exit 1
fi



### 2
net_from_env=$(env_get "NET")
enviro_from_env=$(env_get "ENVIRO")
net_from_env=$(printf '%s' "$net_from_env" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
enviro_from_env=$(printf '%s' "$enviro_from_env" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
net_from_env=${net_from_env:-testnet}
enviro_from_env=${enviro_from_env:-dev}
base_url_default="https://${net_from_env}.${enviro_from_env}.prism.market"

read -p "Enter the base URL [$base_url_default]: " baseUrl
baseUrl=${baseUrl:-$base_url_default}
echo "Base URL set to: $baseUrl"

network="$net_from_env"
case "$network" in
  testnet|previewnet|mainnet) ;;
  *) network="testnet" ;;
esac

grpc_addr="${baseUrl#*://}"
grpc_addr="${grpc_addr%%/}"
grpc_flags=(-w) # grpc-web
grpc_meta=()
if [[ -n "$basic_auth_user" || -n "$basic_auth_pass" ]]; then
  basic_auth_b64=$(printf '%s:%s' "$basic_auth_user" "$basic_auth_pass" | base64 | tr -d '\n')
  grpc_meta=(-H "authorization=Basic $basic_auth_b64")
fi
if [[ "$baseUrl" == https://* ]]; then
  grpc_flags=(-w --tls)
  if [[ "$grpc_addr" != *:* ]]; then
    grpc_addr="${grpc_addr}:443"
  fi
elif [[ "$grpc_addr" != *:* ]]; then
  grpc_addr="${grpc_addr}:8888"
fi

# Fail fast if grpc-web endpoint is blocked or unreachable.
echo "Preflight: checking grpc-web Health on $grpc_addr..."
if ! easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d '{}' -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.Health >/dev/null 2>&1; then
  echo "grpc-web preflight failed for $grpc_addr"
  echo "This edge is currently rejecting grpc-web POST calls (commonly HTTP 403)."
  echo "Use a reachable API grpc-web endpoint/ingress, or run against a local API endpoint."
  exit 1
fi

# Resolve spender smart contract and USDC token for compulsory allowance checks.
echo "Resolving spender and USDC token for allowance checks..."
market_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "{\"marketId\":\"$marketId\"}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetMarketById 2>/dev/null)
if [[ $? -ne 0 || -z "$market_json" ]]; then
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

network_upper=$(printf '%s' "$network" | tr '[:lower:]' '[:upper:]')
usdc_var_name="${network_upper}_USDC_ADDRESS"
usdc_token_id="${!usdc_var_name}"

if [[ -z "$usdc_token_id" ]]; then
  usdc_token_id=$(env_get "$usdc_var_name")
fi

if [[ -z "$usdc_token_id" ]]; then
  macro_json=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d '{}' -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.MacroMetadata 2>/dev/null)
  if [[ $? -ne 0 || -z "$macro_json" ]]; then
    echo "Error: failed to query MacroMetadata for USDC token id."
    exit 1
  fi
  usdc_token_id=$(printf '%s\n' "$macro_json" | jq -r --arg net "$network" '.usdcTokenIds[$net] // .usdc_token_ids[$net] // ""')
fi

if [[ -z "$usdc_token_id" ]]; then
  echo "Error: could not resolve USDC token id for network $network."
  echo "Set ${usdc_var_name} in the environment or ensure MacroMetadata.usdcTokenIds contains $network."
  exit 1
fi

if [[ ! "$usdc_token_id" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: invalid USDC token id '$usdc_token_id' for network $network."
  exit 1
fi

if [[ "$usdc_token_id" == "$spender_account_id" ]]; then
  echo "Error: resolved USDC token id equals spender smartContractId ($usdc_token_id)."
  echo "This indicates a bad USDC token lookup or server-side metadata misconfiguration."
  echo "Set ${usdc_var_name} in $ENV_FILE (or your shell env) to the correct Hedera USDC token id and retry."
  exit 1
fi

usdc_decimals="${USDC_DECIMALS:-6}"
mirror_base="https://${network}.mirrornode.hedera.com"
echo "Allowance checks will use spender $spender_account_id and token $usdc_token_id"



### 3
# get the dollar range from the user (e.g. 0.1, 0.2)
read -p "Enter the dollar range - min and max $ amount per PrismPredictionIntentRequest [0.1,0.2]: " dollar_range
dollar_range=${dollar_range:-0.1,0.2}
if [[ ! $dollar_range =~ ^[0-9]+(\.[0-9]+)?,[0-9]+(\.[0-9]+)?$ ]]; then
  echo "Invalid dollar range format. Please provide a valid range in the format 'min,max' (e.g. 0.1,0.2)."
  exit 1
fi
dollar_min=$(echo "$dollar_range" | cut -d ',' -f1)
dollar_max=$(echo "$dollar_range" | cut -d ',' -f2)
if (( $(echo "$dollar_min >= $dollar_max" | bc -l) )); then
  echo "Invalid dollar range: min ($dollar_min) must be less than max ($dollar_max)."
  exit 1
fi




### 3a
# Prompt the user for the number of buy and sell orders to create (between 1 and 20 each)
read -p "Enter the number of buy orders [3]: " buy_orders
buy_orders=${buy_orders:-3}
if (( buy_orders < 1 || buy_orders > 20 )); then
  echo "Invalid number of buy orders. Please provide a value between 1 and 20."
  exit 1
fi

read -p "Enter the number of sell orders [3]: " sell_orders
sell_orders=${sell_orders:-3}
if (( sell_orders < 1 || sell_orders > 20 )); then
  echo "Invalid number of sell orders. Please provide a value between 1 and 20."
  exit 1
fi





### 4
# Read private keys, accountIds and keyTypes from the .env file
# 0_... 1_... 2_... etc. (up to 9)
# once loaded, echo all the *_ACCOUNT_ID variables to the console, so the user can see which accounts are loaded.
declare -a private_keys
declare -a account_ids
declare -a key_types
declare -a hbar_balances
declare -a usdc_balances
declare -a allowances

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



### 5
# Ensure there is enough HBAR and USDC in each wallet to run the tests (at least 10 HBAR and 10 USDC)
# If not, print a warning message and exit the script.
for i in "${!account_ids[@]}"; do
  account_id="${account_ids[$i]}"
  if [[ -n "$account_id" ]]; then
    balance_output=$(hcli account balance -a "$account_id")

    # Check HBAR balance
    hbar_balance=$(printf '%s\n' "$balance_output" | sed -n 's/^.*Account Balance: \([0-9.][0-9.]*\) HBAR$/\1/p' | head -n 1)
    if [[ -z "$hbar_balance" ]]; then
      echo "Warning: Could not parse HBAR balance for account $account_id."
      exit 1
    fi
    hbar_balances[$i]="$hbar_balance"
    if (( $(echo "$hbar_balance < 10" | bc -l) )); then
      echo "Warning: Account $account_id has insufficient HBAR balance ($hbar_balance HBAR). At least 10 HBAR is required."
      exit 1
    fi

    # Check USDC balance
    usdc_balance=$(printf '%s\n' "$balance_output" | awk '/Balance: [0-9.]+ USDC/ { for (i = 1; i <= NF; i++) if ($i == "Balance:") sum += $(i + 1) } END { if (sum > 0) print sum; else print 0 }')
    usdc_balances[$i]="$usdc_balance"
    if (( $(echo "$usdc_balance < 10" | bc -l) )); then
      echo "Warning: Account $account_id has insufficient USDC balance ($usdc_balance USDC). At least 10 USDC is required."
      exit 1
    fi

    # Check USDC spender allowance on Mirror Node.
    allowance_url="$mirror_base/api/v1/accounts/$account_id/allowances/tokens?spender.id=eq:$spender_account_id&token.id=eq:$usdc_token_id"
    allowance_output=$(curl -sfL "$allowance_url")
    allowance_status=$?
    if [[ $allowance_status -ne 0 || -z "$allowance_output" ]]; then
      echo "Error: failed to query USDC allowance for account $account_id."
      echo "URL: $allowance_url"
      exit 1
    fi

    allowance_scaled=$(printf '%s\n' "$allowance_output" | sed -n 's/.*"amount"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -n 1)
    if [[ -z "$allowance_scaled" ]]; then
      allowance_scaled="0"
    fi
    allowance=$(awk -v raw="$allowance_scaled" -v dec="$usdc_decimals" 'BEGIN { printf "%.*f", dec, raw / (10 ^ dec) }')

    allowances[$i]="$allowance"
    if (( $(echo "$allowance < 10" | bc -l) )); then
      echo "Warning: Account $account_id has insufficient USDC allowance ($allowance USDC). At least 10 USDC is required."
      exit 1
    fi
  fi
done

# Print the HBAR and USDC balances + spending allowances for each account using the values already fetched above.
printf '\n%-15s %-8s %16s %16s %16s\n' "Account ID" "Key" "HBAR" "USDC" "Allowance"
printf '%-15s %-8s %16s %16s %16s\n' "----------" "---" "----" "----" "---------"
for i in "${!account_ids[@]}"; do
  printf '%-15s %-8s %16s %16s %16s\n' "${account_ids[$i]}" "${key_types[$i]}" "${hbar_balances[$i]}" "${usdc_balances[$i]}" "${allowances[$i]}"
done




### 6 
# CreatePredictionIntents: fill up the orderbook with orders from the account_ids
# order usd amount should be a value between the dollar range provided by the user
# make sure there are overlapping orders so that there are some matches

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

mid_price=$(awk -v seed="$RANDOM" 'BEGIN { srand(seed); printf "%.3f", 0.2 + rand() * 0.6 }')
# buy_orders=$((RANDOM % 11 + 10))
# sell_orders=$((RANDOM % 11 + 10))

# Force a minimum number of crossing buy/sell pairs so we get some matches.
overlap_pairs=2
if (( buy_orders < overlap_pairs )); then
  overlap_pairs=$buy_orders
fi
if (( sell_orders < overlap_pairs )); then
  overlap_pairs=$sell_orders
fi

random_order_usd() {
  awk -v min="$dollar_min" -v max="$dollar_max" -v seed="$RANDOM" 'BEGIN { srand(seed); printf "%.6f", min + rand() * (max - min) }'
}

qty_from_usd_and_price() {
  local usd_amount="$1"
  local price_usd="$2"
  awk -v usd="$usd_amount" -v p="$price_usd" 'BEGIN { if (p < 0) p = -p; if (p <= 0) { print "0"; exit 0 } printf "%.6f", usd / p }'
}

float_add() {
  local a="$1"
  local b="$2"
  awk -v x="$a" -v y="$b" 'BEGIN { printf "%.6f", x + y }'
}

calc_notional_usd() {
  local price_usd="$1"
  local qty="$2"
  awk -v p="$price_usd" -v q="$qty" 'BEGIN { if (p < 0) p = -p; printf "%.6f", p * q }'
}

append_submitted_order() {
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
    "$response_message" >> "$orders_file"
}

printf '\nSeeding orderbook for market %s on %s\n' "$marketId" "$network"
printf 'Mid price: %s | buys: %d | sells: %d\n\n' "$mid_price" "$buy_orders" "$sell_orders"
printf 'Forced crossing pairs: %d\n\n' "$overlap_pairs"

printf 'submitted_at\tseq\tside\taccount_index\taccount_id\tkey_type\tprice\tusd\tqty\tprimary_secondary\ttx_id\terror_code\tresponse_message\n' > "$orders_file"

created_orders=0
successful_submissions=0
loaded_indices=("${!account_ids[@]}")
loaded_indices_count=${#loaded_indices[@]}
declare -a submitted_qty_raw
declare -a submitted_notional_usd
declare -a submitted_order_count
declare -a submitted_success_order_count
declare -A submitted_tx_by_account

if [[ $loaded_indices_count -eq 0 ]]; then
  echo "No loaded account indices found."
  exit 1
fi

for ((n = 0; n < buy_orders; n++)); do
  echo "Creating BUY order $((n + 1))/$buy_orders..."
  account_index="${loaded_indices[$((n % loaded_indices_count))]}"
  if (( n < overlap_pairs )); then
    # Aggressive buys above mid to cross with aggressive sells below mid.
    offset=$(awk -v idx="$n" 'BEGIN { printf "%.3f", 0.020 + (idx * 0.010) }')
    price=$(awk -v mid="$mid_price" -v off="$offset" 'BEGIN { p = mid + off; if (p > 0.990) p = 0.990; if (p < 0.010) p = 0.010; printf "%.3f", p }')
  else
    # Resting buys around and below mid.
    offset=$(awk -v idx="$n" -v total="$buy_orders" -v forced="$overlap_pairs" 'BEGIN { spread = 0.08; denom = (total - forced); step = (denom > 1 ? spread / (denom - 1) : 0); rel = idx - forced; if (rel < 0) rel = 0; printf "%.3f", 0.01 + rel * step }')
    price=$(awk -v mid="$mid_price" -v off="$offset" 'BEGIN { p = mid - off; if (p > 0.990) p = 0.990; if (p < 0.010) p = 0.010; printf "%.3f", p }')
  fi
  order_usd=$(random_order_usd)
  qty=$(qty_from_usd_and_price "$order_usd" "$price")
  printf 'BUY  %-15s price=%6s usd=%s qty=%s\n' "${account_ids[$account_index]}" "$price" "$order_usd" "$qty"
  create_prediction_intent "$account_index" "$price" "$qty" "p" || exit 1
  notional_usd=$(calc_notional_usd "$price" "$qty")
  append_submitted_order "$((created_orders + 1))" "BUY" "$account_index" "$price" "$order_usd" "$qty" "p" "$CREATE_LAST_TX_ID" "$CREATE_LAST_ERROR_CODE" "$CREATE_LAST_MESSAGE"
  submitted_qty_raw[$account_index]=$(float_add "${submitted_qty_raw[$account_index]:-0}" "$qty")
  submitted_notional_usd[$account_index]=$(float_add "${submitted_notional_usd[$account_index]:-0}" "$notional_usd")
  submitted_order_count[$account_index]=$(( ${submitted_order_count[$account_index]:-0} + 1 ))
  if [[ "$CREATE_LAST_ERROR_CODE" == "0" && -n "$CREATE_LAST_TX_ID" ]]; then
    submitted_success_order_count[$account_index]=$(( ${submitted_success_order_count[$account_index]:-0} + 1 ))
    submitted_tx_by_account["$account_index|$CREATE_LAST_TX_ID"]=1
    successful_submissions=$((successful_submissions + 1))
  fi
  created_orders=$((created_orders + 1))
done

for ((n = 0; n < sell_orders; n++)); do
  echo "Creating SELL order $((n + 1))/$sell_orders..."
  account_index="${loaded_indices[$(((n + buy_orders) % loaded_indices_count))]}"
  if (( n < overlap_pairs )); then
    # Aggressive sells below mid so abs(sell) <= aggressive buy prices.
    offset=$(awk -v idx="$n" 'BEGIN { printf "%.3f", 0.020 + (idx * 0.010) }')
    abs_price=$(awk -v mid="$mid_price" -v off="$offset" 'BEGIN { p = mid - off; if (p > 0.990) p = 0.990; if (p < 0.010) p = 0.010; printf "%.3f", p }')
  else
    # Resting sells around and above mid.
    offset=$(awk -v idx="$n" -v total="$sell_orders" -v forced="$overlap_pairs" 'BEGIN { spread = 0.08; denom = (total - forced); step = (denom > 1 ? spread / (denom - 1) : 0); rel = idx - forced; if (rel < 0) rel = 0; printf "%.3f", 0.01 + rel * step }')
    abs_price=$(awk -v mid="$mid_price" -v off="$offset" 'BEGIN { p = mid + off; if (p > 0.990) p = 0.990; if (p < 0.010) p = 0.010; printf "%.3f", p }')
  fi
  price=$(awk -v ap="$abs_price" 'BEGIN { printf "%.3f", -1 * ap }')
  order_usd=$(random_order_usd)
  qty=$(qty_from_usd_and_price "$order_usd" "$price")
  printf 'SELL %-15s price=%6s usd=%s qty=%s\n' "${account_ids[$account_index]}" "$price" "$order_usd" "$qty"
  create_prediction_intent "$account_index" "$price" "$qty" "p" || exit 1
  notional_usd=$(calc_notional_usd "$price" "$qty")
  append_submitted_order "$((created_orders + 1))" "SELL" "$account_index" "$price" "$order_usd" "$qty" "p" "$CREATE_LAST_TX_ID" "$CREATE_LAST_ERROR_CODE" "$CREATE_LAST_MESSAGE"
  submitted_qty_raw[$account_index]=$(float_add "${submitted_qty_raw[$account_index]:-0}" "$qty")
  submitted_notional_usd[$account_index]=$(float_add "${submitted_notional_usd[$account_index]:-0}" "$notional_usd")
  submitted_order_count[$account_index]=$(( ${submitted_order_count[$account_index]:-0} + 1 ))
  if [[ "$CREATE_LAST_ERROR_CODE" == "0" && -n "$CREATE_LAST_TX_ID" ]]; then
    submitted_success_order_count[$account_index]=$(( ${submitted_success_order_count[$account_index]:-0} + 1 ))
    submitted_tx_by_account["$account_index|$CREATE_LAST_TX_ID"]=1
    successful_submissions=$((successful_submissions + 1))
  fi
  created_orders=$((created_orders + 1))
done

printf '\nCreated %d prediction intents against %s\n' "$created_orders" "$grpc_addr"






### 7
# GetUserPortfolio: foreach accountId, get the number of open orders (sitting on orderbook) and active positions (matched)
printf '\nFetching user portfolios...\n'

portfolio_failures=0
declare -a portfolio_failure_accounts

resolve_evm_address() {
  local account_id="$1"
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

total_submitted_accounts=0
total_open_accounts=0
total_matched_accounts=0

for i in "${!account_ids[@]}"; do
  account_id="${account_ids[$i]}"
  if [[ -n "$account_id" ]]; then
    evm_address=$(resolve_evm_address "$account_id")
    if [[ -z "$evm_address" ]]; then
      echo "Error: failed to resolve evmAddress for account $account_id via $mirror_base."
      portfolio_failures=$((portfolio_failures + 1))
      portfolio_failure_accounts+=("$account_id")
      continue
    fi

    portfolio_output=$(fetch_user_portfolio_json "$evm_address")
    portfolio_status=$?
    portfolio_json="$portfolio_output"
    if [[ $portfolio_status -ne 0 || -z "$portfolio_json" ]]; then
      echo "Error: failed to fetch portfolio for account $account_id (easyrpc exit=$portfolio_status)."
      if [[ -n "$portfolio_output" ]]; then
        printf '%s\n' "$portfolio_output" | tail -n 2
      fi
      portfolio_failures=$((portfolio_failures + 1))
      portfolio_failure_accounts+=("$account_id")
      continue
    fi

    portfolio_error_code=$(printf '%s\n' "$portfolio_json" | jq -r '.errorCode // ""' 2>/dev/null)
    if [[ -n "$portfolio_error_code" && "$portfolio_error_code" != "0" ]]; then
      portfolio_message=$(printf '%s\n' "$portfolio_json" | jq -r '.message // ""' 2>/dev/null)
      echo "Error: failed to fetch portfolio for account $account_id (errorCode=$portfolio_error_code message='$portfolio_message')."
      portfolio_failures=$((portfolio_failures + 1))
      portfolio_failure_accounts+=("$account_id")
      continue
    fi

    declare -A open_tx_ids
    while IFS= read -r open_tx_id; do
      [[ -z "$open_tx_id" ]] && continue
      open_tx_ids["$open_tx_id"]=1
    done < <(printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '.openPredictionIntents[$m].openPredictionIntents[]?.txId // empty')

    run_submitted="${submitted_success_order_count[$i]:-0}"
    run_open_orders=0
    for tx_key in "${!submitted_tx_by_account[@]}"; do
      [[ "$tx_key" != "$i|"* ]] && continue
      tx_id="${tx_key#${i}|}"
      if [[ -n "${open_tx_ids[$tx_id]:-}" ]]; then
        run_open_orders=$((run_open_orders + 1))
      fi
    done
    run_matched_orders=$(( run_submitted - run_open_orders ))
    if (( run_matched_orders < 0 )); then
      run_matched_orders=0
    fi

    total_submitted_accounts=$((total_submitted_accounts + run_submitted))
    total_open_accounts=$((total_open_accounts + run_open_orders))
    total_matched_accounts=$((total_matched_accounts + run_matched_orders))

    printf 'Account %s: submitted=%d, open orders=%d, matched=%d\n' "$account_id" "$run_submitted" "$run_open_orders" "$run_matched_orders"
  fi
done

if (( portfolio_failures > 0 )); then
  echo
  echo "Portfolio fetch completed with $portfolio_failures failure(s): ${portfolio_failure_accounts[*]}"
fi

echo
echo "Order accounting totals:"
echo "- attempted submissions: $created_orders"
echo "- successful submissions: $successful_submissions"
echo "- per-account submitted total: $total_submitted_accounts"
echo "- per-account open total: $total_open_accounts"
echo "- per-account matched total: $total_matched_accounts"

if (( total_submitted_accounts != successful_submissions )); then
  echo "PANIC: accounting mismatch (per-account submitted total $total_submitted_accounts != successful submissions $successful_submissions)."
  exit 1
fi

if (( (total_open_accounts + total_matched_accounts) != total_submitted_accounts )); then
  echo "PANIC: accounting mismatch (open + matched = $((total_open_accounts + total_matched_accounts)) != submitted $total_submitted_accounts)."
  exit 1
fi

printf '\033[32m✅\033[0m All submitted orders are accounted for: %s = %s open + %s matched.\n' "$total_submitted_accounts" "$total_open_accounts" "$total_matched_accounts"
echo

### 8 state file
echo "Finally, creating a state file..."
# Persist this run so 2_reconcile.sh can run independently.
state_file="$OUT_DIR/fillup_state_${marketId}.env"
latest_state_file="$OUT_DIR/fillup_state_latest.env"
summary_file="$OUT_DIR/fillup_summary_${marketId}.tsv"

{
  printf 'run_timestamp=%q\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'grpc_addr=%q\n' "$grpc_addr"
  printf 'usdc_decimals=%q\n' "$usdc_decimals"
  printf 'proto_dir=%q\n' "$PROTO_DIR"
  printf 'mirror_base=%q\n' "$mirror_base"
  printf 'orders_file=%q\n' "$orders_file"
  printf 'loaded_indices=%q\n' "${loaded_indices[*]}"

  for i in "${!account_ids[@]}"; do
    printf 'account_id_%s=%q\n' "$i" "${account_ids[$i]}"
    printf 'key_type_%s=%q\n' "$i" "${key_types[$i]}"
    printf 'submitted_order_count_%s=%q\n' "$i" "${submitted_order_count[$i]:-0}"
    printf 'submitted_qty_raw_%s=%q\n' "$i" "${submitted_qty_raw[$i]:-0}"
    printf 'submitted_notional_usd_%s=%q\n' "$i" "${submitted_notional_usd[$i]:-0}"
  done
} > "$state_file"

ln -sfn "$(basename "$state_file")" "$latest_state_file"
ln -sfn "$(basename "$orders_file")" "$orders_latest_file"

{
  printf 'account_id\tkey_type\torders\tsubmitted_qty\tsubmitted_usd\n'
  for i in "${!account_ids[@]}"; do
    printf '%s\t%s\t%s\t%s\t%s\n' \
      "${account_ids[$i]}" \
      "${key_types[$i]}" \
      "${submitted_order_count[$i]:-0}" \
      "${submitted_qty_raw[$i]:-0}" \
      "${submitted_notional_usd[$i]:-0}"
  done
} > "$summary_file"

echo "Saved run state: $state_file"
echo "Updated latest state symlink: $latest_state_file -> $(basename "$state_file")"
echo "Saved order ledger: $orders_file"
echo "Updated latest order symlink: $orders_latest_file -> $(basename "$orders_file")"
echo "Saved run summary: $summary_file"

