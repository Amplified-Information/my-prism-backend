CREATE TABLE IF NOT EXISTS global_data (
	id SERIAL PRIMARY KEY,
	tv_matched DOUBLE PRECISION NOT NULL DEFAULT 0.0
);

INSERT INTO global_data (id, tv_matched) VALUES (1, 0.0);

-- tv_matched must be > 0
ALTER TABLE global_data
		ADD CONSTRAINT tv_matched_non_negative CHECK (tv_matched >= 0);


-- updated_at column to track when the global_data was last updated
ALTER TABLE global_data
ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- trigger to update the updated_at column on every update
CREATE OR REPLACE FUNCTION update_global_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	 NEW.updated_at = NOW();
	 RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_global_data_updated_at
BEFORE UPDATE ON global_data
FOR EACH ROW
EXECUTE FUNCTION update_global_data_updated_at();