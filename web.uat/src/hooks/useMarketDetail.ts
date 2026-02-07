import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MarketOption {
  id: string;
  option_name: string;
  option_type: string;
  candidate_name?: string | null;
  current_price: number;
  total_shares: number;
  sort_order: number;
}

export interface MarketDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  volume: number;
  end_date: string;
  market_structure: string;
  image_url?: string;
  resolution_criteria?: string;
  important_notes?: string;
  options: MarketOption[];
  chartData: any[];
}

export const useMarketDetail = (marketId: string) => {
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarketDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch market details with category and subcategory information
        const { data: marketData, error: marketError } = await supabase
          .from('event_markets')
          .select(`
            *,
            market_categories(name),
            market_subcategories(name)
          `)
          .eq('id', marketId)
          .eq('is_active', true)
          .single();

        if (marketError) {
          throw new Error(`Market not found: ${marketError.message}`);
        }

        // Fetch market options
        const { data: optionsData, error: optionsError } = await supabase
          .from('market_options')
          .select('*')
          .eq('market_id', marketId)
          .eq('is_active', true)
          .order('sort_order');

        if (optionsError) {
          throw new Error(`Failed to fetch options: ${optionsError.message}`);
        }

        // Fetch price history for chart
        const { data: priceHistory, error: priceHistoryError } = await supabase
          .from('market_price_history')
          .select(`
            *,
            market_options!inner(
              option_name,
              option_type,
              candidate_name
            )
          `)
          .eq('market_id', marketId)
          .order('timestamp');

        if (priceHistoryError) {
          console.warn('Failed to fetch price history:', priceHistoryError);
        }

        // Transform price history into chart format
        const chartData = priceHistory ? transformPriceHistoryToChart(priceHistory, optionsData || []) : [];

        const transformedMarket: MarketDetail = {
          id: marketData.id,
          name: marketData.name,
          description: marketData.description || '',
          category: marketData.market_categories?.name || 'Unknown',
          subcategory: marketData.market_subcategories?.name,
          volume: Number(marketData.volume || 0),
          end_date: marketData.end_date,
          market_structure: marketData.market_structure || 'binary',
          image_url: marketData.image_url,
          resolution_criteria: marketData.resolution_criteria,
          important_notes: marketData.important_notes,
          options: optionsData || [],
          chartData: priceHistory || []
        };

        setMarket(transformedMarket);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (marketId) {
      fetchMarketDetail();
    }
  }, [marketId]);

  return { market, loading, error };
};

const transformPriceHistoryToChart = (priceHistory: any[], options: MarketOption[]) => {
  if (!priceHistory || priceHistory.length === 0) {
    return [];
  }

  // Group price history by timestamp
  const groupedByDate = priceHistory.reduce((acc, record) => {
    try {
      const date = new Date(record.timestamp).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {};
      }
      
      const option = options.find(opt => opt.id === record.option_id);
      if (option) {
        // For binary markets, use consistent key names
        if (option.option_type?.toLowerCase() === 'yes') {
          acc[date]['Yes'] = Number(record.price) * 100;
        } else if (option.option_type?.toLowerCase() === 'no') {
          acc[date]['No'] = Number(record.price) * 100;
        } else {
          // Fallback to option name for multi-choice markets
          acc[date][option.option_name] = Number(record.price) * 100;
        }
      }
    } catch (error) {
      console.warn('Error processing price history record:', record, error);
    }
    
    return acc;
  }, {});

  // Convert to array format expected by chart
  return Object.entries(groupedByDate).map(([date, prices]) => ({
    date,
    ...(prices as Record<string, number>)
  }));
};