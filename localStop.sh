#!/bin/bash

echo "stopping db..."
docker ps --filter "ancestor=ghcr.io/prismmarketlabs/db:latest" -q | xargs -r docker stop
echo "stopping eventbus..."
docker ps --filter "ancestor=ghcr.io/prismmarketlabs/eventbus:latest" -q | xargs -r docker stop
echo "stopping proxy..."
docker ps --filter "ancestor=ghcr.io/prismmarketlabs/proxy:latest" -q | xargs -r docker stop

echo "Selected services stopped."