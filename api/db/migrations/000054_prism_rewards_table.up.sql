-- create a table called prism_rewards

CREATE TABLE IF NOT EXISTS prism_rewards (
    id SERIAL PRIMARY KEY,
    dest_account_id VARCHAR(255) NOT NULL CHECK (dest_account_id ~ '^[0-9]+\.[0-9]+\.[0-9]+$'), -- must be of 0.0.0 format
    n_prism_scaled BIGINT NOT NULL DEFAULT 0 CHECK (n_prism_scaled >= 0),
    ratio_of_allocation DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (ratio_of_allocation >= 0.0 AND ratio_of_allocation <= 1.0),
    hedera_tx_hash VARCHAR(255),
    cron_ran_at TIMESTAMP DEFAULT NULL,
    sent_at TIMESTAMP DEFAULT NULL,
    sent_by VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);



-- updated_at trigger:
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_prism_rewards_updated_at
BEFORE UPDATE ON prism_rewards
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
