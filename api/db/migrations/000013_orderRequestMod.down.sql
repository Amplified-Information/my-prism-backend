DROP TRIGGER IF EXISTS update_order_requests_updated_at ON order_requests;

DROP FUNCTION IF EXISTS update_updated_at_column();

ALTER TABLE order_requests
  DROP COLUMN cancelled_at,
  DROP COLUMN updated_at;
