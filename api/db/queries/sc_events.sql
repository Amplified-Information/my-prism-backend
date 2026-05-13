-- keep in sync with Prism.sol
-- event PositionTokensPurchased(uint128 marketId, address indexed buyer, uint256 collateralUsd, uint256 qtyScaled);
-- event MarketResolved(uint128 marketId, bool outcome);
-- event WinningsRedeemed(uint128 marketId, address indexed winner, uint256 amount);
-- event TokenAssociated(address indexed token);

-- CREATE

-- name: CreatePositionTokensPurchased :one
INSERT INTO event_position_tokens_purchased (
  net, smart_contract_id, timestamp_nano, tx_hash, hostname,
  md5_uniq,
  market_id, buyer, collateral_usd, qty_scaled, primary_secondary)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: CreateMarketResolved :one
INSERT INTO event_market_resolved (
  net, smart_contract_id, timestamp_nano, tx_hash, hostname,
  md5_uniq,
  market_id, outcome)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: CreateWinningsRedeemed :one
INSERT INTO event_winnings_redeemed (
  net, smart_contract_id, timestamp_nano, tx_hash, hostname,
  md5_uniq,
  market_id, winner, amount)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: CreateTokenAssociated :one
INSERT INTO event_token_associated (
  net, smart_contract_id, timestamp_nano, tx_hash, hostname,
  md5_uniq,
  token)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;




-- READ








-- UPDATE (not applicable for events)









-- DELETE (please don't delete on-chain events)


