-- ============================================================
-- DDL Script for: market_subcategories
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- TABLE DEFINITION
-- ===================

CREATE TABLE public.market_subcategories (
    -- Primary Key
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- Foreign Key
    category_id         UUID            NOT NULL,
    
    -- Subcategory Information
    name                VARCHAR(255)    NOT NULL,
    description         TEXT            NULL,
    
    -- Display & Ordering
    sort_order          INTEGER         NULL DEFAULT 999,
    is_active           BOOLEAN         NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Constraints
    CONSTRAINT market_subcategories_pkey PRIMARY KEY (id),
    CONSTRAINT market_subcategories_category_id_fkey 
        FOREIGN KEY (category_id) 
        REFERENCES public.market_categories(id) 
        ON DELETE CASCADE
);

-- ===================
-- INDEXES
-- ===================

CREATE INDEX idx_market_subcategories_category_id 
    ON public.market_subcategories USING btree (category_id);

CREATE INDEX idx_market_subcategories_is_active 
    ON public.market_subcategories USING btree (is_active);

CREATE INDEX idx_market_subcategories_sort_order 
    ON public.market_subcategories USING btree (sort_order);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE public.market_subcategories ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to market_subcategories"
    ON public.market_subcategories
    FOR SELECT
    USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to market_subcategories"
    ON public.market_subcategories
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===================
-- COMMENTS
-- ===================

COMMENT ON TABLE public.market_subcategories IS 'Subcategories for finer organization of markets within categories';
COMMENT ON COLUMN public.market_subcategories.category_id IS 'Reference to parent category';
