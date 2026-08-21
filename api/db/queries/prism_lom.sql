-- CREATE
-- name: CreateLOMentryForUserOnMarket :exec
INSERT INTO prism_lom (
  market_id, 
  account_id, 
  distance,
  dollar_value,
  duration,
  lom_score
) VALUES ($1, $2, $3, $4, $5, $6);









-- READ



-- name: GetLOMrewardsByMarketId :many
SELECT * FROM prism_lom
WHERE market_id = $1
ORDER BY lom_score DESC;

-- name: GetLOMrewardsByAccountId :many
SELECT * FROM prism_lom
WHERE account_id = $1
ORDER BY lom_score DESC;








-- UPDATE




-- DELETE