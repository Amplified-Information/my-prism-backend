-- remove the updated_at trigger and function and the updated_at column
DROP TRIGGER IF EXISTS update_global_data_updated_at ON global_data;
DROP FUNCTION IF EXISTS update_global_data_updated_at();
ALTER TABLE global_data
DROP COLUMN IF EXISTS updated_at;


-- drop global_data table
DROP TABLE IF EXISTS global_data;
