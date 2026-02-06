-- Simplified approach: Add wallet_id columns and populate them
-- without triggering update triggers

-- Step 1: Add wallet_id column to proposal_votes
ALTER TABLE proposal_votes ADD COLUMN IF NOT EXISTS wallet_id TEXT;

-- Step 2: Add proposer_wallet_id column to market_proposals  
ALTER TABLE market_proposals ADD COLUMN IF NOT EXISTS proposer_wallet_id TEXT;

-- Step 3: Add wallet_id to user_token_balances
ALTER TABLE user_token_balances ADD COLUMN IF NOT EXISTS wallet_id TEXT;

-- Step 4: Add wallet_id to staking_positions
ALTER TABLE staking_positions ADD COLUMN IF NOT EXISTS wallet_id TEXT;

-- Step 5: Add wallet_id to voting_power_snapshots  
ALTER TABLE voting_power_snapshots ADD COLUMN IF NOT EXISTS wallet_id TEXT;