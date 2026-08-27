-- re-add points_awarded_at column to positions table
ALTER TABLE positions
ADD COLUMN points_awarded_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
