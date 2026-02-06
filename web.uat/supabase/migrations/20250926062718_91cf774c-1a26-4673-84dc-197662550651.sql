-- Make voter_id nullable in proposal_votes since we now use wallet_id
ALTER TABLE proposal_votes 
ALTER COLUMN voter_id DROP NOT NULL;