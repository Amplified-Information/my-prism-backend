#!/bin/bash

# noninteractive install of all packages (apt-get, apt and dpkg) - to avoid any interactive prompts that would block the deployment:
export DEBIAN_FRONTEND=noninteractive
export UCF_FORCE_CONFFOLD=1
export UCF_FORCE_CONFFNEW=0

sudo DEBIAN_FRONTEND=noninteractive apt-get install ufw -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"

# UFW - only allow ssh
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw enable
