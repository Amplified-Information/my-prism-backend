import { useQuery, useMutation } from '@tanstack/react-query';
import { useWallet } from '@/contexts/WalletContext';
import { OrderBook, CLOBOrder, CLOBPosition, CLOBMarketStats } from '@/types/clob';
import { toast } from 'sonner';

// Mock order book data for demonstration
// Prices in ticks (1 tick = $0.01)
// Active market range: 30-70 ticks ($0.30-$0.70)
const generateMockOrderBook = (marketId: string): OrderBook => ({
  marketId,
  lastUpdate: Date.now(),
  bids: [
    { price: 49, quantity: 1250, orderCount: 3 },
    { price: 48, quantity: 2100, orderCount: 5 },
    { price: 47, quantity: 850, orderCount: 2 },
    { price: 46, quantity: 1800, orderCount: 4 },
    { price: 45, quantity: 3200, orderCount: 8 },
    { price: 44, quantity: 1100, orderCount: 2 },
    { price: 43, quantity: 2500, orderCount: 6 },
    { price: 42, quantity: 950, orderCount: 1 },
    { price: 41, quantity: 1700, orderCount: 3 },
    { price: 40, quantity: 2800, orderCount: 7 },
  ],
  asks: [
    { price: 50, quantity: 900, orderCount: 2 },
    { price: 51, quantity: 1600, orderCount: 4 },
    { price: 52, quantity: 2200, orderCount: 6 },
    { price: 53, quantity: 800, orderCount: 1 },
    { price: 54, quantity: 1400, orderCount: 3 },
    { price: 55, quantity: 3100, orderCount: 9 },
    { price: 56, quantity: 1200, orderCount: 2 },
    { price: 57, quantity: 1900, orderCount: 4 },
    { price: 58, quantity: 2600, orderCount: 5 },
    { price: 59, quantity: 1050, orderCount: 2 },
  ],
});

export const useCLOBOrderBook = (marketId: string) => {
  const isDevelopment = import.meta.env.MODE === 'development';
  const isDocumentVisible = typeof document !== 'undefined' ? !document.hidden : true;
  
  const getRefetchInterval = () => {
    if (!isDocumentVisible) return false;
    return isDevelopment ? 5000 : 2000;
  };

  return useQuery({
    queryKey: ['clob-orderbook', marketId],
    queryFn: async () => generateMockOrderBook(marketId),
    enabled: !!marketId,
    refetchInterval: getRefetchInterval(),
    staleTime: 2000,
  });
};

export const useCLOBPositions = (accountId?: string, marketId?: string) => {
  const { wallet } = useWallet();
  const effectiveAccountId = accountId || wallet.accountId;

  return useQuery({
    queryKey: ['clob-positions', effectiveAccountId, marketId],
    queryFn: async (): Promise<CLOBPosition[]> => {
      // Return empty array - positions will come from API
      return [];
    },
    enabled: !!effectiveAccountId,
    staleTime: 5000,
  });
};

export const useCLOBOrderHistory = (accountId?: string, marketId?: string, limit = 50) => {
  const { wallet } = useWallet();
  const effectiveAccountId = accountId || wallet.accountId;

  return useQuery({
    queryKey: ['clob-order-history', effectiveAccountId, marketId, limit],
    queryFn: async (): Promise<CLOBOrder[]> => {
      // Return empty array - order history will come from API
      return [];
    },
    enabled: !!effectiveAccountId,
    staleTime: 10000,
  });
};

export const useCLOBTradeHistory = (accountId?: string, marketId?: string, limit = 50) => {
  const { wallet } = useWallet();
  const effectiveAccountId = accountId || wallet.accountId;

  return useQuery({
    queryKey: ['clob-trade-history', effectiveAccountId, marketId, limit],
    queryFn: async () => {
      // Return empty array - trade history will come from API
      return [];
    },
    enabled: !!effectiveAccountId,
    staleTime: 10000,
  });
};

export const useCLOBMarketStats = (marketId: string) => {
  return useQuery({
    queryKey: ['clob-market-stats', marketId],
    queryFn: async (): Promise<CLOBMarketStats> => ({
      volume24h: 125000,
      tradeCount24h: 342,
      lastPrice: 50,
    }),
    enabled: !!marketId,
    staleTime: 30000,
  });
};

export const useSubmitCLOBOrder = () => {
  return useMutation({
    mutationFn: async () => {
      toast.info('CLOB Trading Coming Soon', {
        description: 'Order submission will be available when the trading API is integrated.',
      });
      throw new Error('Coming soon');
    },
  });
};

export const useCancelCLOBOrder = () => {
  return useMutation({
    mutationFn: async () => {
      toast.info('CLOB Trading Coming Soon', {
        description: 'Order cancellation will be available when the trading API is integrated.',
      });
      throw new Error('Coming soon');
    },
  });
};
