-- Add candidates for Economics market (G7 countries)
SELECT public.create_candidate_binary_options(
    'c56989bf-d163-418c-84dc-6f417cd5fbe6',
    'United States',
    'https://flagcdn.com/w80/us.png',
    'USA',
    '{"gdp_2023": "26.9T", "growth_trend": "stable"}'
);

SELECT public.create_candidate_binary_options(
    'c56989bf-d163-418c-84dc-6f417cd5fbe6',
    'Germany',
    'https://flagcdn.com/w80/de.png',
    'DEU',
    '{"gdp_2023": "4.3T", "growth_trend": "slow"}'
);

SELECT public.create_candidate_binary_options(
    'c56989bf-d163-418c-84dc-6f417cd5fbe6',
    'Japan',
    'https://flagcdn.com/w80/jp.png',
    'JPN',
    '{"gdp_2023": "4.2T", "growth_trend": "moderate"}'
);

SELECT public.create_candidate_binary_options(
    'c56989bf-d163-418c-84dc-6f417cd5fbe6',
    'United Kingdom',
    'https://flagcdn.com/w80/gb.png',
    'GBR',
    '{"gdp_2023": "3.1T", "growth_trend": "recovering"}'
);

SELECT public.create_candidate_binary_options(
    'c56989bf-d163-418c-84dc-6f417cd5fbe6',
    'France',
    'https://flagcdn.com/w80/fr.png',
    'FRA',
    '{"gdp_2023": "2.9T", "growth_trend": "stable"}'
);

SELECT public.create_candidate_binary_options(
    'c56989bf-d163-418c-84dc-6f417cd5fbe6',
    'Italy',
    'https://flagcdn.com/w80/it.png',
    'ITA',
    '{"gdp_2023": "2.1T", "growth_trend": "slow"}'
);

SELECT public.create_candidate_binary_options(
    'c56989bf-d163-418c-84dc-6f417cd5fbe6',
    'Canada',
    'https://flagcdn.com/w80/ca.png',
    'CAN',
    '{"gdp_2023": "2.1T", "growth_trend": "moderate"}'
);

-- Add candidates for Health market (Pharma companies)
SELECT public.create_candidate_binary_options(
    '2fb06239-a517-4114-834a-29307481fb15',
    'Novo Nordisk',
    '/api/placeholder/80/80',
    'NVO',
    '{"specialty": "diabetes_obesity", "current_drugs": "Ozempic, Wegovy"}'
);

SELECT public.create_candidate_binary_options(
    '2fb06239-a517-4114-834a-29307481fb15',
    'Eli Lilly',
    '/api/placeholder/80/80',
    'LLY',
    '{"specialty": "diabetes_obesity", "current_drugs": "Mounjaro, Zepbound"}'
);

SELECT public.create_candidate_binary_options(
    '2fb06239-a517-4114-834a-29307481fb15',
    'Roche',
    '/api/placeholder/80/80',
    'RHHBY',
    '{"specialty": "oncology_metabolic", "pipeline": "advanced"}'
);

SELECT public.create_candidate_binary_options(
    '2fb06239-a517-4114-834a-29307481fb15',
    'Pfizer',
    '/api/placeholder/80/80',
    'PFE',
    '{"specialty": "general_pharma", "resources": "high"}'
);

SELECT public.create_candidate_binary_options(
    '2fb06239-a517-4114-834a-29307481fb15',
    'Johnson & Johnson',
    '/api/placeholder/80/80',
    'JNJ',
    '{"specialty": "diverse_portfolio", "r_and_d": "strong"}'
);