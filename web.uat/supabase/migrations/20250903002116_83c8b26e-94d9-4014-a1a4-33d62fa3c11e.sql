-- Phase 1: Database Infrastructure for DAO Governance

-- Create enum for governance status
CREATE TYPE governance_status AS ENUM ('draft', 'proposal', 'voting', 'election', 'approved', 'rejected', 'deployed');

-- Create enum for proposal types
CREATE TYPE proposal_type AS ENUM ('market_creation', 'market_amendment', 'liquidity_incentive', 'governance_parameter');

-- Create enum for vote choices
CREATE TYPE vote_choice AS ENUM ('yes', 'no', 'abstain');

-- Create enum for oracle types
CREATE TYPE oracle_type AS ENUM ('chainlink', 'supra', 'api_endpoint', 'manual');

-- User token balances for PROTOCOL_TOKEN tracking
CREATE TABLE public.user_token_balances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    token_balance NUMERIC NOT NULL DEFAULT 0,
    staked_balance NUMERIC NOT NULL DEFAULT 0,
    total_voting_power NUMERIC NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Staking positions for enhanced voting power
CREATE TABLE public.staking_positions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    staked_amount NUMERIC NOT NULL,
    stake_duration INTEGER NOT NULL, -- in days
    voting_power_multiplier NUMERIC NOT NULL DEFAULT 1.0,
    stake_start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    stake_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Market proposals for DAO governance
CREATE TABLE public.market_proposals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    proposer_id UUID NOT NULL,
    proposal_type proposal_type NOT NULL DEFAULT 'market_creation',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    market_title TEXT,
    market_description TEXT,
    market_outcomes JSONB, -- For binary: {"yes": "description", "no": "description"}
    resolution_date TIMESTAMP WITH TIME ZONE,
    oracle_type oracle_type,
    oracle_config JSONB, -- API endpoints, contract addresses, etc.
    initial_liquidity NUMERIC,
    collateral_type TEXT DEFAULT 'HBAR',
    governance_status governance_status NOT NULL DEFAULT 'draft',
    voting_start_date TIMESTAMP WITH TIME ZONE,
    voting_end_date TIMESTAMP WITH TIME ZONE,
    election_start_date TIMESTAMP WITH TIME ZONE,
    election_end_date TIMESTAMP WITH TIME ZONE,
    proposal_votes_for INTEGER NOT NULL DEFAULT 0,
    proposal_votes_against INTEGER NOT NULL DEFAULT 0,
    proposal_votes_abstain INTEGER NOT NULL DEFAULT 0,
    proposal_voting_power_for NUMERIC NOT NULL DEFAULT 0,
    proposal_voting_power_against NUMERIC NOT NULL DEFAULT 0,
    proposal_voting_power_abstain NUMERIC NOT NULL DEFAULT 0,
    election_votes_for INTEGER NOT NULL DEFAULT 0,
    election_votes_against INTEGER NOT NULL DEFAULT 0,
    election_votes_abstain INTEGER NOT NULL DEFAULT 0,
    election_voting_power_for NUMERIC NOT NULL DEFAULT 0,
    election_voting_power_against NUMERIC NOT NULL DEFAULT 0,
    election_voting_power_abstain NUMERIC NOT NULL DEFAULT 0,
    hcs_topic_id TEXT, -- Hedera Consensus Service topic for tamper-proof recording
    hcs_message_id TEXT,
    deployment_tx_hash TEXT, -- Transaction hash when market is deployed
    deployed_market_id UUID,
    failure_reason TEXT,
    cooldown_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Individual votes on proposals and elections
CREATE TABLE public.proposal_votes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id UUID NOT NULL REFERENCES public.market_proposals(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL,
    vote_choice vote_choice NOT NULL,
    voting_power NUMERIC NOT NULL,
    is_proposal_phase BOOLEAN NOT NULL DEFAULT true, -- true for proposal, false for election
    wallet_signature TEXT NOT NULL, -- For verification
    hcs_message_id TEXT, -- Reference to HCS submission
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(proposal_id, voter_id, is_proposal_phase)
);

