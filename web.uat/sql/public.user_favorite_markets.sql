-- ============================================================
-- DDL Script for: user_favorite_markets
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- TABLE DEFINITION
-- ===================

CREATE TABLE public.user_favorite_markets (
    -- Primary Key
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- Foreign Key
    market_id           UUID            NOT NULL,
    
    -- User (wallet-based)
    wallet_id           TEXT            NOT NULL,
    
    -- Timestamps
    created_at          TIMESTAMPTZ     NULL DEFAULT timezone('utc'::text, now()),
    
    -- Constraints
    CONSTRAINT user_favorite_markets_pkey PRIMARY KEY (id),
    CONSTRAINT user_favorite_markets_market_id_fkey 
        FOREIGN KEY (market_id) 
        REFERENCES public.event_markets(id) 
        ON DELETE CASCADE,
    -- Ensure one favorite per wallet per market
    CONSTRAINT user_favorite_markets_unique_wallet_market 
        UNIQUE (wallet_id, market_id)
);

-- ===================
-- INDEXES
-- ===================

CREATE INDEX idx_user_favorite_markets_wallet_id 
    ON public.user_favorite_markets USING btree (wallet_id);

CREATE INDEX idx_user_favorite_markets_market_id 
    ON public.user_favorite_markets USING btree (market_id);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE public.user_favorite_markets ENABLE ROW LEVEL SECURITY;

-- Public can view favorites
CREATE POLICY "Public can view favorites"
    ON public.user_favorite_markets
    FOR SELECT
    USING (true);

-- Users can manage their own favorites
CREATE POLICY "Users can manage their own favorites"
    ON public.user_favorite_markets
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===================
-- COMMENTS
-- ===================

COMMENT ON TABLE public.user_favorite_markets IS 'User bookmarked/favorite prediction markets';
COMMENT ON COLUMN public.user_favorite_markets.wallet_id IS 'Hedera wallet address of the user';
