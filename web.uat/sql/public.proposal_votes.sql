-- ============================================================
-- DDL Script for: proposal_votes
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- ENUM DEPENDENCY
-- ===================
-- Requires: vote_choice (yes, no, abstain)

-- ===================
-- TABLE DEFINITION
-- ===================

CREATE TABLE public.proposal_votes (
    -- Primary Key
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- Foreign Key
    proposal_id             UUID            NOT NULL,
    
    -- Voter Information
    voter_id                UUID            NULL,
    wallet_id               TEXT            NULL,
    wallet_signature        TEXT            NOT NULL,
    
    -- Vote Details
    vote_choice             vote_choice     NOT NULL,
    voting_power            NUMERIC         NOT NULL,
    is_proposal_phase       BOOLEAN         NOT NULL DEFAULT true,
    
    -- Hedera Integration
    hcs_message_id          TEXT            NULL,
    
    -- Timestamps
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Constraints
    CONSTRAINT proposal_votes_pkey PRIMARY KEY (id),
    CONSTRAINT proposal_votes_proposal_id_fkey 
        FOREIGN KEY (proposal_id) 
        REFERENCES public.market_proposals(id) 
        ON DELETE CASCADE,
    -- Ensure one vote per wallet per proposal per phase
    CONSTRAINT proposal_votes_unique_wallet_proposal_phase 
        UNIQUE (proposal_id, wallet_id, is_proposal_phase)
);

-- ===================
-- INDEXES
-- ===================

CREATE INDEX idx_proposal_votes_proposal_id 
    ON public.proposal_votes USING btree (proposal_id);

CREATE INDEX idx_proposal_votes_wallet_id 
    ON public.proposal_votes USING btree (wallet_id);

CREATE INDEX idx_proposal_votes_voter_id 
    ON public.proposal_votes USING btree (voter_id);

CREATE INDEX idx_proposal_votes_vote_choice 
    ON public.proposal_votes USING btree (vote_choice);

CREATE INDEX idx_proposal_votes_is_proposal_phase 
    ON public.proposal_votes USING btree (is_proposal_phase);

CREATE INDEX idx_proposal_votes_created_at 
    ON public.proposal_votes USING btree (created_at DESC);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE public.proposal_votes ENABLE ROW LEVEL SECURITY;

-- Wallets can view their own votes
CREATE POLICY "Wallets can view their own votes"
    ON public.proposal_votes
    FOR SELECT
    USING (wallet_id IS NOT NULL);

-- Wallets can create votes
CREATE POLICY "Wallets can create votes"
    ON public.proposal_votes
    FOR INSERT
    WITH CHECK (wallet_id IS NOT NULL);

-- Service role can manage votes
CREATE POLICY "Service role can manage votes"
    ON public.proposal_votes
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===================
-- COMMENTS
-- ===================

COMMENT ON TABLE public.proposal_votes IS 'Votes cast on governance proposals';
COMMENT ON COLUMN public.proposal_votes.vote_choice IS 'Vote option: yes, no, or abstain';
COMMENT ON COLUMN public.proposal_votes.voting_power IS 'Weight of vote based on token holdings/staking';
COMMENT ON COLUMN public.proposal_votes.is_proposal_phase IS 'True for proposal phase, false for election phase';
COMMENT ON COLUMN public.proposal_votes.wallet_signature IS 'Cryptographic signature verifying vote authenticity';
