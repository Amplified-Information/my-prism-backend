-- Add YES/NO options for the Apple market
INSERT INTO public.market_options (
  market_id,
  option_name,
  option_type,
  current_price,
  sort_order,
  is_active,
  total_shares
) VALUES 
(
  'e8096588-8f78-4815-9bfb-2428c032b7e3',
  'Yes',
  'yes',
  0.6800,
  1,
  true,
  0
),
(
  'e8096588-8f78-4815-9bfb-2428c032b7e3',
  'No', 
  'no',
  0.3200,
  2,
  true,
  0
);