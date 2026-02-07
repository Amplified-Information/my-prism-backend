-- Update current prices for market options with more realistic varied prices
-- This will give each option a unique price that reflects market dynamics

UPDATE market_options 
SET current_price = CASE 
    -- For binary markets, ensure yes/no prices complement each other
    WHEN option_type = 'yes' THEN 
        GREATEST(0.05, LEAST(0.95, 
            0.3 + (RANDOM() * 0.4) + 
            CASE 
                WHEN candidate_name ILIKE '%trump%' THEN 0.15
                WHEN candidate_name ILIKE '%biden%' THEN 0.05
                WHEN candidate_name ILIKE '%lakers%' THEN 0.20
                WHEN candidate_name ILIKE '%warriors%' THEN 0.15
                WHEN candidate_name ILIKE '%openai%' THEN 0.25
                WHEN candidate_name ILIKE '%google%' THEN 0.20
                WHEN candidate_name ILIKE '%apple%' THEN 0.10
                WHEN candidate_name ILIKE '%tesla%' THEN 0.15
                ELSE 0
            END
        ))
    ELSE 
        -- For 'no' options, use complement of corresponding 'yes' option
        GREATEST(0.05, LEAST(0.95, 
            0.7 - (RANDOM() * 0.4) - 
            CASE 
                WHEN candidate_name ILIKE '%trump%' THEN 0.15
                WHEN candidate_name ILIKE '%biden%' THEN 0.05
                WHEN candidate_name ILIKE '%lakers%' THEN 0.20
                WHEN candidate_name ILIKE '%warriors%' THEN 0.15
                WHEN candidate_name ILIKE '%openai%' THEN 0.25
                WHEN candidate_name ILIKE '%google%' THEN 0.20
                WHEN candidate_name ILIKE '%apple%' THEN 0.10
                WHEN candidate_name ILIKE '%tesla%' THEN 0.15
                ELSE 0
            END
        ))
END,
updated_at = NOW()
WHERE is_active = true;