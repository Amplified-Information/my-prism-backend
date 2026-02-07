-- Create market options for the new markets
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

-- Add more markets for Companies and Sports categories

-- Companies - Tech Giants markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Companies'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Tech Giants' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Companies')),
  '2025-12-31'::timestamp with time zone,
  0.68, 0.32, 420000, 280000, 'binary',
  'Tech giant performance indicates technology sector health and innovation trends',
  'Major technology companies drive market performance and shape digital transformation',
  true, true, false
FROM (VALUES 
  ('Will Apple reach $4 trillion market cap in 2025?', 'Apple continues growing despite market saturation concerns. This market tracks whether the iPhone maker will achieve unprecedented valuation levels.'),
  ('Will Microsoft exceed $500 billion in annual revenue in 2025?', 'Microsoft''s cloud and AI growth drives revenue expansion. This market evaluates whether the software giant will reach new revenue milestones.'),
  ('Will Google parent Alphabet spin off any major division in 2025?', 'Alphabet faces regulatory pressure and strategic questions. This market assesses whether the company will restructure its business units.'),
  ('Will Meta (Facebook) user growth exceed 4 billion globally in 2025?', 'Meta continues expanding despite privacy concerns and competition. This market tracks whether the social media giant will maintain growth momentum.')
) AS v(name, description);

-- Sports - Major Leagues markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Sports'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Major Leagues' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Sports')),
  '2025-12-31'::timestamp with time zone,
  0.55, 0.45, 185000, 125000, 'binary',
  'Major league developments affect sports culture and business models',
  'Professional sports leagues drive entertainment industry trends and cultural conversations',
  false, true, true
FROM (VALUES
  ('Will any major league implement AI umpiring/refereeing in 2025?', 'Technology is transforming sports officiating. This market tracks whether major leagues will adopt artificial intelligence for game decisions.'),
  ('Will sports betting revenue exceed $10 billion in any US state in 2025?', 'Sports gambling continues expanding rapidly. This market evaluates whether betting will reach unprecedented revenue levels in individual states.'),
  ('Will any major league expand internationally in 2025?', 'Sports leagues are globalizing their reach. This market assesses whether major US leagues will establish permanent international presence.'),
  ('Will player salaries in any major league average over $10 million in 2025?', 'Athlete compensation continues rising across sports. This market tracks whether any league will achieve unprecedented average salary levels.')
) AS v(name, description);