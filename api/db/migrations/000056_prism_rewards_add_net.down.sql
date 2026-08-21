-- drop the net column from prism_rewards table
ALTER TABLE prism_rewards
  DROP COLUMN net;

-- remove the indexes:
DROP INDEX IF EXISTS idx_prism_rewards_net_account_unredeemed;
