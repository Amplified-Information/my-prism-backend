-- modify table event_position_tokens_purchased - change market_id to varchar(64)
ALTER TABLE event_position_tokens_purchased
ALTER COLUMN market_id TYPE varchar(64);

-- modify table event_market_resolved - change market_id to varchar(64)
ALTER TABLE event_market_resolved
ALTER COLUMN market_id TYPE varchar(64);

-- modify table event_winnings_redeemed - change market_id to varchar(64)
ALTER TABLE event_winnings_redeemed
ALTER COLUMN market_id TYPE varchar(64);
