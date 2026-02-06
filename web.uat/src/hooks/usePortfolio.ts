import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PortfolioHolding {
  id: string;
  marketName: string;
  position: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  endDate: string;
  change24h: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

export const usePortfolio = () => {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary>({
    totalValue: 0,
    totalCost: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    dayChange: 0,
    dayChangePercent: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: markets, error: marketError } = await supabase
          .from('event_markets')
          .select('id, name, yes_price, no_price, volume, end_date, change_24h')
          .eq('is_active', true)
          .order('volume', { ascending: false })
          .limit(8);

        if (marketError) throw marketError;

        // Generate mock portfolio holdings from markets
        const mockHoldings: PortfolioHolding[] = (markets || []).map((market, index) => {
          const position: 'YES' | 'NO' = Math.random() > 0.5 ? 'YES' : 'NO';
          const shares = Math.floor(Math.random() * 500) + 50;
          const avgPrice = Number(position === 'YES' ? 
            (Number(market.yes_price) - (Math.random() * 0.2 - 0.1)) : 
            (Number(market.no_price) - (Math.random() * 0.2 - 0.1))
          );
          const currentPrice = Number(position === 'YES' ? market.yes_price : market.no_price);
          const marketValue = shares * currentPrice;
          const cost = shares * avgPrice;
          const unrealizedPnL = marketValue - cost;
          const unrealizedPnLPercent = (unrealizedPnL / cost) * 100;

          return {
            id: market.id,
            marketName: market.name,
            position,
            shares,
            avgPrice: Math.max(0.01, Math.min(0.99, avgPrice)),
            currentPrice,
            marketValue,
            unrealizedPnL,
            unrealizedPnLPercent,
            endDate: market.end_date,
            change24h: Number(market.change_24h)
          };
        });

        setHoldings(mockHoldings);

        // Calculate portfolio summary
        const totalValue = mockHoldings.reduce((sum, holding) => sum + holding.marketValue, 0);
        const totalCost = mockHoldings.reduce((sum, holding) => sum + (holding.shares * holding.avgPrice), 0);
        const totalPnL = totalValue - totalCost;
        const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
        const dayChange = mockHoldings.reduce((sum, holding) => 
          sum + (holding.shares * holding.currentPrice * (holding.change24h / 100)), 0
        );
        const dayChangePercent = totalValue > 0 ? (dayChange / totalValue) * 100 : 0;

        setSummary({
          totalValue,
          totalCost,
          totalPnL,
          totalPnLPercent,
          dayChange,
          dayChangePercent
        });

      } catch (err) {
        console.error('Error fetching portfolio:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch portfolio');
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  return { holdings, summary, loading, error };
};