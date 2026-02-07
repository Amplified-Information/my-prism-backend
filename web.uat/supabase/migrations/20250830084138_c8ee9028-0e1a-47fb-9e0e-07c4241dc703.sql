-- Add candidates for Economics market (G7 countries)
SELECT public.create_candidate_binary_options(
    'c56989bf-d163-418c-84dc-6f417cd5fbe6',
    'United States',
    'https://flagcdn.com/w80/us.png',
    'USA',
    '{"gdp_2024": "25.4T", "growth_forecast": "2.1%"}'
);

SELECT public.create_candidate_binary_options(
    'c56989bf-d163-418c-84dc-6f417cd5fbe6',
    'Japan',
    'https://flagcdn.com/w80/jp.png',
    'JPN',
    '{"gdp_2024": "4.9T", "growth_forecast": "0.9%"}'
);

SELECT public.create_candidate_binary_options(
    'c56989bf-d163-418c-84dc-6f417cd5fbe6',
    'Germany',
    'https://flagcdn.com/w80/de.png',
    'DEU',
    '{"gdp_2024": "4.2T", "growth_forecast": "1.3%"}'
);

SELECT public.create_candidate_binary_options(
    'c56989bf-d163-418c-84dc-6f417cd5fbe6',
    'United Kingdom',
    'https://flagcdn.com/w80/gb.png',
    'GBR',
    '{"gdp_2024": "3.1T", "growth_forecast": "1.5%"}'
);

SELECT public.create_candidate_binary_options(
    'c56989bf-d163-418c-84dc-6f417cd5fbe6',
    'France',
    'https://flagcdn.com/w80/fr.png',
    'FRA',
    '{"gdp_2024": "2.9T", "growth_forecast": "1.1%"}'
);

SELECT public.create_candidate_binary_options(
    'c56989bf-d163-418c-84dc-6f417cd5fbe6',
    'Italy',
    'https://flagcdn.com/w80/it.png',
    'ITA',
    '{"gdp_2024": "2.1T", "growth_forecast": "0.7%"}'
);

SELECT public.create_candidate_binary_options(
    'c56989bf-d163-418c-84dc-6f417cd5fbe6',
    'Canada',
    'https://flagcdn.com/w80/ca.png',
    'CAN',
    '{"gdp_2024": "2.1T", "growth_forecast": "1.8%"}'
);

-- Add candidates for Sports market (NBA teams)
SELECT public.create_candidate_binary_options(
    '95e80e46-1c11-491a-8355-7dd07563baac',
    'Boston Celtics',
    '/api/placeholder/80/80',
    'BOS',
    '{"conference": "Eastern", "championships": 18}'
);

SELECT public.create_candidate_binary_options(
    '95e80e46-1c11-491a-8355-7dd07563baac',
    'Los Angeles Lakers',
    '/api/placeholder/80/80',
    'LAL',
    '{"conference": "Western", "championships": 17}'
);

SELECT public.create_candidate_binary_options(
    '95e80e46-1c11-491a-8355-7dd07563baac',
    'Denver Nuggets',
    '/api/placeholder/80/80',
    'DEN',
    '{"conference": "Western", "championships": 1}'
);

SELECT public.create_candidate_binary_options(
    '95e80e46-1c11-491a-8355-7dd07563baac',
    'Milwaukee Bucks',
    '/api/placeholder/80/80',
    'MIL',
    '{"conference": "Eastern", "championships": 2}'
);

SELECT public.create_candidate_binary_options(
    '95e80e46-1c11-491a-8355-7dd07563baac',
    'Phoenix Suns',
    '/api/placeholder/80/80',
    'PHX',
    '{"conference": "Western", "championships": 0}'
);