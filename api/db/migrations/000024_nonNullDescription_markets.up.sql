-- set description to empty string where it is currently null
UPDATE markets
SET description = ''
WHERE description IS NULL;

-- alter the description column to be non-nullable
ALTER TABLE markets
ALTER COLUMN description SET NOT NULL;
