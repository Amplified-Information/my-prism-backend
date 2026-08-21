-- add a net column to prism_rewards table to support multiple networks
ALTER TABLE prism_rewards
    ADD COLUMN net VARCHAR(255) NOT NULL DEFAULT 'testnet' CHECK (net IN ('mainnet', 'testnet'));

CREATE INDEX idx_prism_rewards_net_account_unredeemed 
ON prism_rewards(net, dest_account_id, redeemed_at)
WHERE redeemed_at IS NULL;