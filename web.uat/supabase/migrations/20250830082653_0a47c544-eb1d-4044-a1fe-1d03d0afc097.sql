-- Add support for multi-choice markets
-- Extend market_type options
ALTER TABLE public.event_markets 
ADD COLUMN IF NOT EXISTS participants_count INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS market_structure VARCHAR(50) DEFAULT 'binary';

-- Update market_structure for existing binary markets
UPDATE public.event_markets 
SET market_structure = 'binary' 
WHERE market_structure IS NULL;

-- Extend market_options for candidate information
ALTER TABLE public.market_options 
ADD COLUMN IF NOT EXISTS candidate_name TEXT,
ADD COLUMN IF NOT EXISTS candidate_avatar TEXT,
ADD COLUMN IF NOT EXISTS candidate_party TEXT,
ADD COLUMN IF NOT EXISTS candidate_metadata JSONB DEFAULT '{}';

-- Update existing market options to have proper candidate names
UPDATE public.market_options 
SET candidate_name = option_name 
WHERE candidate_name IS NULL;

-- Create index for better performance on multi-choice queries
CREATE INDEX IF NOT EXISTS idx_event_markets_structure ON public.event_markets(market_structure);
CREATE INDEX IF NOT EXISTS idx_market_options_candidate ON public.market_options(candidate_name);

-- Function to create default binary options for multi-choice candidates
CREATE OR REPLACE FUNCTION public.create_candidate_binary_options(
    p_market_id UUID,
    p_candidate_name TEXT,
    p_candidate_avatar TEXT DEFAULT NULL,
    p_candidate_party TEXT DEFAULT NULL,
    p_candidate_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(yes_option_id UUID, no_option_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_yes_option_id UUID;
    v_no_option_id UUID;
    v_sort_order INTEGER;
BEGIN
    -- Get the next sort order
    SELECT COALESCE(MAX(sort_order), 0) + 1 
    INTO v_sort_order
    FROM public.market_options 
    WHERE market_id = p_market_id;
    
    -- Create YES option
    INSERT INTO public.market_options (
        market_id, 
        option_name, 
        option_type, 
        candidate_name,
        candidate_avatar,
        candidate_party,
        candidate_metadata,
        sort_order,
        current_price
    ) VALUES (
        p_market_id,
        p_candidate_name || ' - Yes',
        'yes',
        p_candidate_name,
        p_candidate_avatar,
        p_candidate_party,
        p_candidate_metadata,
        v_sort_order,
        0.5000
    ) RETURNING id INTO v_yes_option_id;
    
    -- Create NO option  
    INSERT INTO public.market_options (
        market_id,
        option_name,
        option_type,
        candidate_name,
        candidate_avatar,
        candidate_party,
        candidate_metadata,
        sort_order,
        current_price
    ) VALUES (
        p_market_id,
        p_candidate_name || ' - No', 
        'no',
        p_candidate_name,
        p_candidate_avatar,
        p_candidate_party,
        p_candidate_metadata,
        v_sort_order + 1,
        0.5000
    ) RETURNING id INTO v_no_option_id;
    
    RETURN QUERY SELECT v_yes_option_id, v_no_option_id;
END;
$$;