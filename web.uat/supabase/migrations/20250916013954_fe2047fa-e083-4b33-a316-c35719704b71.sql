-- Update market_options current_price with latest values from market_price_history
-- for market 294b5728-c418-4ed3-93a9-10b815010b8f

UPDATE market_options 
SET current_price = latest_prices.latest_price,
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (mph.option_id) 
    mph.option_id,
    mph.price as latest_price
  FROM market_price_history mph
  WHERE mph.market_id = '294b5728-c418-4ed3-93a9-10b815010b8f'
  ORDER BY mph.option_id, mph.timestamp DESC
) as latest_prices
WHERE market_options.id = latest_prices.option_id
AND market_options.market_id = '294b5728-c418-4ed3-93a9-10b815010b8f';