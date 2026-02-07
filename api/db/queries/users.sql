-- CREATE

-- READ


-- name: GetUserByWalletIdAndNetwork :one
SELECT * FROM users WHERE wallet_id = $1 AND network = $2;


-- name: GetUserChallenge :one
SELECT challenge FROM users WHERE wallet_id = $1 AND network = $2;



-- UPDATE


-- name: UpdateUserChallenge :exec
UPDATE users
SET challenge = $1::bigint,
  updated_at = NOW()
WHERE wallet_id = $2 AND network = $3;



-- DELETE
