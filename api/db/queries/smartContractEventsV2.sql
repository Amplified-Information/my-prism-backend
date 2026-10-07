-- name: CreateSmartContractEventV2 :execrows
-- Idempotent: a redelivered event (same md5uniq) is ignored.
INSERT INTO smart_contract_events_v2 (net, contract_id, event, args, tx_hash, event_timestamp, host, md5uniq)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (md5uniq) DO NOTHING;
