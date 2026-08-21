#!/bin/bash


# Require the following variables to be passed as positional arguments:
if [ $# -ne 2 ]; then
  echo "Usage: $0 <AWS_REGION> <ENV>" >&2
  exit 1
fi
AWS_REGION="$1"
ENV="$2"

FLUENTBIT_S3_BUCKET="prismlabs-fluent-bit"


# noninteractive install of all packages (apt-get, apt and dpkg) - to avoid any interactive prompts that would block the deployment:
export DEBIAN_FRONTEND=noninteractive
export UCF_FORCE_CONFFOLD=1
export UCF_FORCE_CONFFNEW=0

wait_for_machine_ready() {
  local retries=100
  local delay=5

  for ((i=1; i<=retries; i++)); do
    echo "Checking if the machine is ready (attempt $i)..."
    if curl -I --silent http://google.com | head -n 1 | grep "HTTP" > /dev/null; then
      echo "Machine is ready."
      sleep 10 # for good measure
      return 0
    fi

    echo "Machine not ready. Retrying in $delay seconds..."
    sleep "$delay"
  done

  echo "Machine did not become ready after $((retries * delay)) seconds."
  return 1
}

###
# First, wait for the machine to be ready
###
wait_for_machine_ready || exit 1


sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade -y
sudo DEBIAN_FRONTEND=noninteractive dpkg --configure -a -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"

sudo DEBIAN_FRONTEND=noninteractive apt-get install -y unzip jq yq cron -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y dnsutils telnet net-tools lsof -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"

# Enable automatic security updates
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
sudo DEBIAN_FRONTEND=noninteractive dpkg-reconfigure -plow unattended-upgrades -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"

# fail2ban
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
sudo systemctl status fail2ban

# NATS cli
curl -sf https://binaries.nats.dev/nats-io/natscli/nats@latest | sh
mv nats /usr/bin/


###
# SSM Agent (for AWS Session Manager - console access without SSH)
# ensure you have added the IAM role for SSM Session Manager in shared/main.tf
# check with: `sudo systemctl status amazon-ssm-agent`
###
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y wget -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
SSM_URL=https://s3.${AWS_REGION}.amazonaws.com/amazon-ssm-${AWS_REGION}/latest/debian_amd64/amazon-ssm-agent.deb
echo $SSM_URL
wget $SSM_URL -O /tmp/amazon-ssm-agent.deb
sudo DEBIAN_FRONTEND=noninteractive dpkg -i --force-confdef --force-confold /tmp/amazon-ssm-agent.deb
sudo systemctl enable amazon-ssm-agent
sudo systemctl start amazon-ssm-agent

###
# fluent bit (logging)
###
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y gpg -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
sudo mkdir -p /usr/share/keyrings
curl -fsSL https://packages.fluentbit.io/fluentbit.key | sudo gpg --dearmor --yes -o /usr/share/keyrings/fluentbit-keyring.gpg
codename=$(grep -oP '(?<=VERSION_CODENAME=).*' /etc/os-release 2>/dev/null || lsb_release -cs 2>/dev/null)
echo "deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] https://packages.fluentbit.io/debian/$codename $codename main" | sudo tee /etc/apt/sources.list.d/fluent-bit.list
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y fluent-bit -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"


# want to add the following in the right place in /etc/fluent-bit/fluent-bit.conf:
# [INPUT]
#     Name              forward
#     Listen            0.0.0.0
#     Port              24224

# Only append [INPUT] forward if it doesn't already exist
if ! sudo grep -q '^\s*Name\s\+forward\s*$' /etc/fluent-bit/fluent-bit.conf; then
  sudo awk '
/^\[(FILTER|OUTPUT)\]/ && !done {
    print "[INPUT]"
    print "    Name              forward"
    print "    Listen            0.0.0.0"
    print "    Port              24224"
    print ""
    done=1
  }
  {print}
  ' /etc/fluent-bit/fluent-bit.conf > /tmp/fb.conf && sudo mv /tmp/fb.conf /etc/fluent-bit/fluent-bit.conf
fi


# Reduce the CPU [INPUT] interval from 1s to 60s (reduce log verbosity)
sudo sed -i 's/\(^\s*interval_sec\s\+\)1/\160/I' /etc/fluent-bit/fluent-bit.conf

# if disk space reaches 90%, send an alert (fluent-bit)
# TODO
# docker system prune -a

###
# S3 stream: stream fluent-bit logs to an S3 bucket called $FLUENTBIT_S3_BUCKET:
###
# ensure S3 output is configured (idempotent)
if ! sudo grep -q "^\s*Name\s\+s3\s*$" /etc/fluent-bit/fluent-bit.conf; then
  sudo mkdir -p /var/log/fluent-bit/s3
  sudo chown -R fluent-bit:fluent-bit /var/log/fluent-bit/s3 || true

  cat <<FB_OUT | sudo tee -a /etc/fluent-bit/fluent-bit.conf > /dev/null

[OUTPUT]
    Name              s3
    Match             *
    bucket            ${FLUENTBIT_S3_BUCKET}
    region            ${AWS_REGION}
    s3_key_format     /${ENV}/\$TAG/%Y/%m/%d/%H/%M/%S-\$UUID.gz
    store_dir         /var/log/fluent-bit/s3
    total_file_size   5M
    upload_timeout    60s
    compression       gzip
FB_OUT
fi

###
# AWS Cloudwatch log streaming:
###
### stream fluent-bit logs to CloudWatch Logs:
# ensure CloudWatch output is configured (idempotent)
if ! sudo grep -q "^\s*Name\s\+cloudwatch_logs\s*$" /etc/fluent-bit/fluent-bit.conf; then
  cat <<FB_CW | sudo tee -a /etc/fluent-bit/fluent-bit.conf > /dev/null

[OUTPUT]
    Name              cloudwatch_logs
    Match             *
    region            ${AWS_REGION}
    # N.B. create this log_group_name (e.g. /prism/dev) manually via clickops (30 day retention, deletion protection) - https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups
    log_group_name    /prism/${ENV}
    log_stream_name   $(hostname)
    auto_create_group true
FB_CW
fi

# restart fluent-bit and enable on reboot:
sudo systemctl start fluent-bit
sudo systemctl enable fluent-bit
sudo systemctl status fluent-bit --no-pager



# Schedule daily pruning of Docker images that are older than 7 days (keep disk space under control):
# This runs via cron at 03:15 every day.
if ! sudo crontab -l 2>/dev/null | grep -Fq 'docker image prune -a -f --filter "until=168h"'; then
  (sudo crontab -l 2>/dev/null; echo '15 3 * * * docker image prune -a -f --filter "until=168h" >/var/log/docker-prune.log 2>&1') | sudo crontab -
fi
