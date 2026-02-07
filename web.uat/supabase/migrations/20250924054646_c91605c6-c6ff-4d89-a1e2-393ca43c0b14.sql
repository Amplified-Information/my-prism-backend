-- Function to recalculate vote counts for market proposals
CREATE OR REPLACE FUNCTION public.recalculate_proposal_vote_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    proposal_record RECORD;
    proposal_votes_data RECORD;
    election_votes_data RECORD;
BEGIN
    -- Iterate through all proposals
    FOR proposal_record IN 
        SELECT id FROM public.market_proposals
    LOOP
        -- Calculate proposal phase votes
        SELECT 
            COALESCE(SUM(CASE WHEN vote_choice = 'yes' THEN 1 ELSE 0 END), 0) as votes_for,
            COALESCE(SUM(CASE WHEN vote_choice = 'no' THEN 1 ELSE 0 END), 0) as votes_against,
            COALESCE(SUM(CASE WHEN vote_choice = 'abstain' THEN 1 ELSE 0 END), 0) as votes_abstain,
            COALESCE(SUM(CASE WHEN vote_choice = 'yes' THEN voting_power ELSE 0 END), 0) as voting_power_for,
            COALESCE(SUM(CASE WHEN vote_choice = 'no' THEN voting_power ELSE 0 END), 0) as voting_power_against,
            COALESCE(SUM(CASE WHEN vote_choice = 'abstain' THEN voting_power ELSE 0 END), 0) as voting_power_abstain
        INTO proposal_votes_data
        FROM public.proposal_votes 
        WHERE proposal_id = proposal_record.id AND is_proposal_phase = true;
        
        -- Calculate election phase votes
        SELECT 
            COALESCE(SUM(CASE WHEN vote_choice = 'yes' THEN 1 ELSE 0 END), 0) as votes_for,
            COALESCE(SUM(CASE WHEN vote_choice = 'no' THEN 1 ELSE 0 END), 0) as votes_against,
            COALESCE(SUM(CASE WHEN vote_choice = 'abstain' THEN 1 ELSE 0 END), 0) as votes_abstain,
            COALESCE(SUM(CASE WHEN vote_choice = 'yes' THEN voting_power ELSE 0 END), 0) as voting_power_for,
            COALESCE(SUM(CASE WHEN vote_choice = 'no' THEN voting_power ELSE 0 END), 0) as voting_power_against,
            COALESCE(SUM(CASE WHEN vote_choice = 'abstain' THEN voting_power ELSE 0 END), 0) as voting_power_abstain
        INTO election_votes_data
        FROM public.proposal_votes 
        WHERE proposal_id = proposal_record.id AND is_proposal_phase = false;
        
        -- Update the proposal with calculated vote counts
        UPDATE public.market_proposals 
        SET 
            proposal_votes_for = proposal_votes_data.votes_for,
            proposal_votes_against = proposal_votes_data.votes_against,
            proposal_votes_abstain = proposal_votes_data.votes_abstain,
            proposal_voting_power_for = proposal_votes_data.voting_power_for,
            proposal_voting_power_against = proposal_votes_data.voting_power_against,
            proposal_voting_power_abstain = proposal_votes_data.voting_power_abstain,
            election_votes_for = election_votes_data.votes_for,
            election_votes_against = election_votes_data.votes_against,
            election_votes_abstain = election_votes_data.votes_abstain,
            election_voting_power_for = election_votes_data.voting_power_for,
            election_voting_power_against = election_votes_data.voting_power_against,
            election_voting_power_abstain = election_votes_data.voting_power_abstain,
            updated_at = now()
        WHERE id = proposal_record.id;
    END LOOP;
END;
$function$;

-- Run the function to fix existing data
SELECT public.recalculate_proposal_vote_counts();