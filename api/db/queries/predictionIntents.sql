-- CREATE

-- name: CreatePredictionIntent :one
-- PrismV2 authorization. price_usd, qty_orig, qty_rem and primary_secondary are
-- derived display/analytics values; the signed integer columns are authoritative.
INSERT INTO prediction_intents (
    tx_id, net, market_id, account_id, price_usd, qty_orig, qty_rem, sig, public_key_hex, evmaddress, keytype, generated_at, primary_secondary,
    protocol_version, chain_id, verifying_contract, side, action, limit_yes_price, qty_shares, collateral_cap, deadline
)
VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
    2, sqlc.arg(chain_id), sqlc.arg(verifying_contract), sqlc.arg(side), sqlc.arg(action), sqlc.arg(limit_yes_price),
    sqlc.arg(qty_shares)::numeric, sqlc.arg(collateral_cap)::numeric, sqlc.arg(deadline)
)
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
AND pi.qty_rem > 0
AND m.deleted_at IS NULL;

-- name: GetAllOpenPredictionIntentsByMarketIdAndAccountId :many
SELECT pi.*
FROM prediction_intents pi
JOIN markets m ON pi.market_id = m.market_id
WHERE pi.market_id = $1 AND pi.account_id = $2
AND pi.cancelled_at IS NULL AND pi.fully_matched_at IS NULL AND pi.evicted_at IS NULL
AND pi.qty_rem > 0
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
	AND pi.qty_rem > 0
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

-- name: CountAllPredictionIntents :one
SELECT COUNT(*)
FROM prediction_intents pi
JOIN markets m ON pi.market_id = m.market_id
WHERE m.deleted_at IS NULL;


-- name: IsDuplicateTxId :one
SELECT COUNT(*) > 0 AS exists
FROM prediction_intents
WHERE tx_id = $1;

-- name: GetTotalValueUsdForMarketId :one
SELECT COALESCE(SUM(pi.price_usd * pi.qty_rem), 0)::double precision AS total_value_usd
FROM prediction_intents pi
JOIN markets m ON pi.market_id = m.market_id
WHERE pi.market_id = $1
AND m.deleted_at IS NULL;









-- UPDATE

-- name: AddPredictionIntentFill :one
-- Applies one finalized on-chain fill. qty_rem is kept as the derived remaining quantity.
UPDATE prediction_intents
SET shares_filled = shares_filled + sqlc.arg(fill_shares)::numeric,
    collateral_filled = collateral_filled + sqlc.arg(fill_collateral)::numeric,
    qty_rem = GREATEST((qty_shares - shares_filled - sqlc.arg(fill_shares)::numeric)::float8 / sqlc.arg(unit_scale)::float8, 0.0),
    updated_at = CURRENT_TIMESTAMP,
    fully_matched_at = CASE
        WHEN shares_filled + sqlc.arg(fill_shares)::numeric >= qty_shares THEN COALESCE(fully_matched_at, CURRENT_TIMESTAMP)
        ELSE fully_matched_at
    END
WHERE tx_id = sqlc.arg(tx_id) AND protocol_version = 2
RETURNING *;

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
UPDATE prediction_intents -- updates all rows where market_id=$1 and evmaddress matches $2 (case and 0x insensitive)
SET redeemed_at = CURRENT_TIMESTAMP
WHERE market_id = $1 AND lower(replace(evmaddress, '0x', '')) = lower(replace(sqlc.arg(evmaddress), '0x', ''));



-- DELETE

-- name: CancelPredictionIntent :exec
UPDATE prediction_intents
SET cancelled_at = CURRENT_TIMESTAMP
WHERE tx_id = $1 AND cancelled_at IS NULL AND fully_matched_at IS NULL AND evicted_at IS NULL;
