-- Create comprehensive event markets for all categories and subcategories

-- Politics - Presidential category markets
INSERT INTO public.event_markets (name, description, category_id, subcategory_id, end_date, yes_price, no_price, volume, liquidity, market_type, relevance, why_it_matters, is_featured, is_trending, is_new) VALUES

-- Get category and subcategory IDs first for Politics
((SELECT name, description, 
  (SELECT id FROM public.market_categories WHERE name = 'Politics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Presidential' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Politics')),
  '2024-12-31'::timestamp with time zone,
  0.65, 0.35, 125000, 85000, 'binary',
  'Critical for understanding 2024 election dynamics and voter sentiment shifts',
  'Presidential approval ratings directly impact electoral outcomes and policy implementation success',
  true, true, false) FROM (VALUES 
    ('Will Biden''s approval rating exceed 45% by year-end 2024?', 'President Biden''s approval rating has fluctuated significantly throughout his term. This market tracks whether his approval will recover above the crucial 45% threshold by December 2024, a key indicator for Democratic electoral prospects.'),
    ('Will a third-party candidate receive over 5% in 2024 presidential election?', 'Third-party candidates have historically struggled to break the 5% threshold in presidential elections. This market assesses whether 2024''s unique political climate will enable a significant third-party showing.'),
    ('Will Trump secure the Republican nomination by Super Tuesday 2024?', 'Donald Trump remains the Republican frontrunner despite legal challenges. This market evaluates whether he can secure enough delegates by Super Tuesday to effectively clinch the nomination.'),
    ('Will there be a brokered Republican convention in 2024?', 'A brokered convention occurs when no candidate secures a majority of delegates before the convention. This market assesses the likelihood of this rare but dramatic scenario in the Republican primary.')) AS v(name, description)),

-- Politics - Congressional markets  
((SELECT name, description,
  (SELECT id FROM public.market_categories WHERE name = 'Politics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Congressional' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Politics')),
  '2024-11-30'::timestamp with time zone,
  0.52, 0.48, 95000, 67000, 'binary',
  'Congressional control determines legislative agenda and policy implementation',
  'House and Senate control directly impacts presidential effectiveness and major policy initiatives',
  false, true, true) FROM (VALUES
    ('Will Republicans maintain House control after 2024 elections?', 'Republicans currently hold a narrow House majority. This market tracks whether they can maintain control despite redistricting changes and suburban voter trends favoring Democrats.'),
    ('Will Democrats gain Senate seats in 2024 elections?', 'Democrats face a challenging Senate map in 2024 with more seats to defend. This market evaluates whether they can net gain seats despite defensive positioning.'),
    ('Will any House Speaker be removed via motion to vacate in 2024?', 'Following Kevin McCarthy''s historic removal, this market assesses whether the precedent will lead to another Speaker facing a successful motion to vacate.'),
    ('Will Congress pass major immigration reform by end of 2024?', 'Immigration remains a top political priority with bipartisan pressure for action. This market tracks whether comprehensive reform can overcome partisan gridlock.')) AS v(name, description)),

-- Politics - Elections markets
((SELECT name, description,
  (SELECT id FROM public.market_categories WHERE name = 'Politics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Elections' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Politics')),
  '2024-11-15'::timestamp with time zone,
  0.58, 0.42, 180000, 125000, 'binary',
  'Election outcomes shape governance and policy direction for years',
  'Electoral results determine control of government and implementation of major policy agendas',
  true, false, true) FROM (VALUES
    ('Will voter turnout exceed 2020 levels in 2024 presidential election?', '2020 saw record turnout at 66.6% of eligible voters. This market evaluates whether 2024 can surpass this historic high despite changing voting laws and political dynamics.'),
    ('Will mail-in voting account for over 30% of 2024 ballots?', 'Mail-in voting expanded dramatically during COVID-19. This market tracks whether remote voting will remain elevated or return to pre-pandemic levels.'),
    ('Will swing state margins be under 2% in 2024 presidential race?', 'Recent elections have been decided by razor-thin margins in key swing states. This market assesses whether 2024 will continue this trend of extremely close races.'),
    ('Will there be significant election disputes requiring courts in 2024?', 'Legal challenges to election results have become more common. This market evaluates the likelihood of major court interventions in 2024 election disputes.')) AS v(name, description)),

-- Economics - Inflation markets
((SELECT name, description,
  (SELECT id FROM public.market_categories WHERE name = 'Economics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Inflation' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Economics')),
  '2024-12-31'::timestamp with time zone,
  0.42, 0.58, 210000, 145000, 'binary',
  'Inflation directly impacts consumer purchasing power and economic stability',
  'Inflation trends drive Federal Reserve policy and affect every aspect of the economy',
  true, true, false) FROM (VALUES
    ('Will U.S. inflation rate fall below 3% by end of 2024?', 'The Federal Reserve targets 2% inflation long-term. This market tracks whether recent progress in reducing inflation will continue to the Fed''s comfort zone.'),
    ('Will core PCE inflation average under 2.5% in Q4 2024?', 'Core PCE is the Fed''s preferred inflation measure. This market evaluates whether the central bank''s target metric will approach acceptable levels.'),
    ('Will food inflation exceed 5% year-over-year in 2024?', 'Food prices significantly impact household budgets and political sentiment. This market tracks whether food inflation will remain elevated despite overall disinflation.'),
    ('Will housing costs drive inflation above Fed targets in 2024?', 'Housing represents 30%+ of inflation calculations. This market assesses whether shelter costs will prevent the Fed from achieving its inflation goals.')) AS v(name, description)),

-- Economics - Employment markets
((SELECT name, description,
  (SELECT id FROM public.market_categories WHERE name = 'Economics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Employment' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Economics')),
  '2024-12-31'::timestamp with time zone,
  0.68, 0.32, 165000, 110000, 'binary',
  'Employment levels indicate economic health and consumer confidence',
  'Job market strength affects spending, inflation, and Federal Reserve monetary policy',
  false, true, true) FROM (VALUES
    ('Will U.S. unemployment rate stay below 4.5% through 2024?', 'Unemployment has remained historically low post-pandemic. This market tracks whether this tight labor market will persist despite economic uncertainties.'),
    ('Will average hourly earnings growth exceed 4% in 2024?', 'Wage growth affects both worker prosperity and inflation pressures. This market evaluates whether strong wage gains will continue in a cooling economy.'),
    ('Will job openings fall below 8 million in 2024?', 'Job openings peaked above 12 million post-pandemic. This market tracks labor market normalization as the economy potentially softens.'),
    ('Will labor force participation rate reach 63.5% in 2024?', 'Labor force participation remains below pre-pandemic levels. This market assesses whether more Americans will return to job seeking.')) AS v(name, description)),

-- Economics - Markets markets
((SELECT name, description,
  (SELECT id FROM public.market_categories WHERE name = 'Economics'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Markets' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Economics')),
  '2024-12-31'::timestamp with time zone,
  0.35, 0.65, 295000, 185000, 'binary',
  'Stock market performance reflects economic confidence and future expectations',
  'Market movements affect retirement accounts, business investment, and economic sentiment',
  true, false, true) FROM (VALUES
    ('Will S&P 500 reach new all-time highs in 2024?', 'Stock markets have shown resilience despite economic uncertainties. This market tracks whether major indices will break through to new record levels.'),
    ('Will the VIX average above 25 in 2024?', 'The VIX measures market volatility and investor fear. This market evaluates whether 2024 will be characterized by elevated market stress.'),
    ('Will Russell 2000 outperform S&P 500 in 2024?', 'Small-cap stocks often outperform during economic recoveries. This market assesses whether smaller companies will lead market gains.'),
    ('Will Bitcoin exceed $75,000 in 2024?', 'Bitcoin has experienced extreme volatility. This market tracks whether the leading cryptocurrency will reach new price milestones amid regulatory clarity.')) AS v(name, description)),

-- Technology - AI markets
((SELECT name, description,
  (SELECT id FROM public.market_categories WHERE name = 'Technology'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Artificial Intelligence' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Technology')),
  '2024-12-31'::timestamp with time zone,
  0.72, 0.28, 340000, 225000, 'binary',
  'AI development shapes future technological capabilities and economic transformation',
  'AI advances affect productivity, employment, and competitive advantages across industries',
  true, true, false) FROM (VALUES
    ('Will GPT-5 or equivalent be released by major AI company in 2024?', 'AI model advancement continues at rapid pace. This market tracks whether next-generation large language models will debut, potentially transforming AI capabilities.'),
    ('Will AI safety regulations be implemented in the U.S. by 2024?', 'Growing AI capabilities raise safety concerns. This market evaluates whether federal regulations will be enacted to govern AI development and deployment.'),
    ('Will any AI system pass a widely recognized general intelligence test in 2024?', 'Artificial General Intelligence remains a key milestone. This market assesses whether 2024 will see breakthrough achievements in general AI capabilities.'),
    ('Will AI-generated content comprise over 20% of web content by end 2024?', 'AI content generation is proliferating rapidly. This market tracks the extent to which AI will reshape the digital content landscape.')) AS v(name, description)),

-- Continue with more categories...
-- Technology - Cybersecurity markets
((SELECT name, description,
  (SELECT id FROM public.market_categories WHERE name = 'Technology'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Cybersecurity' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Technology')),
  '2024-12-31'::timestamp with time zone,
  0.78, 0.22, 145000, 95000, 'binary',
  'Cybersecurity threats affect national security and economic stability',
  'Cyber attacks can disrupt critical infrastructure and cost billions in damages',
  false, true, true) FROM (VALUES
    ('Will there be a major cyberattack on U.S. critical infrastructure in 2024?', 'Critical infrastructure remains vulnerable to sophisticated cyber threats. This market assesses the likelihood of significant attacks on power grids, water systems, or transportation.'),
    ('Will quantum computing break current encryption standards in 2024?', 'Quantum computing threatens current cryptographic methods. This market tracks whether quantum supremacy will compromise existing security protocols.'),
    ('Will ransomware payments exceed $2 billion globally in 2024?', 'Ransomware attacks continue to extort massive payments. This market evaluates whether criminal profits will reach new heights despite law enforcement efforts.'),
    ('Will zero-trust security models be adopted by over 50% of enterprises in 2024?', 'Zero-trust architecture is becoming the gold standard for security. This market tracks enterprise adoption of this comprehensive security approach.')) AS v(name, description)),

-- Technology - Space Tech markets
((SELECT name, description,
  (SELECT id FROM public.market_categories WHERE name = 'Technology'),
  (SELECT id FROM public.market_subcategories WHERE name = 'Space Technology' AND category_id = (SELECT id FROM public.market_categories WHERE name = 'Technology')),
  '2024-12-31'::timestamp with time zone,
  0.85, 0.15, 125000, 78000, 'binary',
  'Space technology advances drive innovation and economic opportunities',
  'Space achievements affect national prestige, scientific discovery, and commercial opportunities',
  true, false, true) FROM (VALUES
    ('Will SpaceX successfully land humans on Mars by end of 2024?', 'Mars colonization represents the next frontier in space exploration. This market tracks whether SpaceX can achieve this historic milestone in their ambitious timeline.'),
    ('Will Artemis III mission launch to the Moon in 2024?', 'NASA''s Artemis program aims to return humans to the Moon. This market evaluates whether the crewed lunar mission will launch as scheduled.'),
    ('Will commercial space tourism flights exceed 100 passengers in 2024?', 'Space tourism is transitioning from novelty to industry. This market tracks whether commercial spaceflight will reach meaningful scale.'),
    ('Will a new space nation join the ISS partnership in 2024?', 'International space cooperation continues evolving. This market assesses whether new countries will join the prestigious ISS consortium.')) AS v(name, description));