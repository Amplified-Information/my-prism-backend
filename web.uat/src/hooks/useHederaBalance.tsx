import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/contexts/WalletContext';
import { apiClient } from '@/utils/apiClient';
import { useDebugger } from './useDebugger';

export const useHederaBalance = () => {
  const { wallet } = useWallet();
  const debug = useDebugger('useHederaBalance');

  const { data: balance, isLoading, error, refetch } = useQuery({
    queryKey: ['hedera-balance', wallet.accountId],
    queryFn: async () => {
      if (!wallet.accountId) {
        debug.log('No account ID available');
        return null;
      }
      debug.log('Fetching balance for account', wallet.accountId);
      try {
        const result = await apiClient.getHederaAccountBalance(wallet.accountId);
        debug.log('Balance fetched successfully', result);
        return result;
      } catch (error) {
        debug.error('Failed to fetch balance', error);
        throw error;
      }
    },
    enabled: !!wallet.accountId && wallet.isConnected,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 2,
    retryDelay: 1000,
  });

  return {
    balance,
    isLoading,
    error,
    refetch,
  };
};

export const useHederaAccountInfo = () => {
  const { wallet } = useWallet();
  const debug = useDebugger('useHederaAccountInfo');

  const { data: accountInfo, isLoading, error } = useQuery({
    queryKey: ['hedera-account-info', wallet.accountId],
    queryFn: async () => {
      if (!wallet.accountId) {
        debug.log('No account ID available');
        return null;
      }
      debug.log('Fetching account info for', wallet.accountId);
      try {
        const result = await apiClient.getHederaAccountInfo(wallet.accountId);
        debug.log('Account info fetched successfully', result);
        return result;
      } catch (error) {
        debug.error('Failed to fetch account info', error);
        throw error;
      }
    },
    enabled: !!wallet.accountId && wallet.isConnected,
    retry: 2,
    retryDelay: 1000,
  });

  return {
    accountInfo,
    isLoading,
    error,
  };
};