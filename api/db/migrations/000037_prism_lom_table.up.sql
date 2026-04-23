-- create a table called prism_lob to store the limit order mining (LOM) calculations for each user's (accountId) unmatched order (prediction_intents.tx_id) for a particular market (marketId):
CREATE TABLE IF NOT EXISTS prism_lom (
    id SERIAL PRIMARY KEY,
    market_id UUID NOT NULL,
    account_id VARCHAR(255) NOT NULL CHECK (account_id ~ '^\d+\.\d+\.\d+$'),
    prediction_intent_tx_id UUID NOT NULL,
    total_lom_score FLOAT NOT NULL,
    cron_ran_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hedera_tx_hash VARCHAR(255) NOT NULL,
    UNIQUE (account_id, market_id, prediction_intent_tx_id)
);
