#!/bin/bash

EC2_PROFILE=prism # AWS CLI profile to use for SSM session manager connection (must have permissions to connect to the instance)


# retrieve EC2 instance IDs for each environment and output to stdout:

# Accept ENV as a parameter
ENV=$1

if [[ -z "${ENV}" ]]; then
  echo "Error: missing environment argument." >&2
  echo "Usage: $(basename "$0") <environment> {dev, int, prod, etc.}" >&2
  exit 1
fi

if [[ ! -d "infra/gen/${ENV}" ]]; then
  echo "Error: environment folder not found: infra/gen/${ENV}" >&2
  exit 1
fi

if ! TF_OUTPUT=$(terraform -chdir="infra/gen/${ENV}" output -json); then
  echo "Error: failed to read Terraform outputs for environment: ${ENV}" >&2
  exit 1
fi



echo "EC2 instance IDs for '$ENV' environment:"
printf "%-5s %-10s %-20s\n" "" "Role" "Instance ID"
printf -- "-------------------------------------\n"
mapfile -t ROLE_ID_ROWS < <(jq -r '
  .ec2_instance_ids.value // {} | to_entries[] | [ .key, .value ] | @tsv' <<<"$TF_OUTPUT")

if [[ ${#ROLE_ID_ROWS[@]} -eq 0 ]]; then
  echo "No EC2 instance IDs found for environment: ${ENV}"
  exit 0
fi

ROLES=()
ROW=1
for role_id in "${ROLE_ID_ROWS[@]}"; do
  IFS=$'\t' read -r role id <<<"$role_id"
  ROLES+=("$role")
  printf "%-5d %-10s %-20s\n" "$ROW" "$role" "$id"
  ROW=$((ROW + 1))
done
echo ""

# prompt the user to select an instance by row number:
echo "Select an EC2 instance to connect to (row number):"
read -p "Row number: " ROW_NUM

if ! [[ "$ROW_NUM" =~ ^[0-9]+$ ]] || ((ROW_NUM < 1 || ROW_NUM > ${#ROLES[@]})); then
  echo "Error: invalid row number. Please choose a value from 1 to ${#ROLES[@]}." >&2
  exit 1
fi

ROLE="${ROLES[$((ROW_NUM - 1))]}"
EC2ID=$(jq -r --arg role "$ROLE" '.ec2_instance_ids.value[$role] // empty' <<<"$TF_OUTPUT")

if [[ -z "$EC2ID" ]]; then
  echo "Error: could not resolve EC2 instance ID for role: ${ROLE}" >&2
  exit 1
fi

export EC2ID
CONNECT_CMD="aws ssm start-session --target $EC2ID --profile $EC2_PROFILE --region us-east-1 --document-name AWS-StartInteractiveCommand --parameters 'command=[\"sudo -iu admin\"]'"

echo "You selected EC2 instance ID: $EC2ID"
echo ""
echo "You can connect to the instance using the following command:"
echo "$CONNECT_CMD"

# put this command on the clipboard for convenience:
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "$CONNECT_CMD" | pbcopy
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  echo "$CONNECT_CMD" | xclip -selection clipboard
else
  echo "Clipboard copy not supported on this OS. Please copy/paste the command manually."
  exit 0
fi

echo ""
echo "-> Command copied to clipboard."
echo "Paste and run the command in your terminal to connect to the instance."
