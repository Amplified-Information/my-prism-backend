#!/bin/bash

PROFILE_NAME="prism"
VALID_ENVS=("local" "dev" "uat" "prod" "local2")

# Ensure this script is only sourced, not executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Error: This script must be sourced, not executed."
  echo "Usage: source loadEnv.sh <environment> [--forceSecretsReload]"
  exit 1
fi




# Detect if the specific AWS profile exists; if so, add it to AWS CLI commands along with the --region
AWS_OPTS=""
if aws configure list-profiles 2>/dev/null | grep -q "^$PROFILE_NAME$"; then
  AWS_OPTS="--profile $PROFILE_NAME --region us-east-1"
fi


# Check if argument is provided
if [ $# -eq 0 ]; then
  echo "Error: Environment argument required (local, dev, uat, prod, or local2)"
  return 1
fi


# Parse for --forceSecretsReload option
# By default, secrets are not reloaded from `aws ssm ...` (too expensive and slow - especially when polling)
FORCE_SECRETS_RELOAD=false
for arg in "$@"; do
  if [ "$arg" = "--forceSecretsReload" ]; then
    FORCE_SECRETS_RELOAD=true
    # Remove the flag from positional parameters
    set -- "${@/--forceSecretsReload}"
    break
  fi
done









ENV=$1

# Validate environment argument
if [[ ! " ${VALID_ENVS[*]} " =~ " ${ENV} " ]]; then
  echo "Error: Invalid environment. Must be one of: ${VALID_ENVS[*]}"
  return 1
fi

# Resolve the directory of the script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

set -a # automatically export all variables

# 1. load configuration
echo "*** Loading configuration files..."
source "$SCRIPT_DIR/.config" # load base config
source "$SCRIPT_DIR/.config.$ENV" || true # env-specific config override (don't error out if it fails - e.g. scs/ doesn)
echo "Loaded configuration from .config and .config.$ENV."
echo ""

# # 2. load secrets
# # Caching: use .secrets.cache (JSON) if <1h old, else fetch from SSM and update cache
# CACHE_FILE="$SCRIPT_DIR/.secrets.cache"
# CACHE_TTL=3600 # seconds (1 hour)

# # Gather all secret keys (strip comments/empty lines)
# SECRET_KEYS=()
# sed -i -e '$a\' "$SCRIPT_DIR/.secrets"
# while IFS= read -r key; do
#   [[ "$key" =~ ^[[:space:]]*([#;]|$) ]] && continue
#   key="${key%%=*}"
#   SECRET_KEYS+=("$key")
# done < "$SCRIPT_DIR/.secrets"

# # Compose SSM parameter names
# PARAM_NAMES=()
# for key in "${SECRET_KEYS[@]}"; do
#   PARAM_NAMES+=("/$ENV/$key")
# done

# USE_CACHE=false
# if [ -f "$CACHE_FILE" ]; then
#   NOW=$(date +%s)
#   MOD=$(date +%s -r "$CACHE_FILE")
#   AGE=$((NOW - MOD))
#   if [ $AGE -lt $CACHE_TTL ]; then
#     USE_CACHE=true
#   fi
# fi

# if $USE_CACHE; then
#   echo "Loading secrets from cache ($CACHE_FILE)..."
#   for key in "${SECRET_KEYS[@]}"; do
#     value=$(jq -r --arg k "$key" '.[$k]' "$CACHE_FILE")
#     if [ "$value" = "null" ] || [ -z "$value" ]; then
#       echo "Error: Missing value for key '$key' in cache."
#       return 1
#     fi
#     export "$key"="$value"
#   done
# else
#   echo "Fetching secrets (in a batch) from AWS SSM..."
#   # Batch fetch (max 10 per call)
#   TMP_JSON="{}"
#   for ((i=0; i<${#PARAM_NAMES[@]}; i+=10)); do
#     BATCH=("${PARAM_NAMES[@]:i:10}")
#     # shellcheck disable=SC2086
#     echo "aws ssm get-parameters --with-decryption $AWS_OPTS --names ${BATCH[*]}"
#     RESP=$(aws ssm get-parameters --with-decryption $AWS_OPTS --names ${BATCH[*]} 2>/dev/null)
#     # Map SSM name to key
#     for row in $(echo "$RESP" | jq -c '.Parameters[]'); do
#       name=$(echo "$row" | jq -r '.Name')
#       val=$(echo "$row" | jq -r '.Value')
#       key="${name##*/}"
#       TMP_JSON=$(echo "$TMP_JSON" | jq --arg k "$key" --arg v "$val" '. + {($k): $v}')
#     done
#   done
#   # Check for missing keys
#   for key in "${SECRET_KEYS[@]}"; do
#     value=$(echo "$TMP_JSON" | jq -r --arg k "$key" '.[$k]')
#     if [ "$value" = "null" ] || [ -z "$value" ]; then
#       echo "Error: Missing value for key '$key' from SSM. Do you have the correct IAM permission?"
#       return 1
#     fi
#     export "$key"="$value"
#   done
#   echo "$TMP_JSON" > "$CACHE_FILE"
#   chmod 600 "$CACHE_FILE"
#   echo "Secrets cached to $CACHE_FILE."
# fi

# 2. load secrets
echo "*** Loading secrets from .secrets file..."
sed -i -e '$a\' "$SCRIPT_DIR/.secrets" # .secrets must end with a newline to ensure the last line is processed
while IFS= read -r key; do # loop through each key in .secrets
  # Ignore lines that start with '#', ';', whitespace, or are empty
  [[ "$key" =~ ^[[:space:]]*([#;]|$) ]] && continue

  key="${key%%=*}" # extract the part before "="


  # If env var exists and is non-empty, skip unless --forceSecretsReload is set (it costs time and money to load from AWS SSM)
  if [ "$FORCE_SECRETS_RELOAD" != "true" ] && [ -n "${!key}" ]; then
    echo "- $key: already set, skipping."
    continue
  fi

  # get the value from AWS SSM
  echo "aws ssm get-parameter --name \"/$ENV/$key\" ..."
  value="$(aws ssm get-parameter --name "/$ENV/$key" --with-decryption $AWS_OPTS | jq '.Parameter.Value' -r)"

  # Check if the value is empty
  if [ -z "$value" ]; then
    echo "Error: Missing value for key '$key'. Do you have the correct IAM permission?"
    return 1
  fi

  # Export the parameter
  export "$key"="$value"
done < "$SCRIPT_DIR/.secrets"





set +a # turn off auto-export

echo ""
echo "\"$ENV\" environment loaded successfully."
