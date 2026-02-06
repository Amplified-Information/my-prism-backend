-- Add candidates for Crypto market 
SELECT public.create_candidate_binary_options(
    'aa231a76-9701-4961-89e0-99196d448bd9',
    'Bitcoin (BTC)',
    '/api/placeholder/80/80',
    'BTC',
    '{"market_cap_rank": 1, "type": "store_of_value"}'
);

SELECT public.create_candidate_binary_options(
    'aa231a76-9701-4961-89e0-99196d448bd9',
    'Ethereum (ETH)',
    '/api/placeholder/80/80',
    'ETH',
    '{"market_cap_rank": 2, "type": "smart_contracts"}'
);

SELECT public.create_candidate_binary_options(
    'aa231a76-9701-4961-89e0-99196d448bd9',
    'Solana (SOL)',
    '/api/placeholder/80/80',
    'SOL',
    '{"market_cap_rank": 5, "type": "high_performance"}'
);

SELECT public.create_candidate_binary_options(
    'aa231a76-9701-4961-89e0-99196d448bd9',
    'Cardano (ADA)',
    '/api/placeholder/80/80',
    'ADA',
    '{"market_cap_rank": 8, "type": "academic_approach"}'
);

SELECT public.create_candidate_binary_options(
    'aa231a76-9701-4961-89e0-99196d448bd9',
    'Polygon (MATIC)',
    '/api/placeholder/80/80',
    'MATIC',
    '{"market_cap_rank": 12, "type": "scaling_solution"}'
);

-- Add candidates for Culture market (Streaming platforms)
SELECT public.create_candidate_binary_options(
    'e1ffb20f-e4e0-4122-921a-e2733611548d',
    'Netflix',
    '/api/placeholder/80/80',
    'NFLX',
    '{"subscribers": "260M", "content_focus": "original_series"}'
);

SELECT public.create_candidate_binary_options(
    'e1ffb20f-e4e0-4122-921a-e2733611548d',
    'Amazon Prime Video',
    '/api/placeholder/80/80',
    'AMZN',
    '{"subscribers": "200M", "content_focus": "blockbusters"}'
);

SELECT public.create_candidate_binary_options(
    'e1ffb20f-e4e0-4122-921a-e2733611548d',
    'HBO Max',
    '/api/placeholder/80/80',
    'HBO',
    '{"subscribers": "95M", "content_focus": "prestige_drama"}'
);

SELECT public.create_candidate_binary_options(
    'e1ffb20f-e4e0-4122-921a-e2733611548d',
    'Disney+',
    '/api/placeholder/80/80',
    'DIS',
    '{"subscribers": "150M", "content_focus": "family_entertainment"}'
);

SELECT public.create_candidate_binary_options(
    'e1ffb20f-e4e0-4122-921a-e2733611548d',
    'Apple TV+',
    '/api/placeholder/80/80',
    'AAPL',
    '{"subscribers": "40M", "content_focus": "premium_originals"}'
);