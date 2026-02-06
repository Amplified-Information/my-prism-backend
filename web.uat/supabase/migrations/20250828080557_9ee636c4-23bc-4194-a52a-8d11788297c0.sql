-- Add theme and background texture preferences to profiles table
ALTER TABLE public.profiles 
ADD COLUMN theme_preference character varying DEFAULT 'default',
ADD COLUMN background_texture character varying DEFAULT 'none';

-- Add comments for clarity
COMMENT ON COLUMN public.profiles.theme_preference IS 'User selected theme: default, ocean, or sunset';
COMMENT ON COLUMN public.profiles.background_texture IS 'User selected background texture: none, carbon, abstract, circuit, waves, or nightsky';