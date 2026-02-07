-- Add candidates for remaining markets

-- Financials market (Dow Jones stocks)
SELECT public.create_candidate_binary_options(
    '45b3a276-37c6-4304-a265-ab283f700daa',
    'Apple (AAPL)',
    '/api/placeholder/80/80',
    'AAPL',
    '{"sector": "Technology", "weight": "7.8%"}'
);

SELECT public.create_candidate_binary_options(
    '45b3a276-37c6-4304-a265-ab283f700daa',
    'Microsoft (MSFT)',
    '/api/placeholder/80/80',
    'MSFT',
    '{"sector": "Technology", "weight": "6.2%"}'
);

SELECT public.create_candidate_binary_options(
    '45b3a276-37c6-4304-a265-ab283f700daa',
    'NVIDIA (NVDA)',
    '/api/placeholder/80/80',
    'NVDA',
    '{"sector": "Technology", "weight": "2.1%"}'
);

-- Health market (Pharmaceutical companies)
SELECT public.create_candidate_binary_options(
    '2fb06239-a517-4114-834a-29307481fb15',
    'Novo Nordisk',
    '/api/placeholder/80/80',
    'NVO',
    '{"current_drugs": "Ozempic, Wegovy", "focus": "diabetes_obesity"}'
);

SELECT public.create_candidate_binary_options(
    '2fb06239-a517-4114-834a-29307481fb15',
    'Eli Lilly',
    '/api/placeholder/80/80',
    'LLY',
    '{"current_drugs": "Mounjaro, Zepbound", "focus": "diabetes_obesity"}'
);

SELECT public.create_candidate_binary_options(
    '2fb06239-a517-4114-834a-29307481fb15',
    'Pfizer',
    '/api/placeholder/80/80',
    'PFE',
    '{"current_drugs": "Various", "focus": "broad_pharma"}'
);

-- Politics market (Republican candidates 2028)
SELECT public.create_candidate_binary_options(
    '2cb1d991-1b2c-4f6b-8ce4-0bccef9b1a28',
    'Ron DeSantis',
    '/api/placeholder/80/80',
    'Republican',
    '{"position": "Florida Governor", "age": "46"}'
);

SELECT public.create_candidate_binary_options(
    '2cb1d991-1b2c-4f6b-8ce4-0bccef9b1a28',
    'Vivek Ramaswamy',
    '/api/placeholder/80/80',
    'Republican',
    '{"position": "Entrepreneur", "age": "39"}'
);

SELECT public.create_candidate_binary_options(
    '2cb1d991-1b2c-4f6b-8ce4-0bccef9b1a28',
    'Tim Scott',
    '/api/placeholder/80/80',
    'Republican',
    '{"position": "Senator", "age": "59"}'
);

-- Tech & Science market (AGI companies)
SELECT public.create_candidate_binary_options(
    'ed8d3018-1498-4297-bf8c-fb5adf3dded5',
    'OpenAI',
    '/api/placeholder/80/80',
    'Private',
    '{"valuation": "90B", "model": "GPT-4"}'
);

SELECT public.create_candidate_binary_options(
    'ed8d3018-1498-4297-bf8c-fb5adf3dded5',
    'Google DeepMind',
    '/api/placeholder/80/80',
    'GOOGL',
    '{"valuation": "Public", "model": "Gemini"}'
);

SELECT public.create_candidate_binary_options(
    'ed8d3018-1498-4297-bf8c-fb5adf3dded5',
    'Anthropic',
    '/api/placeholder/80/80',
    'Private',
    '{"valuation": "25B", "model": "Claude"}'
);

-- World market (Olympic host cities 2032)
SELECT public.create_candidate_binary_options(
    '294b5728-c418-4ed3-93a9-10b815010b8f',
    'Brisbane, Australia',
    'https://flagcdn.com/w80/au.png',
    'Australia',
    '{"continent": "Oceania", "status": "frontrunner"}'
);

SELECT public.create_candidate_binary_options(
    '294b5728-c418-4ed3-93a9-10b815010b8f',
    'Mumbai, India',
    'https://flagcdn.com/w80/in.png',
    'India',
    '{"continent": "Asia", "status": "candidate"}'
);

SELECT public.create_candidate_binary_options(
    '294b5728-c418-4ed3-93a9-10b815010b8f',
    'Istanbul, Turkey',
    'https://flagcdn.com/w80/tr.png',
    'Turkey',
    '{"continent": "Europe/Asia", "status": "candidate"}'
);

SELECT public.create_candidate_binary_options(
    '294b5728-c418-4ed3-93a9-10b815010b8f',
    'Jakarta, Indonesia',
    'https://flagcdn.com/w80/id.png',
    'Indonesia',
    '{"continent": "Asia", "status": "candidate"}'
);