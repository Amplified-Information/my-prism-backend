-- ============================================================
-- DDL Script for: market_proposals
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- ENUM DEPENDENCIES
-- ===================
-- Requires: governance_status, proposal_type, oracle_type

-- ===================
-- TABLE DEFINITION
-- ===================

CREATE TABLE public.market_proposals (
    -- Primary Key
    id                              UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- Proposer Information
    proposer_id                     UUID            NOT NULL,
    proposer_wallet_id              TEXT            NULL,
    
    -- Proposal Details
    title                           TEXT            NOT NULL,
    description                     TEXT            NOT NULL,
    proposal_type                   proposal_type   NOT NULL DEFAULT 'market_creation'::proposal_type,
    
    -- Market Details (for market_creation proposals)
    market_title                    TEXT            NULL,
    market_description              TEXT            NULL,
    market_outcomes                 JSONB           NULL,
    resolution_date                 TIMESTAMPTZ     NULL,
    image_url                       TEXT            NULL,
    
    -- Oracle Configuration
    oracle_type                     oracle_type     NULL,
    oracle_config                   JSONB           NULL,
    
    -- Financial Settings
    initial_liquidity               NUMERIC         NULL,
    collateral_type                 TEXT            NULL DEFAULT 'HBAR'::text,
    
    -- Governance Status
    governance_status               governance_status NOT NULL DEFAULT 'draft'::governance_status,
    
    -- Proposal Phase Voting
    voting_start_date               TIMESTAMPTZ     NULL,
    voting_end_date                 TIMESTAMPTZ     NULL,
    proposal_votes_for              INTEGER         NOT NULL DEFAULT 0,
    proposal_votes_against          INTEGER         NOT NULL DEFAULT 0,
    proposal_votes_abstain          INTEGER         NOT NULL DEFAULT 0,
    proposal_voting_power_for       NUMERIC         NOT NULL DEFAULT 0,
    proposal_voting_power_against   NUMERIC         NOT NULL DEFAULT 0,
    proposal_voting_power_abstain   NUMERIC         NOT NULL DEFAULT 0,
    
    -- Election Phase Voting
    election_start_date             TIMESTAMPTZ     NULL,
    election_end_date               TIMESTAMPTZ     NULL,
    election_votes_for              INTEGER         NOT NULL DEFAULT 0,
    election_votes_against          INTEGER         NOT NULL DEFAULT 0,
    election_votes_abstain          INTEGER         NOT NULL DEFAULT 0,
    election_voting_power_for       NUMERIC         NOT NULL DEFAULT 0,
    election_voting_power_against   NUMERIC         NOT NULL DEFAULT 0,
    election_voting_power_abstain   NUMERIC         NOT NULL DEFAULT 0,
    
    -- Deployment
    deployed_market_id              UUID            NULL,
    deployment_tx_hash              TEXT            NULL,
    failure_reason                  TEXT            NULL,
    
    -- Hedera Integration
    hcs_topic_id                    TEXT            NULL,
    hcs_message_id                  TEXT            NULL,
    
    -- Cooldown
    cooldown_until                  TIMESTAMPTZ     NULL,
    
    -- Timestamps
    created_at                      TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at                      TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Constraints
    CONSTRAINT market_proposals_pkey PRIMARY KEY (id)
);

-- ===================
-- INDEXES
-- ===================

CREATE INDEX idx_market_proposals_proposer_id 
    ON public.market_proposals USING btree (proposer_id);

CREATE INDEX idx_market_proposals_proposer_wallet_id 
    ON public.market_proposals USING btree (proposer_wallet_id);

CREATE INDEX idx_market_proposals_governance_status 
    ON public.market_proposals USING btree (governance_status);

CREATE INDEX idx_market_proposals_proposal_type 
    ON public.market_proposals USING btree (proposal_type);

CREATE INDEX idx_market_proposals_created_at 
    ON public.market_proposals USING btree (created_at DESC);

CREATE INDEX idx_market_proposals_voting_dates 
    ON public.market_proposals USING btree (voting_start_date, voting_end_date);

CREATE INDEX idx_market_proposals_election_dates 
    ON public.market_proposals USING btree (election_start_date, election_end_date);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE public.market_proposals ENABLE ROW LEVEL SECURITY;

-- Public read access to proposals
CREATE POLICY "Public read access to proposals"
    ON public.market_proposals
    FOR SELECT
    USING (true);

-- Wallets can create proposals
CREATE POLICY "Wallets can create proposals"
    ON public.market_proposals
    FOR INSERT
    WITH CHECK (proposer_wallet_id IS NOT NULL);

-- Proposers can update their own proposals via wallet
CREATE POLICY "Proposers can update their own proposals via wallet"
    ON public.market_proposals
    FOR UPDATE
    USING (proposer_wallet_id IS NOT NULL);

-- Service role can manage all proposals
CREATE POLICY "Service role can manage all proposals"
    ON public.market_proposals
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===================
-- COMMENTS
-- ===================

COMMENT ON TABLE public.market_proposals IS 'Governance proposals for creating and managing prediction markets';
COMMENT ON COLUMN public.market_proposals.governance_status IS 'Current stage in the governance lifecycle';
COMMENT ON COLUMN public.market_proposals.proposal_type IS 'Type of proposal: market_creation, amendment, etc.';
COMMENT ON COLUMN public.market_proposals.hcs_topic_id IS 'Hedera Consensus Service topic for on-chain record';
COMMENT ON COLUMN public.market_proposals.market_outcomes IS 'JSON array of possible market outcomes';
