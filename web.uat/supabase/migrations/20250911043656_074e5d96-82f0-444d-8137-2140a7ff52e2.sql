-- Add test orders for 3 additional markets

-- Market 1: Will the U.S. debt ceiling be raised or suspended in 2025? (High confidence YES market - 85%)
-- Market ID: 7d13aac4-8405-43df-b5c6-76b6b40acd2b

INSERT INTO order_queue (
  order_id, market_id, maker_account_id, side, quantity, price_ticks, max_collateral,
  nonce, order_signature, time_in_force, expiry_timestamp, priority_score
) VALUES 
-- YES orders (buy side) - Strong demand around 80-85 ticks
('ord_debt_001', '7d13aac4-8405-43df-b5c6-76b6b40acd2b', '0.0.1001', 'BUY', 50000000, 82, 41000000, 1001, 'sig_debt_001', 'GTC', NULL, 1736640000000001),
('ord_debt_002', '7d13aac4-8405-43df-b5c6-76b6b40acd2b', '0.0.1002', 'BUY', 25000000, 84, 21000000, 1002, 'sig_debt_002', 'GTC', NULL, 1736640000000002),
('ord_debt_003', '7d13aac4-8405-43df-b5c6-76b6b40acd2b', '0.0.1003', 'BUY', 75000000, 80, 60000000, 1003, 'sig_debt_003', 'GTC', NULL, 1736640000000003),
('ord_debt_004', '7d13aac4-8405-43df-b5c6-76b6b40acd2b', '0.0.1004', 'BUY', 100000000, 78, 78000000, 1004, 'sig_debt_004', 'GTC', NULL, 1736640000000004),

-- NO orders (sell side) - Limited supply, higher prices
('ord_debt_005', '7d13aac4-8405-43df-b5c6-76b6b40acd2b', '0.0.1005', 'SELL', 30000000, 88, 30000000, 1005, 'sig_debt_005', 'GTC', NULL, 1736640000000005),
('ord_debt_006', '7d13aac4-8405-43df-b5c6-76b6b40acd2b', '0.0.1006', 'SELL', 40000000, 90, 40000000, 1006, 'sig_debt_006', 'GTC', NULL, 1736640000000006),

-- Market 2: Will Xi Jinping meet with Donald Trump in 2025? (Moderate YES market - 62%)
-- Market ID: 84a04c44-e1d7-4a9b-a2a6-ce3f1c763412

-- YES orders (buy side) - Moderate demand around 58-65 ticks
('ord_xi_001', '84a04c44-e1d7-4a9b-a2a6-ce3f1c763412', '0.0.2001', 'BUY', 60000000, 60, 36000000, 2001, 'sig_xi_001', 'GTC', NULL, 1736640000000007),
('ord_xi_002', '84a04c44-e1d7-4a9b-a2a6-ce3f1c763412', '0.0.2002', 'BUY', 40000000, 62, 24800000, 2002, 'sig_xi_002', 'GTC', NULL, 1736640000000008),
('ord_xi_003', '84a04c44-e1d7-4a9b-a2a6-ce3f1c763412', '0.0.2003', 'BUY', 80000000, 58, 46400000, 2003, 'sig_xi_003', 'GTC', NULL, 1736640000000009),

-- NO orders (sell side) - Competing supply around 65-70 ticks
('ord_xi_004', '84a04c44-e1d7-4a9b-a2a6-ce3f1c763412', '0.0.2004', 'SELL', 35000000, 65, 35000000, 2004, 'sig_xi_004', 'GTC', NULL, 1736640000000010),
('ord_xi_005', '84a04c44-e1d7-4a9b-a2a6-ce3f1c763412', '0.0.2005', 'SELL', 45000000, 67, 45000000, 2005, 'sig_xi_005', 'GTC', NULL, 1736640000000011),
('ord_xi_006', '84a04c44-e1d7-4a9b-a2a6-ce3f1c763412', '0.0.2006', 'SELL', 55000000, 70, 55000000, 2006, 'sig_xi_006', 'GTC', NULL, 1736640000000012),

-- Market 3: Will clean energy incentives from the Inflation Reduction Act be repealed in 2025? (Moderate NO market - 40% yes)
-- Market ID: c0264ae0-3302-413d-bbd7-833bb6d03890

-- YES orders (buy side) - Limited demand around 35-42 ticks
('ord_ira_001', 'c0264ae0-3302-413d-bbd7-833bb6d03890', '0.0.3001', 'BUY', 45000000, 38, 17100000, 3001, 'sig_ira_001', 'GTC', NULL, 1736640000000013),
('ord_ira_002', 'c0264ae0-3302-413d-bbd7-833bb6d03890', '0.0.3002', 'BUY', 30000000, 40, 12000000, 3002, 'sig_ira_002', 'GTC', NULL, 1736640000000014),
('ord_ira_003', 'c0264ae0-3302-413d-bbd7-833bb6d03890', '0.0.3003', 'BUY', 25000000, 35, 8750000, 3003, 'sig_ira_003', 'GTC', NULL, 1736640000000015),

-- NO orders (sell side) - Strong supply, confident NO position
('ord_ira_004', 'c0264ae0-3302-413d-bbd7-833bb6d03890', '0.0.3004', 'SELL', 70000000, 42, 70000000, 3004, 'sig_ira_004', 'GTC', NULL, 1736640000000016),
('ord_ira_005', 'c0264ae0-3302-413d-bbd7-833bb6d03890', '0.0.3005', 'SELL', 90000000, 45, 90000000, 3005, 'sig_ira_005', 'GTC', NULL, 1736640000000017),
('ord_ira_006', 'c0264ae0-3302-413d-bbd7-833bb6d03890', '0.0.3006', 'SELL', 60000000, 48, 60000000, 3006, 'sig_ira_006', 'GTC', NULL, 1736640000000018);