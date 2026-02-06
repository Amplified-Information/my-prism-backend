-- Insert mock market data into event_markets table

-- Featured Markets
INSERT INTO public.event_markets (
    name, description, category_id, subcategory_id, is_featured, is_trending, is_new,
    yes_price, no_price, volume, liquidity, change_24h, end_date, sort_order
) VALUES
-- Bitcoin market
('Will Bitcoin reach $100,000 by end of 2024?', 
 'Prediction market on whether Bitcoin will reach the $100,000 price milestone before the end of 2024.',
 '95694825-09f2-4c86-a016-262efee00775', NULL, TRUE, FALSE, FALSE,
 0.7200, 0.2800, 45230.00, 52000.00, 0.0520, '2024-12-31 23:59:59+00', 1),

-- US Presidential Election
('Will the 2024 US Presidential Election be decided by more than 5% margin?',
 'Prediction on whether the winner of the 2024 US Presidential Election will win by more than a 5% margin in the popular vote.',
 '41584341-62ed-482b-bae2-95bb612e4e4f', NULL, TRUE, FALSE, FALSE,
 0.3400, 0.6600, 89450.00, 125000.00, -0.0210, '2024-11-05 23:59:59+00', 2),

-- OpenAI GPT-5
('Will OpenAI release GPT-5 in 2024?',
 'Market on whether OpenAI will officially release GPT-5 or announce its public availability in 2024.',
 'b353e0c6-b874-4681-90c6-59c1d2949cb4', NULL, TRUE, FALSE, FALSE,
 0.6800, 0.3200, 23120.00, 34000.00, 0.0870, '2024-12-31 23:59:59+00', 3),

-- LeBron James NBA
('Will LeBron James play in the 2024-25 NBA season?',
 'Prediction on whether LeBron James will appear in at least one game during the 2024-25 NBA regular season.',
 '90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', NULL, TRUE, FALSE, FALSE,
 0.8500, 0.1500, 56780.00, 72000.00, 0.0460, '2025-06-01 23:59:59+00', 4),

-- Super Bowl overtime
('Will the Super Bowl 2025 go to overtime?',
 'Market on whether Super Bowl LIX will require overtime to determine the winner.',
 '90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', NULL, TRUE, FALSE, FALSE,
 0.1200, 0.8800, 78450.00, 95000.00, -0.0130, '2025-02-09 23:59:59+00', 5),

-- Amazon stock
('Will Amazon stock reach $200 by end of 2024?',
 'Prediction on whether Amazon (AMZN) stock price will reach or exceed $200 per share by the end of 2024.',
 '1c4b6f6b-28e9-4a49-bdcc-e9b35a818b3f', NULL, TRUE, FALSE, FALSE,
 0.5800, 0.4200, 67890.00, 82000.00, 0.0380, '2024-12-31 23:59:59+00', 6),

-- Apple market cap
('Will Apple''s market cap exceed $4 trillion in 2024?',
 'Market on whether Apple Inc. will achieve a market capitalization of over $4 trillion at any point during 2024.',
 '1c4b6f6b-28e9-4a49-bdcc-e9b35a818b3f', NULL, TRUE, FALSE, FALSE,
 0.7300, 0.2700, 89450.00, 115000.00, 0.0620, '2024-12-31 23:59:59+00', 7),

-- Marvel movie
('Will the next Marvel movie gross over $1 billion worldwide?',
 'Prediction on whether the next Marvel Cinematic Universe theatrical release will gross over $1 billion worldwide.',
 'fe179d4c-fae9-4f03-b2f1-9cca3fb24d4f', NULL, TRUE, FALSE, FALSE,
 0.6400, 0.3600, 54320.00, 68000.00, 0.0210, '2024-12-31 23:59:59+00', 8),

-- Taylor Swift album
('Will Taylor Swift announce a new album in 2024?',
 'Market on whether Taylor Swift will officially announce a new studio album for release in 2024.',
 'fe179d4c-fae9-4f03-b2f1-9cca3fb24d4f', NULL, TRUE, FALSE, FALSE,
 0.8100, 0.1900, 73210.00, 92000.00, 0.0790, '2024-12-31 23:59:59+00', 9),

-- NASA Mars life
('Will NASA announce evidence of life on Mars in 2024?',
 'Prediction on whether NASA will make an official announcement regarding evidence of past or present life on Mars.',
 'b353e0c6-b874-4681-90c6-59c1d2949cb4', NULL, TRUE, FALSE, FALSE,
 0.0800, 0.9200, 41230.00, 55000.00, -0.0050, '2024-12-31 23:59:59+00', 10),

-- Quantum computer RSA
('Will a quantum computer break RSA encryption in 2024?',
 'Market on whether any quantum computer will successfully break RSA encryption in a publicly demonstrated way.',
 'b353e0c6-b874-4681-90c6-59c1d2949cb4', NULL, TRUE, FALSE, FALSE,
 0.1500, 0.8500, 29840.00, 38000.00, 0.0120, '2024-12-31 23:59:59+00', 11);

