#!/bin/bash

# Query getUserTokens for all X_ACCOUNT_ID entries in .env.
# Output: accountId + YES token count + NO token count for the input marketId.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO_DIR="$API_DIR/proto"
ENV_FILE="$SCRIPT_DIR/.env"
SCS_DIR="$(cd "$API_DIR/.." && pwd)/scs"
GET_TOKENS_SCRIPT="$SCS_DIR/scripts/3_getUserTokens.ts"
REDEEM_SCRIPT="$SCS_DIR/scripts/6_redeem.ts"
TS_NODE_BIN="$SCS_DIR/node_modules/.bin/ts-node"

if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env file not found at $ENV_FILE"
  exit 1
fi

if [[ ! -d "$PROTO_DIR" ]]; then
  echo "proto directory not found at $PROTO_DIR"
  exit 1
fi

if [[ ! -x "$TS_NODE_BIN" ]]; then
  echo "ts-node could not be found at $TS_NODE_BIN. Install scs dependencies first."
  exit 1
fi

if [[ ! -f "$GET_TOKENS_SCRIPT" ]]; then
  echo "getUserTokens script not found at $GET_TOKENS_SCRIPT"
  exit 1
fi

if [[ ! -f "$REDEEM_SCRIPT" ]]; then
  echo "redeem script not found at $REDEEM_SCRIPT"
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

normalize_key_type() {
  local raw="$1"
  local upper
  upper=$(printf '%s' "$raw" | tr '[:lower:]' '[:upper:]')
  case "$upper" in
    ECDSA|ECDSA_SECP256K1) printf 'ecdsa\n' ;;
    ED|ED25519) printf 'ed25519\n' ;;
    *) printf '\n' ;;
  esac
}

find_account_slot() {
  local target_account="$1"
  local slot
  for slot in "${account_slots[@]}"; do
    if [[ "$(env_get "${slot}_ACCOUNT_ID")" == "$target_account" ]]; then
      printf '%s\n' "$slot"
      return 0
    fi
  done
  return 1
}

