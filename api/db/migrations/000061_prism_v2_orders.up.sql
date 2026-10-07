-- PrismV2 cutover: the API and CLOB accept only V2 integer authorizations.

-- Persist the domain fields exactly as signed, plus the cumulative on-chain fill state.
ALTER TABLE prediction_intents
    ADD COLUMN chain_id BIGINT,
    ADD COLUMN verifying_contract TEXT,
    ADD COLUMN shares_filled NUMERIC(78,0) NOT NULL DEFAULT 0,
    ADD COLUMN collateral_filled NUMERIC(78,0) NOT NULL DEFAULT 0;

ALTER TABLE prediction_intents
    ALTER COLUMN protocol_version SET DEFAULT 2,
    ADD CONSTRAINT prediction_intents_chain_id_check CHECK (chain_id > 0),
    ADD CONSTRAINT prediction_intents_verifying_contract_check CHECK (verifying_contract ~ '^[0-9a-f]{40}$'),
    ADD CONSTRAINT prediction_intents_shares_filled_check CHECK (shares_filled >= 0 AND (qty_shares IS NULL OR shares_filled <= qty_shares)),
    ADD CONSTRAINT prediction_intents_collateral_filled_check CHECK (collateral_filled >= 0),
    -- NOT VALID: enforced for new rows. Rows from a previous up/down cycle lost these columns.
    ADD CONSTRAINT prediction_intents_v2_domain_check CHECK (
        protocol_version = 1 OR (chain_id IS NOT NULL AND verifying_contract IS NOT NULL)
    ) NOT VALID;

-- V1 orders can never settle against PrismV2. Close any that are still open so they
-- are not restored to the CLOB or shown as live orders.
UPDATE prediction_intents
SET evicted_at = NOW(), updated_at = CURRENT_TIMESTAMP
WHERE protocol_version = 1
  AND cancelled_at IS NULL AND fully_matched_at IS NULL AND evicted_at IS NULL;

-- Integer settlement detail for each fill. tx_id1 is the bid, tx_id2 the ask.
ALTER TABLE matches
    ADD COLUMN protocol_version SMALLINT NOT NULL DEFAULT 1,
    ADD COLUMN fill_shares NUMERIC(78,0),
    ADD COLUMN execution_yes_price BIGINT,
    ADD COLUMN yes_collateral NUMERIC(78,0),
    ADD COLUMN no_collateral NUMERIC(78,0);

ALTER TABLE matches
    ADD CONSTRAINT matches_protocol_version_check CHECK (protocol_version IN (1, 2)),
    ADD CONSTRAINT matches_v2_fields_check CHECK (
        protocol_version = 1 OR (
            match_id IS NOT NULL AND fill_shares > 0
            AND execution_yes_price > 0 AND execution_yes_price < 1000000
            AND yes_collateral > 0 AND no_collateral > 0
            AND yes_collateral + no_collateral = fill_shares
        )
    );

-- PrismV2 contract events, stored as delivered by blocknode. md5uniq makes redelivery idempotent.
CREATE TABLE smart_contract_events_v2 (
    id BIGSERIAL PRIMARY KEY,
    net TEXT NOT NULL,
    contract_id TEXT NOT NULL,
    event TEXT NOT NULL,
    args JSONB NOT NULL,
    tx_hash TEXT NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL,
    host TEXT,
    md5uniq TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX smart_contract_events_v2_event_idx ON smart_contract_events_v2 (net, contract_id, event, event_timestamp);
