export type GovernanceStatus = 'draft' | 'proposal' | 'voting' | 'election' | 'approved' | 'rejected' | 'deployed';

export type ProposalType = 'market_creation' | 'market_amendment' | 'liquidity_incentive' | 'governance_parameter';

export type VoteChoice = 'yes' | 'no' | 'abstain';

export type OracleType = 'chainlink' | 'supra' | 'api_endpoint' | 'manual';

export interface UserTokenBalance {
  id: string;
  user_id: string;
  token_balance: number;
  staked_balance: number;
  total_voting_power: number;
  last_updated: string;
  created_at: string;
}

export interface StakingPosition {
  id: string;
  user_id: string;
  staked_amount: number;
  stake_duration: number;
  voting_power_multiplier: number;
  stake_start_date: string;
  stake_end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketProposal {
  id: string;
  proposer_id: string;
  proposal_type: ProposalType;
  title: string;
  description: string;
  market_title?: string;
  market_description?: string;
  market_outcomes?: {
    yes: string;
    no: string;
  };
  image_url?: string;
  resolution_date?: string;
  oracle_type?: OracleType;
  oracle_config?: Record<string, any>;
  initial_liquidity?: number;
  collateral_type: string;
  governance_status: GovernanceStatus;
  voting_start_date?: string;
  voting_end_date?: string;
  election_start_date?: string;
  election_end_date?: string;
  proposal_votes_for: number;
  proposal_votes_against: number;
  proposal_votes_abstain: number;
  proposal_voting_power_for: number;
  proposal_voting_power_against: number;
  proposal_voting_power_abstain: number;
  election_votes_for: number;
  election_votes_against: number;
  election_votes_abstain: number;
  election_voting_power_for: number;
  election_voting_power_against: number;
  election_voting_power_abstain: number;
  hcs_topic_id?: string;
  hcs_message_id?: string;
  deployment_tx_hash?: string;
  deployed_market_id?: string;
  failure_reason?: string;
  cooldown_until?: string;
  created_at: string;
  updated_at: string;
}

export interface ProposalVote {
  id: string;
  proposal_id: string;
  voter_id: string;
  vote_choice: VoteChoice;
  voting_power: number;
  is_proposal_phase: boolean;
  wallet_signature: string;
  hcs_message_id?: string;
  created_at: string;
}

export interface VotingPowerSnapshot {
  id: string;
  user_id: string;
  proposal_id?: string;
  snapshot_date: string;
  token_balance: number;
  staked_balance: number;
  total_voting_power: number;
  created_at: string;
}

export interface MarketDeploymentQueue {
  id: string;
  proposal_id: string;
  priority: number;
  deployment_status: string;
  smart_contract_address?: string;
  yes_token_id?: string;
  no_token_id?: string;
  deployment_error?: string;
  deployment_attempts: number;
  max_attempts: number;
  scheduled_for?: string;
  deployed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface GovernanceSettings {
  id: string;
  setting_key: string;
  setting_value: any;
  description?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProposalData {
  title: string;
  description: string;
  market_title: string;
  market_description: string;
  market_outcomes: {
    yes: string;
    no: string;
  };
  proposal_end_date: string;
  resolution_date: string;
  oracle_type: OracleType;
  oracle_config: Record<string, any>;
  initial_liquidity: number;
  collateral_type: string;
  marketImage?: File;
}