-- ============================================================
-- DDL Script for: comment_reactions
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- ENUM DEPENDENCY
-- ===================
-- Requires: reaction_type (like, dislike)

-- ===================
-- TABLE DEFINITION
-- ===================

CREATE TABLE public.comment_reactions (
    -- Primary Key
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- Foreign Key
    comment_id          UUID            NOT NULL,
    
    -- Author (wallet-based or auth-based)
    user_id             UUID            NULL,
    wallet_id           TEXT            NULL,
    
    -- Reaction
    reaction_type       reaction_type   NOT NULL,
    
    -- Timestamps
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT comment_reactions_pkey PRIMARY KEY (id),
    CONSTRAINT comment_reactions_comment_id_fkey 
        FOREIGN KEY (comment_id) 
        REFERENCES public.market_comments(id) 
        ON DELETE CASCADE,
    -- Ensure one reaction per user per comment
    CONSTRAINT comment_reactions_unique_user_comment 
        UNIQUE (comment_id, user_id),
    CONSTRAINT comment_reactions_unique_wallet_comment 
        UNIQUE (comment_id, wallet_id)
);

-- ===================
-- INDEXES
-- ===================

CREATE INDEX idx_comment_reactions_comment_id 
    ON public.comment_reactions USING btree (comment_id);

CREATE INDEX idx_comment_reactions_user_id 
    ON public.comment_reactions USING btree (user_id);

CREATE INDEX idx_comment_reactions_wallet_id 
    ON public.comment_reactions USING btree (wallet_id);

CREATE INDEX idx_comment_reactions_type 
    ON public.comment_reactions USING btree (reaction_type);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- Public can view reactions
CREATE POLICY "Public can view reactions"
    ON public.comment_reactions
    FOR SELECT
    USING (true);

-- Authenticated users can manage reactions
CREATE POLICY "Authenticated users can manage reactions"
    ON public.comment_reactions
    FOR ALL
    USING (
        ((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) 
        OR (wallet_id IS NOT NULL)
    )
    WITH CHECK (
        ((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) 
        OR (wallet_id IS NOT NULL)
    );

-- Service role can manage all reactions
CREATE POLICY "Service role can manage all reactions"
    ON public.comment_reactions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===================
-- COMMENTS
-- ===================

COMMENT ON TABLE public.comment_reactions IS 'Like/dislike reactions on market comments';
COMMENT ON COLUMN public.comment_reactions.reaction_type IS 'Type of reaction: like or dislike';
