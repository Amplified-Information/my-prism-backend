-- Enable RLS on all tables that don't have it enabled and create appropriate policies

-- Companies table
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to companies" 
ON public.companies 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Allow service role full access to companies" 
ON public.companies 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Current holdings table  
ALTER TABLE public.current_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to current_holdings" 
ON public.current_holdings 
FOR SELECT 
USING (true);

CREATE POLICY "Allow service role full access to current_holdings" 
ON public.current_holdings 
FOR ALL 
USING (true)
WITH CHECK (true);

-- NASDAQ stocks table
ALTER TABLE public.nasdaq_stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to nasdaq_stocks" 
ON public.nasdaq_stocks 
FOR SELECT 
USING (true);

CREATE POLICY "Allow service role full access to nasdaq_stocks" 
ON public.nasdaq_stocks 
FOR ALL 
USING (true)
WITH CHECK (true);

-- NASDAQ stock fundamentals table
ALTER TABLE public.nasdaq_stock_fundamentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to nasdaq_stock_fundamentals" 
ON public.nasdaq_stock_fundamentals 
FOR SELECT 
USING (true);

CREATE POLICY "Allow service role full access to nasdaq_stock_fundamentals" 
ON public.nasdaq_stock_fundamentals 
FOR ALL 
USING (true)
WITH CHECK (true);

-- NASDAQ stock quotes table
ALTER TABLE public.nasdaq_stock_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to nasdaq_stock_quotes" 
ON public.nasdaq_stock_quotes 
FOR SELECT 
USING (true);

CREATE POLICY "Allow service role full access to nasdaq_stock_quotes" 
ON public.nasdaq_stock_quotes 
FOR ALL 
USING (true)
WITH CHECK (true);

-- NASDAQ sync logs table
ALTER TABLE public.nasdaq_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to nasdaq_sync_logs" 
ON public.nasdaq_sync_logs 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Stock exchanges table
ALTER TABLE public.stock_exchanges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to stock_exchanges" 
ON public.stock_exchanges 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Allow service role full access to stock_exchanges" 
ON public.stock_exchanges 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Stock historical prices table
ALTER TABLE public.stock_historical_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to stock_historical_prices" 
ON public.stock_historical_prices 
FOR SELECT 
USING (true);

CREATE POLICY "Allow service role full access to stock_historical_prices" 
ON public.stock_historical_prices 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Stock picks table
ALTER TABLE public.stock_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to active stock_picks" 
ON public.stock_picks 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Allow service role full access to stock_picks" 
ON public.stock_picks 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Stock price history table
ALTER TABLE public.stock_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to stock_price_history" 
ON public.stock_price_history 
FOR SELECT 
USING (true);

CREATE POLICY "Allow service role full access to stock_price_history" 
ON public.stock_price_history 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Stock quote update logs table
ALTER TABLE public.stock_quote_update_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to stock_quote_update_logs" 
ON public.stock_quote_update_logs 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Stock quotes table
ALTER TABLE public.stock_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to stock_quotes" 
ON public.stock_quotes 
FOR SELECT 
USING (true);

CREATE POLICY "Allow service role full access to stock_quotes" 
ON public.stock_quotes 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Stock trades table
ALTER TABLE public.stock_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to stock_trades" 
ON public.stock_trades 
FOR SELECT 
USING (true);

CREATE POLICY "Allow service role full access to stock_trades" 
ON public.stock_trades 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Technical indicators table
ALTER TABLE public.technical_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to technical_indicators" 
ON public.technical_indicators 
FOR SELECT 
USING (true);

CREATE POLICY "Allow service role full access to technical_indicators" 
ON public.technical_indicators 
FOR ALL 
USING (true)
WITH CHECK (true);