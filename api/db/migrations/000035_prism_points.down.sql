

-- Drop all triggers that depend on update_updated_at_column
DROP TRIGGER IF EXISTS update_prism_points_updated_at ON prism_points;

DROP TABLE IF EXISTS prism_points;
