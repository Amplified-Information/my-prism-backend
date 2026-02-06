-- Create enum for resolution status
CREATE TYPE public.resolution_status AS ENUM ('open', 'closed', 'resolved', 'cancelled');

-- Create event_markets table
CREATE TABLE public.event_markets (
    -- Core Identification
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Category Relationships
    category_id UUID NOT NULL REFERENCES public.market_categories(id) ON DELETE RESTRICT,
    subcategory_id UUID REFERENCES public.market_subcategories(id) ON DELETE RESTRICT,
    
    -- Status Indicators
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_trending BOOLEAN NOT NULL DEFAULT FALSE,
    is_new BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Market Mechanics
    yes_price NUMERIC(10,4) NOT NULL DEFAULT 0.5000,
    no_price NUMERIC(10,4) NOT NULL DEFAULT 0.5000,
    volume NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    liquidity NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_shares BIGINT NOT NULL DEFAULT 0,
    change_24h NUMERIC(8,4) NOT NULL DEFAULT 0.0000,
    
    -- Time Management
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    resolution_date TIMESTAMP WITH TIME ZONE,
    
    -- Resolution System
    resolution_status resolution_status NOT NULL DEFAULT 'open',
    resolved_value BOOLEAN,
    resolution_notes TEXT,
    
    -- Market Configuration
    market_type VARCHAR(50) NOT NULL DEFAULT 'binary',
    minimum_bet NUMERIC(10,2) NOT NULL DEFAULT 1.00,
    maximum_bet NUMERIC(10,2),
    
    -- Display & Ordering
    sort_order INTEGER NOT NULL DEFAULT 999,
    featured_order INTEGER,
    
    -- User Association (for future use)
    created_by UUID,
    
    -- Constraints
    CONSTRAINT valid_prices CHECK (yes_price >= 0 AND yes_price <= 1 AND no_price >= 0 AND no_price <= 1),
    CONSTRAINT valid_volume CHECK (volume >= 0),
    CONSTRAINT valid_liquidity CHECK (liquidity >= 0),
    CONSTRAINT valid_minimum_bet CHECK (minimum_bet > 0),
    CONSTRAINT valid_maximum_bet CHECK (maximum_bet IS NULL OR maximum_bet >= minimum_bet),
    CONSTRAINT valid_end_date CHECK (end_date > created_at),
    CONSTRAINT valid_resolution_date CHECK (resolution_date IS NULL OR resolution_date >= end_date)
);

-- Create indexes for performance
CREATE INDEX idx_event_markets_category_id ON public.event_markets(category_id);
CREATE INDEX idx_event_markets_subcategory_id ON public.event_markets(subcategory_id);
CREATE INDEX idx_event_markets_is_featured ON public.event_markets(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_event_markets_is_trending ON public.event_markets(is_trending) WHERE is_trending = TRUE;
CREATE INDEX idx_event_markets_is_new ON public.event_markets(is_new) WHERE is_new = TRUE;
CREATE INDEX idx_event_markets_is_active ON public.event_markets(is_active);
CREATE INDEX idx_event_markets_end_date ON public.event_markets(end_date);
CREATE INDEX idx_event_markets_resolution_status ON public.event_markets(resolution_status);
CREATE INDEX idx_event_markets_created_at ON public.event_markets(created_at DESC);
CREATE INDEX idx_event_markets_volume ON public.event_markets(volume DESC);
CREATE INDEX idx_event_markets_featured_order ON public.event_markets(featured_order) WHERE featured_order IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.event_markets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access
CREATE POLICY "Allow public read access to active event_markets" 
ON public.event_markets 
FOR SELECT 
USING (is_active = TRUE);

CREATE POLICY "Allow service role full access to event_markets" 
ON public.event_markets 
FOR ALL 
USING (TRUE)
WITH CHECK (TRUE);

-- Create trigger for automatic updated_at timestamp
CREATE TRIGGER update_event_markets_updated_at
    BEFORE UPDATE ON public.event_markets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add validation trigger for subcategory belonging to category
CREATE OR REPLACE FUNCTION public.validate_subcategory_belongs_to_category()
RETURNS TRIGGER AS $$
BEGIN
    -- If subcategory_id is provided, ensure it belongs to the specified category
    IF NEW.subcategory_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 
            FROM public.market_subcategories 
            WHERE id = NEW.subcategory_id 
            AND category_id = NEW.category_id
        ) THEN
            RAISE EXCEPTION 'Subcategory must belong to the specified category';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_event_markets_subcategory
    BEFORE INSERT OR UPDATE ON public.event_markets
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_subcategory_belongs_to_category();