import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/contexts/WalletContext';
import { apiClient } from '@/utils/apiClient';
import { useDebugger } from './useDebugger';
import { hederaConfig } from '@/config/hedera';

export const useUsdcBalance = () => {
  const { wallet } = useWallet();
  const debug = useDebugger('useUsdcBalance');
  
  const { id: usdcTokenId, decimals: USDC_DECIMALS } = hederaConfig.tokens.usdc;

  const { data: balance, isLoading, error, refetch } = useQuery({
    queryKey: ['usdc-balance', wallet.accountId, usdcTokenId],
    queryFn: async () => {
      if (!wallet.accountId) {
        debug.log('No account ID available');
        return null;
      }
      debug.log('Fetching USDC balance for account', wallet.accountId);
      try {
        const rawBalance = await apiClient.getHederaTokenBalance(wallet.accountId, usdcTokenId);
        const formattedBalance = rawBalance / Math.pow(10, USDC_DECIMALS);
        debug.log('USDC balance fetched successfully', { raw: rawBalance, formatted: formattedBalance });
        return formattedBalance;
      } catch (error) {
        debug.error('Failed to fetch USDC balance', error);
        return 0;
      }
    },
    enabled: !!wallet.accountId && wallet.isConnected,
    refetchInterval: 30000,
    retry: 1,
    retryDelay: 1000,
  });

  const formatUsdcBalance = (balance: number | null | undefined): string => {
    if (balance === null || balance === undefined) return '0.00 USDC';
    if (balance === 0) return '0.00 USDC';
    if (balance < 0.01) return `${balance.toFixed(6)} USDC`;
    return `${balance.toFixed(2)} USDC`;
  };

  return {
    balance,
    formattedBalance: formatUsdcBalance(balance),
    isLoading,
    error,
    refetch,
  };
};