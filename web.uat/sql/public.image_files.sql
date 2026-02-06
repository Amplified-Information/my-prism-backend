-- ============================================================
-- DDL Script for: image_files
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- TABLE DEFINITION
-- ===================

CREATE TABLE public.image_files (
    -- Primary Key
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- File Information
    filename            TEXT            NOT NULL,
    url                 TEXT            NOT NULL,
    alt_text            TEXT            NULL,
    keywords            TEXT[]          NULL,
    
    -- Audit
    uploaded_by         UUID            NULL,
    
    -- Timestamps
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT image_files_pkey PRIMARY KEY (id)
);

-- ===================
-- INDEXES
-- ===================

CREATE INDEX idx_image_files_filename 
    ON public.image_files USING btree (filename);

CREATE INDEX idx_image_files_keywords 
    ON public.image_files USING gin (keywords);

CREATE INDEX idx_image_files_uploaded_by 
    ON public.image_files USING btree (uploaded_by);

CREATE INDEX idx_image_files_created_at 
    ON public.image_files USING btree (created_at DESC);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE public.image_files ENABLE ROW LEVEL SECURITY;

-- Public read access to image_files
CREATE POLICY "Public read access to image_files"
    ON public.image_files
    FOR SELECT
    USING (true);

-- Public can insert image_files
CREATE POLICY "Public can insert image_files"
    ON public.image_files
    FOR INSERT
    WITH CHECK (true);

-- Public can update image_files
CREATE POLICY "Public can update image_files"
    ON public.image_files
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Public can delete image_files
CREATE POLICY "Public can delete image_files"
    ON public.image_files
    FOR DELETE
    USING (true);

-- ===================
-- COMMENTS
-- ===================

COMMENT ON TABLE public.image_files IS 'Registry of uploaded images for markets and content';
COMMENT ON COLUMN public.image_files.url IS 'Full URL to the image in Supabase storage';
COMMENT ON COLUMN public.image_files.keywords IS 'Searchable tags for image discovery';
