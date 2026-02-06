-- Create comprehensive event markets for all categories and subcategories with future end dates

-- Politics - Presidential markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new) 
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Politics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Presidential' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Politics')),
  '2025-12-31'::timestamp with time zone,
  0.65, 0.35, 125000, 85000, 'binary',
  'Critical for understanding 2025 political dynamics and voter sentiment shifts',
  'Presidential approval ratings directly impact electoral outcomes and policy implementation success',
  true, true, false
FROM (VALUES 
  ('Will Biden''s approval rating exceed 45% by year-end 2025?', 'President Biden''s approval rating continues to fluctuate. This market tracks whether his approval will exceed the crucial 45% threshold by December 2025, a key indicator for Democratic prospects.'),
  ('Will a third-party movement gain significant momentum in 2025?', 'Third-party movements often emerge between election cycles. This market assesses whether 2025 will see the rise of a significant alternative political movement.'),
  ('Will Trump announce candidacy for 2028 presidential race by end 2025?', 'Donald Trump''s political future remains uncertain. This market evaluates whether he will officially launch another presidential campaign.'),
  ('Will any major primary challenger emerge against Biden in 2025?', 'Incumbent presidents sometimes face primary challenges. This market assesses whether Biden will face significant opposition within his own party.')
) AS v(name, description);

-- Politics - Congressional markets  
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Politics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Congressional' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Politics')),
  '2025-11-30'::timestamp with time zone,
  0.52, 0.48, 95000, 67000, 'binary',
  'Congressional dynamics determine legislative agenda and policy implementation',
  'House and Senate relationships directly impact government effectiveness and major policy initiatives',
  false, true, true
FROM (VALUES
  ('Will Congress pass comprehensive infrastructure spending in 2025?', 'Infrastructure remains a bipartisan priority. This market tracks whether Congress can agree on major infrastructure investments in 2025.'),
  ('Will the House pass significant healthcare reform legislation in 2025?', 'Healthcare costs continue rising. This market evaluates whether the House will advance major healthcare reform measures.'),
  ('Will any House Speaker face a motion to vacate in 2025?', 'Speaker instability has become more common. This market assesses whether 2025 will see another leadership challenge.'),
  ('Will Congress extend the debt ceiling before any default risk in 2025?', 'Debt ceiling battles have become routine. This market tracks whether Congress will act proactively to avoid default scenarios.')
) AS v(name, description);

-- Politics - Elections markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Politics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Elections' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Politics')),
  '2025-11-15'::timestamp with time zone,
  0.58, 0.42, 180000, 125000, 'binary',
  'Electoral processes shape democratic governance and representation',
  'Election integrity and participation determine the legitimacy of democratic institutions',
  true, false, true
FROM (VALUES
  ('Will major voting rights legislation pass in 2025?', 'Voting rights remain a contentious issue. This market evaluates whether comprehensive federal voting legislation will be enacted.'),
  ('Will any state implement ranked choice voting for federal elections by 2025?', 'Electoral reform is gaining momentum. This market tracks whether states will adopt alternative voting methods for federal races.'),
  ('Will election security funding exceed $1 billion federally in 2025?', 'Election security requires significant investment. This market assesses whether federal funding will meet security needs.'),
  ('Will any major election reforms be implemented before 2026 midterms?', 'Electoral system changes often occur between cycles. This market evaluates whether significant reforms will be ready for 2026.')
) AS v(name, description);