#!/bin/bash
set -e

# Generate main.tf for multiple envs from a template

cd "$(dirname "$0")"

# dev
export ENV="dev"
export DOMAIN_NAME="dev.prism.market"
export EBS_VOLUME_ID="vol-0d3a782bdfffc34aa"
#export SSL_CERT_ARN="arn:aws:acm:us-east-1:063088900305:certificate/fdb39519-526b-48d2-a96e-307381465c05"
export SSL_CERT_ARN="arn:aws:acm:us-east-1:063088900305:certificate/f392b6c2-7e34-4e7e-9fd3-b33d55cdfb96"
export SSL_CERT_ARN_WILDCARD="arn:aws:acm:us-east-1:063088900305:certificate/0c03a7c8-f646-4f60-a30f-29f14989749b" # wildcard *.dev.prism.market
# export EC2_TYPE_BASTION=t3.nano
export EC2_TYPE_PROXY=t3.nano
export EC2_TYPE_MONOLITH=t3.micro
export EC2_TYPE_DATA=t3.micro

mkdir -p gen/dev
envsubst '$ENV $DOMAIN_NAME $EBS_VOLUME_ID $SSL_CERT_ARN $SSL_CERT_ARN_WILDCARD $EC2_TYPE_PROXY $EC2_TYPE_MONOLITH $EC2_TYPE_DATA' < main.tftpl > gen/dev/main.tf
echo "Generated gen/dev/main.tf"

# uat
export ENV="uat"
export DOMAIN_NAME="uat.prism.market"
export EBS_VOLUME_ID="vol-043410f6197ee2c31"
#export SSL_CERT_ARN="arn:aws:acm:us-east-1:063088900305:certificate/48dc07e4-d1c2-488e-a085-3e499893a4e4"
export SSL_CERT_ARN="arn:aws:acm:us-east-1:063088900305:certificate/860f7226-32a8-43e3-b03b-2d0f80ac4eb8"
export SSL_CERT_ARN_WILDCARD="arn:aws:acm:us-east-1:063088900305:certificate/2481be4f-e7be-409d-bb7c-430d95b0becd" # wildcard *.uat.prism.market
# export EC2_TYPE_BASTION=t3.nano
export EC2_TYPE_PROXY=t3.nano
export EC2_TYPE_MONOLITH=t3.micro
export EC2_TYPE_DATA=t3.nano

mkdir -p gen/uat
envsubst '$ENV $DOMAIN_NAME $EBS_VOLUME_ID $SSL_CERT_ARN $SSL_CERT_ARN_WILDCARD $EC2_TYPE_PROXY $EC2_TYPE_MONOLITH $EC2_TYPE_DATA' < main.tftpl > gen/uat/main.tf
echo "Generated gen/uat/main.tf"


# prod
export ENV="prod"
export DOMAIN_NAME="prism.market"
export EBS_VOLUME_ID="vol-0e4912ca44f31c1f5"
#export SSL_CERT_ARN="arn:aws:acm:us-east-1:063088900305:certificate/93dfad7f-8a67-43f3-a2e1-7f1f2f4b91c7"
export SSL_CERT_ARN="arn:aws:acm:us-east-1:063088900305:certificate/93dfad7f-8a67-43f3-a2e1-7f1f2f4b91c7"
export SSL_CERT_ARN_WILDCARD="arn:aws:acm:us-east-1:063088900305:certificate/ccee5179-316a-4220-bb04-72dd26e2c3a9" # wildcard *.prism.market
# export EC2_TYPE_BASTION=t3.nano
export EC2_TYPE_PROXY=t3.micro
export EC2_TYPE_MONOLITH=t3.small
export EC2_TYPE_DATA=t3.micro

mkdir -p gen/prod
envsubst '$ENV $DOMAIN_NAME $EBS_VOLUME_ID $SSL_CERT_ARN $SSL_CERT_ARN_WILDCARD $EC2_TYPE_PROXY $EC2_TYPE_MONOLITH $EC2_TYPE_DATA' < main.tftpl > gen/prod/main.tf
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
