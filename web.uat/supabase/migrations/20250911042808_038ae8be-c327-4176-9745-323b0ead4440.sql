-- Insert test orders for Trump approval rating market (af539f2d-8a88-4f04-9ed8-b5604cb9591c)
-- These orders will test the matching engine with various scenarios

INSERT INTO public.order_queue (
  order_id, 
  market_id, 
  maker_account_id, 
  side, 
  price_ticks, 
  quantity, 
  max_collateral, 
  time_in_force, 
  nonce, 
  order_signature, 
  status, 
  priority_score
) VALUES 
-- BUY orders (bidding for YES shares)
('order_buy_001', 'af539f2d-8a88-4f04-9ed8-b5604cb9591c', '0.0.12345', 'BUY', 4500, 1000, 450000, 'GTC', 1704067200001, 'sig_buy_001', 'QUEUED', 1704067200001000),
('order_buy_002', 'af539f2d-8a88-4f04-9ed8-b5604cb9591c', '0.0.12346', 'BUY', 4800, 500, 240000, 'GTC', 1704067200002, 'sig_buy_002', 'QUEUED', 1704067200002000),
('order_buy_003', 'af539f2d-8a88-4f04-9ed8-b5604cb9591c', '0.0.12347', 'BUY', 5200, 750, 390000, 'GTC', 1704067200003, 'sig_buy_003', 'QUEUED', 1704067200003000),
('order_buy_004', 'af539f2d-8a88-4f04-9ed8-b5604cb9591c', '0.0.12348', 'BUY', 5500, 300, 165000, 'GTC', 1704067200004, 'sig_buy_004', 'QUEUED', 1704067200004000),

-- SELL orders (offering YES shares)  
('order_sell_001', 'af539f2d-8a88-4f04-9ed8-b5604cb9591c', '0.0.56789', 'SELL', 5000, 800, 400000, 'GTC', 1704067200005, 'sig_sell_001', 'QUEUED', 1704067200005000),
('order_sell_002', 'af539f2d-8a88-4f04-9ed8-b5604cb9591c', '0.0.56790', 'SELL', 5300, 600, 318000, 'GTC', 1704067200006, 'sig_sell_002', 'QUEUED', 1704067200006000),
('order_sell_003', 'af539f2d-8a88-4f04-9ed8-b5604cb9591c', '0.0.56791', 'SELL', 4700, 400, 188000, 'GTC', 1704067200007, 'sig_sell_007', 'QUEUED', 1704067200007000),
('order_sell_004', 'af539f2d-8a88-4f04-9ed8-b5604cb9591c', '0.0.56792', 'SELL', 5600, 200, 112000, 'GTC', 1704067200008, 'sig_sell_008', 'QUEUED', 1704067200008000),

-- More aggressive orders that should create matches
('order_buy_aggressive', 'af539f2d-8a88-4f04-9ed8-b5604cb9591c', '0.0.99001', 'BUY', 5400, 600, 324000, 'GTC', 1704067200009, 'sig_buy_agg', 'QUEUED', 1704067200009000),
('order_sell_aggressive', 'af539f2d-8a88-4f04-9ed8-b5604cb9591c', '0.0.99002', 'SELL', 4900, 500, 245000, 'GTC', 1704067200010, 'sig_sell_agg', 'QUEUED', 1704067200010000),

-- Large orders
('order_buy_large', 'af539f2d-8a88-4f04-9ed8-b5604cb9591c', '0.0.77777', 'BUY', 4600, 2000, 920000, 'GTC', 1704067200011, 'sig_buy_large', 'QUEUED', 1704067200011000),
('order_sell_large', 'af539f2d-8a88-4f04-9ed8-b5604cb9591c', '0.0.77778', 'SELL', 5400, 1500, 810000, 'GTC', 1704067200012, 'sig_sell_large', 'QUEUED', 1704067200012000);