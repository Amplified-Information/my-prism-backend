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
options_data AS (
  SELECT id, option_name, option_type, current_price
  FROM market_options 
  WHERE market_id = '294b5728-c418-4ed3-93a9-10b815010b8f' 
  AND is_active = true
),
price_movements AS (
  SELECT 
    od.id as option_id,
    ds.date_val,
    ds.day_num,
    od.option_name,
    od.option_type,
    -- Generate realistic price movements with volatility
    CASE 
      WHEN od.option_name LIKE '%Brisbane%' THEN
        GREATEST(0.05, LEAST(0.95, 0.45 + 0.15 * SIN(ds.day_num * 0.1) + 0.05 * COS(ds.day_num * 0.3)))
      WHEN od.option_name LIKE '%Mumbai%' OR od.option_name LIKE '%India%' THEN  
        GREATEST(0.05, LEAST(0.95, 0.35 + 0.20 * SIN(ds.day_num * 0.08) + 0.08 * COS(ds.day_num * 0.5)))
      WHEN od.option_name LIKE '%Istanbul%' OR od.option_name LIKE '%Turkey%' THEN
        GREATEST(0.05, LEAST(0.95, 0.25 + 0.18 * SIN(ds.day_num * 0.12) + 0.06 * COS(ds.day_num * 0.4)))
      WHEN od.option_name LIKE '%Jakarta%' THEN
        GREATEST(0.05, LEAST(0.95, 0.20 + 0.12 * SIN(ds.day_num * 0.15) + 0.04 * COS(ds.day_num * 0.6)))
      WHEN od.option_name LIKE '%Qatar%' THEN
        GREATEST(0.05, LEAST(0.95, 0.15 + 0.10 * SIN(ds.day_num * 0.09) + 0.03 * COS(ds.day_num * 0.7)))
      ELSE 0.50
    END as base_price,
    -- Generate volume with some variation
    (500 + (ds.day_num * 2) + (EXTRACT(DOW FROM ds.date_val) * 50))::numeric as volume
  FROM date_series ds
  CROSS JOIN options_data od
),
final_data AS (
  SELECT 
    option_id,
    date_val,
    option_name,
    option_type,
    -- Adjust NO prices to complement YES prices for same candidate
    CASE 
      WHEN option_type = 'no' THEN GREATEST(0.05, LEAST(0.95, 1.0 - base_price))
      ELSE base_price
    END as price,
    volume
  FROM price_movements
)
INSERT INTO market_price_history (market_id, option_id, price, volume, timestamp, created_at)
SELECT 
  '294b5728-c418-4ed3-93a9-10b815010b8f'::uuid,
  fd.option_id,
  ROUND(fd.price, 4),
  fd.volume,
  fd.date_val + TIME '12:00:00',
  fd.date_val + TIME '12:00:00'
FROM final_data fd
ORDER BY fd.date_val, fd.option_id;