-- Voting power snapshots for historical tracking
CREATE TABLE public.voting_power_snapshots (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    proposal_id UUID REFERENCES public.market_proposals(id) ON DELETE CASCADE,
    snapshot_date TIMESTAMP WITH TIME ZONE NOT NULL,
    token_balance NUMERIC NOT NULL,
    staked_balance NUMERIC NOT NULL,
    total_voting_power NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Market deployment queue for approved markets
CREATE TABLE public.market_deployment_queue (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id UUID NOT NULL REFERENCES public.market_proposals(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 1,
    deployment_status TEXT NOT NULL DEFAULT 'pending', -- pending, deploying, completed, failed
    smart_contract_address TEXT,
    yes_token_id TEXT, -- HTS token ID for YES outcome
    no_token_id TEXT, -- HTS token ID for NO outcome
    deployment_error TEXT,
    deployment_attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    deployed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Governance settings for configurable parameters
CREATE TABLE public.governance_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on all tables
ALTER TABLE public.user_token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staking_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_power_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_deployment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_token_balances
CREATE POLICY "Users can view their own token balances" 
ON public.user_token_balances 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Public read access to token balances for governance" 
ON public.user_token_balances 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage token balances" 
ON public.user_token_balances 
FOR ALL 
USING (true)
WITH CHECK (true);

-- RLS Policies for staking_positions
CREATE POLICY "Users can view their own staking positions" 
ON public.staking_positions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own staking positions" 
ON public.staking_positions 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for market_proposals
CREATE POLICY "Public read access to market proposals" 
ON public.market_proposals 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create proposals" 
ON public.market_proposals 
FOR INSERT 
WITH CHECK (auth.uid() = proposer_id);

CREATE POLICY "Proposers can update their own proposals" 
ON public.market_proposals 
FOR UPDATE 
USING (auth.uid() = proposer_id);

CREATE POLICY "Service role can manage all proposals" 
ON public.market_proposals 
FOR ALL 
USING (true)
WITH CHECK (true);

-- RLS Policies for proposal_votes
CREATE POLICY "Public read access to votes" 
ON public.proposal_votes 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own votes" 
ON public.proposal_votes 
FOR INSERT 
WITH CHECK (auth.uid() = voter_id);

CREATE POLICY "Service role can manage votes" 
ON public.proposal_votes 
FOR ALL 
USING (true)
WITH CHECK (true);

-- RLS Policies for voting_power_snapshots
CREATE POLICY "Public read access to voting power snapshots" 
ON public.voting_power_snapshots 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage snapshots" 
ON public.voting_power_snapshots 
FOR ALL 
USING (true)
WITH CHECK (true);

-- RLS Policies for market_deployment_queue
CREATE POLICY "Public read access to deployment queue" 
ON public.market_deployment_queue 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage deployment queue" 
ON public.market_deployment_queue 
FOR ALL 
USING (true)
WITH CHECK (true);

-- RLS Policies for governance_settings
CREATE POLICY "Public read access to governance settings" 
ON public.governance_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage governance settings" 
ON public.governance_settings 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add governance fields to existing event_markets table
ALTER TABLE public.event_markets 
ADD COLUMN proposal_id UUID REFERENCES public.market_proposals(id),
ADD COLUMN governance_status governance_status DEFAULT 'deployed',
ADD COLUMN oracle_type oracle_type,
ADD COLUMN oracle_config JSONB,
ADD COLUMN collateral_type TEXT DEFAULT 'HBAR',
ADD COLUMN smart_contract_address TEXT,
ADD COLUMN yes_token_id TEXT,
ADD COLUMN no_token_id TEXT;

-- Create triggers for updated_at columns
CREATE TRIGGER update_user_token_balances_updated_at
    BEFORE UPDATE ON public.user_token_balances
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staking_positions_updated_at
    BEFORE UPDATE ON public.staking_positions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_market_proposals_updated_at
    BEFORE UPDATE ON public.market_proposals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_market_deployment_queue_updated_at
    BEFORE UPDATE ON public.market_deployment_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_governance_settings_updated_at
    BEFORE UPDATE ON public.governance_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default governance settings
INSERT INTO public.governance_settings (setting_key, setting_value, description) VALUES
('min_proposal_voting_power', '100000', 'Minimum voting power required to submit a proposal'),
('proposal_voting_duration_hours', '24', 'Duration of proposal voting phase in hours'),
('proposal_quorum_voting_power', '5000000', 'Minimum voting power required for proposal quorum'),
('election_voting_duration_hours', '24', 'Duration of election voting phase in hours'),
('election_quorum_voting_power', '10000000', 'Minimum voting power required for election quorum'),
('failed_proposal_cooldown_hours', '336', 'Cooldown period for failed proposals in hours (2 weeks)'),
('max_proposal_description_length', '10000', 'Maximum length of proposal description'),
('voting_power_snapshot_delay_hours', '1', 'Delay before taking voting power snapshot for proposals');

-- Create indexes for performance
CREATE INDEX idx_user_token_balances_user_id ON public.user_token_balances(user_id);
CREATE INDEX idx_staking_positions_user_id ON public.staking_positions(user_id);
CREATE INDEX idx_staking_positions_active ON public.staking_positions(is_active, stake_end_date);
CREATE INDEX idx_market_proposals_status ON public.market_proposals(governance_status);
CREATE INDEX idx_market_proposals_proposer ON public.market_proposals(proposer_id);
CREATE INDEX idx_market_proposals_dates ON public.market_proposals(voting_start_date, voting_end_date, election_start_date, election_end_date);
CREATE INDEX idx_proposal_votes_proposal ON public.proposal_votes(proposal_id);
CREATE INDEX idx_proposal_votes_voter ON public.proposal_votes(voter_id);
CREATE INDEX idx_voting_power_snapshots_user_proposal ON public.voting_power_snapshots(user_id, proposal_id);
CREATE INDEX idx_market_deployment_queue_status ON public.market_deployment_queue(deployment_status);
CREATE INDEX idx_market_deployment_queue_scheduled ON public.market_deployment_queue(scheduled_for);
CREATE INDEX idx_governance_settings_key ON public.governance_settings(setting_key);
CREATE INDEX idx_event_markets_proposal ON public.event_markets(proposal_id);
CREATE INDEX idx_event_markets_governance_status ON public.event_markets(governance_status);