-- ============================================================
-- DDL Script for: hedera_wallets
-- Database: Supabase (PostgreSQL)
-- Generated: 2025-12-22
-- ============================================================

-- ===================
-- FUNCTION DEPENDENCY
-- ===================

-- Function to check wallet ownership
CREATE OR REPLACE FUNCTION public.is_wallet_owner(wallet_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN auth.uid() = wallet_user_id;
END;
$$;

-- Function to set primary wallet
CREATE OR REPLACE FUNCTION public.set_primary_wallet(wallet_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    wallet_user_id UUID;
BEGIN
    SELECT user_id INTO wallet_user_id 
    FROM public.hedera_wallets 
    WHERE id = wallet_id AND public.is_wallet_owner(user_id);
    
    IF wallet_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    UPDATE public.hedera_wallets 
    SET is_primary = false 
    WHERE user_id = wallet_user_id AND id != wallet_id;
    
    UPDATE public.hedera_wallets 
    SET is_primary = true 
    WHERE id = wallet_id;
    
    RETURN true;
END;
$$;

-- ===================
-- TABLE DEFINITION
-- ===================

CREATE TABLE public.hedera_wallets (
    -- Primary Key
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    
    -- Optional User Reference (for auth-based users)
    user_id                 UUID            NULL,
    
    -- Wallet Information
    account_id              TEXT            NOT NULL,
    public_key              TEXT            NULL,
    wallet_name             TEXT            NULL,
    
    -- Persona/Display Settings
    persona_name            TEXT            NULL,
    persona_color           TEXT            NULL,
    
    -- Status
    is_primary              BOOLEAN         NOT NULL DEFAULT false,
    
    -- Timestamps
    last_connected_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT hedera_wallets_pkey PRIMARY KEY (id),
    CONSTRAINT hedera_wallets_account_id_unique UNIQUE (account_id)
);

-- ===================
-- INDEXES
-- ===================

CREATE INDEX idx_hedera_wallets_account_id 
    ON public.hedera_wallets USING btree (account_id);

CREATE INDEX idx_hedera_wallets_user_id 
    ON public.hedera_wallets USING btree (user_id);

CREATE INDEX idx_hedera_wallets_is_primary 
    ON public.hedera_wallets USING btree (is_primary) 
    WHERE (is_primary = true);

-- ===================
-- TRIGGERS
-- ===================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_hedera_wallets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_hedera_wallets_updated_at
    BEFORE UPDATE ON public.hedera_wallets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_hedera_wallets_updated_at();

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE public.hedera_wallets ENABLE ROW LEVEL SECURITY;

-- Users can view their own wallets (or wallets without user_id)
CREATE POLICY "Users can view their own wallets"
    ON public.hedera_wallets
    FOR SELECT
    USING ((user_id IS NULL) OR is_wallet_owner(user_id));

-- Users can create their own wallets
CREATE POLICY "Users can create their own wallets"
    ON public.hedera_wallets
    FOR INSERT
    WITH CHECK ((user_id IS NULL) OR is_wallet_owner(user_id));

-- Users can update their own wallets
CREATE POLICY "Users can update their own wallets"
    ON public.hedera_wallets
    FOR UPDATE
    USING ((user_id IS NULL) OR is_wallet_owner(user_id))
    WITH CHECK ((user_id IS NULL) OR is_wallet_owner(user_id));

-- Users can delete their own wallets
CREATE POLICY "Users can delete their own wallets"
    ON public.hedera_wallets
    FOR DELETE
    USING ((user_id IS NULL) OR is_wallet_owner(user_id));

-- Service role can manage all wallets
CREATE POLICY "Service role can manage all wallets"
    ON public.hedera_wallets
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ===================
-- COMMENTS
-- ===================

COMMENT ON TABLE public.hedera_wallets IS 'Hedera wallet connections for wallet-based identity';
COMMENT ON COLUMN public.hedera_wallets.account_id IS 'Hedera account ID (e.g., 0.0.12345)';
COMMENT ON COLUMN public.hedera_wallets.persona_name IS 'User-defined display name for this wallet';
COMMENT ON COLUMN public.hedera_wallets.persona_color IS 'User-defined color theme for wallet avatar';
