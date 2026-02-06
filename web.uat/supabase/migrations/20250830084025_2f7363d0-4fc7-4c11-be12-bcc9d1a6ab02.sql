-- Add candidates for Climate market (Carbon neutrality)
SELECT public.create_candidate_binary_options(
    '691d24fe-4ed4-4806-897d-5adf3ec5d4a2',
    'United States',
    'https://flagcdn.com/w80/us.png',
    'USA',
    '{"region": "North America", "current_emissions": "high"}'
);

SELECT public.create_candidate_binary_options(
    '691d24fe-4ed4-4806-897d-5adf3ec5d4a2',
    'European Union',
    'https://flagcdn.com/w80/eu.png',
    'EU',
    '{"region": "Europe", "current_emissions": "medium"}'
);

SELECT public.create_candidate_binary_options(
    '691d24fe-4ed4-4806-897d-5adf3ec5d4a2',
    'China',
    'https://flagcdn.com/w80/cn.png',
    'CHN',
    '{"region": "Asia", "current_emissions": "very_high"}'
);

SELECT public.create_candidate_binary_options(
    '691d24fe-4ed4-4806-897d-5adf3ec5d4a2',
    'Japan',
    'https://flagcdn.com/w80/jp.png',
    'JPN',
    '{"region": "Asia", "current_emissions": "medium"}'
);

SELECT public.create_candidate_binary_options(
    '691d24fe-4ed4-4806-897d-5adf3ec5d4a2',
    'United Kingdom',
    'https://flagcdn.com/w80/gb.png',
    'UK',
    '{"region": "Europe", "current_emissions": "medium"}'
);

-- Add candidates for Companies market (Tech market cap)
SELECT public.create_candidate_binary_options(
    'e1b56510-ef0c-44cd-9c6f-2ee318e4c4f2',
    'Apple',
    '/api/placeholder/80/80',
    'AAPL',
    '{"sector": "Consumer Electronics", "current_cap": "3.5T"}'
);

SELECT public.create_candidate_binary_options(
    'e1b56510-ef0c-44cd-9c6f-2ee318e4c4f2',
    'Microsoft',
    '/api/placeholder/80/80',
    'MSFT',
    '{"sector": "Software", "current_cap": "3.1T"}'
);

SELECT public.create_candidate_binary_options(
    'e1b56510-ef0c-44cd-9c6f-2ee318e4c4f2',
    'NVIDIA',
    '/api/placeholder/80/80',
    'NVDA',
    '{"sector": "Semiconductors", "current_cap": "1.8T"}'
);

SELECT public.create_candidate_binary_options(
    'e1b56510-ef0c-44cd-9c6f-2ee318e4c4f2',
    'Google (Alphabet)',
    '/api/placeholder/80/80',
    'GOOGL',
    '{"sector": "Internet Services", "current_cap": "2.1T"}'
);

SELECT public.create_candidate_binary_options(
    'e1b56510-ef0c-44cd-9c6f-2ee318e4c4f2',
    'Amazon',
    '/api/placeholder/80/80',
    'AMZN',
    '{"sector": "E-commerce/Cloud", "current_cap": "1.6T"}'
);

SELECT public.create_candidate_binary_options(
    'e1b56510-ef0c-44cd-9c6f-2ee318e4c4f2',
    'Tesla',
    '/api/placeholder/80/80',
    'TSLA',
    '{"sector": "Electric Vehicles", "current_cap": "800B"}'
);