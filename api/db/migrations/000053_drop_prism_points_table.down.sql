-- undo drop prism_points table
CREATE TABLE IF NOT EXISTS prism_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID NOT NULL,
    account_id UUID NOT NULL,
    distance FLOAT NOT NULL DEFAULT 0.0,
    dollar_value FLOAT NOT NULL DEFAULT 0.0,
    duration FLOAT NOT NULL DEFAULT 0.0,
    lom_score FLOAT NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
