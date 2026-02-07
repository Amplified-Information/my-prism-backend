-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.create_default_binary_options()
RETURNS void
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert Yes/No options for existing binary markets that don't have options yet
  INSERT INTO public.market_options (market_id, option_name, option_type, current_price, sort_order)
  SELECT 
    em.id,
    'Yes',
    'yes',
    COALESCE(em.yes_price, 0.5000),
    1
  FROM public.event_markets em
  LEFT JOIN public.market_options mo ON em.id = mo.market_id
  WHERE mo.id IS NULL
    AND em.market_type = 'binary'
    AND em.is_active = true;

  INSERT INTO public.market_options (market_id, option_name, option_type, current_price, sort_order)
  SELECT 
    em.id,
    'No',
    'no',
    COALESCE(em.no_price, 0.5000),
    2
  FROM public.event_markets em
  LEFT JOIN public.market_options mo ON em.id = mo.market_id AND mo.option_type = 'no'
  WHERE mo.id IS NULL
    AND em.market_type = 'binary'
    AND em.is_active = true;
END;
$$;