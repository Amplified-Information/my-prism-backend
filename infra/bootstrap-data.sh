#!/bin/bash
set -euo pipefail

# it's critical that this script doesn't overwrite the persistent ebs data volume
# ebs volume id is passed as an argument to this script, and the script will fail if the volume is not attached or if it has a filesystem that is not ext4.
# mounted at /mnt/external/postgresdata, and the postgres container will use this path for its data directory.

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <EBS_VOLUME_ID>" >&2
  exit 1
fi

EBS_VOLUME_ID="$1"
NVME_VOLUME_ID="${EBS_VOLUME_ID//-/}"
DATA_MOUNT="/mnt/external"
POSTGRES_DATA_DIR="$DATA_MOUNT/postgresdata"

# noninteractive install of all packages (apt-get, apt and dpkg) - to avoid any interactive prompts that would block the deployment:
export DEBIAN_FRONTEND=noninteractive
export UCF_FORCE_CONFFOLD=1
export UCF_FORCE_CONFFNEW=0

# Terraform's /dev/xvdf mapping is exposed through a stable NVMe by-id path.
DEVICE="/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_${NVME_VOLUME_ID}"

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-client e2fsprogs xfsprogs util-linux -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"


# prepare mount point for postgres data volume
sudo mkdir -p "$POSTGRES_DATA_DIR"

# The volume attachment is a separate Terraform resource and can complete
# after cloud-init starts user-data. Never continue against the root disk.
for attempt in $(seq 1 60); do
  if sudo test -b "$DEVICE"; then
    break
  fi
  if [ "$attempt" -eq 60 ]; then
    echo "ERROR: persistent data volume $EBS_VOLUME_ID was not attached" >&2
    exit 1
  fi
  sleep 5
done

sudo udevadm settle

# Make reruns idempotent, but never accept a different device at the mountpoint.
mounted=false
if mountpoint -q "$DATA_MOUNT"; then
  mounted_source=$(sudo findmnt -rn -o SOURCE --target "$DATA_MOUNT")
  if [ "$(readlink -f "$mounted_source")" != "$(readlink -f "$DEVICE")" ]; then
    echo "ERROR: $DATA_MOUNT is mounted from unexpected device $mounted_source" >&2
    exit 1
  fi
  mounted=true
elif sudo findmnt -rn -S "$DEVICE" >/dev/null; then
  echo "ERROR: persistent data volume $DEVICE is mounted at an unexpected path" >&2
  exit 1
fi

# Use ext4 for a genuinely blank, unmounted EBS volume. Existing filesystems
# and any detectable signatures are never overwritten.
FILESYSTEM_TYPE=$(sudo blkid -s TYPE -o value "$DEVICE" || true)
if [ -z "$FILESYSTEM_TYPE" ]; then
  FILE_SIGNATURE=$(sudo file -sL "$DEVICE" || true)
  if printf '%s\n' "$FILE_SIGNATURE" | grep -qi 'ext[234] filesystem data'; then
    FILESYSTEM_TYPE=ext4
  fi
fi
if [ "$mounted" = false ] && [ -z "$FILESYSTEM_TYPE" ]; then
  if sudo wipefs -n "$DEVICE" 2>/dev/null | grep -q .; then
    echo "ERROR: $DEVICE has filesystem signatures but no recognized type; refusing to format it" >&2
    exit 1
  fi
  
  echo "WARNING (mkfs.ext4): Formatting $DEVICE as ext4 for persistent data volume $EBS_VOLUME_ID"
  sudo mkfs.ext4 "$DEVICE" # DANGER!
  sudo udevadm settle
  FILESYSTEM_TYPE=$(sudo blkid -s TYPE -o value "$DEVICE" || true)
fi

if [ "$FILESYSTEM_TYPE" != "ext4" ]; then
  echo "ERROR: expected ext4 on $DEVICE, found '${FILESYSTEM_TYPE:-unknown}'; refusing to modify it" >&2
  exit 1
fi

# Use the filesystem UUID because NVMe device names can change across reboots.
VOLUME_UUID=$(sudo blkid -s UUID -o value "$DEVICE")
if [ -z "$VOLUME_UUID" ]; then
  echo "ERROR: no filesystem UUID found for $DEVICE" >&2
  exit 1
fi
sudo sed -i "\|[[:space:]]$DATA_MOUNT[[:space:]]|d" /etc/fstab
echo "UUID=$VOLUME_UUID $DATA_MOUNT ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab

# Mount only the persistent filesystem; do not let an unrelated fstab entry
# affect provisioning.
if [ "$mounted" = false ]; then
  sudo mount "$DATA_MOUNT"
fi

if ! mountpoint -q "$DATA_MOUNT"; then
  echo "ERROR: persistent volume $EBS_VOLUME_ID is not mounted at $DATA_MOUNT" >&2
  exit 1
fi

# N.B. must give permission to the PostgreSQL container user.
sudo chown -R 999:999 "$POSTGRES_DATA_DIR"
