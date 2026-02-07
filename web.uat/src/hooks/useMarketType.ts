import { useMemo } from 'react';
import type { MarketDetail } from "./useMarketDetail";

export type MarketType = 'BINARY' | 'MULTI_CHOICE' | 'TRADITIONAL';

export const useMarketType = (market: MarketDetail | null) => {
  const marketType = useMemo((): MarketType => {
    if (!market || !market.options) return 'TRADITIONAL';

    // Check if it's explicitly marked as multi-choice
    if (market.market_structure === 'multi-choice') {
      return 'MULTI_CHOICE';
    }

    // Check if it's explicitly marked as binary
    if (market.market_structure === 'binary') {
      return 'BINARY';
    }

    // Determine based on options structure
    if (market.options.length === 2 && 
        market.options.every(opt => ['yes', 'no'].includes(opt.option_type?.toLowerCase() || ''))) {
      return 'BINARY';
    }

    // Check if it has candidate-based structure (multiple yes/no pairs)
    const candidateNames = new Set(market.options.map(opt => opt.candidate_name).filter(Boolean));
    const hasYesNoStructure = market.options.some(opt => ['yes', 'no'].includes(opt.option_type?.toLowerCase() || ''));
    
    if (candidateNames.size > 1 && hasYesNoStructure) {
      return 'MULTI_CHOICE';
    }

    return 'TRADITIONAL';
  }, [market]);

  const isBinary = marketType === 'BINARY';
  const isMultiChoice = marketType === 'MULTI_CHOICE';
  const isTraditional = marketType === 'TRADITIONAL';

  return {
    marketType,
    isBinary,
    isMultiChoice,
    isTraditional
  };
};