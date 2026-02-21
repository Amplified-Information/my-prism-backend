#!/bin/sh
set -e

REQUIRED_VARS="ENVOY_HOST_CLOB ENVOY_HOST_API ENVOY_HOST_WEB ENVOY_HOST_WEB_ADMIN ENVOY_HOST_WEB_LP"
for VAR in $REQUIRED_VARS; do
  if [ -z "$(eval echo \"\${$VAR}\")" ]; then
    echo "Error: $VAR environment variable is not set."
    exit 1
  fi
done


# Substitute env vars into the template at container start
envsubst < /etc/envoy/envoy.tmpl.yaml > /etc/envoy/envoy.yaml

# Launch Envoy
exec envoy -c /etc/envoy/envoy.yaml "$@"
