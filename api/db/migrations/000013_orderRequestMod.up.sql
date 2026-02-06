
ALTER TABLE order_requests
ADD COLUMN cancelled_at TIMESTAMP DEFAULT NULL;

ALTER TABLE order_requests
ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at = CURRENT_TIMESTAMP;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to use the function
CREATE TRIGGER update_order_requests_updated_at
BEFORE UPDATE ON order_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
