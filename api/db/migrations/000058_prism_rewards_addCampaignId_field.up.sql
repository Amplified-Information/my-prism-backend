-- add a column to the prism_rewards table to store the campaign_id for each reward
-- for existing rows, set the campaign_id to 1 (the first campaign)
ALTER TABLE prism_rewards ADD COLUMN campaign_id BIGINT NOT NULL DEFAULT 1;

