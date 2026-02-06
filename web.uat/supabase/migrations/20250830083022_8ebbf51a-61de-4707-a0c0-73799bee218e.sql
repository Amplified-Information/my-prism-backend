-- Fix the search path issue for the function
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
SET search_path = public
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