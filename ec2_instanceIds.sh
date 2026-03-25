#!/bin/bash

# retrieve EC2 instance IDs for each environment and output to stdout:

# Accept ENV as a parameter
ENV=$1

if [[ -z "${ENV}" ]]; then
  echo "Error: missing environment argument." >&2
  echo "Usage: $(basename "$0") <environment>" >&2
  exit 1
fi

if [[ ! -d "infra/gen/${ENV}" ]]; then
  echo "Error: environment folder not found: infra/gen/${ENV}" >&2
  exit 1
fi




echo "EC2 instance IDs for '$ENV' environment:"
printf "%-10s %-20s\n" "Role" "Instance ID"
printf -- "------------------------------\n"
terraform -chdir=infra/gen/$ENV output -json | jq -r '
  .ec2_instance_ids.value // {} | to_entries[] | [ .key, .value ] | @tsv' | while IFS=$'\t' read -r role id; do
  printf "%-10s %-20s\n" "$role" "$id"
done
echo ""


echo "export EC2ID="
echo "aws ssm start-session --target \$EC2ID --profile prism --region us-east-1"
echo ""