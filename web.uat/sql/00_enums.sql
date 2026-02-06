-- ============================================================
-- DDL Script for: All ENUM Types
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- ENUM DEFINITIONS
-- ===================

-- Resolution status for markets
CREATE TYPE public.resolution_status AS ENUM (
    'open',
    'closed',
    'resolved',
    'cancelled'
);

COMMENT ON TYPE public.resolution_status IS 'Tracks the lifecycle state of a prediction market';

-- Governance status for proposals and markets
CREATE TYPE public.governance_status AS ENUM (
    'draft',
    'proposal',
    'voting',
    'election',
    'approved',
    'rejected',
    'deployed'
);

COMMENT ON TYPE public.governance_status IS 'Tracks the governance lifecycle of market proposals';

-- Oracle types for market resolution
CREATE TYPE public.oracle_type AS ENUM (
    'chainlink',
    'supra',
    'api_endpoint',
    'manual'
);

COMMENT ON TYPE public.oracle_type IS 'Defines the data source for market resolution';

-- Proposal types for governance
CREATE TYPE public.proposal_type AS ENUM (
    'market_creation',
    'market_amendment',
    'liquidity_incentive',
    'governance_parameter'
);

COMMENT ON TYPE public.proposal_type IS 'Categories of governance proposals';

-- Vote choices for governance voting
CREATE TYPE public.vote_choice AS ENUM (
    'yes',
    'no',
    'abstain'
);

COMMENT ON TYPE public.vote_choice IS 'Available voting options for proposals';

-- Comment position (trading stance)
CREATE TYPE public.comment_position AS ENUM (
    'YES',
    'NO'
);

COMMENT ON TYPE public.comment_position IS 'User trading position indicated in comments';

-- Reaction types for comments
CREATE TYPE public.reaction_type AS ENUM (
    'like',
    'dislike'
);

COMMENT ON TYPE public.reaction_type IS 'Available reaction types for comments';

-- Report status for moderation
CREATE TYPE public.report_status AS ENUM (
    'pending',
    'reviewed',
    'resolved'
);

COMMENT ON TYPE public.report_status IS 'Status of user-submitted reports';
