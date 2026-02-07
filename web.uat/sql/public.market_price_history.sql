-- ============================================================
-- DDL Script for: market_price_history
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- TABLE DEFINITION
-- ===================

CREATE TABLE public.market_price_history (
    -- Primary Key
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- Foreign Keys
    market_id           UUID            NOT NULL,
    option_id           UUID            NOT NULL,
    
    -- Price Data
    price               NUMERIC         NOT NULL,
    volume              NUMERIC         NOT NULL DEFAULT 0,
    
    -- Timestamps
    timestamp           TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Constraints
    CONSTRAINT market_price_history_pkey PRIMARY KEY (id),
    CONSTRAINT market_price_history_market_id_fkey 
        FOREIGN KEY (market_id) 
        REFERENCES public.event_markets(id) 
        ON DELETE CASCADE,
    CONSTRAINT market_price_history_option_id_fkey 
        FOREIGN KEY (option_id) 
        REFERENCES public.market_options(id) 
        ON DELETE CASCADE
);

-- ===================
-- INDEXES
-- ===================

CREATE INDEX idx_market_price_history_market_id 
    ON public.market_price_history USING btree (market_id);

CREATE INDEX idx_market_price_history_option_id 
    ON public.market_price_history USING btree (option_id);

CREATE INDEX idx_market_price_history_timestamp 
    ON public.market_price_history USING btree (timestamp DESC);

-- Composite index for time-series queries
CREATE INDEX idx_market_price_history_market_timestamp 
    ON public.market_price_history USING btree (market_id, timestamp DESC);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE public.market_price_history ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to market_price_history"
    ON public.market_price_history
    FOR SELECT
    USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to market_price_history"
    ON public.market_price_history
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===================
-- COMMENTS
-- ===================

COMMENT ON TABLE public.market_price_history IS 'Historical price data for market options, used for charting';
COMMENT ON COLUMN public.market_price_history.price IS 'Price at this point in time (0.0000 to 1.0000)';
COMMENT ON COLUMN public.market_price_history.volume IS 'Trading volume at this timestamp';
