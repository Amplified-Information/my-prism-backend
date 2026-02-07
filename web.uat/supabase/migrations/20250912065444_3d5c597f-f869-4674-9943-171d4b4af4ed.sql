-- Clean up binary market options to remove candidate data
UPDATE market_options 
SET candidate_name = null, 
    candidate_avatar = null, 
    candidate_party = null,
    candidate_metadata = '{}'::jsonb
FROM event_markets em 
WHERE market_options.market_id = em.id 
AND em.market_structure = 'binary';