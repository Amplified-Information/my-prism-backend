-- remove claimed_at column from prism_points
ALTER TABLE prism_points
DROP COLUMN IF EXISTS claimed_at;
