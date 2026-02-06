-- Add governance token configuration
INSERT INTO public.governance_settings (setting_key, setting_value, description)
VALUES 
  ('governance_token_id', '"0.0.6890168"', 'Hedera governance token ID'),
  ('voting_power_requirement', '1000', 'Minimum governance tokens required to create proposals'),
  ('proposal_quorum', '10000', 'Minimum voting power required for proposal quorum'),
  ('election_quorum', '15000', 'Minimum voting power required for election quorum')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  updated_at = now();