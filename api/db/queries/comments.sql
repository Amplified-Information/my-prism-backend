-- CREATE

-- name: AddComment :one
INSERT INTO comments (market_id, account_id, content, sig, public_key, key_type)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING 
  comment_id, account_id, content, created_at;








-- READ

-- name: GetCommentsByMarketId :many
-- params: market_id, limit, offset
SELECT 
  comment_id,
  account_id,
  content,
  sig,
  public_key,
  key_type,
  created_at
FROM 
  comments
WHERE 
  market_id = $1
ORDER BY 
  created_at DESC
LIMIT 
  $2 OFFSET $3;







-- UPDATE





-- DELETE

-- name: DeleteComment :exec
DELETE FROM comments
WHERE 
  comment_id = $1;
