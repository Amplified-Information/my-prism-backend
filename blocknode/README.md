# blocknode

A Golang app that polls and publishes smart contract events of interest to NATS.

Requires ABI to be added to .config file so the Solidity event payload can be processed

## Quickstart

`npm run dev`

Tail NATS with:

```bash
nats sub '>' --server nats://localhost:4222
# or, on an EC2:
nats sub '>' --server nats://0.0.0.0:4222 # `nats` available on data EC2 box
```

Install nats-cli on EC2 box:

`curl -sf https://binaries.nats.dev/nats-io/natscli/nats@latest | sh`

`sudo cp nats /usr/bin` // put it on the path

## Backfill requests

Two ways to trigger a backfill:

1. cli (set parameters on startup)
2. admin HTTP server

### admin HTTP server

```bash
curl -X POST http://127.0.0.1:7777/backfill -H 'Content-Type: application/json' -d '{"lookbackMins": 10000, "toMins": 1000}'
```

### TODO

nats.proto - "sc.evt.solidity_evt_name" {param1: strictType, param2: strictType, param3: strictType}
