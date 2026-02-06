-- Populate price history data for all market options
-- This will create 30 days of price history with realistic price movements

DO $$
DECLARE
    option_record RECORD;
    base_date DATE;
    day_offset INTEGER;
    current_price_val NUMERIC;
    price_variation NUMERIC;
    volume_val NUMERIC;
BEGIN
    -- Set base date to 30 days ago
    base_date := CURRENT_DATE - INTERVAL '30 days';
    
    -- Loop through all active market options
    FOR option_record IN 
        SELECT mo.id, mo.market_id, mo.current_price, mo.option_type
        FROM market_options mo
        JOIN event_markets em ON mo.market_id = em.id
        WHERE mo.is_active = true AND em.is_active = true
    LOOP
        -- Generate 30 days of price history for each option
        FOR day_offset IN 0..29 LOOP
            -- Calculate price with some realistic variation
            -- Start at 0.5 and gradually move toward current price
            current_price_val := 0.5 + 
                (option_record.current_price - 0.5) * (day_offset::NUMERIC / 29.0) +
                (RANDOM() - 0.5) * 0.05; -- Add some random variation
            
            -- Ensure price stays between 0.01 and 0.99
            current_price_val := GREATEST(0.01, LEAST(0.99, current_price_val));
            
            -- Generate random volume between 100 and 10000
            volume_val := 100 + (RANDOM() * 9900);
            
            -- Insert price history record
            INSERT INTO market_price_history (
                market_id,
                option_id,
                price,
                volume,
                timestamp
            ) VALUES (
                option_record.market_id,
                option_record.id,
                current_price_val,
                volume_val,
                (base_date + day_offset * INTERVAL '1 day')::TIMESTAMP WITH TIME ZONE
            );
        END LOOP;
        
        -- Add final entry with exact current price for today
        INSERT INTO market_price_history (
            market_id,
            option_id,
            price,
            volume,
            timestamp
        ) VALUES (
            option_record.market_id,
            option_record.id,
            option_record.current_price,
            1000 + (RANDOM() * 5000), -- Random volume
            NOW()
        );
        
    END LOOP;
END $$;