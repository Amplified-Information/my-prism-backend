-- add a non-NULL market_id column to matches:
ALTER TABLE matches
ADD COLUMN market_id UUID;

UPDATE matches
SET market_id = (SELECT market_id FROM order_requests WHERE tx_id = matches.tx_id1) -- note: tx_id1 and tx_id2 should belong to the same market
WHERE market_id IS NULL;

ALTER TABLE matches
ALTER COLUMN market_id SET NOT NULL;









-- Add columns "qty1_remaining" and "qty2_remaining" - when regenerating the clob, want to keep track of the quantity remaining on the tx1 side and the tx2 side
ALTER TABLE matches
ADD COLUMN qty1 DOUBLE PRECISION NOT NULL; -- qty1_remaining is not the same as qtyOrig

ALTER TABLE matches
ADD COLUMN qty2 DOUBLE PRECISION NOT NULL; -- qty2_remaining is notthe same as qtyOrig

-- ALTER TABLE matches
-- ADD COLUMN qty DOUBLE PRECISION NOT NULL; -- the amount matched in this match


-- Add column "tx_hash" to "matches" to store the hash of the match transaction - will be deleting the "settlements" table completely
-- fill up "tx_hash" with existing rows from the settlements table
ALTER TABLE matches
ADD COLUMN tx_hash VARCHAR(256) NOT NULL;


-- UPDATE matches
-- SET tx_hash = (SELECT tx_hash FROM settlements WHERE (tx_id1 = matches.tx_id1 AND tx_id2 = matches.tx_id2 OR tx_id1 = matches.tx_id2 AND tx_id2 = matches.tx_id1))
-- WHERE tx_hash IS NULL;


-- also, add a "regenerated_at" column to "order_requests"
ALTER TABLE order_requests
ADD COLUMN regenerated_at TIMESTAMPTZ DEFAULT NULL;

-- finally, drop the settlements table
DROP TABLE IF EXISTS settlements;

