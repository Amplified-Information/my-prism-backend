-- keep in sync with Prism.sol
-- event PositionTokensPurchased(uint128 marketId, address indexed buyer, uint256 collateralUsd, uint256 qtyScaled);
-- event MarketResolved(uint128 marketId, bool outcome);
-- event WinningsRedeemed(uint128 marketId, address indexed winner, uint256 amount);
-- event TokenAssociated(address indexed token);

CREATE TABLE IF NOT EXISTS event_position_tokens_purchased (
    id SERIAL PRIMARY KEY,
    net VARCHAR(20) NOT NULL CHECK (net IN ('previewnet', 'testnet', 'mainnet')),
    smart_contract_id VARCHAR(256) NOT NULL,
    timestamp_nano TIMESTAMP(9) NOT NULL,
    tx_hash VARCHAR(256) NOT NULL,
    hostname VARCHAR(256) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

     -- prevent duplicates!
    md5_uniq VARCHAR(32) NOT NULL UNIQUE,

    -- PositionTOkensPurchased(uint128 marketId, address indexed buyer, uint256 collateralUsd, uint256 qtyScaled)
    market_id INTEGER NOT NULL,
    buyer TEXT NOT NULL,
    collateral_usd DOUBLE PRECISION NOT NULL,
    qty_scaled DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS event_market_resolved (
    id SERIAL PRIMARY KEY,
    net VARCHAR(20) NOT NULL CHECK (net IN ('previewnet', 'testnet', 'mainnet')),
    smart_contract_id VARCHAR(256) NOT NULL,
    timestamp_nano TIMESTAMP(9) NOT NULL,
    tx_hash VARCHAR(256) NOT NULL,
    hostname VARCHAR(256) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

     -- prevent duplicates!
    md5_uniq VARCHAR(32) NOT NULL UNIQUE,

    -- MarketResolved(uint128 marketId, bool outcome)
    market_id INTEGER NOT NULL,
    outcome BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS event_winnings_redeemed (
    id SERIAL PRIMARY KEY,
    net VARCHAR(20) NOT NULL CHECK (net IN ('previewnet', 'testnet', 'mainnet')),
    smart_contract_id VARCHAR(256) NOT NULL,
    timestamp_nano TIMESTAMP(9) NOT NULL,
    tx_hash VARCHAR(256) NOT NULL,
    hostname VARCHAR(256) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- prevent duplicates!
    md5_uniq VARCHAR(32) NOT NULL UNIQUE,

    -- WinningsRedeemed(uint128 marketId, address indexed winner, uint256 amount)
    market_id INTEGER NOT NULL,
    winner TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL
);


CREATE TABLE IF NOT EXISTS event_token_associated (
    id SERIAL PRIMARY KEY,
    net VARCHAR(20) NOT NULL CHECK (net IN ('previewnet', 'testnet', 'mainnet')),
    smart_contract_id VARCHAR(256) NOT NULL,
    timestamp_nano TIMESTAMP(9) NOT NULL,
    tx_hash VARCHAR(256) NOT NULL,
    hostname VARCHAR(256) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- prevent duplicates!
    md5_uniq VARCHAR(32) NOT NULL UNIQUE,

    -- TokenAssociated(address indexed token)
    token TEXT NOT NULL
);
