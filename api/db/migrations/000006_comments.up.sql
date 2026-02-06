CREATE TABLE IF NOT EXISTS comments (
  comment_id SERIAL PRIMARY KEY, -- Auto-incrementing integer for the comment ID
  market_id UUID NOT NULL, -- UUID for the market ID
  account_id VARCHAR(255) NOT NULL, -- accountId
  sig VARCHAR(2048) NOT NULL, -- Digital signature for the comment
  public_key VARCHAR(2048) NOT NULL, -- Public key of the commenter
  key_type INTEGER NOT NULL, -- Key type of the public key
  content TEXT NOT NULL, -- Content of the comment
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), -- Timestamp for when the comment was created
  CONSTRAINT fk_market FOREIGN KEY (market_id) REFERENCES markets(market_id) ON DELETE CASCADE
);

-- Index for faster lookups by market_id
CREATE INDEX idx_comments_market_id ON comments (market_id);

-- Index for faster lookups by account_id
CREATE INDEX idx_comments_account_id ON comments (account_id);
