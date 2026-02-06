-- ============================================================
-- DDL Script for: flagged_comments
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- TABLE DEFINITION
-- ===================

CREATE TABLE public.flagged_comments (
    -- Primary Key
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- Foreign Key
    market_id               UUID            NOT NULL,
    
    -- Author
    user_id                 UUID            NULL,
    wallet_id               TEXT            NULL,
    
    -- Flagged Content
    content                 TEXT            NOT NULL,
    moderation_reason       TEXT            NOT NULL,
    moderation_categories   JSONB           NULL DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT flagged_comments_pkey PRIMARY KEY (id),
    CONSTRAINT flagged_comments_market_id_fkey 
        FOREIGN KEY (market_id) 
        REFERENCES public.event_markets(id) 
        ON DELETE CASCADE
);

-- ===================
-- INDEXES
-- ===================

CREATE INDEX idx_flagged_comments_market_id 
    ON public.flagged_comments USING btree (market_id);

CREATE INDEX idx_flagged_comments_user_id 
    ON public.flagged_comments USING btree (user_id);

CREATE INDEX idx_flagged_comments_wallet_id 
    ON public.flagged_comments USING btree (wallet_id);

CREATE INDEX idx_flagged_comments_created_at 
    ON public.flagged_comments USING btree (created_at DESC);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE public.flagged_comments ENABLE ROW LEVEL SECURITY;

-- Users can view their own flagged comments
CREATE POLICY "Users can view their own flagged comments"
    ON public.flagged_comments
    FOR SELECT
    USING (
        ((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) 
        OR (wallet_id IS NOT NULL)
    );

-- Service role can manage flagged comments
CREATE POLICY "Service role can manage flagged comments"
    ON public.flagged_comments
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===================
-- COMMENTS
-- ===================

COMMENT ON TABLE public.flagged_comments IS 'Comments flagged by AI moderation for policy violations';
COMMENT ON COLUMN public.flagged_comments.moderation_reason IS 'AI-generated reason for flagging';
COMMENT ON COLUMN public.flagged_comments.moderation_categories IS 'JSON array of violated policy categories';
