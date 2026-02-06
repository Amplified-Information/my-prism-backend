-- CREATE

-- name: CreatePrice :exec
INSERT INTO price_history (market_id, tx_id, price, ts)
VALUES ($1, $2, $3, $4);


-- name: CreatePriceReturn :one
INSERT INTO price_history (market_id, tx_id, price, ts)
VALUES ($1, $2, $3, $4)
RETURNING market_id, tx_id, price, ts;








-- READ

-- name: GetPriceHistoryEfficient :many
-- params: market_id, from, to, limit, offset
SELECT price, ts
FROM price_history
WHERE market_id = $1 
  AND ts >= $2
  AND ts <  $3
ORDER BY ts ASC -- order by does not allow paramerized placeholders
LIMIT $4 OFFSET $5;


-- name: GetLatestPriceByMarket :one
SELECT market_id, price, ts
FROM price_history
WHERE market_id = $1
ORDER BY ts DESC
LIMIT 1;


-- name: GetPricesByMarketSince :many
-- convenience: fetch from a given time until now
SELECT market_id, price, ts
FROM price_history
WHERE market_id = $1
  AND ts >= $2
ORDER BY ts ASC;


-- name: GetPricesByMarketInRange :many
SELECT market_id, price, ts
FROM price_history
WHERE market_id = $1
  AND ts >= $2
  AND ts <  $3
ORDER BY ts ASC;


-- name: GetLatestPricesForMarkets :many
-- fetch the latest price for each of the given markets
WITH latest AS (
  SELECT DISTINCT ON (market_id) market_id, price, ts
  FROM price_history
  WHERE market_id = ANY($1)
  ORDER BY market_id, ts DESC
)
SELECT market_id, price, ts
FROM latest;


-- name: GetGlobalPricesSince :many
-- fetch all prices (all markets) since a given timestamp
SELECT market_id, price, ts
FROM price_history
WHERE ts >= $1
ORDER BY ts ASC;





-- DELETE

-- name: DeletePricesBefore :exec
-- Not usually required if you drop partitions, but useful if you store in a single table
DELETE FROM price_history
WHERE ts < $1;











-- name: GetAggregatedPriceHistory :many
-- params: market_id, limit, offset, zoom
-- Query to fetch the most recent aggregated price points based on the zoom level (minute, hour, etc.)
-- WITH aggregated AS (
--   SELECT
--     market_id,
--     DATE_TRUNC($4, ts) AS zoomed_interval, -- Aggregate by the specified zoom level (minute, hour, day, etc.)
--     AVG(price) AS avg_price -- Calculate the average price for the interval
--   FROM
--     price_history
--   WHERE
--     market_id = $1
--   GROUP BY
--     market_id, zoomed_interval
--   ORDER BY
--     zoomed_interval DESC -- Order by the most recent intervals first
-- )
-- SELECT
--   market_id,
--   zoomed_interval,
--   avg_price
-- FROM
--   aggregated
-- LIMIT $2 OFFSET $3::int; -- Apply pagination to the aggregated results
