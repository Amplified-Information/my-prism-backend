/**
 * Hedera Network Configuration
 * 
 * Centralized configuration for all Hedera network settings.
 * All values are derived from environment variables to support easy migration
 * between testnet and mainnet.
 */

export type HederaNetwork = 'testnet' | 'mainnet';

interface NetworkConfig {
  network: HederaNetwork;
  chainId: number;
  rpcUrl: string;
  mirrorNodeUrl: string;
  hashscanUrl: string;
  displayName: string;
  tokens: {
    usdc: {
      id: string;
      decimals: number;
      symbol: string;
    };
    prsm: {
      id: string;
      decimals: number;
      symbol: string;
    };
    xprsm: {
      id: string;
      decimals: number;
      symbol: string;
    };
  };
}

const TESTNET_CONFIG: NetworkConfig = {
  network: 'testnet',
  chainId: 296,
  rpcUrl: 'https://testnet.hashio.io/api',
  mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com/api/v1',
  hashscanUrl: 'https://hashscan.io/testnet',
  displayName: 'Hedera Testnet',
  tokens: {
    usdc: {
      id: '0.0.429274',
      decimals: 6,
      symbol: 'USDC',
    },
    prsm: {
      id: '0.0.6890168', // Testnet PRSM token
      decimals: 8,
      symbol: 'PRSM',
    },
    xprsm: {
      id: '', // To be created
      decimals: 8,
      symbol: 'xPRSM',
    },
  },
};

const MAINNET_CONFIG: NetworkConfig = {
  network: 'mainnet',
  chainId: 295,
  rpcUrl: 'https://mainnet.hashio.io/api',
  mirrorNodeUrl: 'https://mainnet.mirrornode.hedera.com/api/v1',
  hashscanUrl: 'https://hashscan.io/mainnet',
  displayName: 'Hedera Mainnet',
  tokens: {
    usdc: {
      id: '0.0.456858',
      decimals: 6,
      symbol: 'USDC',
    },
    prsm: {
      id: '', // To be created on mainnet
      decimals: 8,
      symbol: 'PRSM',
    },
    xprsm: {
      id: '', // To be created on mainnet
      decimals: 8,
      symbol: 'xPRSM',
    },
  },
};

/**
 * Get the current network from environment variables
 */
export const getCurrentNetwork = (): HederaNetwork => {
  const network = import.meta.env.VITE_HEDERA_NETWORK;
  return network === 'mainnet' ? 'mainnet' : 'testnet';
};

/**
 * Get the full network configuration for the current environment
 */
export const getNetworkConfig = (): NetworkConfig => {
  const network = getCurrentNetwork();
  const baseConfig = network === 'mainnet' ? MAINNET_CONFIG : TESTNET_CONFIG;
  
  // Allow environment variables to override defaults
  return {
    ...baseConfig,
    chainId: import.meta.env.VITE_CHAIN_ID 
      ? parseInt(import.meta.env.VITE_CHAIN_ID, 10) 
      : baseConfig.chainId,
    rpcUrl: import.meta.env.VITE_RPC_URL || baseConfig.rpcUrl,
    mirrorNodeUrl: import.meta.env.VITE_MIRROR_NODE_URL || baseConfig.mirrorNodeUrl,
    tokens: {
      ...baseConfig.tokens,
      prsm: {
        ...baseConfig.tokens.prsm,
        id: import.meta.env.VITE_PRSM_TOKEN_ID || baseConfig.tokens.prsm.id,
      },
      xprsm: {
        ...baseConfig.tokens.xprsm,
        id: import.meta.env.VITE_XPRSM_TOKEN_ID || baseConfig.tokens.xprsm.id,
      },
    },
  };
};

/**
 * Check if currently on mainnet
 */
export const isMainnet = (): boolean => getCurrentNetwork() === 'mainnet';

/**
 * Check if currently on testnet
 */
export const isTestnet = (): boolean => getCurrentNetwork() === 'testnet';

/**
 * Get the hashscan URL for an account
 */
export const getAccountHashscanUrl = (accountId: string): string => {
  const config = getNetworkConfig();
  return `${config.hashscanUrl}/account/${accountId}`;
};

/**
 * Get the hashscan URL for a transaction
 */
export const getTransactionHashscanUrl = (transactionId: string): string => {
  const config = getNetworkConfig();
  return `${config.hashscanUrl}/transaction/${transactionId}`;
};

/**
 * Get the hashscan URL for a token
 */
export const getTokenHashscanUrl = (tokenId: string): string => {
  const config = getNetworkConfig();
  return `${config.hashscanUrl}/token/${tokenId}`;
};

// Export a singleton config for easy access
export const hederaConfig = getNetworkConfig();
