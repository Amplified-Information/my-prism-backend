-- modify markets table to add optional params
-- add alias_yes and alias_no columns for optional YES/NO alternative strings
-- add hex_color_yes and hex_color_no columns for optional YES/NO color codes in hex format (e.g. #RRGGBB)
-- apply regex constraint to hex_color_yes and hex_color_no columns to ensure valid hex color codes "^#[A-Fa-f0-9]{6}$"
ALTER TABLE markets
ADD COLUMN alias_yes varchar(255) DEFAULT NULL,
ADD COLUMN alias_no varchar(255) DEFAULT NULL,
ADD COLUMN hex_color_yes varchar(7) DEFAULT NULL CHECK (hex_color_yes ~ '^#[A-Fa-f0-9]{6}$' OR hex_color_yes IS NULL),
ADD COLUMN hex_color_no varchar(7) DEFAULT NULL CHECK (hex_color_no ~ '^#[A-Fa-f0-9]{6}$' OR hex_color_no IS NULL);
