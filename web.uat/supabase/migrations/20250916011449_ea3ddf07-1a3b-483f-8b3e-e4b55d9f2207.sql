-- Generate 6 months of daily price history data for market 294b5728-c418-4ed3-93a9-10b815010b8f
WITH RECURSIVE date_series AS (
  SELECT 
    CURRENT_DATE - INTERVAL '180 days' as date_val,
    0 as day_num
  UNION ALL
  SELECT 
    date_val + INTERVAL '1 day',
    day_num + 1
  FROM date_series
  WHERE day_num < 179
),
market_options AS (
  SELECT id, option_name, option_type, current_price
  FROM market_options 
  WHERE market_id = '294b5728-c418-4ed3-93a9-10b815010b8f' 
  AND is_active = true
),
price_data AS (
  SELECT 
    mo.id as option_id,
    ds.date_val,
    ds.day_num,
    mo.option_name,
    mo.option_type,
    -- Generate realistic price movements with some volatility
    CASE 
      WHEN mo.option_name LIKE '%Brisbane%' THEN
        GREATEST(0.05, LEAST(0.95, 0.45 + 0.15 * SIN(ds.day_num * 0.1) + 0.05 * COS(ds.day_num * 0.3)))
      WHEN mo.option_name LIKE '%Mumbai%' OR mo.option_name LIKE '%India%' THEN  
        GREATEST(0.05, LEAST(0.95, 0.35 + 0.20 * SIN(ds.day_num * 0.08) + 0.08 * COS(ds.day_num * 0.5)))
      WHEN mo.option_name LIKE '%Istanbul%' OR mo.option_name LIKE '%Turkey%' THEN
        GREATEST(0.05, LEAST(0.95, 0.25 + 0.18 * SIN(ds.day_num * 0.12) + 0.06 * COS(ds.day_num * 0.4)))
      WHEN mo.option_name LIKE '%Jakarta%' THEN
        GREATEST(0.05, LEAST(0.95, 0.20 + 0.12 * SIN(ds.day_num * 0.15) + 0.04 * COS(ds.day_num * 0.6)))
      WHEN mo.option_name LIKE '%Qatar%' THEN
        GREATEST(0.05, LEAST(0.95, 0.15 + 0.10 * SIN(ds.day_num * 0.09) + 0.03 * COS(ds.day_num * 0.7)))
      ELSE 0.50
    END as base_price,
    -- Generate volume with some randomness
    (500 + (ds.day_num * 2) + (EXTRACT(DOW FROM ds.date_val) * 50))::numeric as volume
  FROM date_series ds
  CROSS JOIN market_options mo
),
final_prices AS (
  SELECT 
    option_id,
    date_val,
    option_name,
    option_type,
    -- Adjust NO prices to be complement of YES prices for same candidate
    CASE 
      WHEN option_type = 'no' THEN GREATEST(0.05, LEAST(0.95, 1.0 - base_price))
      ELSE base_price
    END as price,
    volume
  FROM price_data
)
INSERT INTO market_price_history (market_id, option_id, price, volume, timestamp, created_at)
SELECT 
  '294b5728-c418-4ed3-93a9-10b815010b8f'::uuid,
  fp.option_id,
  ROUND(fp.price, 4),
  fp.volume,
  fp.date_val + TIME '12:00:00',
  fp.date_val + TIME '12:00:00'
FROM final_prices fp
ORDER BY fp.date_val, fp.option_id;