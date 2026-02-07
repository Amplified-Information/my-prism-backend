-- Insert Politics subcategories
INSERT INTO public.market_subcategories (category_id, name, description, sort_order) VALUES
('41584341-62ed-482b-bae2-95bb612e4e4f', 'U.S. Elections', '2026 midterms, early 2028 presidential race speculation', 1),
('41584341-62ed-482b-bae2-95bb612e4e4f', 'Global Leadership', 'Outcomes of elections or leadership changes in key nations (e.g., EU, Asia)', 2),
('41584341-62ed-482b-bae2-95bb612e4e4f', 'Policy Outcomes', 'Legislation impacts (e.g., AI regulation, tax reforms)', 3),
('41584341-62ed-482b-bae2-95bb612e4e4f', 'Geopolitical Conflicts', 'Resolutions or escalations in ongoing global tensions', 4);

-- Insert Sports subcategories  
INSERT INTO public.market_subcategories (category_id, name, description, sort_order) VALUES
('90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', 'Major Leagues', 'NFL, NBA, MLB, Premier League outcomes', 1),
('90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', 'Olympics 2026', 'Winter Olympics predictions (e.g., medal counts, standout athletes)', 2),
('90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', 'Esports', 'Competitive gaming events, tournament winners', 3),
('90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', 'Athlete Performance', 'Individual records, injuries, or retirements', 4);

-- Insert Culture subcategories
INSERT INTO public.market_subcategories (category_id, name, description, sort_order) VALUES
('fe179d4c-fae9-4f03-b2f1-9cca3fb24d4f', 'Entertainment Awards', 'Oscars, Grammys, or Emmy outcomes', 1),
('fe179d4c-fae9-4f03-b2f1-9cca3fb24d4f', 'Social Media Trends', 'Viral challenges, influencer controversies', 2),
('fe179d4c-fae9-4f03-b2f1-9cca3fb24d4f', 'Pop Culture Events', 'Movie releases, music album success, or cancellations', 3),
('fe179d4c-fae9-4f03-b2f1-9cca3fb24d4f', 'Meme Economy', 'Predictions on viral memes or internet phenomena', 4);

-- Insert Crypto subcategories
INSERT INTO public.market_subcategories (category_id, name, description, sort_order) VALUES
('95694825-09f2-4c86-a016-262efee00775', 'Bitcoin Price Movements', 'BTC price milestones or crashes', 1),
('95694825-09f2-4c86-a016-262efee00775', 'Altcoin Performance', 'Ethereum, Solana, or emerging token trends', 2),
('95694825-09f2-4c86-a016-262efee00775', 'Regulatory Outcomes', 'Crypto laws or SEC decisions', 3),
('95694825-09f2-4c86-a016-262efee00775', 'NFT/Web3 Trends', 'Adoption rates, major project successes, or failures', 4);

-- Insert Climate subcategories
INSERT INTO public.market_subcategories (category_id, name, description, sort_order) VALUES
('463d093b-0ccb-4a12-8d62-1c0a1ba3abcd', 'Extreme Weather Events', 'Hurricanes, floods, or heatwave predictions', 1),
('463d093b-0ccb-4a12-8d62-1c0a1ba3abcd', 'Renewable Energy Milestones', 'Solar, wind, or battery tech advancements', 2),
('463d093b-0ccb-4a12-8d62-1c0a1ba3abcd', 'Climate Policy', 'Global agreements, carbon credit markets', 3),
('463d093b-0ccb-4a12-8d62-1c0a1ba3abcd', 'Environmental Disasters', 'Oil spills, deforestation impacts', 4);

-- Insert Economics subcategories
INSERT INTO public.market_subcategories (category_id, name, description, sort_order) VALUES
('b44fc1e7-4ca7-455a-b065-24fa72c368da', 'Inflation Trends', 'CPI forecasts, cost-of-living shifts', 1),
('b44fc1e7-4ca7-455a-b065-24fa72c368da', 'Interest Rates', 'Federal Reserve or global bank rate changes', 2),
('b44fc1e7-4ca7-455a-b065-24fa72c368da', 'Job Market', 'Unemployment rates, gig economy growth', 3),
('b44fc1e7-4ca7-455a-b065-24fa72c368da', 'Trade Policies', 'Tariffs, supply chain disruptions', 4);

