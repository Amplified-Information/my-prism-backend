-- don't allow category ids that don't exist to be attached to markets
ALTER TABLE market_categories
ADD CONSTRAINT fk_category
FOREIGN KEY (category_id)
REFERENCES categories(id)
ON DELETE CASCADE;
