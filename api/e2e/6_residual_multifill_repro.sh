#!/bin/bash

# Residual multi-fill reproduction harness.
#
# This script submits a resting order, then a smaller opposing take, then a
# larger opposing take against the residual. It prints the observed match
# quantities and portfolio deltas so the residual over-settlement behavior can
# be inspected directly from api/e2e.
#
# Intended use:
#   ./api/e2e/6_residual_multifill_repro.sh
#
# Prereqs:
# - .env with 1_ACCOUNT_ID, 1_PRIVATE_KEY, 1_KEY_TYPE and 2_ACCOUNT_ID, 2_PRIVATE_KEY, 2_KEY_TYPE
# - hcli, easyrpc, curl, jq, ts-node installed
# - funded Hedera accounts and allowance for the target market

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$API_DIR/proto"
ENV_FILE="$SCRIPT_DIR/.env"
SCS_DIR="$(cd "$API_DIR/.." && pwd)/scs"

if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env file not found at $ENV_FILE"
  exit 1
fi

if [[ ! -d "$PROTO_DIR" ]]; then
  echo "proto directory not found at $PROTO_DIR"
  exit 1
fi

for bin in easyrpc curl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "$bin could not be found. Please install it before running this script."
    exit 1
  fi
done

ts_node_bin="$SCS_DIR/node_modules/.bin/ts-node"
if [[ ! -x "$ts_node_bin" ]]; then
  echo "ts-node could not be found at $ts_node_bin. Install scs dependencies first."
  exit 1
fi

