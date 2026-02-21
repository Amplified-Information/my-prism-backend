-- add an "outcome" column to the "markets" table - default NULL
ALTER TABLE markets
ADD COLUMN outcome BOOLEAN DEFAULT NULL;
