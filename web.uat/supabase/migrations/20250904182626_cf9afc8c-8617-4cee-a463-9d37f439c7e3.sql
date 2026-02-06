-- Fix critical security issues by updating RLS policies

-- 1. Remove public read access from secrets table and restrict to service role only
DROP POLICY IF EXISTS "Allow anonymous users to read secrets" ON public.secrets;
DROP POLICY IF EXISTS "Allow authenticated users to read secrets" ON public.secrets;

-- Create service role only access for secrets
CREATE POLICY "Service role can read secrets" ON public.secrets 
FOR SELECT 
USING (auth.jwt() ->> 'role' = 'service_role');

-- 2. Fix profiles table - remove public read access for sensitive data
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Allow public to view only basic profile info (exclude sensitive data like email, phone, date_of_birth)
-- This policy will need to be handled at the application level since PostgreSQL RLS doesn't support column-level restrictions in policies

-- 3. Fix user_token_balances - remove public read access
DROP POLICY IF EXISTS "Public read access to token balances for governance" ON public.user_token_balances;

-- Keep the existing user-specific access policy which is secure

-- 4. Fix voting_power_snapshots - remove public read access
DROP POLICY IF EXISTS "Public read access to voting power snapshots" ON public.voting_power_snapshots;

-- Create policy for users to view only their own snapshots
CREATE POLICY "Users can view their own voting power snapshots" ON public.voting_power_snapshots 
FOR SELECT 
USING (auth.uid() = user_id);

-- Keep service role access for system operations
CREATE POLICY "Service role can read all snapshots" ON public.voting_power_snapshots 
FOR SELECT 
USING (auth.jwt() ->> 'role' = 'service_role');

-- 5. Fix proposal_votes for better privacy - remove individual voter access
DROP POLICY IF EXISTS "Public read access to votes" ON public.proposal_votes;

-- Users can view their own votes only
CREATE POLICY "Users can view their own votes" ON public.proposal_votes 
FOR SELECT 
USING (auth.uid() = voter_id);

-- Keep service role access
-- (The existing "Service role can manage votes" policy already handles this)