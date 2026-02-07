-- Drop CLOB-related tables in correct order (respecting foreign key dependencies)

-- First drop tables with foreign key references
DROP TABLE IF EXISTS settlement_transactions CASCADE;
DROP TABLE IF EXISTS platform_fees CASCADE;
DROP TABLE IF EXISTS clob_trades CASCADE;
DROP TABLE IF EXISTS clob_positions CASCADE;
DROP TABLE IF EXISTS clob_orders CASCADE;
DROP TABLE IF EXISTS clob_batches CASCADE;
DROP TABLE IF EXISTS sequencer_state CASCADE;
DROP TABLE IF EXISTS order_queue CASCADE;