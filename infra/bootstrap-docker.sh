#!/bin/bash

# Require the following variables to be passed as positional arguments:
if [ $# -ne 4 ]; then
  echo "Usage: $0 <AWS_REGION> <ENV> <S3_BUCKET_DEPLOYMENT> <GHRC_SECRET_NAME>" >&2
  exit 1
fi
AWS_REGION="$1"
ENV="$2"
S3_BUCKET_DEPLOYMENT="$3"
GHRC_SECRET_NAME="$4"



# Accept AWS_REGION as a parameter or environment variable
if [ -n "$1" ]; then
  AWS_REGION="$1"
elif [ -z "$AWS_REGION" ]; then
  echo "ERROR: AWS_REGION must be provided as the first argument or set as an environment variable." >&2
  exit 1
fi



# noninteractive install of all packages (apt-get, apt and dpkg) - to avoid any interactive prompts that would block the deployment:
export DEBIAN_FRONTEND=noninteractive
export UCF_FORCE_CONFFOLD=1
export UCF_FORCE_CONFFNEW=0

# S3 cli (for pulling container images and configs):
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y awscli -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"

# Docker
# remove any conflicting packages:
REMOVE_PKGS=$(dpkg --get-selections docker.io docker-compose docker-doc podman-docker containerd runc | cut -f1)
if [ -n "$REMOVE_PKGS" ]; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get remove -y $REMOVE_PKGS -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
fi

# Add Docker's official GPG key:
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
sudo tee /etc/apt/sources.list.d/docker.sources <<DOCKER_EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
DOCKER_EOF

sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get dist-upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"

sudo DEBIAN_FRONTEND=noninteractive apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"

# newgrp docker # admin user must be in the docker group
sudo usermod -aG docker admin


# if data box, /mnt/external/postgresdata must be mounted before docker starts (so that postgres container can start successfully):
if [ "$(hostname)" = "data" ]; then
  sudo mkdir -p /etc/systemd/system/docker.service.d
  cat <<'DOCKER_MOUNT_GUARD' | sudo tee /etc/systemd/system/docker.service.d/10-persistent-data.conf > /dev/null
[Unit]
Description=Require persistent PostgreSQL storage before Docker starts
After=local-fs.target
RequiresMountsFor=/mnt/external/postgresdata
ConditionPathIsMountPoint=/mnt/external
DOCKER_MOUNT_GUARD
  sudo systemctl daemon-reload
fi


sudo systemctl start docker
sudo systemctl enable docker
sudo systemctl status docker --no-pager

sudo usermod -aG docker admin # N.B. 'admin' is the default user on AWS Debian AMIs

sudo systemctl restart docker





#####
# Devops: Create a 0_pull_latest.sh script
#####
cat <<SCRIPT > /home/admin/0_pull_latest.sh
#!/bin/bash


# Variables
ENVIRONMENT="${ENV}"
AWS_REGION="${AWS_REGION}"
SECRET_NAME="${GHRC_SECRET_NAME}"
MACHINE=$(hostname) # should be 'proxy', 'monolith', or 'data'
S3_BUCKET="${S3_BUCKET_DEPLOYMENT}"

login_to_github() {
  echo "Logging in to GitHub Container Registry..."
  GITHUB_PAT=\$(aws ssm get-parameter --name "\$SECRET_NAME" --with-decryption --region "\$AWS_REGION" | jq ".Parameter.Value" -r)
  if [ -z "\$GITHUB_PAT" ]; then
    echo "Failed to retrieve GitHub PAT from AWS Secrets Manager."
    exit 1
  fi
  echo "\$GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
}

pull_docker_compose_files() {
  echo "Retrieving Docker Compose files from S3..."
  FILES=\$(aws s3 ls "s3://\$S3_BUCKET" --region "\$AWS_REGION" | awk '{print \$4}')

  # Filter for the base file and the environment-specific file
  BASE_FILE="docker-compose-\$MACHINE.yml"
  ENV_FILE="docker-compose-\$MACHINE.\$ENVIRONMENT.yml"

  if ! echo "\$FILES" | grep -q "\$BASE_FILE"; then
    echo "Base file \$BASE_FILE not found in S3 bucket."
    exit 1
  fi

  if ! echo "\$FILES" | grep -q "\$ENV_FILE"; then
    echo "Environment file \$ENV_FILE not found in S3 bucket."
    exit 1
  fi

  # Download the base file
  echo "Downloading \$BASE_FILE..."
  aws s3 cp "s3://\$S3_BUCKET/\$BASE_FILE" "./\$BASE_FILE.tmp" --region "\$AWS_REGION"
  if ! cmp -s "\$BASE_FILE" "\$BASE_FILE.tmp"; then
    echo "DIFF detected in \$BASE_FILE"  # don't change this string (needed for pattern match)
  else
    echo "-> No changes in \$BASE_FILE"
  fi
  mv "\$BASE_FILE.tmp" "\$BASE_FILE"

  # Download the environment-specific file
  echo "Downloading \$ENV_FILE..."
  aws s3 cp "s3://\$S3_BUCKET/\$ENV_FILE" "./\$ENV_FILE.tmp" --region "\$AWS_REGION"
  if ! cmp -s "\$ENV_FILE" "\$ENV_FILE.tmp"; then
    echo "DIFF detected in \$ENV_FILE"  # don't change this string (needed for pattern match)
  else
    echo "-> No changes in \$ENV_FILE"
  fi
  mv "\$ENV_FILE.tmp" "\$ENV_FILE"

  # also, if there's nothing running yet, output a DIFF detected string:
  if [ -z "\$(docker ps -q)" ]; then
    echo "No running containers detected. Treating as initial deployment with DIFF."
    echo "DIFF detected in \$BASE_FILE"  # don't change this string (needed for pattern match)
  fi

  # symlink the base file to docker-compose.yml (for docker compose logging, etc.)
  rm -f docker-compose.yml # if symlink exists
  ln -s "\$BASE_FILE" docker-compose.yml
}

pull_config_secrets_files() {
  echo "Retrieving .config* files, .secret file and loadEnv.sh from S3..."
  # Check if docker-compose-\$MACHINE.yml exists before proceeding
  if [ ! -f "./docker-compose-\$MACHINE.yml" ]; then
    echo "ERROR: ./docker-compose-\$MACHINE.yml not found. Aborting pull_config_secrets_files."
    exit 1
  fi
  # Loop through each service as defined in the docker-compose file under "services"
  for SERVICE in \$(yq '.services | keys | join(" ")' ./docker-compose-\$MACHINE.yml | tr -d '"'); do
    echo "Pulling .config*, .secrets and loadEnv.sh for \$SERVICE..."
    mkdir -p "./\$SERVICE" # Ensure the local folder exists

    aws s3 cp "s3://\$S3_BUCKET/\$SERVICE" "./\$SERVICE/" --recursive --region "\$AWS_REGION"

    chmod +x "./\$SERVICE/loadEnv.sh" # make loadEnv.sh executable
  done
}

pull_latest_docker_images_if_changed() {
  echo "Inspecting GHCR image digests for docker-compose files..."
  local state_dir=/home/admin/.ghcr_image_state
  local machine="\${MACHINE:-}"
  local environment="\${ENVIRONMENT:-}"
  local compose_base="docker-compose-\${machine}.yml"
  local compose_env="docker-compose-\${machine}.\${environment}.yml"

  if [ -z "\$machine" ] || [ -z "\$environment" ]; then
    echo "ERROR: MACHINE and ENVIRONMENT must be set for image inspection." >&2
    return 1
  fi

  if ! command -v yq >/dev/null 2>&1 || ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: yq and docker are required for image inspection." >&2
    return 1
  fi

  if [ ! -f "\${compose_base}" ] || [ ! -f "\${compose_env}" ]; then
    echo "Compose files not present: \${compose_base}, \${compose_env}"
    return 0
  fi

  if ! mkdir -p /home/admin/.ghcr_image_state; then
    echo "ERROR: cannot create digest state directory /home/admin/.ghcr_image_state" >&2
    return 1
  fi

  local services
  services=\$(yq -r '.services | keys[]' "\$compose_base" 2>/dev/null) || {
    echo "ERROR: could not read services from \$compose_base" >&2
    return 1
  }

  local changed=0
  local service
  while IFS= read -r service; do
    [ -n "\$service" ] || continue

    local image
    image=\$(yq -r --arg svc "\$service" '.services[$svc].image // empty' "\$compose_env" 2>/dev/null)
    if [ -z "\$image" ]; then
      image=\$(yq -r --arg svc "\$service" '.services[$svc].image // empty' "\$compose_base" 2>/dev/null)
    fi
    [ -n "\$image" ] || continue

    local remote_digest
    remote_digest=\$(docker buildx imagetools inspect "\$image" --format '{{.Manifest.Digest}}' 2>/dev/null || true)
    if [ -z "\$remote_digest" ]; then
      echo "INFO: no digest available for \$service (\$image); skipping."
      continue
    fi

    local state_file="\$state_dir/\$service.digest"
    local last_digest
    last_digest=\$(cat "\$state_file" 2>/dev/null || true)

    if [ "\$last_digest" != "\$remote_digest" ]; then
      echo "New image available for \$service: \$image -> \$remote_digest"
      changed=1
    fi
  done <<< "\$services"

  if [ "\$changed" -eq 1 ]; then
    echo "DIFF detected in docker-compose-\$machine.yml"
    if ! docker compose -f "\$compose_base" -f "\$compose_env" pull --policy missing; then
      echo "ERROR: image pull failed; digest state was not updated." >&2
      return 1
    fi

    while IFS= read -r service; do
      [ -n "\$service" ] || continue
      image=\$(yq -r --arg svc "\$service" '.services[$svc].image // empty' "\$compose_env" 2>/dev/null)
      [ -n "\$image" ] || image=\$(yq -r --arg svc "\$service" '.services[$svc].image // empty' "\$compose_base" 2>/dev/null)
      [ -n "\$image" ] || continue
      remote_digest=\$(docker buildx imagetools inspect "\$image" --format '{{.Manifest.Digest}}' 2>/dev/null || true)
      [ -n "\$remote_digest" ] && printf '%s\n' "\$remote_digest" > "\$state_dir/\$service.digest"
    done <<< "\$services"
  fi

  [ "\$changed" -eq 0 ] && echo "No new GHCR digests detected for \$machine."
}

main() {
  login_to_github
  pull_docker_compose_files
  pull_config_secrets_files
  pull_latest_docker_images_if_changed
}

main
SCRIPT

# Make the 0_pull_latest.sh script executable
chown admin:admin /home/admin/0_pull_latest.sh
chmod +x /home/admin/0_pull_latest.sh


#####
# Devops: Create a 1_loadEnvVars.sh script
#####
cat <<SCRIPT > /home/admin/1_loadEnvVars.sh
#!/bin/bash

# Variables
ENVIRONMENT="${ENV}"
MACHINE=$(hostname) # should be 'proxy', 'monolith', or 'data'

# Detect if the script is being sourced
# If \$BASH_SOURCE[0] == \$0, the script is executed, not sourced
if [[ "\${BASH_SOURCE[0]}" == "\$0" ]]; then
  echo "ERROR: This script must be sourced, not executed."
  echo "Usage: source \$0"
  exit 1  # exit script execution
fi

echo "Loading config and secrets..."
# Load environment variables (reads .config* files and loads .secrets from AWS SSM)
# set -a causes all variables set/sourced to be automatically exported to child processes
set -a
for SERVICE in \$(yq '.services | keys | join(" ")' ./docker-compose-\$MACHINE.yml | tr -d '"'); do
  source ./\$SERVICE/loadEnv.sh \$ENVIRONMENT
done
set +a

SCRIPT

# Make the 1_loadEnvVars.sh script executable
chown admin:admin /home/admin/1_loadEnvVars.sh
# chmod +x /home/admin/1_loadEnvVars.sh # can only source this script - exec not needed



#####
# Devops: Create a 2_dockerComposeUp.sh script
#####
cat <<SCRIPT > /home/admin/2_dockerComposeUp.sh
#!/bin/bash
set -o pipefail

ENVIRONMENT="${ENV}"
MACHINE=$(hostname) # should be 'proxy', 'monolith', or 'data'
S3_BUCKET="pl-deployment-badges"

BASE_FILE="docker-compose-\$MACHINE.yml"
ENV_FILE="docker-compose-\$MACHINE.\$ENVIRONMENT.yml"


echo "Starting docker compose..."
# -d - daemon mode
#  --force-recreate - always recreate containers (e.g. apply new env vars - configChange.sh script)
# If SERVICE is passed as first argument, only update that service (--no-deps avoids restarting dependencies)
# Usage: ./2_dockerComposeUp.sh [SERVICE]
# e.g.:  ./2_dockerComposeUp.sh blocknode
if [ -n "\$1" ]; then
  echo "Targeted deployment: updating only service '\$1'"
  docker compose -f "\$BASE_FILE" -f "\$ENV_FILE" up -d --no-deps "\$1"
else
  docker compose -f "\$BASE_FILE" -f "\$ENV_FILE" up -d --remove-orphans
fi

# List running containers:
docker ps



### svg deployment badge generation and upload (for rendering on README.md):
# only proceed if there was a change in running containers (e.g. new image pulled and deployed, or container restarted with same image):
# docker ps -q | xargs -r docker inspect --format '{{.Name}} {{.State.StartedAt}}' | awk -v now="\$(date -u +%s)" '{ gsub("/", "", \$1); split(\$2, a, "T"); split(a[2], b, "."); cmd="date -d \""a[1]" "b[1]"\" +%s"; cmd | getline t; close(cmd); if (now-t <= 5) print \$1 " started " now-t " seconds ago" }'
recently_started=\$(docker ps -q | xargs -r docker inspect --format '{{.Name}} {{.State.StartedAt}}' | awk -v now="\$(date -u +%s)" '{ gsub("/", "", \$1); split(\$2, a, "T"); split(a[2], b, "."); cmd="date -d \""a[1]" "b[1]"\" +%s"; cmd | getline t; close(cmd); if (now-t <= 15) print \$1 " started " now-t " seconds ago" }')
echo "[DEBUG] Recently started containers (<=15s):"
echo "\$recently_started"
if [ -n "\$recently_started" ]; then
  echo "Changes detected in docker compose deployment. Generating and uploading SVG badge..."

  lines=\$(docker compose ps --format "table {{.Service}}\t{{.Image}}" 2>/dev/null | tail -n +2 | while read svc img; do
    tag=\$(echo "\$img" | awk -F: '{print \$2}')
    echo "\$svc \$tag"
  done)

  count=\$(echo "\$lines" | wc -l)
  height=\$((70 + 20 * count))
  DEPLOY_TIME=\$(date -u +"%Y-%m-%d %H:%M:%S UTC")

  echo "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"300\" height=\"\$height\" style=\"font-family:monospace\">" > "\$MACHINE.svg"
  echo "<text x=\"10\" y=\"20\" font-size=\"16\" fill=\"green\">\$ENVIRONMENT.\$MACHINE</text>" >> "\$MACHINE.svg"
  echo "<text x=\"10\" y=\"40\" font-size=\"13\" fill=\"orange\">\$DEPLOY_TIME</text>" >> "\$MACHINE.svg"

  y=60
  echo "\$lines" | while read svc tag; do
    echo "<text x=\"30\" y=\"\$y\" font-size=\"14\"><tspan fill=\"blue\">\$svc</tspan>:<tspan fill=\"purple\">\$tag</tspan></text>" >> "\$MACHINE.svg"
    y=\$((y + 20))
  done

  echo "</svg>" >> "\$MACHINE.svg"

  echo "Uploading svg to s3://\$S3_BUCKET/\$ENVIRONMENT/\$MACHINE.svg..."
  aws s3 cp "\$MACHINE.svg" "s3://\$S3_BUCKET/\$ENVIRONMENT/\$MACHINE.svg" --content-type image/svg+xml
  aws s3 cp "s3://\$S3_BUCKET/\$ENVIRONMENT/\$MACHINE.svg" "s3://\$S3_BUCKET/\$ENVIRONMENT/\$MACHINE.svg" --metadata-directive REPLACE --content-type image/svg+xml --cache-control "no-cache, no-store, must-revalidate"
  rm "\$MACHINE.svg"

  echo "svg badge uploaded successfully."
else
  echo "No changes detected in docker compose deployment. Skipping SVG badge generation."
  exit 0
fi

SCRIPT

# Make the 2_dockerComposeUp.sh script executable
chown admin:admin /home/admin/2_dockerComposeUp.sh
chmod +x /home/admin/2_dockerComposeUp.sh




#####
# Finally, add a systemd service to run the above scripts every X seconds
# (with a delay to ensure machine is ready and volumes are attached)
#####
PERSISTENT_DATA_UNIT=""
if [ "$(hostname)" = "data" ]; then
  PERSISTENT_DATA_UNIT=$'RequiresMountsFor=/mnt/external/postgresdata\nConditionPathIsMountPoint=/mnt/external'
fi

cat <<POLL | sudo tee /etc/systemd/system/deploy_poll.service > /dev/null

[Unit]
Description=Poll for new Docker images and deploy with docker compose
# Start only after local filesystems, including the data volume, are ready.
After=network.target local-fs.target
$PERSISTENT_DATA_UNIT

[Service]
Type=simple
User=admin
WorkingDirectory=/home/admin
# every 30 seconds:
# always pull images and deploy only iff there's a diff in any the docker-compose-* files
# docker compose will intelligently deploy - so if a service has the same version, it won't get re-deployed
ExecStart=/bin/bash -c "while true; do sleep 30; OUT=\$(/home/admin/0_pull_latest.sh 2>&1); echo \"\$OUT\"; echo \"\$OUT\" | grep -q 'DIFF detected in docker-compose-' && source /home/admin/1_loadEnvVars.sh && /home/admin/2_dockerComposeUp.sh; done"
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target

# check with:
# sudo journalctl -u deploy_poll.service -f

POLL

# enable and start:

sudo systemctl daemon-reload
sudo systemctl enable deploy_poll.service
sudo systemctl start deploy_poll.service

# view output with:
# sudo journalctl -u deploy_poll.service -f




# Finally:
# Note: newgrp command starts a new shell with the new group, and when it is run in a non-interactive script, it spawns a subshell and does not return to the parent script. This means any commands after newgrp docker will not execute in your original script—they are effectively skipped.
newgrp docker & # don't have to logout and log back in again...


# and restart the deploy_poll service to ensure it runs with the new docker group permissions:
sudo systemctl start deploy_poll.service