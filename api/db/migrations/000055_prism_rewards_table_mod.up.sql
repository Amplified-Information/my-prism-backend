-- prism_rewards table
-- rename:
-- - sent_at -> redeemed_at
-- - sent_by -> redeemed_by
-- add a new column:
-- - is_redeemable BOOLEAN NOT NULL DEFAULT FALSE
ALTER TABLE prism_rewards
    RENAME COLUMN sent_at TO redeemed_at;
ALTER TABLE prism_rewards
    RENAME COLUMN sent_by TO redeemed_by;
ALTER TABLE prism_rewards
    ADD COLUMN is_redeemable BOOLEAN NOT NULL DEFAULT FALSE;
