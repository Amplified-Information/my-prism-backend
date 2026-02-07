-- Add persona columns to hedera_wallets table
ALTER TABLE public.hedera_wallets
ADD COLUMN IF NOT EXISTS persona_name text,
ADD COLUMN IF NOT EXISTS persona_color text;

-- Add unique constraint on persona_name to ensure uniqueness across all wallets
CREATE UNIQUE INDEX IF NOT EXISTS hedera_wallets_persona_name_unique 
ON public.hedera_wallets (persona_name) 
WHERE persona_name IS NOT NULL;