-- CREATE

-- name: CreatePredictionIntent :one
INSERT INTO prediction_intents (tx_id, net, market_id, account_id, market_limit, price_usd, qty, sig, public_key_hex, evmaddress, keytype, generated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;





-- READ

-- name: GetAllOpenPredictionIntentsByMarketId :many
SELECT *
FROM prediction_intents
WHERE market_id = $1 
AND cancelled_at IS NULL AND fully_matched_at IS NULL AND evicted_at IS NULL;

-- name: GetAllOpenPredictionIntentsByMarketIdAndAccountId :many
SELECT *
FROM prediction_intents
WHERE market_id = $1 AND account_id = $2 
AND cancelled_at IS NULL AND fully_matched_at IS NULL AND evicted_at IS NULL
ORDER BY account_id;

-- name: GetAllAccountIdsForMarketId :many
SELECT DISTINCT account_id
FROM prediction_intents
WHERE market_id = $1 
AND cancelled_at IS NULL AND fully_matched_at IS NULL AND evicted_at IS NULL;

-- name: GetAllOpenPredictionIntentsByEvmAddress :many
SELECT *
FROM prediction_intents
WHERE evmaddress = $1 
AND cancelled_at IS NULL AND fully_matched_at IS NULL AND evicted_at IS NULL;



-- name: IsDuplicateTxId :one
SELECT COUNT(*) > 0 AS exists
FROM prediction_intents
WHERE tx_id = $1;





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



-- DELETE

-- name: CancelPredictionIntent :exec
UPDATE prediction_intents
SET cancelled_at = CURRENT_TIMESTAMP
WHERE tx_id = $1 AND cancelled_at IS NULL AND fully_matched_at IS NULL AND evicted_at IS NULL;
