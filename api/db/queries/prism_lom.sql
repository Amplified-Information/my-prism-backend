-- CREATE
-- name: CreateLOMentryForUserOnMarket :exec
INSERT INTO prism_lom (
  market_id, 
  account_id, 
  prediction_intent_tx_id, 
  total_lom_score, 
  cron_ran_at,
  hedera_tx_hash
) VALUES ($1, $2, $3, $4, $5, $6);


-- READ




-- UPDATE




-- DELETE