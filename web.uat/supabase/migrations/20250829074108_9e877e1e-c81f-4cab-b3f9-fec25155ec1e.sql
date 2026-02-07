-- Create Global Leadership category
INSERT INTO market_categories (name, description, sort_order, is_active) 
VALUES ('Global Leadership', 'Markets focused on world leaders, international relations, and geopolitical events', 1, true);

-- Insert the 10 Global Leadership event markets with randomized is_featured and is_trending values
INSERT INTO event_markets (
  name, description, category_id, end_date, yes_price, no_price, volume, liquidity, 
  change_24h, is_featured, is_trending, relevance, why_it_matters, market_type, 
  resolution_status, is_active, sort_order
) VALUES 
-- Market 1: Trump-Russia-Ukraine ceasefire
(
  'Will Donald Trump broker a Russia-Ukraine ceasefire by July 2025?',
  'Traders bet on whether U.S. President Donald Trump will successfully negotiate a ceasefire in the Russia-Ukraine conflict by mid-2025, potentially involving territorial concessions.',
  (SELECT id FROM market_categories WHERE name = 'Global Leadership'),
  '2025-07-31 23:59:59+00',
  0.35, 0.65, 2500000, 150000, -0.05,
  true, false,
  'Trump''s second term emphasizes an "America First" agenda, with claims of resolving the Ukraine conflict swiftly. Polymarket odds recently dropped to 35% for a ceasefire, reflecting skepticism after Zelensky-Trump meetings. His leadership style and potential collaboration with China to pressure Russia are pivotal.',
  'A ceasefire could reshape European security, NATO''s role, and global energy markets, while failure risks prolonged conflict and economic instability.',
  'binary', 'open', true, 1
),
-- Market 2: Xi Jinping meets Trump
(
  'Will Xi Jinping meet with Donald Trump in 2025?',
  'This market predicts whether Chinese President Xi Jinping will hold a formal meeting with Trump in 2025, amid escalating U.S.-China trade tensions.',
  (SELECT id FROM market_categories WHERE name = 'Global Leadership'),
  '2025-12-31 23:59:59+00',
  0.62, 0.38, 1800000, 120000, 0.03,
  false, true,
  'With Trump''s proposed tariffs on Chinese goods, a meeting could signal de-escalation or further entrenchment of the trade war. Expert forecasts highlight U.S.-China rivalry as a defining geopolitical issue.',
  'The outcome influences global trade, supply chains, and economic stability, impacting markets from tech to commodities.',
  'binary', 'open', true, 2
),
-- Market 3: Germany CDU/CSU coalition
(
  'Will Germany''s CDU/CSU form a coalition excluding AfD in 2025?',
  'Traders wager on whether the center-right CDU/CSU will form a government coalition without the far-right Alternative for Germany (AfD) after the February 2025 Bundestag elections.',
  (SELECT id FROM market_categories WHERE name = 'Global Leadership'),
  '2025-02-28 23:59:59+00',
  0.78, 0.22, 980000, 85000, 0.02,
  true, true,
  'The CDU/CSU''s victory is likely, but AfD''s strong polling (second place) signals rising populism. A coalition excluding AfD would stabilize Germany''s EU leadership, while inclusion could disrupt it.',
  'Germany''s government composition affects EU policy on trade, climate, and Ukraine, influencing global markets and alliances.',
  'binary', 'open', true, 3
),
-- Market 4: Lukashenko remains president
(
  'Will Alexander Lukashenko remain Belarus'' president by December 2025?',
  'This market bets on whether Belarusian President Alexander Lukashenko will stay in power through 2025, following his controversial seventh-term win in January.',
  (SELECT id FROM market_categories WHERE name = 'Global Leadership'),
  '2025-12-31 23:59:59+00',
  0.71, 0.29, 750000, 65000, -0.01,
  false, false,
  'Lukashenko''s alignment with Russia''s Putin makes his leadership a geopolitical linchpin. Protests and suppression highlight domestic instability, impacting regional security.',
  'His tenure affects Russia''s influence in Eastern Europe, NATO''s eastern flank, and energy routes, with global security implications.',
  'binary', 'open', true, 4
),
-- Market 5: Shanghai Cooperation Organization expansion
(
  'Will the Shanghai Cooperation Organization expand membership in 2025?',
  'Traders predict whether the SCO, led by China and Russia, will admit new members at its September 2025 summit in Tianjin.',
  (SELECT id FROM market_categories WHERE name = 'Global Leadership'),
  '2025-09-30 23:59:59+00',
  0.54, 0.46, 1200000, 95000, 0.07,
  true, false,
  'The SCO''s growing influence in Central Asia counters Western alliances. Expansion could strengthen China-Russia''s geopolitical leverage, especially amid U.S. tariff policies.',
  'New members could shift global power dynamics, impacting trade, security, and BRICS alignment, with ripple effects on markets.',
  'binary', 'open', true, 5
),
-- Market 6: Norway Labour Party majority
(
  'Will Norway''s Labour Party lose the parliamentary majority in 2025?',
  'This market assesses whether Norway''s center-left Labour Party will lose its majority in the September 2025 parliamentary elections.',
  (SELECT id FROM market_categories WHERE name = 'Global Leadership'),
  '2025-09-30 23:59:59+00',
  0.43, 0.57, 680000, 58000, -0.02,
  false, true,
  'The Labour Party''s likely win but potential loss of majority could shift Norway''s energy and climate policies, given its role as a major oil and gas exporter.',
  'Norway''s energy policies influence global oil markets and Europe''s energy security, especially amid Russia-Ukraine tensions.',
  'binary', 'open', true, 6
),
-- Market 7: Bolivia MAS party presidency
(
  'Will Bolivia''s MAS party retain the presidency in August 2025?',
  'Traders bet on whether the Movement for Socialism (MAS) party will win Bolivia''s presidential election, amid divisions between President Luis Arce and Evo Morales.',
  (SELECT id FROM market_categories WHERE name = 'Global Leadership'),
  '2025-08-31 23:59:59+00',
  0.49, 0.51, 420000, 42000, 0.04,
  true, false,
  'Internal MAS fractures and Morales'' barred candidacy create uncertainty in a key lithium-producing nation, impacting global resource markets.',
  'Bolivia''s leadership affects lithium supply chains critical for batteries and renewable energy, influencing tech and green energy sectors.',
  'binary', 'open', true, 7
),
-- Market 8: Guyana President re-election
(
  'Will Guyana''s President Irfaan Ali be re-elected in September 2025?',
  'This market predicts whether Guyana''s center-left President Irfaan Ali will secure re-election in the September 2025 general elections.',
  (SELECT id FROM market_categories WHERE name = 'Global Leadership'),
  '2025-09-30 23:59:59+00',
  0.58, 0.42, 320000, 38000, 0.01,
  false, false,
  'Guyana''s oil boom makes its leadership pivotal for global energy markets. A stable Ali re-election could ensure policy continuity, while opposition gains may disrupt oil development.',
  'Guyana''s oil production influences global energy prices and South American geopolitics, impacting investment flows.',
  'binary', 'open', true, 8
),
-- Market 9: UN AI governance resolution
(
  'Will the UN General Assembly pass a global AI governance resolution in September 2025?',
  'Traders wager on whether the UN General Assembly will adopt a resolution on AI governance during its September 2025 session.',
  (SELECT id FROM market_categories WHERE name = 'Global Leadership'),
  '2025-09-30 23:59:59+00',
  0.67, 0.33, 1500000, 110000, 0.08,
  true, true,
  'Global leaders face pressure to regulate AI amid its disruptive rise. A resolution could signal coordinated governance, impacting tech markets and international cooperation.',
  'AI governance affects innovation, cybersecurity, and economic competition, with implications for global tech leadership and market stability.',
  'binary', 'open', true, 9
),
-- Market 10: Malawi President re-election
(
  'Will Malawi''s President Lazarus Chakwera win re-election in September 2025?',
  'This market bets on whether incumbent President Lazarus Chakwera will defeat Peter Mutharika in Malawi''s September 2025 general elections.',
  (SELECT id FROM market_categories WHERE name = 'Global Leadership'),
  '2025-09-30 23:59:59+00',
  0.52, 0.48, 180000, 25000, -0.03,
  false, true,
  'Malawi''s leadership influences regional stability in Southern Africa and its role in international development partnerships, such as TICAD 9.',
  'The outcome affects foreign investment, aid flows, and regional cooperation, with broader implications for African geopolitics and markets.',
  'binary', 'open', true, 10
);