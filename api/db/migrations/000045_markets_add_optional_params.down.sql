-- modify markets table to remove the optional params
-- remove alias_yes and alias_no columns for optional YES/NO alternative strings
-- remove hex_color_yes and hex_color_no columns for optional YES/NO color codes in hex format (e.g. #RRGGBB)
ALTER TABLE markets
DROP COLUMN alias_yes,
DROP COLUMN alias_no,
DROP COLUMN hex_color_yes,
DROP COLUMN hex_color_no;