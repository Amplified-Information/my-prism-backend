import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MarketStats {
  activeMarkets: number;
  totalVolume: string;
  totalTraders: string;
  volume24h: string;
}

export const useMarketStats = () => {
  const [stats, setStats] = useState<MarketStats>({
    activeMarkets: 0,
    totalVolume: "$0",
    totalTraders: "0",
    volume24h: "$0"
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarketStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get count of active markets
        const { count: activeMarketsCount, error: countError } = await supabase
          .from('event_markets')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        if (countError) throw countError;

        // Get total volume and calculate other stats
        const { data: volumeData, error: volumeError } = await supabase
          .from('event_markets')
          .select('volume')
          .eq('is_active', true);

        if (volumeError) throw volumeError;

        // Calculate total volume
        const totalVolumeSum = volumeData?.reduce((sum, market) => sum + (Number(market.volume) || 0), 0) || 0;
        
        // Format volume numbers with full numbers and commas
        const formatVolume = (value: number) => {
          return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
        };

        // Format 24h volume with commas
        const format24hVolume = (value: number) => {
          return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
        };

        // For now, use calculated values for total volume and estimates for traders and 24h volume
        // In a real app, you'd have separate tables/calculations for these
        const estimatedTraders = Math.floor(totalVolumeSum / 200); // Rough estimate based on volume
        const estimated24hVolume = totalVolumeSum * 0.065; // Rough estimate as 6.5% of total volume

        setStats({
          activeMarkets: activeMarketsCount || 0,
          totalVolume: formatVolume(totalVolumeSum),
          totalTraders: formatVolume(estimatedTraders).replace('$', ''),
          volume24h: format24hVolume(estimated24hVolume)
        });
      } catch (err) {
        console.error('Error fetching market stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch market stats');
        // Set fallback values on error
        setStats({
          activeMarkets: 0,
          totalVolume: "$0",
          totalTraders: "0",
          volume24h: "$0"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMarketStats();
  }, []);

  return { stats, loading, error };
};