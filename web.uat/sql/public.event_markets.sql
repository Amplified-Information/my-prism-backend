-- ============================================================
-- DDL Script for: event_markets
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- ENUM DEPENDENCIES
-- ===================
-- These enums must exist before creating the table

CREATE TYPE resolution_status AS ENUM (
    'open',
    'closed',
    'resolved',
    'cancelled'
);

CREATE TYPE governance_status AS ENUM (
    'draft',
    'proposal',
    'voting',
    'election',
    'approved',
    'rejected',
    'deployed'
);

CREATE TYPE oracle_type AS ENUM (
    'chainlink',
    'supra',
    'api_endpoint',
    'manual'
);

-- ===================
-- TABLE DEFINITION
-- ===================

CREATE TABLE public.event_markets (
    -- Primary Key
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- Core Market Information
    name                    VARCHAR(500)    NOT NULL,
    description             TEXT            NULL,
    category_id             UUID            NOT NULL,
    subcategory_id          UUID            NULL,
    market_structure        VARCHAR(50)     NOT NULL DEFAULT 'binary'::character varying,
    market_format           TEXT            NULL DEFAULT 'binary'::text,
    
    -- Display Flags
    is_featured             BOOLEAN         NOT NULL DEFAULT false,
    is_trending             BOOLEAN         NOT NULL DEFAULT false,
    is_new                  BOOLEAN         NOT NULL DEFAULT false,
    is_active               BOOLEAN         NOT NULL DEFAULT true,
    
    -- Pricing (Binary Markets)
    yes_price               NUMERIC         NOT NULL DEFAULT 0.5000,
    no_price                NUMERIC         NOT NULL DEFAULT 0.5000,
    
    -- Market Metrics
    volume                  NUMERIC         NOT NULL DEFAULT 0.00,
    liquidity               NUMERIC         NOT NULL DEFAULT 0.00,
    total_shares            BIGINT          NOT NULL DEFAULT 0,
    change_24h              NUMERIC         NOT NULL DEFAULT 0.0000,
    options_count           INTEGER         NULL DEFAULT 2,
    participants_count      INTEGER         NULL DEFAULT 2,
    
    -- Timestamps
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    end_date                TIMESTAMPTZ     NOT NULL,
    resolution_date         TIMESTAMPTZ     NULL,
    
    -- Resolution
    resolution_status       resolution_status NOT NULL DEFAULT 'open'::resolution_status,
    resolved_value          BOOLEAN         NULL,
    resolution_notes        TEXT            NULL,
    resolution_criteria     TEXT            NULL,
    
    -- Betting Limits
    minimum_bet             NUMERIC         NOT NULL DEFAULT 1.00,
    maximum_bet             NUMERIC         NULL,
    
    -- Ordering
    sort_order              INTEGER         NOT NULL DEFAULT 999,
    featured_order          INTEGER         NULL,
    
    -- Ownership
    created_by              UUID            NULL,
    
    -- Content
    relevance               TEXT            NULL,
    why_it_matters          TEXT            NULL,
    important_notes         TEXT            NULL,
    image_url               TEXT            NULL,
    
    -- Governance Integration
    proposal_id             UUID            NULL,
    governance_status       governance_status NULL DEFAULT 'deployed'::governance_status,
    
    -- Oracle Configuration
    oracle_type             oracle_type     NULL,
    oracle_config           JSONB           NULL,
    
    -- Hedera Integration
    smart_contract_address  TEXT            NULL,
    yes_token_id            TEXT            NULL,
    no_token_id             TEXT            NULL,
    collateral_type         TEXT            NULL DEFAULT 'HBAR'::text,
    
    -- Constraints
    CONSTRAINT event_markets_pkey PRIMARY KEY (id)
);

-- ===================
-- INDEXES
-- ===================

-- Category lookups
CREATE INDEX idx_event_markets_category_id 
    ON public.event_markets USING btree (category_id);

CREATE INDEX idx_event_markets_subcategory_id 
    ON public.event_markets USING btree (subcategory_id);

-- Display flag indexes (partial indexes for efficiency)
CREATE INDEX idx_event_markets_is_featured 
    ON public.event_markets USING btree (is_featured) 
    WHERE (is_featured = true);

CREATE INDEX idx_event_markets_is_trending 
    ON public.event_markets USING btree (is_trending) 
    WHERE (is_trending = true);

CREATE INDEX idx_event_markets_is_new 
    ON public.event_markets USING btree (is_new) 
    WHERE (is_new = true);

CREATE INDEX idx_event_markets_is_active 
    ON public.event_markets USING btree (is_active);

-- Time-based queries
CREATE INDEX idx_event_markets_end_date 
    ON public.event_markets USING btree (end_date);

CREATE INDEX idx_event_markets_created_at 
    ON public.event_markets USING btree (created_at DESC);

-- Status and sorting
CREATE INDEX idx_event_markets_resolution_status 
    ON public.event_markets USING btree (resolution_status);

CREATE INDEX idx_event_markets_volume 
    ON public.event_markets USING btree (volume DESC);

CREATE INDEX idx_event_markets_featured_order 
    ON public.event_markets USING btree (featured_order) 
    WHERE (featured_order IS NOT NULL);

CREATE INDEX idx_event_markets_structure 
    ON public.event_markets USING btree (market_structure);

-- Governance
CREATE INDEX idx_event_markets_proposal 
    ON public.event_markets USING btree (proposal_id);

CREATE INDEX idx_event_markets_governance_status 
    ON public.event_markets USING btree (governance_status);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE public.event_markets ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active markets only
CREATE POLICY "Allow public read access to active event_markets"
    ON public.event_markets
    FOR SELECT
    USING (is_active = true);

-- Allow service role full access (for backend operations)
CREATE POLICY "Allow service role full access to event_markets"
    ON public.event_markets
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===================
-- COMMENTS
-- ===================

COMMENT ON TABLE public.event_markets IS 'Core table storing prediction market definitions';
COMMENT ON COLUMN public.event_markets.market_structure IS 'binary, multi-choice, or traditional';
COMMENT ON COLUMN public.event_markets.resolution_status IS 'Current state: open, closed, resolved, or cancelled';
COMMENT ON COLUMN public.event_markets.yes_price IS 'Current price of YES outcome (0.0000 to 1.0000)';
COMMENT ON COLUMN public.event_markets.no_price IS 'Current price of NO outcome (0.0000 to 1.0000)';
COMMENT ON COLUMN public.event_markets.collateral_type IS 'Token used for trading, default HBAR';