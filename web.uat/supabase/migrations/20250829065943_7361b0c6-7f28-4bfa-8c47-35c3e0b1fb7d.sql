-- Fix function search path security issues by setting proper search_path

-- Update handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    first_name, 
    last_name,
    email_verified
  )
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email_confirmed_at IS NOT NULL
  );
  RETURN new;
END;
$function$;

-- Update update_profiles_updated_at function
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$function$;

-- Update get_processing_state function
CREATE OR REPLACE FUNCTION public.get_processing_state(process_name_param text)
 RETURNS TABLE(process_name text, last_processed_index integer, total_items integer, last_updated timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT p.process_name, p.last_processed_index, p.total_items, p.last_updated, p.created_at
    FROM processing_state p
    WHERE p.process_name = process_name_param;
END;
$function$;

-- Update update_market_data_cache_last_updated function
CREATE OR REPLACE FUNCTION public.update_market_data_cache_last_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.last_updated = now();
    RETURN NEW;
END;
$function$;

-- Update validate_subcategory_belongs_to_category function
CREATE OR REPLACE FUNCTION public.validate_subcategory_belongs_to_category()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    -- If subcategory_id is provided, ensure it belongs to the specified category
    IF NEW.subcategory_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 
            FROM public.market_subcategories 
            WHERE id = NEW.subcategory_id 
            AND category_id = NEW.category_id
        ) THEN
            RAISE EXCEPTION 'Subcategory must belong to the specified category';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Update update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$function$;