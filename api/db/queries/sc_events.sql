-- keep in sync with Prism.sol
--  event DaoUpdated(address newDao);
--  event MarketResolved(uint128 marketId, uint8 outcome);
--  event OracleUpdated(address newOracle);
--  event PositionTokensPurchased(uint128 marketId, address indexed buyer, uint256 collateralUsd, uint256 qtyScaled, bool primarySecondary);
--  event RakeUpdated(uint256 newRakePercentScaled100);
--  event TokenAssociated(address indexed token);
--  event WinningsRedeemed(uint128 marketId, address indexed winner, uint256 amount);


-- CREATE

-- name: CreateDaoUpdatedEvent :one
INSERT INTO event_dao_updated (
  net, smart_contract_id, timestamp_nano, tx_hash, hostname,
  md5_uniq,
  new_dao_address)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: CreateMarketResolvedEvent :one
INSERT INTO event_market_resolved (
  net, smart_contract_id, timestamp_nano, tx_hash, hostname,
  md5_uniq,
  market_id, outcome)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: CreateOracleUpdatedEvent :one
INSERT INTO event_oracle_updated (
  net, smart_contract_id, timestamp_nano, tx_hash, hostname,
  md5_uniq,
  new_oracle_address)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: CreatePositionTokensPurchasedEvent :one
INSERT INTO event_position_tokens_purchased (
  net, smart_contract_id, timestamp_nano, tx_hash, hostname,
  md5_uniq,
  market_id, buyer, collateral_usd, qty_scaled, primary_secondary)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: CreateRakeUpdatedEvent :one
INSERT INTO event_rake_updated (
  net, smart_contract_id, timestamp_nano, tx_hash, hostname,
  md5_uniq,
  new_rake_percent_scaled_100)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: CreateTokenAssociatedEvent :one
INSERT INTO event_token_associated (
  net, smart_contract_id, timestamp_nano, tx_hash, hostname,
  md5_uniq,
  token)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: CreateWinningsRedeemedEvent :one
INSERT INTO event_winnings_redeemed (
  net, smart_contract_id, timestamp_nano, tx_hash, hostname,
  md5_uniq,
  market_id, winner, amount)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;



-- READ

-- name: GetMarketResolvedEventByMarketId :one
-- there's only ever one row - constraint on the table
SELECT * FROM event_market_resolved
WHERE market_id = $1;

-- name: GetWinningsRedeemedEventByMarketIdAndWinner :one
-- there's only ever one row - constraint on the table
SELECT * FROM event_winnings_redeemed
WHERE market_id = $1
  AND lower(replace(winner, '0x', '')) = lower(replace(sqlc.arg(winner), '0x', ''));





-- UPDATE (not applicable for events)









-- DELETE (please don't delete on-chain events)


