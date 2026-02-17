-- READ

-- name: GetTotalValueMatchedUsd :one
SELECT tv_matched FROM global_data;





-- UPDATE
-- name: IncrementTotalValueMatchedUsd :exec
UPDATE global_data
SET tv_matched = tv_matched + $1;
