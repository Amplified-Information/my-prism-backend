# blocknode

A Golang app that polls and publishes smart contract events of interest to NATS.

Requires ABI to be added to .config file so the Solidity event payload can be processed

## Quickstart

`npm run dev`

Tail NATS with:

```bash
nats sub '>' --server nats://localhost:4222
```

### TODO

nats.proto - "sc.evt.solidity_evt_name" {param1: strictType, param2: strictType, param3: strictType}
