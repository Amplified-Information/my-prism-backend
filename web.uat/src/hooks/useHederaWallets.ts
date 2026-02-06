import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebugger } from './useDebugger';
import { toast } from '@/hooks/use-toast';

// Type definitions for hedera wallets
export interface HederaWallet {
  id: string;
  user_id: string | null;
  account_id: string;
  public_key: string | null;
  is_primary: boolean;
  wallet_name: string | null;
  persona_name: string | null;
  persona_color: string | null;
  last_connected_at: string;
  created_at: string;
  updated_at: string;
}

export interface SaveWalletParams {
  accountId: string;
  publicKey: string | null;
  walletName?: string;
  isPrimary?: boolean;
}

// Hook to get wallet by account ID (wallet-based identity)
export const useWalletByAccountId = (accountId: string | null) => {
  const debug = useDebugger('useWalletByAccountId');

  return useQuery({
    queryKey: ['hedera-wallet', accountId],
    queryFn: async (): Promise<HederaWallet | null> => {
      if (!accountId) {
        return null;
      }

      debug.log('Fetching wallet by account ID', accountId);

      const { data, error } = await supabase
        .from('hedera_wallets')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();

      if (error) {
        debug.error('Failed to fetch wallet', error);
        throw error;
      }

      debug.log('Fetched wallet successfully', data);
      return data;
    },
    enabled: !!accountId,
    retry: 2,
    retryDelay: 1000,
  });
};

// Hook to get all wallets (no auth required - wallet is the identity)
export const useHederaWallets = (accountId: string | null) => {
  const debug = useDebugger('useHederaWallets');

  return useQuery({
    queryKey: ['hedera-wallets', accountId],
    queryFn: async (): Promise<HederaWallet[]> => {
      if (!accountId) {
        debug.log('No account ID provided, returning empty array');
        return [];
      }

      debug.log('Fetching wallets for account', accountId);

      const { data, error } = await supabase
        .from('hedera_wallets')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (error) {
        debug.error('Failed to fetch wallets', error);
        throw error;
      }

      debug.log('Fetched wallets successfully', data);
      return data || [];
    },
    enabled: !!accountId,
    retry: 2,
    retryDelay: 1000,
  });
};

// Hook to get primary wallet (simplified - no auth dependency)
export const usePrimaryWallet = () => {
  const debug = useDebugger('usePrimaryWallet');

  return useQuery({
    queryKey: ['primary-wallet'],
    queryFn: async (): Promise<HederaWallet | null> => {
      debug.log('Fetching primary wallet');
      
      // This hook is now only used for session restoration
      // In wallet-based identity, we don't have a "primary" concept per user
      // Instead, we restore from WalletConnect session
      return null;
    },
    enabled: false, // Disabled by default - session restoration handled by WalletConnect
    retry: 2,
    retryDelay: 1000,
  });
};

// Hook to save wallet to database (no auth required)
export const useSaveWallet = () => {
  const queryClient = useQueryClient();
  const debug = useDebugger('useSaveWallet');

  return useMutation({
    mutationFn: async ({ accountId, publicKey, walletName, isPrimary = false }: SaveWalletParams): Promise<HederaWallet> => {
      debug.log('Saving wallet', { accountId, walletName, isPrimary });

      // Check if wallet already exists
      const { data: existingWallet } = await supabase
        .from('hedera_wallets')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();

      let walletData: HederaWallet;

      if (existingWallet) {
        // Update existing wallet
        debug.log('Updating existing wallet', existingWallet.id);
        const { data, error } = await supabase
          .from('hedera_wallets')
          .update({
            public_key: publicKey,
            wallet_name: walletName || existingWallet.wallet_name,
            last_connected_at: new Date().toISOString(),
          })
          .eq('id', existingWallet.id)
          .select()
          .single();

        if (error) throw error;
        walletData = data;
      } else {
        // Create new wallet
        debug.log('Creating new wallet');
        const { data, error } = await supabase
          .from('hedera_wallets')
          .insert({
            account_id: accountId,
            public_key: publicKey,
            wallet_name: walletName || `Wallet ${accountId}`,
            is_primary: true,
            last_connected_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        walletData = data;
      }

      debug.log('Wallet saved successfully', walletData);
      return walletData;
    },
    onSuccess: (data) => {
      // Invalidate and refetch wallet queries
      queryClient.invalidateQueries({ queryKey: ['hedera-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['hedera-wallet', data.account_id] });
      
      debug.log('Wallet cache invalidated');
    },
    onError: (error: any) => {
      debug.error('Failed to save wallet', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save wallet.",
        variant: "destructive",
      });
    },
  });
};
