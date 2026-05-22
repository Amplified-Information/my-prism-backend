# blocknode

A Golang app that polls and publishes smart contract events of interest to NATS.

Requires ABI to be added to .config file so the Solidity event payload can be processed

## Quickstart

`npm run dev`

Tail NATS with:

```bash
nats sub '>' --server nats://localhost:4222
```

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