rpc_call() {
  local rpc_name="$1"
  local rpc_payload="$2"
  local response

  if ! response=$(easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" -a "$grpc_addr" -d "$rpc_payload" -i "$PROTO_DIR" -p api.proto "$rpc_name" 2>&1); then
    echo "RPC call failed: $rpc_name"
    echo "Payload: $rpc_payload"
    echo "Response:"
    printf '%s\n' "$response"
    return 1
  fi

  printf '%s\n' "$response"
}

rpc_call_retry() {
  local rpc_name="$1"
  local rpc_payload="$2"
  local max_attempts="${3:-8}"
  local attempt
  local response

  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    echo "$rpc_name attempt $attempt/$max_attempts..." >&2
    if response=$(rpc_call "$rpc_name" "$rpc_payload" 2>&1); then
      echo "$rpc_name succeeded on attempt $attempt/$max_attempts" >&2
      printf '%s\n' "$response"
      return 0
    fi

    if (( attempt < max_attempts )); then
      echo "Warning: $rpc_name transient failure on attempt $attempt/$max_attempts. Retrying..." >&2
      sleep 2
    fi
  done

  printf '%s\n' "$response"
  return 1
}

portfolio_snapshot() {
  local portfolio_json="$1"
  local evm_address="$2"

  printf '%s\n' "$portfolio_json" | jq -c --arg m "$marketId" --arg evm "$evm_address" '
    {
      evm: $evm,
      yes_raw: ((.positions[$m].position.yes // 0) | tonumber),
      no_raw: ((.positions[$m].position.no // 0) | tonumber),
      open_txs: (.openPredictionIntents[$m].openPredictionIntents // [] | map(.txId) | map(select(. != null and . != ""))),
      matched_txs: (.matchedPredictionIntents[$m].matchedPredictionIntents // [] | map(.txId) | map(select(. != null and . != "")))
    }
  '
}

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

resolve_evm_address() {
  local account_id="$1"
  local mirror_base="$2"
  local account_json
  account_json=$(curl -sfL "$mirror_base/api/v1/accounts/$account_id") || return 1
  printf '%s\n' "$account_json" | sed -n 's/.*"evm_address"[[:space:]]*:[[:space:]]*"0x\{0,1\}\([0-9a-fA-F]\{40\}\)".*/\1/p' | head -n 1 | tr 'A-F' 'a-f'
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

fetch_user_portfolio_json() {
  local evm_address="$1"
  rpc_call_retry "api.ApiServicePublic.GetUserPortfolio" "{\"evmAddress\":\"$evm_address\",\"net\":\"$network\",\"marketId\":\"$marketId\"}"
}

fetch_matches_json() {
  rpc_call_retry "api.ApiServicePublic.GetPredictionIntentMatches" "{\"marketId\":\"$marketId\",\"limit\":100,\"offset\":0}"
}

snapshot_yes_raw() {
  local portfolio_json="$1"
  printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '(.positions[$m].position.yes // 0)'
}

snapshot_no_raw() {
  local portfolio_json="$1"
  printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '(.positions[$m].position.no // 0)'
}

snapshot_open_count() {
  local portfolio_json="$1"
  printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '(.openPredictionIntents[$m].openPredictionIntents // []) | length'
}

snapshot_matched_count() {
  local portfolio_json="$1"
  printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" '(.matchedPredictionIntents[$m].matchedPredictionIntents // []) | length'
}

snapshot_open_qty_for_tx() {
  local portfolio_json="$1"
  local tx_id="$2"

  printf '%s\n' "$portfolio_json" | jq -r --arg m "$marketId" --arg tx "$tx_id" '
    [(.openPredictionIntents[$m].openPredictionIntents // [])[]? | select(.txId == $tx) | (.qty | tonumber)]
    | if length == 0 then 0 else add end
  '
}

wait_for_open_qty_for_tx() {
  local evm_address="$1"
  local tx_id="$2"
  local expected_qty="$3"
  local max_attempts="${4:-12}"
  local attempt
  local portfolio_json
  local actual_qty

  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    portfolio_json=$(fetch_user_portfolio_json "$evm_address")
    actual_qty=$(snapshot_open_qty_for_tx "$portfolio_json" "$tx_id")
    if awk -v actual="$actual_qty" -v expected="$expected_qty" 'BEGIN { diff = actual - expected; if (diff < 0) diff = -diff; exit !(diff <= 0.000001) }'; then
      printf '%s\n' "$actual_qty"
      return 0
    fi
    sleep 2
  done

  printf '%s\n' "$actual_qty"
  return 1
}

marketId_default="$(env_get "MARKET_ID")"
if [[ -n "$marketId_default" ]]; then
  read -p "Enter the marketId (UUID7) [$marketId_default]: " marketId
  marketId=${marketId:-$marketId_default}
else
  read -p "Enter the marketId (UUID7): " marketId
fi

net_from_env="$(env_get "NET")"
enviro_from_env="$(env_get "ENVIRO")"
network="$(printf '%s' "${net_from_env:-testnet}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
enviro="$(printf '%s' "${enviro_from_env:-dev}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
base_url_default="https://${network}.${enviro}.prism.market"
read -r -p "Enter the Prism base URL [$base_url_default]: " base_url
base_url="${base_url:-$base_url_default}"
grpc_addr="${base_url#*://}"
grpc_addr="${grpc_addr%%/}"
grpc_flags=(-w)
grpc_meta=()
if [[ "$base_url" == https://* ]]; then
  grpc_flags=(-w --tls)
  if [[ "$grpc_addr" != *:* ]]; then
    grpc_addr="${grpc_addr}:443"
  fi
elif [[ "$grpc_addr" != *:* ]]; then
  grpc_addr="${grpc_addr}:8888"
fi

if [[ ! $marketId =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "Invalid marketId format. Please provide a valid UUID7."
  exit 1
fi

mapfile -t account_ids < <(printf '%s\n' 1_ACCOUNT_ID 2_ACCOUNT_ID | while read -r key; do env_get "$key"; done)
mapfile -t private_keys < <(printf '%s\n' 1_PRIVATE_KEY 2_PRIVATE_KEY | while read -r key; do env_get "$key"; done)
mapfile -t key_types < <(printf '%s\n' 1_KEY_TYPE 2_KEY_TYPE | while read -r key; do env_get "$key"; done)
mirror_base="https://${network}.mirrornode.hedera.com"

if [[ -z "${account_ids[0]:-}" || -z "${account_ids[1]:-}" ]]; then
  echo "1_ACCOUNT_ID and 2_ACCOUNT_ID must be set in .env"
  exit 1
fi

for idx in 0 1; do
  if [[ -z "${private_keys[$idx]:-}" ]]; then
    echo "Missing private key for account index $idx in .env"
    exit 1
  fi
  if [[ -z "${key_types[$idx]:-}" ]]; then
    echo "Missing key type for account index $idx in .env"
    exit 1
  fi
done

evm_a=$(resolve_evm_address "${account_ids[0]}" "$mirror_base")
evm_b=$(resolve_evm_address "${account_ids[1]}" "$mirror_base")
if [[ -z "$evm_a" || -z "$evm_b" ]]; then
  echo "Failed to resolve EVM addresses via mirror node"
  exit 1
fi

price=0.05
rest_qty=1.0
partial_qty=0.4
second_qty=1.0

cat <<EOF
Residual repro target
  marketId: $marketId
  baseUrl:   $base_url
  A:         ${account_ids[0]}
  B:         ${account_ids[1]}
  price:     $price
  sequence:  rest 1.0, take 0.4, take 1.0
EOF

before_a=$(fetch_user_portfolio_json "$evm_a")
before_b=$(fetch_user_portfolio_json "$evm_b")
before_a_yes_raw=$(snapshot_yes_raw "$before_a")
before_b_no_raw=$(snapshot_no_raw "$before_b")

rest=$(create_prediction_intent 0 "$price" "$rest_qty" "p")
rest_tx=$(printf '%s\n' "$rest" | jq -r '.txId // empty')
rest_err=$(printf '%s\n' "$rest" | jq -r '.errorCode // ""')
rest_msg=$(printf '%s\n' "$rest" | jq -r '.message // ""')
echo "rest tx=$rest_tx err=$rest_err msg=$rest_msg"
sleep 3

after_rest_a=$(fetch_user_portfolio_json "$evm_a")
after_rest_b=$(fetch_user_portfolio_json "$evm_b")
after_rest_a_open=$(snapshot_open_count "$after_rest_a")
after_rest_a_matched=$(snapshot_matched_count "$after_rest_a")
after_rest_b_open=$(snapshot_open_count "$after_rest_b")
after_rest_b_matched=$(snapshot_matched_count "$after_rest_b")
after_rest_a_yes_raw=$(snapshot_yes_raw "$after_rest_a")
after_rest_b_no_raw=$(snapshot_no_raw "$after_rest_b")

partial=$(create_prediction_intent 1 "-$price" "$partial_qty" "p")
partial_tx=$(printf '%s\n' "$partial" | jq -r '.txId // empty')
partial_err=$(printf '%s\n' "$partial" | jq -r '.errorCode // ""')
partial_msg=$(printf '%s\n' "$partial" | jq -r '.message // ""')
echo "partial tx=$partial_tx err=$partial_err msg=$partial_msg"
sleep 8

after_partial_a=$(fetch_user_portfolio_json "$evm_a")
after_partial_b=$(fetch_user_portfolio_json "$evm_b")
after_partial_a_open=$(snapshot_open_count "$after_partial_a")
after_partial_a_matched=$(snapshot_matched_count "$after_partial_a")
after_partial_b_open=$(snapshot_open_count "$after_partial_b")
after_partial_b_matched=$(snapshot_matched_count "$after_partial_b")
after_partial_a_yes_raw=$(snapshot_yes_raw "$after_partial_a")
after_partial_b_no_raw=$(snapshot_no_raw "$after_partial_b")

second=$(create_prediction_intent 1 "-$price" "$second_qty" "p")
second_tx=$(printf '%s\n' "$second" | jq -r '.txId // empty')
second_err=$(printf '%s\n' "$second" | jq -r '.errorCode // ""')
second_msg=$(printf '%s\n' "$second" | jq -r '.message // ""')
echo "second tx=$second_tx err=$second_err msg=$second_msg"
sleep 10

after_second_a=$(fetch_user_portfolio_json "$evm_a")
after_second_b=$(fetch_user_portfolio_json "$evm_b")
after_second_a_open=$(snapshot_open_count "$after_second_a")
after_second_a_matched=$(snapshot_matched_count "$after_second_a")
after_second_b_open=$(snapshot_open_count "$after_second_b")
after_second_b_matched=$(snapshot_matched_count "$after_second_b")
after_second_a_yes_raw=$(snapshot_yes_raw "$after_second_a")
after_second_b_no_raw=$(snapshot_no_raw "$after_second_b")
after_second_rest_open_qty=$(snapshot_open_qty_for_tx "$after_second_a" "$rest_tx")
after_second_second_open_qty=$(snapshot_open_qty_for_tx "$after_second_b" "$second_tx")

if ! awk -v actual="$after_second_second_open_qty" -v expected="$partial_qty" 'BEGIN { diff = actual - expected; if (diff < 0) diff = -diff; exit !(diff <= 0.000001) }'; then
  echo "Waiting for second tx residual state..."
  after_second_second_open_qty=$(wait_for_open_qty_for_tx "$evm_b" "$second_tx" "$partial_qty" 12 || true)
  after_second_a=$(fetch_user_portfolio_json "$evm_a")
  after_second_b=$(fetch_user_portfolio_json "$evm_b")
  after_second_rest_open_qty=$(snapshot_open_qty_for_tx "$after_second_a" "$rest_tx")
  after_second_second_open_qty=$(snapshot_open_qty_for_tx "$after_second_b" "$second_tx")
fi

a_before_snapshot=$(portfolio_snapshot "$before_a" "$evm_a")
a_rest_snapshot=$(portfolio_snapshot "$after_rest_a" "$evm_a")
a_partial_snapshot=$(portfolio_snapshot "$after_partial_a" "$evm_a")
a_second_snapshot=$(portfolio_snapshot "$after_second_a" "$evm_a")
b_before_snapshot=$(portfolio_snapshot "$before_b" "$evm_b")
b_rest_snapshot=$(portfolio_snapshot "$after_rest_b" "$evm_b")
b_partial_snapshot=$(portfolio_snapshot "$after_partial_b" "$evm_b")
b_second_snapshot=$(portfolio_snapshot "$after_second_b" "$evm_b")

a_before_summary=$(printf '%s\n' "$a_before_snapshot" | jq -r '[.yes_raw, .no_raw, (.open_txs | length), (.matched_txs | length)] | @csv')
a_rest_summary=$(printf '%s\n' "$a_rest_snapshot" | jq -r '[.yes_raw, .no_raw, (.open_txs | length), (.matched_txs | length)] | @csv')
a_partial_summary=$(printf '%s\n' "$a_partial_snapshot" | jq -r '[.yes_raw, .no_raw, (.open_txs | length), (.matched_txs | length)] | @csv')
a_second_summary=$(printf '%s\n' "$a_second_snapshot" | jq -r '[.yes_raw, .no_raw, (.open_txs | length), (.matched_txs | length)] | @csv')
b_before_summary=$(printf '%s\n' "$b_before_snapshot" | jq -r '[.yes_raw, .no_raw, (.open_txs | length), (.matched_txs | length)] | @csv')
b_rest_summary=$(printf '%s\n' "$b_rest_snapshot" | jq -r '[.yes_raw, .no_raw, (.open_txs | length), (.matched_txs | length)] | @csv')
b_partial_summary=$(printf '%s\n' "$b_partial_snapshot" | jq -r '[.yes_raw, .no_raw, (.open_txs | length), (.matched_txs | length)] | @csv')
b_second_summary=$(printf '%s\n' "$b_second_snapshot" | jq -r '[.yes_raw, .no_raw, (.open_txs | length), (.matched_txs | length)] | @csv')

step1_expected_raw=$(awk -v p="$price" -v q="$partial_qty" 'BEGIN { printf "%.0f", (p * q) * 1000000 }')
step2_expected_residual_raw=$(awk -v p="$price" -v rest="$rest_qty" -v partial="$partial_qty" 'BEGIN { residual = rest - partial; if (residual < 0) residual = 0; printf "%.0f", (p * residual) * 1000000 }')
step2_expected_bug_raw=$(awk -v p="$price" -v q="$second_qty" 'BEGIN { printf "%.0f", (p * q) * 1000000 }')

step1_actual_raw=$(awk -v a="$after_partial_a_yes_raw" -v b="$after_rest_a_yes_raw" 'BEGIN { printf "%.0f", a - b }')
step2_actual_raw=$(awk -v a="$after_second_a_yes_raw" -v b="$after_partial_a_yes_raw" 'BEGIN { printf "%.0f", a - b }')

rest_open_after=$(printf '%s\n' "$after_second_a" | jq -r --arg m "$marketId" --arg tx "$rest_tx" '.openPredictionIntents[$m].openPredictionIntents[]? | select(.txId == $tx) | .txId' 2>/dev/null | head -n 1)

echo
echo "Portfolio summary (yes_raw,no_raw,open_count,matched_count)"
printf '  A before:   %s\n' "$a_before_summary"
printf '  A after 1:  %s\n' "$a_rest_summary"
printf '  A after 2:  %s\n' "$a_partial_summary"
printf '  A after 3:  %s\n' "$a_second_summary"
printf '  B before:   %s\n' "$b_before_summary"
printf '  B after 1:  %s\n' "$b_rest_summary"
printf '  B after 2:  %s\n' "$b_partial_summary"
printf '  B after 3:  %s\n' "$b_second_summary"

echo
echo "Residual verdict"
printf '  step1 actual raw: %s\n' "$step1_actual_raw"
printf '  step1 expected raw: %s\n' "$step1_expected_raw"
printf '  step2 actual raw: %s\n' "$step2_actual_raw"
printf '  step2 expected residual raw: %s\n' "$step2_expected_residual_raw"
printf '  step2 bug-shaped raw: %s\n' "$step2_expected_bug_raw"
printf '  rest open after final step: %s\n' "$after_second_rest_open_qty"
printf '  second tx open after final step: %s\n' "$after_second_second_open_qty"

if awk -v actual="$after_second_second_open_qty" -v expected="0" 'BEGIN { diff = actual - expected; if (diff < 0) diff = -diff; exit !(diff <= 0.000001) }'; then
  echo "BUG REPRODUCED: the second order closed out instead of leaving the residual open quantity."
  exit 0
fi

if awk -v actual="$after_second_second_open_qty" -v expected="$partial_qty" 'BEGIN { diff = actual - expected; if (diff < 0) diff = -diff; exit !(diff <= 0.000001) }'; then
  echo "NO BUG: the second order retained the expected residual open quantity."
  exit 1
fi

echo "INCONCLUSIVE: the second order did not resolve to either the expected residual or the bug shape."
exit 1
