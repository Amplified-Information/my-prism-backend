-- add a column called hcsTxId to matches to store the Hedera HCS message ID
ALTER TABLE matches 
ADD COLUMN hcs_tx_id varchar(256) DEFAULT NULL;
