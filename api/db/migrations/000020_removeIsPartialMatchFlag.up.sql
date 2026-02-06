-- remove is_partial_match flag from matches table
ALTER TABLE matches
DROP COLUMN is_partial;
