-- Mainnet settlement safety: fixed-point authorizations, a transactional order
-- outbox, and a durable/idempotent match lifecycle.

ALTER TABLE prediction_intents
    -- Existing records and the legacy API are v1. V2 writers must opt in and
    -- provide the complete integer authorization tuple below.
    ADD COLUMN protocol_version SMALLINT NOT NULL DEFAULT 1,
    ADD COLUMN side SMALLINT,
    ADD COLUMN action SMALLINT,
    ADD COLUMN limit_yes_price BIGINT,
    ADD COLUMN qty_shares NUMERIC(78,0),
    ADD COLUMN collateral_cap NUMERIC(78,0),
    ADD COLUMN deadline BIGINT;

ALTER TABLE prediction_intents
	ADD CONSTRAINT prediction_intents_protocol_version_check CHECK (protocol_version IN (1, 2)),
    ADD CONSTRAINT prediction_intents_side_check CHECK (side IN (0, 1)),
    ADD CONSTRAINT prediction_intents_action_check CHECK (action IN (0, 1)),
    ADD CONSTRAINT prediction_intents_limit_yes_price_check CHECK (limit_yes_price BETWEEN 0 AND 1000000),
    ADD CONSTRAINT prediction_intents_qty_shares_check CHECK (qty_shares > 0),
    ADD CONSTRAINT prediction_intents_collateral_cap_check CHECK (collateral_cap >= 0),
    ADD CONSTRAINT prediction_intents_deadline_check CHECK (deadline > 0),
	ADD CONSTRAINT prediction_intents_v2_fields_check CHECK (
		protocol_version = 1 OR (
			side IS NOT NULL AND action IS NOT NULL AND limit_yes_price IS NOT NULL
			AND qty_shares IS NOT NULL AND collateral_cap IS NOT NULL AND deadline IS NOT NULL
		)
	);

CREATE TABLE order_outbox (
    id BIGSERIAL PRIMARY KEY,
    tx_id UUID NOT NULL REFERENCES prediction_intents(tx_id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    payload JSONB NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tx_id, subject)
);

CREATE INDEX order_outbox_pending_idx
    ON order_outbox (next_attempt_at, id)
    WHERE delivered_at IS NULL;

ALTER TABLE matches
    ADD COLUMN match_id TEXT,
    ADD COLUMN status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN last_error TEXT,
    ADD COLUMN submitted_at TIMESTAMPTZ,
    ADD COLUMN finalized_at TIMESTAMPTZ;

UPDATE matches
SET match_id = encode(sha256((id::text || ':' || market_id::text || ':' || LEAST(tx_id1::text, tx_id2::text) || ':' || GREATEST(tx_id1::text, tx_id2::text) || ':' || qty1::text)::bytea), 'hex'),
    status = CASE WHEN tx_hash IS NOT NULL AND tx_hash <> '' AND tx_hash <> 'notYetAvailable' THEN 'finalized' ELSE 'pending' END,
    finalized_at = CASE WHEN tx_hash IS NOT NULL AND tx_hash <> '' AND tx_hash <> 'notYetAvailable' THEN created_at AT TIME ZONE 'UTC' ELSE NULL END;

ALTER TABLE matches
    ADD CONSTRAINT matches_status_check CHECK (status IN ('pending', 'submitted', 'finalized', 'failed')),
    ADD CONSTRAINT matches_attempts_check CHECK (attempts >= 0),
    ADD CONSTRAINT matches_match_id_unique UNIQUE (match_id);

CREATE INDEX matches_reconciliation_idx
    ON matches (status, created_at)
    WHERE status IN ('pending', 'submitted', 'failed');
