-- reverse the up:
ALTER TABLE prism_rewards
    RENAME COLUMN redeemed_at TO sent_at;
ALTER TABLE prism_rewards
    RENAME COLUMN redeemed_by TO sent_by;
ALTER TABLE prism_rewards
    DROP COLUMN is_redeemable;
