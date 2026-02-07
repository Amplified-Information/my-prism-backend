-- Create comprehensive event markets for all categories and subcategories

-- Politics - Presidential markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new) 
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Politics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Presidential' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Politics')),
  '2024-12-31'::timestamp with time zone,
  0.65, 0.35, 125000, 85000, 'binary',
  'Critical for understanding 2024 election dynamics and voter sentiment shifts',
  'Presidential approval ratings directly impact electoral outcomes and policy implementation success',
  true, true, false
FROM (VALUES 
  ('Will Biden''s approval rating exceed 45% by year-end 2024?', 'President Biden''s approval rating has fluctuated significantly throughout his term. This market tracks whether his approval will recover above the crucial 45% threshold by December 2024, a key indicator for Democratic electoral prospects.'),
  ('Will a third-party candidate receive over 5% in 2024 presidential election?', 'Third-party candidates have historically struggled to break the 5% threshold in presidential elections. This market assesses whether 2024''s unique political climate will enable a significant third-party showing.'),
  ('Will Trump secure the Republican nomination by Super Tuesday 2024?', 'Donald Trump remains the Republican frontrunner despite legal challenges. This market evaluates whether he can secure enough delegates by Super Tuesday to effectively clinch the nomination.'),
  ('Will there be a brokered Republican convention in 2024?', 'A brokered convention occurs when no candidate secures a majority of delegates before the convention. This market assesses the likelihood of this rare but dramatic scenario in the Republican primary.')
) AS v(name, description);

-- Politics - Congressional markets  
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Politics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Congressional' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Politics')),
  '2024-11-30'::timestamp with time zone,
  0.52, 0.48, 95000, 67000, 'binary',
  'Congressional control determines legislative agenda and policy implementation',
  'House and Senate control directly impacts presidential effectiveness and major policy initiatives',
  false, true, true
FROM (VALUES
  ('Will Republicans maintain House control after 2024 elections?', 'Republicans currently hold a narrow House majority. This market tracks whether they can maintain control despite redistricting changes and suburban voter trends favoring Democrats.'),
  ('Will Democrats gain Senate seats in 2024 elections?', 'Democrats face a challenging Senate map in 2024 with more seats to defend. This market evaluates whether they can net gain seats despite defensive positioning.'),
  ('Will any House Speaker be removed via motion to vacate in 2024?', 'Following Kevin McCarthy''s historic removal, this market assesses whether the precedent will lead to another Speaker facing a successful motion to vacate.'),
  ('Will Congress pass major immigration reform by end of 2024?', 'Immigration remains a top political priority with bipartisan pressure for action. This market tracks whether comprehensive reform can overcome partisan gridlock.')
) AS v(name, description);

-- Politics - Elections markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Politics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Elections' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Politics')),
  '2024-11-15'::timestamp with time zone,
  0.58, 0.42, 180000, 125000, 'binary',
  'Election outcomes shape governance and policy direction for years',
  'Electoral results determine control of government and implementation of major policy agendas',
  true, false, true
FROM (VALUES
  ('Will voter turnout exceed 2020 levels in 2024 presidential election?', '2020 saw record turnout at 66.6% of eligible voters. This market evaluates whether 2024 can surpass this historic high despite changing voting laws and political dynamics.'),
  ('Will mail-in voting account for over 30% of 2024 ballots?', 'Mail-in voting expanded dramatically during COVID-19. This market tracks whether remote voting will remain elevated or return to pre-pandemic levels.'),
  ('Will swing state margins be under 2% in 2024 presidential race?', 'Recent elections have been decided by razor-thin margins in key swing states. This market assesses whether 2024 will continue this trend of extremely close races.'),
  ('Will there be significant election disputes requiring courts in 2024?', 'Legal challenges to election results have become more common. This market evaluates the likelihood of major court interventions in 2024 election disputes.')
) AS v(name, description);