-- Drop triggers for user_roles table
DROP TRIGGER IF EXISTS trigger_update_user_roles_updated_at ON user_roles;
-- Drop function for user_roles table
DROP FUNCTION IF EXISTS update_user_roles_updated_at_column();

-- Drop user_roles table
DROP TABLE IF EXISTS user_roles;

-- Drop triggers for users table
DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON users;
-- Drop function for users table
DROP FUNCTION IF EXISTS update_users_updated_at_column();

-- Drop users table
DROP TABLE IF EXISTS users;

DROP TRIGGER IF EXISTS trigger_update_updated_at ON roles;

DROP TABLE IF EXISTS roles;