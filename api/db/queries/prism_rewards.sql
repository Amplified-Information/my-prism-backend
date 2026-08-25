-- CREATE
-- name: CreatePrismReward :exec
INSERT INTO prism_rewards (
  net,
  dest_account_id,
  n_prism_scaled,
  ratio_of_allocation,
  cron_ran_at,
  campaign_id
) VALUES (
  $1, $2, $3, $4, $5, $6
) RETURNING *;



-- READ
-- name: GetUnredeemedPrismRewardsByUser :many
SELECT * FROM prism_rewards
WHERE net = $1 AND dest_account_id = $2
  AND redeemed_at IS NULL
ORDER BY created_at DESC;

-- name: GetTotalUnredeemedPrismRewardsByUser :one
SELECT COALESCE(SUM(n_prism_scaled), 0)::BIGINT AS total_unredeemed_prism
FROM prism_rewards
WHERE net = $1 AND dest_account_id = $2
  AND redeemed_at IS NULL;

-- name: GetRedeemablePrismRewardsByUser :many
SELECT * FROM prism_rewards
WHERE net = $1 AND dest_account_id = $2
  AND redeemed_at IS NULL
  AND is_redeemable IS TRUE
ORDER BY created_at DESC;

-- name: GetTotalRedeemablePrismRewardsByUser :one
SELECT COALESCE(SUM(n_prism_scaled), 0)::BIGINT AS total_redeemable_prism
FROM prism_rewards
WHERE net = $1 AND dest_account_id = $2
  AND redeemed_at IS NULL
  AND is_redeemable IS TRUE;

-- name: GetRedeemedPrismRewardsByUser :many
SELECT * FROM prism_rewards
WHERE net = $1 AND dest_account_id = $2
  AND redeemed_at IS NOT NULL
ORDER BY redeemed_at DESC;

-- name: GetTotalRedeemedPrismRewardsByUser :one
SELECT COALESCE(SUM(n_prism_scaled), 0)::BIGINT AS total_redeemed_prism
FROM prism_rewards
WHERE net = $1 AND dest_account_id = $2
  AND redeemed_at IS NOT NULL;

-- UPDATE





-- DELETE