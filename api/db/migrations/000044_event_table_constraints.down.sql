-- reverse: apply a constraint to event_market_resolved - market_id
ALTER TABLE event_market_resolved
DROP CONSTRAINT event_market_resolved_market_id_unique;

-- reverse: apply a constraint to event_winnings_redeemed - market_id and winner
ALTER TABLE event_winnings_redeemed
DROP CONSTRAINT event_winnings_redeemed_market_id_winner_unique;
