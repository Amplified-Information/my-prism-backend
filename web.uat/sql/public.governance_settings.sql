-- ============================================================
-- DDL Script for: governance_settings
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- TABLE DEFINITION
-- ===================

CREATE TABLE public.governance_settings (
    -- Primary Key
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- Setting Information
    setting_key         TEXT            NOT NULL,
    setting_value       JSONB           NOT NULL,
    description         TEXT            NULL,
    
    -- Audit
    updated_by          UUID            NULL,
    
    -- Timestamps
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Constraints
    CONSTRAINT governance_settings_pkey PRIMARY KEY (id),
    CONSTRAINT governance_settings_key_unique UNIQUE (setting_key)
);

-- ===================
-- INDEXES
-- ===================

CREATE INDEX idx_governance_settings_key 
    ON public.governance_settings USING btree (setting_key);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE public.governance_settings ENABLE ROW LEVEL SECURITY;

-- Public read access to governance settings
CREATE POLICY "Public read access to governance settings"
    ON public.governance_settings
    FOR SELECT
    USING (true);

-- Service role can manage governance settings
CREATE POLICY "Service role can manage governance settings"
    ON public.governance_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===================
-- COMMENTS
-- ===================

COMMENT ON TABLE public.governance_settings IS 'Configurable parameters for the governance system';
COMMENT ON COLUMN public.governance_settings.setting_key IS 'Unique identifier for the setting';
COMMENT ON COLUMN public.governance_settings.setting_value IS 'JSON value of the setting (supports complex structures)';

-- ===================
-- SEED DATA (Common Settings)
-- ===================

-- Example governance settings (uncomment to seed)
-- INSERT INTO public.governance_settings (setting_key, setting_value, description) VALUES
--     ('proposal_threshold', '{"value": 100, "unit": "PRSM"}', 'Minimum tokens required to create a proposal'),
--     ('voting_period', '{"value": 7, "unit": "days"}', 'Duration of voting period'),
--     ('election_period', '{"value": 3, "unit": "days"}', 'Duration of election period'),
--     ('quorum_percentage', '{"value": 10, "unit": "percent"}', 'Minimum participation for valid vote'),
--     ('approval_threshold', '{"value": 51, "unit": "percent"}', 'Percentage needed for proposal approval');
