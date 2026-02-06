-- Insert multi-choice event markets for each category
INSERT INTO public.event_markets (
    name,
    description,
    category_id,
    market_type,
    market_structure,
    participants_count,
    end_date,
    yes_price,
    no_price,
    volume,
    liquidity,
    change_24h
) VALUES 
-- Climate Category
(
    'Which country will achieve carbon neutrality first by 2035?',
    'A prediction market on which major economy will successfully reach net-zero carbon emissions first among the leading candidates.',
    '463d093b-0ccb-4a12-8d62-1c0a1ba3abcd',
    'binary',
    'multi-choice',
    5,
    '2035-01-01T00:00:00Z',
    0.2000,
    0.8000,
    125000.00,
    85000.00,
    2.5
),
-- Companies Category
(
    'Which tech company will have the highest market cap in 2026?',
    'Predict which technology company will lead global markets by market capitalization at the end of 2026.',
    '1c4b6f6b-28e9-4a49-bdcc-e9b35a818b3f',
    'binary',
    'multi-choice',
    6,
    '2026-12-31T23:59:59Z',
    0.1667,
    0.8333,
    320000.00,
    180000.00,
    1.8
),
-- Crypto Category
(
    'Which cryptocurrency will have the best performance in 2025?',
    'A market predicting which major cryptocurrency will deliver the highest returns during 2025.',
    '95694825-09f2-4c86-a016-262efee00775',
    'binary',
    'multi-choice',
    8,
    '2025-12-31T23:59:59Z',
    0.1250,
    0.8750,
    280000.00,
    195000.00,
    -1.2
),
-- Culture Category
(
    'Which streaming platform will win the most Emmy nominations in 2025?',
    'Predict which streaming service will receive the most Emmy Award nominations in the 2025 ceremony.',
    'fe179d4c-fae9-4f03-b2f1-9cca3fb24d4f',
    'binary',
    'multi-choice',
    5,
    '2025-09-01T00:00:00Z',
    0.2000,
    0.8000,
    95000.00,
    62000.00,
    0.8
),
-- Economics Category  
(
    'Which G7 country will have the fastest GDP growth in 2025?',
    'A prediction market on which G7 nation will achieve the highest GDP growth rate in 2025.',
    'b44fc1e7-4ca7-455a-b065-24fa72c368da',
    'binary',
    'multi-choice',
    7,
    '2025-12-31T23:59:59Z',
    0.1429,
    0.8571,
    210000.00,
    145000.00,
    1.1
),
-- Financials Category
(
    'Which stock will be the best performer in the Dow Jones in 2025?',
    'Predict which Dow Jones Industrial Average component will have the highest returns in 2025.',
    '15f273b0-7060-4e0f-9f31-19e94f5d4ff3',
    'binary', 
    'multi-choice',
    6,
    '2025-12-31T23:59:59Z',
    0.1667,
    0.8333,
    420000.00,
    235000.00,
    2.2
),
-- Health Category
(
    'Which pharmaceutical company will develop the next breakthrough obesity drug?',
    'A market on which company will bring the next major weight-loss medication to market after Ozempic/Wegovy.',
    'e746bb34-72c9-4527-9575-22ea6275e5b4',
    'binary',
    'multi-choice', 
    5,
    '2026-06-30T23:59:59Z',
    0.2000,
    0.8000,
    155000.00,
    98000.00,
    -0.5
),
-- Politics Category
(
    'Who will be the Republican nominee for President in 2028?',
    'Predict who will win the Republican Party nomination for the 2028 US Presidential Election.',
    '41584341-62ed-482b-bae2-95bb612e4e4f',
    'binary',
    'multi-choice',
    8,
    '2028-08-31T23:59:59Z',
    0.1250,
    0.8750,
    650000.00,
    380000.00,
    3.1
),
-- Sports Category
(
    'Which team will win the 2025 NBA Championship?',
    'A prediction market on which NBA franchise will win the 2024-25 NBA Finals championship.',
    '90b1e60b-8e7a-4c20-ad56-fb38b6a3877a',
    'binary',
    'multi-choice',
    10,
    '2025-06-30T23:59:59Z',
    0.1000,
    0.9000,
    890000.00,
    425000.00,
    1.7
),
-- Tech & Science Category
(
    'Which company will achieve the first major AGI breakthrough?',
    'Predict which organization will be first to demonstrate artificial general intelligence capabilities.',
    'b353e0c6-b874-4681-90c6-59c1d2949cb4',
    'binary',
    'multi-choice',
    6,
    '2027-12-31T23:59:59Z',
    0.1667,
    0.8333,
    750000.00,
    465000.00,
    4.2
),
-- World Category
(
    'Which city will host the 2032 Summer Olympics?',
    'A market predicting which city will be selected to host the 2032 Summer Olympic Games.',
    'ea5aeb55-f200-4338-ad5c-28d148e267c7',
    'binary',
    'multi-choice',
    4,
    '2025-07-31T23:59:59Z',
    0.2500,
    0.7500,
    180000.00,
    125000.00,
    0.9
);