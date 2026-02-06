-- READ

-- name: GetCategories :many
SELECT *
FROM categories
ORDER BY sort_order, name;

-- name: GetActiveCategories :many
SELECT *
FROM categories
WHERE is_active = TRUE
ORDER BY sort_order, name;
