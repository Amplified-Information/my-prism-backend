#!/bin/bash

# noninteractive install of all packages (apt-get, apt and dpkg) - to avoid any interactive prompts that would block the deployment:
export DEBIAN_FRONTEND=noninteractive
export UCF_FORCE_CONFFOLD=1
export UCF_FORCE_CONFFNEW=0

# this maps to /dev/xvdf
DEVICE="/dev/nvme1n1"

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y e2fsprogs xfsprogs util-linux -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"


# prepare mount point for postgres data volume
sudo mkdir -p /mnt/external

sudo mkdir -p /mnt/external/postgresdata
# N.B. must give permission to the 999/systemd-journal user!
sudo chown -R 999:999 /mnt/external/postgresdata



# journal recovery, if needed
sudo fsck $DEVICE

# Check if volume is formatted; format only if needed (i.e. only format on first boot, not on reboots)
if ! file -s $DEVICE | grep -q "filesystem"; then
  sudo mkfs -t ext4 $DEVICE
fi

# Add to fstab if not present (auto-mount on reboots)
grep -q "$DEVICE" /etc/fstab || echo "$DEVICE /mnt/external ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab

# Now mount all:
sudo mount -a
