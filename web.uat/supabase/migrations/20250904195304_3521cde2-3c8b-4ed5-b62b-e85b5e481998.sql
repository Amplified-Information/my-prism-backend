-- Create hedera_wallets table to store wallet information
CREATE TABLE public.hedera_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  public_key TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  wallet_name TEXT,
  last_connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate account IDs per user
-- Allow NULL user_id for guest wallets, but prevent duplicate account_id for same user
CREATE UNIQUE INDEX idx_hedera_wallets_user_account 
ON public.hedera_wallets (user_id, account_id) 
WHERE user_id IS NOT NULL;

-- Create index for faster lookups
CREATE INDEX idx_hedera_wallets_account_id ON public.hedera_wallets (account_id);
CREATE INDEX idx_hedera_wallets_user_id ON public.hedera_wallets (user_id);

-- Enable Row Level Security
ALTER TABLE public.hedera_wallets ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if current user matches the wallet owner
CREATE OR REPLACE FUNCTION public.is_wallet_owner(wallet_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() = wallet_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Create policies for hedera_wallets table
CREATE POLICY "Users can view their own wallets" 
ON public.hedera_wallets 
FOR SELECT 
USING (user_id IS NULL OR public.is_wallet_owner(user_id));

CREATE POLICY "Users can create their own wallets" 
ON public.hedera_wallets 
FOR INSERT 
WITH CHECK (user_id IS NULL OR public.is_wallet_owner(user_id));

CREATE POLICY "Users can update their own wallets" 
ON public.hedera_wallets 
FOR UPDATE 
USING (user_id IS NULL OR public.is_wallet_owner(user_id))
WITH CHECK (user_id IS NULL OR public.is_wallet_owner(user_id));

CREATE POLICY "Users can delete their own wallets" 
ON public.hedera_wallets 
FOR DELETE 
USING (user_id IS NULL OR public.is_wallet_owner(user_id));

-- Service role can manage all wallets
CREATE POLICY "Service role can manage all wallets" 
ON public.hedera_wallets 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_hedera_wallets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_hedera_wallets_updated_at
    BEFORE UPDATE ON public.hedera_wallets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_hedera_wallets_updated_at();

-- Create function to manage primary wallet (only one primary per user)
CREATE OR REPLACE FUNCTION public.set_primary_wallet(wallet_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    wallet_user_id UUID;
BEGIN
    -- Get the user_id of the wallet being set as primary
    SELECT user_id INTO wallet_user_id 
    FROM public.hedera_wallets 
    WHERE id = wallet_id AND public.is_wallet_owner(user_id);
    
    -- If wallet not found or not owned by current user, return false
    IF wallet_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Set all other wallets for this user to not primary
    UPDATE public.hedera_wallets 
    SET is_primary = false 
    WHERE user_id = wallet_user_id AND id != wallet_id;
    
    -- Set the specified wallet as primary
    UPDATE public.hedera_wallets 
    SET is_primary = true 
    WHERE id = wallet_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;