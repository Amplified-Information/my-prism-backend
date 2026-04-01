-- create a new table called "prism_points" to store the points awarded for each position
CREATE TABLE prism_points (
    id SERIAL PRIMARY KEY,
    market_id VARCHAR(255) NOT NULL,
    evm_address VARCHAR(255) NOT NULL,
    points_awarded DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (market_id, evm_address)
);

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function before any update
CREATE TRIGGER update_prism_points_updated_at
BEFORE UPDATE ON prism_points
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();