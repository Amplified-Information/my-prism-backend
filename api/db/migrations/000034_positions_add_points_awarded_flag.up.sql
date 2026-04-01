-- add a timestamp column to track when points were awarded for a position
ALTER TABLE positions
ADD COLUMN points_awarded_at TIMESTAMPTZ DEFAULT NULL;
