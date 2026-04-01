-- add a column to track when points were claimed
ALTER TABLE prism_points
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ DEFAULT NULL;
