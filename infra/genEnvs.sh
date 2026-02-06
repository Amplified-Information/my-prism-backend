#!/bin/bash
set -e

# Generate main.tf for multiple envs from a template

cd "$(dirname "$0")"

# dev
export ENV="dev"
export DOMAIN_NAME="dev.prism.market"
export EBS_VOLUME_ID="vol-0d3a782bdfffc34aa"
export SSL_CERT_ARN="arn:aws:acm:us-east-1:063088900305:certificate/fdb39519-526b-48d2-a96e-307381465c05"

mkdir -p gen/dev
envsubst '$ENV $DOMAIN_NAME $EBS_VOLUME_ID $SSL_CERT_ARN' < main.tftpl > gen/dev/main.tf
echo "Generated gen/dev/main.tf"

# uat
export ENV="uat"
export DOMAIN_NAME="uat.prism.market"
export EBS_VOLUME_ID="vol-043410f6197ee2c31"
export SSL_CERT_ARN="arn:aws:acm:us-east-1:063088900305:certificate/48dc07e4-d1c2-488e-a085-3e499893a4e4"

mkdir -p gen/uat
envsubst '$ENV $DOMAIN_NAME $EBS_VOLUME_ID $SSL_CERT_ARN' < main.tftpl > gen/uat/main.tf
echo "Generated gen/uat/main.tf"


# prod
export ENV="prod"
export DOMAIN_NAME="prism.market"
export EBS_VOLUME_ID="vol-0e4912ca44f31c1f5"
export SSL_CERT_ARN="arn:aws:acm:us-east-1:063088900305:certificate/93dfad7f-8a67-43f3-a2e1-7f1f2f4b91c7"

mkdir -p gen/prod
envsubst '$ENV $DOMAIN_NAME $EBS_VOLUME_ID $SSL_CERT_ARN' < main.tftpl > gen/prod/main.tf
echo "Generated gen/prod/main.tf"



# Finally, link shared 
cd gen
ln -sf ../shared . || true
cd ..

echo ""
echo "To deploy to 'dev' simply do:"
echo "cd gen/dev"
echo "terraform init # if necessary"
echo "terraform apply"
