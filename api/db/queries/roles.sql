-- CREATE

-- READ

-- name: IsUserAdmin :one
-- Check if a user is an admin by wallet_id and network
SELECT EXISTS (
  SELECT 1
  FROM users u
  JOIN user_roles ur ON u.id = ur.user_id
  JOIN roles r ON ur.role_id = r.id
  WHERE u.wallet_id = $1 AND u.network = $2 AND r.name = 'ADMIN'
) AS is_admin;




-- UPDATE

-- DELETE