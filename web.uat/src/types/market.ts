export interface MarketOption {
  id: string;
  market_id: string;
  option_name: string;
  option_type: string;
  candidate_name?: string | null;
  candidate_avatar?: string | null;
  candidate_party?: string | null;
  candidate_metadata?: any;
  current_price: number;
  total_shares: number;
  sort_order?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketDetail {
  id: string;
  name: string;
  description?: string;
  category_id: string;
  market_structure: string;
  participants_count?: number;
  yes_price: number;
  no_price: number;
  volume: number;
  liquidity: number;
  change_24h: number;
  end_date: string;
  is_active: boolean;
  resolution_status: 'open' | 'closed' | 'resolved' | 'cancelled';
  resolution_criteria?: string;
  important_notes?: string;
  options: MarketOption[];
  chart_data?: any[];
  chartData?: any[];
}

export interface MultiChoiceCandidate {
  id: string;
  name: string;
  avatar?: string;
  party?: string;
  metadata?: Record<string, any>;
  yesPrice: number;
  noPrice: number;
  yesOptionId: string;
  noOptionId: string;
  volume24h: number;
  change24h: number;
  totalShares: number;
}

export interface CandidateGroup {
  candidate: MultiChoiceCandidate;
  yesOption: MarketOption;
  noOption: MarketOption;
}