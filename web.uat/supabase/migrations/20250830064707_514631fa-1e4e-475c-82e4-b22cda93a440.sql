-- Create markets for correct category and subcategory names

-- Economics - Inflation Trends markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Economics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Inflation Trends' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Economics')),
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

-- Economics - Job Market markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Economics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Job Market' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Economics')),
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

-- Tech & Science - AI Advancements markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Tech & Science'),
  (SELECT id FROM public.market_subcategories WHERE name = 'AI Advancements' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Tech & Science')),
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

-- Tech & Science - Space Exploration markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Tech & Science'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Space Exploration' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Tech & Science')),
  '2025-12-31'::timestamp with time zone,
  0.85, 0.15, 125000, 78000, 'binary',
  'Space technology advances drive innovation and economic opportunities',
  'Space achievements affect national prestige, scientific discovery, and commercial opportunities',
  true, false, true
FROM (VALUES
  ('Will SpaceX successfully land humans on Mars by end of 2025?', 'Mars colonization represents the next frontier in space exploration. This market tracks whether SpaceX can achieve this historic milestone in their ambitious timeline.'),
  ('Will Artemis III mission launch to the Moon in 2025?', 'NASA''s Artemis program aims to return humans to the Moon. This market evaluates whether the crewed lunar mission will launch as scheduled.'),
  ('Will commercial space tourism flights exceed 200 passengers in 2025?', 'Space tourism is transitioning from novelty to industry. This market tracks whether commercial spaceflight will reach meaningful scale.'),
  ('Will a new space nation join major space partnerships in 2025?', 'International space cooperation continues evolving. This market assesses whether new countries will join prestigious space consortiums.')
) AS v(name, description);