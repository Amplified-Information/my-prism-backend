#!/bin/bash

echo "stopping db..."
docker stop prism-db 2>/dev/null; docker rm prism-db 2>/dev/null
echo "stopping eventbus..."
docker stop prism-eventbus 2>/dev/null; docker rm prism-eventbus 2>/dev/null
echo "stopping proxy..."
docker stop prism-proxy 2>/dev/null; docker rm prism-proxy 2>/dev/null
echo "stopping blocknode..."
docker stop prism-blocknode 2>/dev/null; docker rm prism-blocknode 2>/dev/null

echo "Selected services stopped."
