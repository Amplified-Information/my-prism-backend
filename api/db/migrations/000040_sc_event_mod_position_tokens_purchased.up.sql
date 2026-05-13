-- modify event_position_tokens_purchased
-- add a column called primary_secondary to indicate whether the event is for the primary or secondary position (YES or NO)
ALTER TABLE event_position_tokens_purchased
ADD COLUMN primary_secondary BOOLEAN NOT NULL;
