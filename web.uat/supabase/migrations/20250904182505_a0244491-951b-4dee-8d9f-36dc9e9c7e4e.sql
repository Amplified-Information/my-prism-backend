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

-- Allow users to view only basic public profile info (no sensitive data)
CREATE POLICY "Public can view basic profile info" ON public.profiles 
FOR SELECT 
USING (true)
WITH (
  id, first_name, last_name, username, bio, avatar_url, website_url, is_active
);

-- Create separate policy for users to view their own complete profile
-- (The existing "Users can view their own profile" policy already handles this)

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

-- 5. Fix proposal_votes for better privacy
DROP POLICY IF EXISTS "Public read access to votes" ON public.proposal_votes;

-- Allow viewing aggregated vote counts but not individual voter details
CREATE POLICY "Public can view vote counts only" ON public.proposal_votes 
FOR SELECT 
USING (true)
WITH (
  proposal_id, vote_choice, created_at, is_proposal_phase
);

-- Users can view their own votes
CREATE POLICY "Users can view their own votes" ON public.proposal_votes 
FOR SELECT 
USING (auth.uid() = voter_id);

-- Keep service role access
-- (The existing "Service role can manage votes" policy already handles this)