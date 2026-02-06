# Proxy

Proxy application

N.B. Envoy cannot be configured using env vars.

Must generate `/etc/envoy/envoy.yaml`

You can apply hot changes using the admin port.

It is not possible to modify `.config*` or `.secrets` and re-run the container. You must rebuild the container and push a new image containing the `envoy.yaml` config.

## Quickstart

Envoy proxy on local:

```bash
# follow instructions at:
head Dockerfile
```

Note: the `--net=host` parameter must be applied in a localhost scenario (Docker)

Note: disable the admin config in production!

Note: enable debugging on a live Envoy proxy: `curl -X POST "http://127.0.0.1:9901/logging?level=debug"`

Access the admin panel at: http://localhost:9901/

###

Test the proxy locally:

Should return 200:

`curl -I localhost:8090/health`

Should return 401:

`curl -I localhost:8090/`

Should return 401 Unauthorized:
`easyrpc c -a localhost:8090 -w -i ./proto -p api.proto api.ApiServicePublic.Health`

### OLD

Envoy proxy on local:

```bash
cd proxy
source ./loadEnv.sh local2
# template to config:
envsubst < ./envoy.tmpl.yaml > /tmp/envoy/envoy.yaml
# docker run --network=host --rm -it -p $ENVOY_PORT:$ENVOY_PORT -p $ENVOY_PORT_ADMIN:$ENVOY_PORT_ADMIN -v $(pwd)/envoy.yaml:/etc/envoy/envoy.yaml envoyproxy/envoy:contrib-v1.35-latest
docker run --network=host --rm -it -v /tmp/envoy/envoy.yaml:/etc/envoy/envoy.yaml envoyproxy/envoy:contrib-v1.35-latest

```