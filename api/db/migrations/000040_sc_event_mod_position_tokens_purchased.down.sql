-- remove the column primary_secondary from event_position_tokens_purchased
ALTER TABLE event_position_tokens_purchased
DROP COLUMN primary_secondary;
