-- Create more comprehensive event markets for Economics and Technology categories

-- Economics - Inflation markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new) 
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Economics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Inflation' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Economics')),
  '2025-12-31'::timestamp with time zone,
  0.42, 0.58, 210000, 145000, 'binary',
  'Inflation directly impacts consumer purchasing power and economic stability',
  'Inflation trends drive Federal Reserve policy and affect every aspect of the economy',
  true, true, false
FROM (VALUES 
  ('Will U.S. inflation rate fall below 2.5% by end of 2025?', 'The Federal Reserve targets 2% inflation long-term. This market tracks whether recent progress in reducing inflation will continue toward the Fed''s target zone.'),
  ('Will core PCE inflation average under 2.2% in Q4 2025?', 'Core PCE is the Fed''s preferred inflation measure. This market evaluates whether the central bank''s target metric will approach acceptable levels.'),
  ('Will food inflation exceed 4% year-over-year in 2025?', 'Food prices significantly impact household budgets and political sentiment. This market tracks whether food inflation will remain elevated despite overall disinflation.'),
  ('Will housing costs drive inflation above Fed targets in 2025?', 'Housing represents 30%+ of inflation calculations. This market assesses whether shelter costs will prevent the Fed from achieving its inflation goals.')
) AS v(name, description);

-- Economics - Employment markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Economics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Employment' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Economics')),
  '2025-12-31'::timestamp with time zone,
  0.68, 0.32, 165000, 110000, 'binary',
  'Employment levels indicate economic health and consumer confidence',
  'Job market strength affects spending, inflation, and Federal Reserve monetary policy',
  false, true, true
FROM (VALUES
  ('Will U.S. unemployment rate stay below 4.0% through 2025?', 'Unemployment has remained historically low post-pandemic. This market tracks whether this tight labor market will persist despite economic uncertainties.'),
  ('Will average hourly earnings growth exceed 3.5% in 2025?', 'Wage growth affects both worker prosperity and inflation pressures. This market evaluates whether strong wage gains will continue in a potentially cooling economy.'),
  ('Will job openings fall below 7 million in 2025?', 'Job openings peaked above 12 million post-pandemic. This market tracks labor market normalization as economic conditions evolve.'),
  ('Will labor force participation rate reach 63.0% in 2025?', 'Labor force participation remains below historical highs. This market assesses whether more Americans will participate in the job market.')
) AS v(name, description);

-- Economics - Markets markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Economics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Markets' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Economics')),
  '2025-12-31'::timestamp with time zone,
  0.35, 0.65, 295000, 185000, 'binary',
  'Stock market performance reflects economic confidence and future expectations',
  'Market movements affect retirement accounts, business investment, and economic sentiment',
  true, false, true
FROM (VALUES
  ('Will S&P 500 reach 6000 by end of 2025?', 'Stock markets continue showing resilience. This market tracks whether major indices will achieve significant milestone levels reflecting economic optimism.'),
  ('Will the VIX average below 20 in 2025?', 'The VIX measures market volatility and investor confidence. This market evaluates whether 2025 will be characterized by relative market calm.'),
  ('Will Russell 2000 outperform S&P 500 in 2025?', 'Small-cap stocks often lead during economic expansions. This market assesses whether smaller companies will drive market performance.'),
  ('Will Bitcoin exceed $100,000 in 2025?', 'Bitcoin continues experiencing significant volatility. This market tracks whether the leading cryptocurrency will reach major psychological price levels.')
) AS v(name, description);

-- Technology - AI markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Technology'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Artificial Intelligence' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Technology')),
  '2025-12-31'::timestamp with time zone,
  0.72, 0.28, 340000, 225000, 'binary',
  'AI development shapes future technological capabilities and economic transformation',
  'AI advances affect productivity, employment, and competitive advantages across industries',
  true, true, false
FROM (VALUES
  ('Will AGI be achieved by any major AI company in 2025?', 'Artificial General Intelligence represents a crucial milestone. This market tracks whether 2025 will see breakthrough achievements in general AI capabilities.'),
  ('Will AI safety regulations be implemented federally in 2025?', 'Growing AI capabilities raise safety concerns. This market evaluates whether comprehensive federal regulations will govern AI development and deployment.'),
  ('Will any AI system demonstrate human-level reasoning in 2025?', 'AI reasoning capabilities continue advancing rapidly. This market assesses whether AI will achieve human-equivalent reasoning performance.'),
  ('Will AI-generated content comprise over 40% of web content by end 2025?', 'AI content generation is proliferating exponentially. This market tracks the extent to which AI will dominate digital content creation.')
) AS v(name, description);