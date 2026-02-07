-- Update current_price in market_options to match the latest price from price history
-- and remove any duplicate price history records

-- First, remove duplicate price history records
DELETE FROM market_price_history 
WHERE id IN (
    SELECT id FROM (
        SELECT id, 
               ROW_NUMBER() OVER (
                   PARTITION BY market_id, option_id, timestamp::date 
                   ORDER BY timestamp DESC
               ) as rn
        FROM market_price_history
    ) t WHERE rn > 1
);

-- Update current prices in market_options to match latest price history
UPDATE market_options 
SET current_price = latest_prices.latest_price,
    updated_at = NOW()
FROM (
    SELECT 
        mph.option_id,
        mph.price as latest_price
    FROM market_price_history mph
    INNER JOIN (
        SELECT 
            option_id,
            MAX(timestamp) as max_timestamp
        FROM market_price_history
        GROUP BY option_id
    ) latest ON mph.option_id = latest.option_id 
               AND mph.timestamp = latest.max_timestamp
) latest_prices
WHERE market_options.id = latest_prices.option_id;