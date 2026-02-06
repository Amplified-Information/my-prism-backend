-- Add candidates for Politics market (Republican 2028)
SELECT public.create_candidate_binary_options(
    '2cb1d991-1b2c-4f6b-8ce4-0bccef9b1a28',
    'Ron DeSantis',
    '/api/placeholder/80/80',
    'Republican',
    '{"state": "Florida", "position": "Governor", "age": "46"}'
);

SELECT public.create_candidate_binary_options(
    '2cb1d991-1b2c-4f6b-8ce4-0bccef9b1a28',
    'Vivek Ramaswamy',
    '/api/placeholder/80/80',
    'Republican',
    '{"background": "Entrepreneur", "age": "39", "experience": "Business"}'
);

SELECT public.create_candidate_binary_options(
    '2cb1d991-1b2c-4f6b-8ce4-0bccef9b1a28',
    'Tim Scott',
    '/api/placeholder/80/80',
    'Republican',
    '{"state": "South Carolina", "position": "Senator", "age": "59"}'
);

SELECT public.create_candidate_binary_options(
    '2cb1d991-1b2c-4f6b-8ce4-0bccef9b1a28',
    'Kristi Noem',
    '/api/placeholder/80/80',
    'Republican',
    '{"state": "South Dakota", "position": "Governor", "age": "52"}'
);

SELECT public.create_candidate_binary_options(
    '2cb1d991-1b2c-4f6b-8ce4-0bccef9b1a28',
    'Glenn Youngkin',
    '/api/placeholder/80/80',
    'Republican',
    '{"state": "Virginia", "position": "Governor", "age": "57"}'
);

-- Add candidates for Sports market (NBA Championship)
SELECT public.create_candidate_binary_options(
    '95e80e46-1c11-491a-8355-7dd07563baac',
    'Boston Celtics',
    '/api/placeholder/80/80',
    'Eastern Conference',
    '{"city": "Boston", "championships": 18, "recent_form": "strong"}'
);

SELECT public.create_candidate_binary_options(
    '95e80e46-1c11-491a-8355-7dd07563baac',
    'Denver Nuggets',
    '/api/placeholder/80/80',
    'Western Conference',
    '{"city": "Denver", "championships": 1, "defending_champs": true}'
);

SELECT public.create_candidate_binary_options(
    '95e80e46-1c11-491a-8355-7dd07563baac',
    'Phoenix Suns',
    '/api/placeholder/80/80',
    'Western Conference',
    '{"city": "Phoenix", "championships": 0, "recent_form": "improving"}'
);

SELECT public.create_candidate_binary_options(
    '95e80e46-1c11-491a-8355-7dd07563baac',
    'Milwaukee Bucks',
    '/api/placeholder/80/80',
    'Eastern Conference',
    '{"city": "Milwaukee", "championships": 2, "star_player": "Giannis"}'
);

-- Add candidates for Tech market (AGI breakthrough)
SELECT public.create_candidate_binary_options(
    'ed8d3018-1498-4297-bf8c-fb5adf3dded5',
    'OpenAI',
    '/api/placeholder/80/80',
    'AI Research',
    '{"focus": "Large Language Models", "funding": "Microsoft"}'
);

SELECT public.create_candidate_binary_options(
    'ed8d3018-1498-4297-bf8c-fb5adf3dded5',
    'Google DeepMind',
    '/api/placeholder/80/80',
    'AI Research',
    '{"focus": "General AI Research", "resources": "Alphabet"}'
);

SELECT public.create_candidate_binary_options(
    'ed8d3018-1498-4297-bf8c-fb5adf3dded5',
    'Anthropic',
    '/api/placeholder/80/80',
    'AI Safety',
    '{"focus": "Safe AI Systems", "approach": "Constitutional AI"}'
);

-- Add candidates for World market (Olympics 2032)
SELECT public.create_candidate_binary_options(
    '294b5728-c418-4ed3-93a9-10b815010b8f',
    'Brisbane, Australia',
    'https://flagcdn.com/w80/au.png',
    'Oceania',
    '{"bid_status": "Preferred", "infrastructure": "good"}'
);

SELECT public.create_candidate_binary_options(
    '294b5728-c418-4ed3-93a9-10b815010b8f',
    'Qatar',
    'https://flagcdn.com/w80/qa.png',
    'Asia',
    '{"bid_status": "Interested", "resources": "unlimited"}'
);

SELECT public.create_candidate_binary_options(
    '294b5728-c418-4ed3-93a9-10b815010b8f',
    'India',
    'https://flagcdn.com/w80/in.png',
    'Asia',
    '{"bid_status": "Considering", "market_size": "huge"}'
);

SELECT public.create_candidate_binary_options(
    '294b5728-c418-4ed3-93a9-10b815010b8f',
    'Turkey',
    'https://flagcdn.com/w80/tr.png',
    'Europe/Asia',
    '{"bid_status": "Interested", "previous_bids": "multiple"}'
);