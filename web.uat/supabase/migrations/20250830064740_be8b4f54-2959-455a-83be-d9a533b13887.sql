-- Create default binary options for all event markets that don't have options yet
-- This will create Yes/No options for all binary markets

INSERT INTO public.market_options (market_id, option_name, option_type, current_price, sort_order)
SELECT 
  em.id,
  'Yes',
  'yes',
  em.yes_price,
  1
FROM public.event_markets em
LEFT JOIN public.market_options mo ON em.id = mo.market_id AND mo.option_type = 'yes'
WHERE mo.id IS NULL
  AND em.market_type = 'binary'
  AND em.is_active = true;

INSERT INTO public.market_options (market_id, option_name, option_type, current_price, sort_order)
SELECT 
  em.id,
  'No',
  'no',
  em.no_price,
  2
FROM public.event_markets em
LEFT JOIN public.market_options mo ON em.id = mo.market_id AND mo.option_type = 'no'
WHERE mo.id IS NULL
  AND em.market_type = 'binary'
  AND em.is_active = true;