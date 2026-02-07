# event bus

Using NATS for events.

No message persistence, no replaying of messages. No state is stored.

## cmds

```bash
source loadEnv.sh local
docker run --rm -it -p 4222:4222 -p 6222:6222 nats:latest
```

## install nats-cli

`go install github.com/nats-io/natscli/nats@latest`

`nats --version`

## listen to all events

`nats sub '>' --server nats://localhost:4222`
