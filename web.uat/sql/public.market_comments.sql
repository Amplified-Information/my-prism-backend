-- ============================================================
-- DDL Script for: market_comments
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- ENUM DEPENDENCY
-- ===================
-- Requires: comment_position (YES, NO)

-- ===================
-- TABLE DEFINITION
-- ===================

CREATE TABLE public.market_comments (
    -- Primary Key
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- Foreign Keys
    market_id               UUID            NOT NULL,
    parent_comment_id       UUID            NULL,
    
    -- Author (wallet-based identity)
    user_id                 UUID            NULL,
    wallet_id               TEXT            NULL,
    
    -- Content
    content                 TEXT            NOT NULL,
    position                comment_position NULL,
    
    -- Status
    is_active               BOOLEAN         NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT market_comments_pkey PRIMARY KEY (id),
    CONSTRAINT market_comments_market_id_fkey 
        FOREIGN KEY (market_id) 
        REFERENCES public.event_markets(id) 
        ON DELETE CASCADE,
    CONSTRAINT market_comments_parent_comment_id_fkey 
        FOREIGN KEY (parent_comment_id) 
        REFERENCES public.market_comments(id) 
        ON DELETE CASCADE
);

-- ===================
-- INDEXES
-- ===================

CREATE INDEX idx_market_comments_market_id 
    ON public.market_comments USING btree (market_id);

CREATE INDEX idx_market_comments_parent_comment_id 
    ON public.market_comments USING btree (parent_comment_id);

CREATE INDEX idx_market_comments_wallet_id 
    ON public.market_comments USING btree (wallet_id);

CREATE INDEX idx_market_comments_created_at 
    ON public.market_comments USING btree (created_at DESC);

CREATE INDEX idx_market_comments_is_active 
    ON public.market_comments USING btree (is_active) 
    WHERE (is_active = true);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE public.market_comments ENABLE ROW LEVEL SECURITY;

-- Public can view active comments
CREATE POLICY "Public can view active comments"
    ON public.market_comments
    FOR SELECT
    USING (is_active = true);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments"
    ON public.market_comments
    FOR INSERT
    WITH CHECK (
        ((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) 
        OR (wallet_id IS NOT NULL)
    );

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
    ON public.market_comments
    FOR UPDATE
    USING (
        ((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) 
        OR (wallet_id IS NOT NULL)
    )
    WITH CHECK (is_active = true);

-- Service role can manage all comments
CREATE POLICY "Service role can manage all comments"
    ON public.market_comments
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===================
-- COMMENTS
-- ===================

COMMENT ON TABLE public.market_comments IS 'User discussion comments on prediction markets';
COMMENT ON COLUMN public.market_comments.wallet_id IS 'Hedera wallet address for wallet-based identity';
COMMENT ON COLUMN public.market_comments.position IS 'Trading stance: YES or NO';
COMMENT ON COLUMN public.market_comments.parent_comment_id IS 'Reference to parent comment for threaded replies';
