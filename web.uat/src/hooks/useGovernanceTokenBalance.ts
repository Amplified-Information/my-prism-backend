import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/contexts/WalletContext';
import { supabase } from '@/integrations/supabase/client';
import { apiClient } from '@/utils/apiClient';

export const useGovernanceTokenBalance = () => {
  const { wallet } = useWallet();

  // Get governance token ID from settings
  const { data: governanceTokenId } = useQuery({
    queryKey: ['governance-token-id'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('governance_settings')
          .select('setting_value')
          .eq('setting_key', 'governance_token_id')
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching governance token ID:', error);
          return '0.0.6890168';
        }
        
        const tokenId = data?.setting_value ? String(data.setting_value) : '0.0.6890168';
        console.log('Governance token ID retrieved:', tokenId);
        return tokenId;
      } catch (error) {
        console.error('Error in governance token ID query:', error);
        return '0.0.6890168';
      }
    },
  });

  // Get real-time token balance from Hedera
  const { data: tokenBalance, isLoading, error, refetch } = useQuery({
    queryKey: ['governance-token-balance', wallet.accountId, governanceTokenId],
    queryFn: async () => {
      if (!wallet.accountId || !governanceTokenId) return 0;
      
      return await apiClient.getHederaTokenBalance(wallet.accountId, governanceTokenId);
    },
    enabled: wallet.isConnected && !!wallet.accountId && !!governanceTokenId,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 2,
    retryDelay: 1000,
  });

  // Calculate voting power (for now, 1:1 with token balance, but could include staking multipliers)
  const votingPower = tokenBalance || 0;

  return {
    tokenBalance,
    votingPower,
    isLoading,
    error,
    refetch,
  };
};