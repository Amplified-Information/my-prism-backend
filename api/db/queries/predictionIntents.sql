-- CREATE

-- name: CreatePredictionIntent :one
INSERT INTO prediction_intents (tx_id, net, market_id, account_id, price_usd, qty, sig, public_key_hex, evmaddress, keytype, generated_at, primary_secondary)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;





-- READ

-- name: GetPredictionIntentByTxId :one
SELECT *
FROM prediction_intents
WHERE tx_id = $1;

-- name: GetAllOpenPredictionIntentsByMarketId :many
SELECT pi.*
FROM prediction_intents pi
JOIN markets m ON pi.market_id = m.market_id
WHERE pi.market_id = $1
AND pi.cancelled_at IS NULL AND pi.fully_matched_at IS NULL AND pi.evicted_at IS NULL
AND m.deleted_at IS NULL;

-- name: GetAllOpenPredictionIntentsByMarketIdAndAccountId :many
SELECT pi.*
FROM prediction_intents pi
JOIN markets m ON pi.market_id = m.market_id
WHERE pi.market_id = $1 AND pi.account_id = $2
AND pi.cancelled_at IS NULL AND pi.fully_matched_at IS NULL AND pi.evicted_at IS NULL
AND m.deleted_at IS NULL
ORDER BY account_id;

-- name: GetAllAccountIdsForMarketId :many
SELECT DISTINCT pi.account_id
FROM prediction_intents pi
JOIN markets m ON pi.market_id = m.market_id
WHERE pi.market_id = $1
AND pi.cancelled_at IS NULL AND pi.fully_matched_at IS NULL AND pi.evicted_at IS NULL
AND m.deleted_at IS NULL;

-- name: GetAllOpenPredictionIntentsByEvmAddress :many
SELECT pi.*
FROM prediction_intents pi
JOIN markets m ON pi.market_id = m.market_id
WHERE pi.evmaddress = $1
	AND pi.cancelled_at IS NULL
	AND pi.fully_matched_at IS NULL
	AND pi.evicted_at IS NULL
	AND m.deleted_at IS NULL;

-- name: GetAllMatchedPredictionIntentsByEvmAddress :many
SELECT pi.*
FROM prediction_intents pi
JOIN markets m ON pi.market_id = m.market_id
JOIN matches ma ON (pi.tx_id = ma.tx_id1 OR pi.tx_id = ma.tx_id2)
WHERE pi.evmaddress = $1
	AND pi.cancelled_at IS NULL
	AND pi.evicted_at IS NULL
	AND m.deleted_at IS NULL;


-- name: GetAllPredictionIntents :many
SELECT pi.*
FROM prediction_intents pi
JOIN markets m ON pi.market_id = m.market_id
WHERE m.deleted_at IS NULL
ORDER BY pi.generated_at DESC
LIMIT $1 OFFSET $2;


-- name: IsDuplicateTxId :one
SELECT COUNT(*) > 0 AS exists
FROM prediction_intents
WHERE tx_id = $1;

-- name: GetTotalValueUsdForMarketId :one
SELECT COALESCE(SUM(pi.price_usd * pi.qty), 0)::double precision AS total_value_usd
FROM prediction_intents pi
JOIN markets m ON pi.market_id = m.market_id
WHERE pi.market_id = $1
AND m.deleted_at IS NULL;









-- UPDATE

-- name: MarkPredictionIntentAsRegenerated :exec
UPDATE prediction_intents
SET regenerated_at = CURRENT_TIMESTAMP
WHERE tx_id = $1;

-- name: MarkPredictionIntentAsFullyMatched :one
UPDATE prediction_intents
SET fully_matched_at = CURRENT_TIMESTAMP
WHERE market_id = $1 AND tx_id = $2
RETURNING *;

-- name: MarkPredictionIntentAsEvicted :exec
UPDATE prediction_intents
SET evicted_at = CURRENT_TIMESTAMP
WHERE tx_id = $1;

-- name: MarkPredictionIntentAsRedeemedForAccount :exec
UPDATE prediction_intents -- updates all rows where market_id=$1 and evmaddress=$2
SET redeemed_at = CURRENT_TIMESTAMP
WHERE market_id = $1 AND evmaddress = $2;



-- DELETE

-- name: CancelPredictionIntent :exec
UPDATE prediction_intents
SET cancelled_at = CURRENT_TIMESTAMP
WHERE tx_id = $1 AND cancelled_at IS NULL AND fully_matched_at IS NULL AND evicted_at IS NULL;