-- Insert Mentions subcategories
INSERT INTO public.market_subcategories (category_id, name, description, sort_order) VALUES
('4c951cec-f367-4d4e-8fed-9008a1554555', 'Celebrity Buzz', 'Public figure scandals or endorsements', 1),
('4c951cec-f367-4d4e-8fed-9008a1554555', 'Brand Sentiment', 'Corporate PR wins or failures', 2),
('4c951cec-f367-4d4e-8fed-9008a1554555', 'Political Figures', 'Mentions of key leaders in media or X posts', 3),
('4c951cec-f367-4d4e-8fed-9008a1554555', 'Viral Hashtags', 'Trending topics or campaigns on social platforms', 4);

-- Insert Companies subcategories
INSERT INTO public.market_subcategories (category_id, name, description, sort_order) VALUES
('1c4b6f6b-28e9-4a49-bdcc-e9b35a818b3f', 'Tech Giants', 'Apple, Google, or Tesla performance and product launches', 1),
('1c4b6f6b-28e9-4a49-bdcc-e9b35a818b3f', 'Startups', 'Unicorn valuations, IPO successes, or failures', 2),
('1c4b6f6b-28e9-4a49-bdcc-e9b35a818b3f', 'Mergers & Acquisitions', 'Major corporate deals or buyouts', 3),
('1c4b6f6b-28e9-4a49-bdcc-e9b35a818b3f', 'ESG Performance', 'Companies environmental, social, governance impacts', 4);

-- Insert Financials subcategories
INSERT INTO public.market_subcategories (category_id, name, description, sort_order) VALUES
('15f273b0-7060-4e0f-9f31-19e94f5d4ff3', 'Stock Market Indices', 'S&P 500, NASDAQ, or Dow Jones trends', 1),
('15f273b0-7060-4e0f-9f31-19e94f5d4ff3', 'Commodities', 'Oil, gold, or rare earth metal prices', 2),
('15f273b0-7060-4e0f-9f31-19e94f5d4ff3', 'Currency Markets', 'Dollar, euro, or yuan fluctuations', 3),
('15f273b0-7060-4e0f-9f31-19e94f5d4ff3', 'Bond Yields', 'Treasury yields or corporate bond performance', 4);

-- Insert Tech & Science subcategories
INSERT INTO public.market_subcategories (category_id, name, description, sort_order) VALUES
('b353e0c6-b874-4681-90c6-59c1d2949cb4', 'AI Advancements', 'Breakthroughs in AI models or ethics debates', 1),
('b353e0c6-b874-4681-90c6-59c1d2949cb4', 'Space Exploration', 'Mars missions, private spaceflight outcomes', 2),
('b353e0c6-b874-4681-90c6-59c1d2949cb4', 'Quantum Computing', 'Milestones in quantum tech development', 3),
('b353e0c6-b874-4681-90c6-59c1d2949cb4', 'Cybersecurity', 'Major hacks, data breaches, or defense innovations', 4);

-- Insert Health subcategories
INSERT INTO public.market_subcategories (category_id, name, description, sort_order) VALUES
('e746bb34-72c9-4527-9575-22ea6275e5b4', 'Pandemics', 'Emerging diseases or vaccine rollouts', 1),
('e746bb34-72c9-4527-9575-22ea6275e5b4', 'Mental Health', 'Policy changes, therapy access trends', 2),
('e746bb34-72c9-4527-9575-22ea6275e5b4', 'Biotech', 'Gene editing, personalized medicine advancements', 3),
('e746bb34-72c9-4527-9575-22ea6275e5b4', 'Healthcare Policy', 'Universal healthcare or insurance reforms', 4);

-- Insert World subcategories
INSERT INTO public.market_subcategories (category_id, name, description, sort_order) VALUES
('ea5aeb55-f200-4338-ad5c-28d148e267c7', 'International Conflicts', 'Ukraine, Middle East, or South China Sea developments', 1),
('ea5aeb55-f200-4338-ad5c-28d148e267c7', 'Global Summits', 'G7, G20, or COP outcomes', 2),
('ea5aeb55-f200-4338-ad5c-28d148e267c7', 'Refugee Crises', 'Migration trends, border policy impacts', 3),
('ea5aeb55-f200-4338-ad5c-28d148e267c7', 'Humanitarian Aid', 'Disaster relief efforts or funding outcomes', 4);