format_units_6() {
  local raw="$1"
  local n_decimals=6
  local value
  value="${raw:-0}"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    printf 'ERR\n'
    return 0
  fi
  if (( ${#value} <= n_decimals )); then
    local padded
    padded=$(printf "%0${n_decimals}d" "$value")
    printf '0.%s\n' "$padded" | sed -E 's/(\.[0-9]*[1-9])0+$/\1/; s/\.0+$/\.0/'
  else
    local int_part frac_part
    int_part=${value:0:${#value}-n_decimals}
    frac_part=${value:${#value}-n_decimals}
    printf '%s.%s\n' "$int_part" "$frac_part" | sed -E 's/(\.[0-9]*[1-9])0+$/\1/; s/\.0+$/\.0/'
  fi
}

read -p "Enter marketId to query: " marketId
if [[ -z "$marketId" ]]; then
  echo "marketId is required"
  exit 1
fi

if [[ ! $marketId =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "Invalid marketId format."
  exit 1
fi

read -p "Enter network [testnet]: " network
network=${network:-testnet}
network_lower=$(printf '%s' "$network" | tr '[:upper:]' '[:lower:]')
case "$network_lower" in
  testnet|previewnet|mainnet) ;;
  *)
    echo "Invalid network '$network'. Use one of: testnet, previewnet, mainnet."
    exit 1
    ;;
esac
network="$network_lower"
network_upper=$(printf '%s' "$network" | tr '[:lower:]' '[:upper:]')

read -p "Enter base URL [https://testnet.dev.prism.market]: " baseUrl
baseUrl=${baseUrl:-https://testnet.dev.prism.market}

grpc_addr="${baseUrl#*://}"
grpc_addr="${grpc_addr%%/}"
grpc_flags=(-w)
if [[ "$baseUrl" == https://* ]]; then
  grpc_flags=(-w --tls)
  if [[ "$grpc_addr" != *:* ]]; then
    grpc_addr="${grpc_addr}:443"
  fi
elif [[ "$grpc_addr" != *:* ]]; then
  grpc_addr="${grpc_addr}:8888"
fi

if ! easyrpc c "${grpc_flags[@]}" -a "$grpc_addr" -d '{}' -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.Health >/dev/null 2>&1; then
  echo "grpc-web preflight failed for $grpc_addr"
  exit 1
fi

market_json=$(easyrpc c "${grpc_flags[@]}" -a "$grpc_addr" -d "{\"marketId\":\"$marketId\"}" -i "$PROTO_DIR" -p api.proto api.ApiServicePublic.GetMarketById 2>/dev/null)
if [[ -z "$market_json" ]]; then
  echo "Error: GetMarketById returned empty response for marketId $marketId"
  exit 1
fi


contract_id=$(printf '%s\n' "$market_json" | jq -r '.smartContractId // .smartContractID // .contractId // .contractID // ""')
if [[ -z "$contract_id" || "$contract_id" == "null" ]]; then
  echo "Error: failed to resolve smartContractId from GetMarketById"
  exit 1
fi

if [[ ! $contract_id =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: invalid smartContractId '$contract_id' from GetMarketById"
  exit 1
fi

mapfile -t account_slots < <(awk -F '=' '/^[0-9]+_ACCOUNT_ID=/ {split($1,a,"_"); print a[1]}' "$ENV_FILE" | sort -n -u)
if [[ ${#account_slots[@]} -eq 0 ]]; then
  echo "No X_ACCOUNT_ID entries found in $ENV_FILE"
  exit 1
fi

declare -a account_ids=()
for slot in "${account_slots[@]}"; do
  aid=$(env_get "${slot}_ACCOUNT_ID")
  if [[ "$aid" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    account_ids+=("$aid")
  fi
done

if [[ ${#account_ids[@]} -eq 0 ]]; then
  echo "No valid account IDs found in $ENV_FILE"
  exit 1
fi

operator_slot=""
for slot in "${account_slots[@]}"; do
  op_id=$(env_get "${slot}_ACCOUNT_ID")
  op_key=$(env_get "${slot}_PRIVATE_KEY")
  op_key_type_raw=$(env_get "${slot}_KEY_TYPE")
  op_key_type=$(normalize_key_type "$op_key_type_raw")
  if [[ -n "$op_id" && -n "$op_key" && -n "$op_key_type" ]]; then
    operator_slot="$slot"
    break
  fi
done

if [[ -z "$operator_slot" ]]; then
  echo "Could not find an operator in $ENV_FILE with ACCOUNT_ID, PRIVATE_KEY, and KEY_TYPE"
  exit 1
fi




echo "Getting position token balances (on-chain) for each account (marketId=$marketId)..."

operator_id=$(env_get "${operator_slot}_ACCOUNT_ID")
operator_key=$(env_get "${operator_slot}_PRIVATE_KEY")
operator_key_type=$(normalize_key_type "$(env_get "${operator_slot}_KEY_TYPE")")

export HEDERA_NETWORK_SELECTED="$network"
export "${network_upper}_HEDERA_OPERATOR_ID=$operator_id"
export "${network_upper}_HEDERA_OPERATOR_KEY=$operator_key"
export "${network_upper}_HEDERA_OPERATOR_KEY_TYPE=$operator_key_type"
export "${network_upper}_SMART_CONTRACT_ID=$contract_id"

printf '\n%-15s %-30s %-30s\n' "Account ID" "YES" "NO"
printf '%-15s %-30s %-30s\n' "----------" "---" "--"

total_yes=0
total_no=0

for account_id in "${account_ids[@]}"; do
  output=$("$TS_NODE_BIN" "$GET_TOKENS_SCRIPT" "$marketId" "$account_id" 2>&1 || true)
  line=$(printf '%s\n' "$output" | grep '=> yes=' | tail -n1 || true)

  if [[ -n "$line" ]]; then
    yes=$(printf '%s\n' "$line" | sed -E 's/.*yes=([^,]+), no=.*/\1/')
    no=$(printf '%s\n' "$line" | sed -E 's/.*no=([^ ]+).*/\1/')
    if [[ "$yes" =~ ^[0-9]+$ ]]; then
      total_yes=$((total_yes + yes))
    fi
    if [[ "$no" =~ ^[0-9]+$ ]]; then
      total_no=$((total_no + no))
    fi
    printf '%-15s %-30s %-30s\n' "$account_id" "$yes" "$no"
  else
    printf '%-15s %-30s %-30s\n' "$account_id" "ERR" "ERR"
  fi
done

printf '%-15s %-30s %-30s\n' "----------" "---" "--"
printf '%-15s %-30s %-30s\n' "TOTAL" "$total_yes" "$total_no"








### is market resolved?

resolved_at=$(printf '%s\n' "$market_json" | jq -r '.resolvedAt // .resolved_at // ""')
is_suspended=$(printf '%s\n' "$market_json" | jq -r '.isSuspended // .is_suspended // false')
closes_at=$(printf '%s\n' "$market_json" | jq -r '.closesAt // .closes_at // ""')
outcome=$(printf '%s\n' "$market_json" | jq -r '.outcome // "null"')
rake_percent=$(printf '%s\n' "$market_json" | jq -r '.rakePercent // .rake_percent // 2')
if [[ ! "$rake_percent" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  rake_percent="2"
fi

if [[ "$is_suspended" == "true" ]]; then
  echo "Market is not resolvable: market is suspended"
  exit 1
fi

if [[ -n "$resolved_at" && "$resolved_at" != "null" ]]; then
  echo "-> Market is resolved. Resolved at $resolved_at"
else
  echo "Market is not yet resolved. Cannot claim. Market closes at $closes_at"
  exit 1
fi







### get total collateral for the market (on-chain)
# call Solidity: getTotalCollateral(marketId)
echo "Retrieving the collateral currently in the smart contract ($contract_id) for marketId=$marketId..."

tmp_ts="$SCS_DIR/scripts/.tmp_total_collateral.ts"
cat > "$tmp_ts" <<'TS'
import { ContractCallQuery, ContractFunctionParameters, ContractId } from '@hashgraph/sdk'
import { initHederaClient } from './lib/hedera.ts'

const [client] = initHederaClient()

const toUint128 = (uuid: string): bigint => {
  const hex = uuid.replace(/-/g, '')
  if (hex.length !== 32) {
    throw new Error('Invalid marketId UUID format')
  }
  return BigInt('0x' + hex)
}

const main = async () => {
  const [contractId, marketId] = process.argv.slice(2)
  if (!contractId || !marketId) {
    throw new Error('Usage: ts-node totalCollateral.ts <contractId> <marketId>')
  }

  const marketIdBigInt = toUint128(marketId)
  const callUint = async (fnNames: string[]): Promise<string | null> => {
    for (const fnName of fnNames) {
      try {
        const params = new ContractFunctionParameters().addUint128(marketIdBigInt.toString())
        const result = await new ContractCallQuery()
          .setContractId(ContractId.fromString(contractId))
          .setGas(100_000)
          .setFunction(fnName, params)
          .execute(client)
        return result.getUint256(0).toString()
      } catch {
        // Try next known method signature.
      }
    }
    return null
  }

  const totalCollateral = await callUint(['totalCollateral', 'getTotalCollateral'])
  if (totalCollateral === null) {
    throw new Error('Unable to call total collateral function on contract')
  }
  console.log(`TOTAL_COLLATERAL=${totalCollateral}`)

  const totalYesOutstanding = await callUint(['totalYesTokensOutstanding'])
  if (totalYesOutstanding !== null) {
    console.log(`TOTAL_YES_OUTSTANDING=${totalYesOutstanding}`)
  }

  const totalNoOutstanding = await callUint(['totalNoTokensOutstanding'])
  if (totalNoOutstanding !== null) {
    console.log(`TOTAL_NO_OUTSTANDING=${totalNoOutstanding}`)
  }

  return
}

;(async () => {
  await main()
  process.exit(0)
})().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
TS

if command -v timeout >/dev/null 2>&1; then
  total_collateral_output=$(timeout 45s "$TS_NODE_BIN" "$tmp_ts" "$contract_id" "$marketId" 2>&1 || true)
else
  total_collateral_output=$("$TS_NODE_BIN" "$tmp_ts" "$contract_id" "$marketId" 2>&1 || true)
fi
rm -f "$tmp_ts"

total_collateral=$(printf '%s\n' "$total_collateral_output" | awk -F '=' '/^TOTAL_COLLATERAL=/{print $2; exit}')
total_yes_outstanding=$(printf '%s\n' "$total_collateral_output" | awk -F '=' '/^TOTAL_YES_OUTSTANDING=/{print $2; exit}')
total_no_outstanding=$(printf '%s\n' "$total_collateral_output" | awk -F '=' '/^TOTAL_NO_OUTSTANDING=/{print $2; exit}')
if [[ -z "$total_collateral" ]]; then
  echo "Failed to read totalCollateral from Solidity call"
  printf '%s\n' "$total_collateral_output"
  exit 1
fi

n_decimals=6
if [[ ! "$total_collateral" =~ ^[0-9]+$ ]]; then
  echo "Invalid totalCollateral value: $total_collateral"
  exit 1
fi

if (( ${#total_collateral} <= n_decimals )); then
  padded=$(printf "%0${n_decimals}d" "$total_collateral")
  total_collateral_scaled="0.${padded}"
else
  int_part=${total_collateral:0:${#total_collateral}-n_decimals}
  frac_part=${total_collateral:${#total_collateral}-n_decimals}
  total_collateral_scaled="${int_part}.${frac_part}"
fi

# Trim trailing zeros for cleaner display while preserving at least one decimal digit.
total_collateral_scaled=$(printf '%s\n' "$total_collateral_scaled" | sed -E 's/(\.[0-9]*[1-9])0+$/\1/; s/\.0+$/\.0/')

echo "totalCollateral($marketId) raw = $total_collateral"
echo "totalCollateral($marketId) = \$$total_collateral_scaled"
if [[ "$total_yes_outstanding" =~ ^[0-9]+$ ]]; then
  echo "totalYesTokensOutstanding($marketId) raw = $total_yes_outstanding"
fi
if [[ "$total_no_outstanding" =~ ^[0-9]+$ ]]; then
  echo "totalNoTokensOutstanding($marketId) raw = $total_no_outstanding"
fi











# if total_yes && total_no == 0, then no one can claim anything, so exit early
if [[ "$total_yes" -eq 0 && "$total_no" -eq 0 ]]; then
  printf "No YES or NO tokens exist for this market for the %d accountIds. No claims possible.\n" "${#account_ids[@]}"
  if [[ "$total_collateral" =~ ^[0-9]+$ && "$total_collateral" -gt 0 ]]; then
    echo
    echo "Note: totalCollateral is still non-zero."
    echo "With the current Prism.sol payout model, resolved winners should drain the market pot as they redeem."
    echo "A remaining balance here usually means some winning claims still belong to accounts not listed in .env,"
    echo "or the market has been abandoned and would need claimCollateralAfterOneYear() after the waiting period."
  fi
  exit 0
fi


echo "Continue to claim collateral for all the above accounts?? (y/N)"
read -r continue_input
continue_input=$(printf '%s' "$continue_input" | tr '[:upper:]' '[:lower:]')
if [[ "$continue_input" != "y" && "$continue_input" != "yes" ]]; then
  echo "Aborting."
  exit 1
fi










### claim collateral
# ensure the amount receieved (USD) by each account is equal to the totalCollateral (USD) in the smart contract (minus the 2% rake)
echo "Claiming collateral for each account..."
# loop through each account and call claimCollateral for each accountId
# call Solidity: redeem(marketId) - use the private key of each accountId to sign the transaction
# call Solidity: redeem(marketId)

declare -a claim_amounts_raw=()
total_received_raw=0

printf '\n%-15s %-10s %-18s %-18s\n' "Account ID" "Status" "Received(raw)" "Received(USD)"
printf '%-15s %-10s %-18s %-18s\n' "----------" "------" "-------------" "-------------"

for account_id in "${account_ids[@]}"; do
  slot=$(find_account_slot "$account_id" || true)
  if [[ -z "$slot" ]]; then
    printf '%-15s %-10s %-18s %-18s\n' "$account_id" "missing" "-" "-"
    continue
  fi

  account_key=$(env_get "${slot}_PRIVATE_KEY")
  account_key_type=$(normalize_key_type "$(env_get "${slot}_KEY_TYPE")")
  if [[ -z "$account_key" || -z "$account_key_type" ]]; then
    printf '%-15s %-10s %-18s %-18s\n' "$account_id" "bad-env" "-" "-"
    continue
  fi

  export "${network_upper}_HEDERA_OPERATOR_ID=$account_id"
  export "${network_upper}_HEDERA_OPERATOR_KEY=$account_key"
  export "${network_upper}_HEDERA_OPERATOR_KEY_TYPE=$account_key_type"

  if command -v timeout >/dev/null 2>&1; then
    redeem_output=$(timeout 60s "$TS_NODE_BIN" "$REDEEM_SCRIPT" "$contract_id" "$marketId" 2>&1 || true)
  else
    redeem_output=$("$TS_NODE_BIN" "$REDEEM_SCRIPT" "$contract_id" "$marketId" 2>&1 || true)
  fi
  received_raw=$(printf '%s\n' "$redeem_output" | sed -nE 's/.*amountUSDC[[:space:]]+recieved[[:space:]]*=[[:space:]]*([0-9]+).*/\1/p' | tail -n1)
  receipt_status=$(printf '%s\n' "$redeem_output" | sed -nE 's/.*Receipt status:[[:space:]]*([A-Z_]+).*/\1/p' | tail -n1)

  if [[ -n "$received_raw" && "$receipt_status" == "SUCCESS" ]]; then
    claim_amounts_raw+=("$received_raw")
    total_received_raw=$((total_received_raw + received_raw))
    received_usd=$(format_units_6 "$received_raw")
    printf '%-15s %-10s %-18s %-18s\n' "$account_id" "ok" "$received_raw" "\$$received_usd"
  else
    printf '%-15s %-10s %-18s %-18s\n' "$account_id" "fail" "-" "-"
    printf '%s\n' "$redeem_output" | tail -n 3
  fi
done

winner_label=""
expected_base_raw=0
tracked_winner_units_raw=0
winning_outstanding_raw=""
if [[ "$outcome" == "1" ]]; then
  winner_label="YES"
  expected_base_raw=$total_collateral
  tracked_winner_units_raw=$total_yes
  winning_outstanding_raw="$total_yes_outstanding"
elif [[ "$outcome" == "0" ]]; then
  winner_label="NO"
  expected_base_raw=$total_collateral
  tracked_winner_units_raw=$total_no
  winning_outstanding_raw="$total_no_outstanding"
elif [[ "$outcome" == "2" ]]; then
  winner_label="CANCELLED_50_50"
  expected_base_raw=$total_collateral
  tracked_winner_units_raw=$((total_yes + total_no))
  if [[ "$total_yes_outstanding" =~ ^[0-9]+$ && "$total_no_outstanding" =~ ^[0-9]+$ ]]; then
    winning_outstanding_raw=$((total_yes_outstanding + total_no_outstanding))
  fi
else
  echo "Unable to compute expected payout: unknown market outcome '$outcome'"
  exit 1
fi

expected_payout_raw=$(awk -v base="$expected_base_raw" -v rake="$rake_percent" 'BEGIN { v=base*(100-rake)/100; printf "%d", int(v+0.5) }')
expected_rake_raw=$((expected_base_raw - expected_payout_raw))

expected_tracked_base_raw=""
expected_tracked_payout_raw=""
if [[ "$winning_outstanding_raw" =~ ^[0-9]+$ && "$winning_outstanding_raw" -gt 0 && "$tracked_winner_units_raw" -ge 0 && "$tracked_winner_units_raw" -le "$winning_outstanding_raw" ]]; then
  if [[ "$tracked_winner_units_raw" -eq "$winning_outstanding_raw" ]]; then
    expected_tracked_base_raw=$total_collateral
  else
    expected_tracked_base_raw=$(awk -v total="$total_collateral" -v tracked="$tracked_winner_units_raw" -v denom="$winning_outstanding_raw" 'BEGIN { v=(total*tracked)/denom; printf "%d", int(v+0.5) }')
  fi
  expected_tracked_payout_raw=$(awk -v base="$expected_tracked_base_raw" -v rake="$rake_percent" 'BEGIN { v=base*(100-rake)/100; printf "%d", int(v+0.5) }')
fi

sum_tokens_raw=$((total_yes + total_no))
collateral_delta_raw=$((sum_tokens_raw - total_collateral))

assert_expected_payout_raw=$expected_payout_raw
assert_label="full market"
if [[ "$expected_tracked_payout_raw" =~ ^[0-9]+$ ]]; then
  assert_expected_payout_raw=$expected_tracked_payout_raw
  assert_label="tracked-account share"
fi

delta_raw=$((total_received_raw - assert_expected_payout_raw))
abs_delta_raw=$delta_raw
if (( abs_delta_raw < 0 )); then
  abs_delta_raw=$(( -abs_delta_raw ))
fi

rounding_tolerance_raw=2

echo
echo "Payout check"
echo "Outcome: $outcome ($winner_label)"
echo "Rake percent: $rake_percent"
echo "Total received raw: $total_received_raw"
total_received_usd=$(format_units_6 "$total_received_raw")
echo "Total received USD: \$$total_received_usd"
echo "Expected raw (full market collateral less rake): $expected_payout_raw"
expected_payout_usd=$(format_units_6 "$expected_payout_raw")
echo "Expected USD (full market collateral less rake): \$$expected_payout_usd"
if [[ "$expected_tracked_payout_raw" =~ ^[0-9]+$ ]]; then
  echo "Expected raw (tracked-account share less rake): $expected_tracked_payout_raw"
  expected_tracked_payout_usd=$(format_units_6 "$expected_tracked_payout_raw")
  echo "Expected USD (tracked-account share less rake): \$$expected_tracked_payout_usd"
fi

echo
echo "Accounting diagnostics"
echo "Sum YES+NO raw: $sum_tokens_raw"
echo "totalCollateral raw: $total_collateral"
echo "Token-vs-collateral delta raw: $collateral_delta_raw"
if [[ "$winning_outstanding_raw" =~ ^[0-9]+$ ]]; then
  echo "Winning outstanding raw (on-chain): $winning_outstanding_raw"
  echo "Tracked winner units raw: $tracked_winner_units_raw"
fi
echo "Expected rake raw: $expected_rake_raw"
expected_rake_usd=$(format_units_6 "$expected_rake_raw")
echo "Expected rake USD: \$$expected_rake_usd"
actual_rake_raw=$((assert_expected_payout_raw - total_received_raw))
actual_rake_usd=$(format_units_6 "$actual_rake_raw")
echo "Implied actual delta raw vs $assert_label expectation: $actual_rake_raw"
echo "Implied actual delta USD vs $assert_label expectation: \$$actual_rake_usd"
echo "Received-vs-expected delta raw ($assert_label): $delta_raw"

if [[ "$collateral_delta_raw" -ne 0 ]]; then
  echo "ALERT: Token accounting mismatch (YES+NO differs from totalCollateral)."
fi

if (( abs_delta_raw > rounding_tolerance_raw )); then
  echo "ALERT: Payout mismatch exceeds tolerance (|delta|=$abs_delta_raw > $rounding_tolerance_raw)."
  exit 1
fi

if (( abs_delta_raw > 0 )); then
  echo "Warning: payout delta is non-zero but within rounding tolerance (|delta|=$abs_delta_raw)."
fi

echo "Claim totals verified."
