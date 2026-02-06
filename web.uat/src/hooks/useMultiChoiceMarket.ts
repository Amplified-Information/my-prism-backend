import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MarketDetail, MarketOption, MultiChoiceCandidate, CandidateGroup } from '@/types/market';

export const useMultiChoiceMarket = (marketId: string) => {
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch market details
        const { data: marketData, error: marketError } = await supabase
          .from('event_markets')
          .select('*')
          .eq('id', marketId)
          .eq('is_active', true)
          .single();

        if (marketError) throw marketError;

        // Fetch market options
        const { data: optionsData, error: optionsError } = await supabase
          .from('market_options')
          .select('*')
          .eq('market_id', marketId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (optionsError) throw optionsError;

        // Fetch price history for charts
        const { data: priceHistory, error: priceError } = await supabase
          .from('market_price_history')
          .select('*')
          .eq('market_id', marketId)
          .order('timestamp', { ascending: true })
          .limit(100);

        if (priceError) throw priceError;

        const transformedMarket: MarketDetail = {
          ...marketData,
          options: optionsData || [],
          chartData: priceHistory || [],
        };

        setMarket(transformedMarket);
      } catch (err) {
        console.error('Error fetching market data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch market data');
      } finally {
        setLoading(false);
      }
    };

    if (marketId) {
      fetchMarketData();
    }
  }, [marketId]);

  // Transform options into candidate groups for multi-choice markets
  const candidateGroups = useMemo((): CandidateGroup[] => {
    if (!market || !market.options || market.market_structure !== 'multi-choice') {
      return [];
    }

    const candidateMap = new Map<string, { yes?: MarketOption; no?: MarketOption }>();

    // Group options by candidate name
    market.options.forEach(option => {
      const candidateName = option.candidate_name || option.option_name;
      if (!candidateMap.has(candidateName)) {
        candidateMap.set(candidateName, {});
      }
      
      const group = candidateMap.get(candidateName)!;
      if (option.option_type === 'yes') {
        group.yes = option;
      } else {
        group.no = option;
      }
    });

    // Convert to candidate groups
    return Array.from(candidateMap.entries())
      .filter(([_, group]) => group.yes && group.no)
      .map(([candidateName, group]) => {
        const yesOption = group.yes!;
        const noOption = group.no!;
        
        const candidate: MultiChoiceCandidate = {
          id: yesOption.candidate_name || candidateName,
          name: candidateName,
          avatar: yesOption.candidate_avatar,
          party: yesOption.candidate_party,
          metadata: yesOption.candidate_metadata,
          yesPrice: yesOption.current_price,
          noPrice: noOption.current_price,
          yesOptionId: yesOption.id,
          noOptionId: noOption.id,
          volume24h: 0, // TODO: Calculate from price history
          change24h: 0, // TODO: Calculate from price history  
          totalShares: yesOption.total_shares + noOption.total_shares,
        };

        return {
          candidate,
          yesOption,
          noOption,
        };
      })
      .sort((a, b) => b.candidate.yesPrice - a.candidate.yesPrice); // Sort by Yes price descending
  }, [market]);

  // Get traditional binary candidates (for backwards compatibility)
  const binaryCandidates = useMemo(() => {
    if (!market) return [];
    
    return candidateGroups.map(group => ({
      id: group.candidate.id,
      name: group.candidate.name,
      party: group.candidate.party || '',
      percentage: Math.round(group.candidate.yesPrice * 100),
      yesPrice: Math.round(group.candidate.yesPrice * 100),
      noPrice: Math.round(group.candidate.noPrice * 100),
      change24h: group.candidate.change24h,
      avatar: group.candidate.avatar || '/placeholder.svg',
    }));
  }, [candidateGroups, market]);

  const isMultiChoice = market?.market_structure === 'multi-choice';
  const isBinary = market?.market_structure === 'binary';

  return {
    market,
    candidateGroups,
    binaryCandidates,
    isMultiChoice,
    isBinary,
    loading,
    error,
  };
};