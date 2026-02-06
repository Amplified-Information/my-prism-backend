-- Update RLS policies for wallet-based governance

-- Update proposal_votes policies to work with wallet_id
DROP POLICY IF EXISTS "Users can create their own votes" ON proposal_votes;
DROP POLICY IF EXISTS "Users can view their own votes" ON proposal_votes;

-- Create new policies that work with wallet_id
CREATE POLICY "Wallets can create votes" 
ON proposal_votes 
FOR INSERT 
WITH CHECK (wallet_id IS NOT NULL);

CREATE POLICY "Wallets can view their own votes" 
ON proposal_votes 
FOR SELECT 
USING (wallet_id IS NOT NULL);

-- Update market_proposals policies to work with proposer_wallet_id  
DROP POLICY IF EXISTS "Users can create proposals" ON market_proposals;
DROP POLICY IF EXISTS "Proposers can update their own proposals" ON market_proposals;

-- Create new policies for wallet-based proposals
CREATE POLICY "Wallets can create proposals" 
ON market_proposals 
FOR INSERT 
WITH CHECK (proposer_wallet_id IS NOT NULL);

CREATE POLICY "Proposers can update their own proposals via wallet" 
ON market_proposals 
FOR UPDATE 
USING (proposer_wallet_id IS NOT NULL);

-- Make sure public read access still works
CREATE POLICY "Public read access to proposals" 
ON market_proposals 
FOR SELECT 
USING (true);