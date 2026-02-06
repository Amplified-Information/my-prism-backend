-- ============================================================
-- DDL Script for: market_categories
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- TABLE DEFINITION
-- ===================

CREATE TABLE public.market_categories (
    -- Primary Key
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- Category Information
    name                VARCHAR(255)    NOT NULL,
    description         TEXT            NULL,
    
    -- Display & Ordering
    sort_order          INTEGER         NULL DEFAULT 999,
    is_active           BOOLEAN         NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Constraints
    CONSTRAINT market_categories_pkey PRIMARY KEY (id)
);

-- ===================
-- INDEXES
-- ===================

CREATE INDEX idx_market_categories_is_active 
    ON public.market_categories USING btree (is_active);

CREATE INDEX idx_market_categories_sort_order 
    ON public.market_categories USING btree (sort_order);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE public.market_categories ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to market_categories"
    ON public.market_categories
    FOR SELECT
    USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to market_categories"
    ON public.market_categories
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===================
-- COMMENTS
-- ===================

COMMENT ON TABLE public.market_categories IS 'Top-level categories for organizing prediction markets';
COMMENT ON COLUMN public.market_categories.name IS 'Display name of the category';
COMMENT ON COLUMN public.market_categories.sort_order IS 'Order for display, lower values appear first';