-- Trending Markets  
INSERT INTO public.event_markets (
    name, description, category_id, subcategory_id, is_featured, is_trending, is_new,
    yes_price, no_price, volume, liquidity, change_24h, end_date, sort_order
) VALUES
-- Tesla stock
('Will Tesla stock hit $300 before Q2 2024?',
 'Prediction on whether Tesla (TSLA) stock price will reach or exceed $300 per share before June 30, 2024.',
 '1c4b6f6b-28e9-4a49-bdcc-e9b35a818b3f', NULL, FALSE, TRUE, FALSE,
 0.4500, 0.5500, 34890.00, 42000.00, 0.1230, '2024-06-30 23:59:59+00', 12),

-- Champions League goals
('Will the Champions League final have over 2.5 goals?',
 'Market on whether the UEFA Champions League final will have a combined total of more than 2.5 goals scored.',
 '90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', NULL, FALSE, TRUE, FALSE,
 0.7800, 0.2200, 67230.00, 78000.00, 0.0340, '2024-06-01 23:59:59+00', 13),

-- Patrick Mahomes yards
('Will Patrick Mahomes throw for over 4,500 yards this NFL season?',
 'Prediction on whether Patrick Mahomes will throw for more than 4,500 passing yards in the 2024 NFL season.',
 '90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', NULL, FALSE, TRUE, FALSE,
 0.6500, 0.3500, 45670.00, 58000.00, 0.0720, '2025-02-15 23:59:59+00', 14),

-- NBA 70 wins
('Will any NBA team win 70+ games this season?',
 'Market on whether any NBA team will achieve 70 or more regular season wins in the 2023-24 season.',
 '90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', NULL, FALSE, TRUE, FALSE,
 0.2300, 0.7700, 29840.00, 35000.00, -0.0410, '2024-04-14 23:59:59+00', 15),

-- Lionel Messi MLS goals
('Will Lionel Messi score 15+ goals in MLS this season?',
 'Prediction on whether Lionel Messi will score 15 or more goals in Major League Soccer during the 2024 season.',
 '90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', NULL, FALSE, TRUE, FALSE,
 0.8900, 0.1100, 52310.00, 67000.00, 0.0280, '2024-11-09 23:59:59+00', 16);

-- New Markets
INSERT INTO public.event_markets (
    name, description, category_id, subcategory_id, is_featured, is_trending, is_new,
    yes_price, no_price, volume, liquidity, change_24h, end_date, sort_order
) VALUES
-- Apple VR headset
('Will Apple announce a VR headset successor in 2024?',
 'Market on whether Apple will officially announce a successor to the Vision Pro or new VR/AR headset in 2024.',
 'b353e0c6-b874-4681-90c6-59c1d2949cb4', NULL, FALSE, FALSE, TRUE,
 0.8200, 0.1800, 12340.00, 18500.00, -0.0120, '2024-12-31 23:59:59+00', 17),

-- NBA playoffs 100 points
('Will any team break the 100-point barrier in NBA playoffs?',
 'Prediction on whether any team will score 100 or more points in a single game during the 2024 NBA playoffs.',
 '90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', NULL, FALSE, FALSE, TRUE,
 0.9100, 0.0900, 18760.00, 22000.00, 0.1580, '2024-06-20 23:59:59+00', 18),

-- Max Verstappen F1 Championship
('Will Max Verstappen win the 2024 Formula 1 Championship?',
 'Market on whether Max Verstappen will win the Formula 1 Drivers'' Championship for the 2024 season.',
 '90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', NULL, FALSE, FALSE, TRUE,
 0.9400, 0.0600, 73420.00, 89000.00, 0.0150, '2024-12-08 23:59:59+00', 19),

-- US Women''s Soccer Olympic Gold
('Will the US Women''s Soccer team win Olympic Gold in Paris 2024?',
 'Prediction on whether the United States Women''s National Soccer Team will win the gold medal at the 2024 Paris Olympics.',
 '90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', NULL, FALSE, FALSE, TRUE,
 0.4700, 0.5300, 31250.00, 41000.00, 0.0630, '2024-08-10 23:59:59+00', 20),

-- Shohei Ohtani home runs
('Will Shohei Ohtani hit 50+ home runs this MLB season?',
 'Market on whether Shohei Ohtani will hit 50 or more home runs during the 2024 MLB regular season.',
 '90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', NULL, FALSE, FALSE, TRUE,
 0.3800, 0.6200, 42890.00, 55000.00, 0.0970, '2024-10-01 23:59:59+00', 21),

-- Perfect game MLB
('Will there be a perfect game thrown in MLB this season?',
 'Prediction on whether any pitcher will throw a perfect game (27 consecutive outs) during the 2024 MLB season.',
 '90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', NULL, FALSE, FALSE, TRUE,
 0.1500, 0.8500, 19670.00, 24000.00, -0.0240, '2024-10-31 23:59:59+00', 22),

-- Novak Djokovic Wimbledon
('Will Novak Djokovic win Wimbledon 2024?',
 'Market on whether Novak Djokovic will win the men''s singles title at Wimbledon 2024.',
 '90b1e60b-8e7a-4c20-ad56-fb38b6a3877a', NULL, FALSE, FALSE, TRUE,
 0.5600, 0.4400, 38450.00, 47000.00, -0.0180, '2024-07-14 23:59:59+00', 23);