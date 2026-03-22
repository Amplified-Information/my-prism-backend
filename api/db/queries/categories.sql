-- CREATE

-- name: CreateCategory :one
INSERT INTO categories (name, is_active, description)
VALUES ($1, $2, $3)
RETURNING *;



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







-- UPDATE

-- name: UpdateCategory :one
UPDATE categories
SET name = $1,
    is_active = $2,
    description = $3
WHERE id = $4
RETURNING *;

-- name: DeleteCategoriesForMarket :exec
DELETE FROM market_categories WHERE market_id = $1;









-- DELETE

-- name: DeleteCategory :one
DELETE FROM categories
WHERE id = $1
RETURNING *;
