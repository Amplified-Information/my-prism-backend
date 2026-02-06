-- ============================================================
-- DDL Script for: market_options
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- TABLE DEFINITION
-- ===================

CREATE TABLE public.market_options (
    -- Primary Key
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- Foreign Key
    market_id               UUID            NOT NULL,
    
    -- Option Information
    option_name             TEXT            NOT NULL,
    option_type             TEXT            NOT NULL,
    
    -- Candidate Information (for multi-choice markets)
    candidate_name          TEXT            NULL,
    candidate_avatar        TEXT            NULL,
    candidate_party         TEXT            NULL,
    candidate_metadata      JSONB           NULL DEFAULT '{}'::jsonb,
    
    -- Pricing & Trading
    current_price           NUMERIC         NOT NULL DEFAULT 0.5000,
    total_shares            BIGINT          NOT NULL DEFAULT 0,
    
    -- Display
    sort_order              INTEGER         NULL DEFAULT 0,
    is_active               BOOLEAN         NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Constraints
    CONSTRAINT market_options_pkey PRIMARY KEY (id),
    CONSTRAINT market_options_market_id_fkey 
        FOREIGN KEY (market_id) 
        REFERENCES public.event_markets(id) 
        ON DELETE CASCADE
);

-- ===================
-- INDEXES
-- ===================

CREATE INDEX idx_market_options_market_id 
    ON public.market_options USING btree (market_id);

CREATE INDEX idx_market_options_option_type 
    ON public.market_options USING btree (option_type);

CREATE INDEX idx_market_options_is_active 
    ON public.market_options USING btree (is_active);

CREATE INDEX idx_market_options_sort_order 
    ON public.market_options USING btree (sort_order);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE public.market_options ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active options
CREATE POLICY "Allow public read access to active market_options"
    ON public.market_options
    FOR SELECT
    USING (is_active = true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to market_options"
    ON public.market_options
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===================
-- COMMENTS
-- ===================

COMMENT ON TABLE public.market_options IS 'Tradeable options/outcomes for prediction markets';
COMMENT ON COLUMN public.market_options.option_type IS 'Type identifier: yes, no, or custom option name';
COMMENT ON COLUMN public.market_options.current_price IS 'Current market price (0.0000 to 1.0000)';
COMMENT ON COLUMN public.market_options.candidate_metadata IS 'Additional JSON data for candidate-based options';
