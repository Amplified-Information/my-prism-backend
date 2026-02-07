-- Drop trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop trigger on profiles that depends on the function
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;

-- Drop RLS policies on profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Drop the profiles table
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop functions (after table is gone)
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.update_profiles_updated_at();