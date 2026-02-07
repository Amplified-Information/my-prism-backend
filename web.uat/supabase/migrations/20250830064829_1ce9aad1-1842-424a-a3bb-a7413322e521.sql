-- Continue creating markets for more categories

-- Crypto - Bitcoin Price Movements markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Crypto'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Bitcoin Price Movements' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Crypto')),
  '2025-12-31'::timestamp with time zone,
  0.45, 0.55, 380000, 250000, 'binary',
  'Bitcoin price movements influence the entire cryptocurrency market',
  'Bitcoin serves as the leading indicator for crypto market sentiment and institutional adoption',
  true, true, false
FROM (VALUES 
  ('Will Bitcoin exceed $120,000 by end of 2025?', 'Bitcoin continues its volatile journey toward mainstream adoption. This market tracks whether the leading cryptocurrency will reach new psychological price levels.'),
  ('Will Bitcoin ETF assets exceed $50 billion in 2025?', 'Bitcoin ETFs have attracted significant institutional interest. This market evaluates whether fund inflows will continue accelerating adoption.'),
  ('Will Bitcoin market dominance exceed 60% in 2025?', 'Bitcoin''s share of total crypto market cap fluctuates significantly. This market assesses whether Bitcoin will regain dominance over altcoins.'),
  ('Will any Bitcoin ETF become top 10 largest ETF in 2025?', 'Bitcoin ETFs are growing rapidly. This market tracks whether crypto funds will join the ranks of largest investment vehicles.')
) AS v(name, description);

-- Crypto - Regulatory Outcomes markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Crypto'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Regulatory Outcomes' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Crypto')),
  '2025-12-31'::timestamp with time zone,
  0.62, 0.38, 295000, 185000, 'binary',
  'Cryptocurrency regulation shapes market access and institutional participation',
  'Regulatory clarity determines whether crypto can achieve mainstream financial integration',
  false, true, true
FROM (VALUES
  ('Will the US approve comprehensive crypto regulation in 2025?', 'Clear federal crypto regulation remains elusive. This market tracks whether Congress will pass comprehensive legislation governing digital assets.'),
  ('Will any major central bank launch a digital currency in 2025?', 'Central Bank Digital Currencies (CBDCs) are being developed globally. This market evaluates whether any major economy will launch its digital currency.'),
  ('Will crypto staking be classified as securities in the US in 2025?', 'Staking classification remains unclear under US law. This market assesses whether regulators will define staking rewards as securities offerings.'),
  ('Will Europe implement comprehensive crypto licensing in 2025?', 'European crypto regulation is advancing rapidly. This market tracks whether MiCA and related frameworks will be fully implemented.')
) AS v(name, description);

-- Climate - Climate Policy markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Climate'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Climate Policy' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Climate')),
  '2025-12-31'::timestamp with time zone,
  0.38, 0.62, 195000, 125000, 'binary',
  'Climate policy drives global response to environmental challenges',
  'Policy decisions determine whether humanity can limit global warming and environmental damage',
  true, false, true
FROM (VALUES
  ('Will global carbon emissions peak in 2025?', 'Climate scientists track when global emissions will peak before declining. This market evaluates whether 2025 will mark this crucial environmental milestone.'),
  ('Will the US rejoin major international climate agreements in 2025?', 'International climate cooperation requires major emitter participation. This market tracks US engagement with global climate frameworks.'),
  ('Will carbon pricing exceed $100/ton in any major economy in 2025?', 'Carbon pricing mechanisms are expanding globally. This market assesses whether carbon costs will reach levels that significantly change behavior.'),
  ('Will renewable energy exceed 50% of global electricity in 2025?', 'Renewable energy adoption is accelerating worldwide. This market tracks whether clean energy will achieve majority status in global electricity generation.')
) AS v(name, description);

-- Climate - Renewable Energy Milestones markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new)
SELECT 
  v.name,
  v.description,
  (SELECT id FROM public.market_categories WHERE name = 'Climate'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Renewable Energy Milestones' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Climate')),
  '2025-12-31'::timestamp with time zone,
  0.75, 0.25, 215000, 140000, 'binary',
  'Renewable energy milestones indicate progress toward climate goals',
  'Clean energy achievements determine whether economies can decarbonize while maintaining growth',
  true, true, false
FROM (VALUES
  ('Will solar energy costs fall below $0.02/kWh globally in 2025?', 'Solar costs continue declining rapidly. This market tracks whether photovoltaic energy will achieve unprecedented affordability levels.'),
  ('Will offshore wind capacity exceed 100GW globally in 2025?', 'Offshore wind is expanding rapidly in suitable coastal regions. This market evaluates whether marine wind will reach significant scale.'),
  ('Will battery storage costs fall below $50/kWh in 2025?', 'Battery costs are crucial for renewable energy adoption. This market tracks whether energy storage will achieve cost parity with traditional power.'),
  ('Will any country achieve 100% renewable electricity in 2025?', 'Several nations are approaching full renewable electricity. This market assesses whether any will achieve complete clean energy independence.')
) AS v(name, description);