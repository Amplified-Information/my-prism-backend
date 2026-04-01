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

To switch it back:

`curl -X POST "http://127.0.0.1:9901/logging?level=info"`

Access the admin panel at: http://localhost:9901/

Test the proxy locally:

Should return 200:

`curl -I localhost:8090/health`

Should return 401:

`curl -I localhost:8090/`

Should return 401 Unauthorized:
`easyrpc c -a localhost:8090 -w -i ./proto -p api.proto api.ApiServicePublic.Health`

## rate limiting

Rate limiting is enabled (see: `envoy.filters.http.local_ratelimit` in [envoy.tmpl.yaml](envoy.tmpl.yaml)):

- global rate limit for the application (180 requests/min)
- per route rate limiting (/api.ApiAuth/ - 5 requests/min)

Test rate limit with:

```bash
for i in {1..10}; do curl -I https://dev.prism.market/api.ApiAuth/; done
```

Should see HTTP 429 responsed with "x-rate-limit" header when the rate limit is hit
