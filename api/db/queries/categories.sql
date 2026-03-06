-- READ

-- name: GetCategories :many
SELECT *
FROM categories
ORDER BY sort_order, name;

-- name: GetCategoriesForMarket :many
SELECT c.*
FROM categories c
JOIN market_categories mc ON c.id = mc.category_id
WHERE mc.market_id = $1
ORDER BY c.sort_order, c.name;

-- name: GetActiveCategories :many
SELECT *
FROM categories
WHERE is_active = TRUE
ORDER BY sort_order, name;

-- name: GetActiveCategoriesForMarket :many
SELECT c.*
FROM categories c
JOIN market_categories mc ON c.id = mc.category_id
WHERE mc.market_id = $1
AND c.is_active = TRUE
ORDER BY c.sort_order, c.name;
