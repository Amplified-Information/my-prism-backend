================================================================================
HEDERA NETWORK CONFIGURATION UTILITY
================================================================================

OVERVIEW
--------
This project uses a centralized Hedera network configuration utility located at:
  src/config/hedera.ts

All Hedera network settings (token IDs, URLs, chain IDs, UI labels) are fully
dynamic based on environment variables, enabling easy migration between testnet
and mainnet.


================================================================================
ENVIRONMENT VARIABLES
================================================================================

Required:
---------
VITE_HEDERA_NETWORK     Controls which network to use: "testnet" or "mainnet"

Optional (override defaults):
-----------------------------
VITE_RPC_URL            Override the JSON-RPC endpoint
VITE_MIRROR_NODE_URL    Override the Mirror Node API endpoint
VITE_CHAIN_ID           Override the chain ID (296 for testnet, 295 for mainnet)
VITE_PRSM_TOKEN_ID      Override the PRSM token ID
VITE_XPRSM_TOKEN_ID     Override the xPRSM token ID


================================================================================
DEFAULT CONFIGURATIONS
================================================================================

TESTNET (default):
------------------
  Network:        testnet
  Chain ID:       296
  RPC URL:        https://testnet.hashio.io/api
  Mirror Node:    https://testnet.mirrornode.hedera.com/api/v1
  Hashscan:       https://hashscan.io/testnet
  USDC Token:     0.0.429274
  PRSM Token:     0.0.6890168

MAINNET:
--------
  Network:        mainnet
  Chain ID:       295
  RPC URL:        https://mainnet.hashio.io/api
  Mirror Node:    https://mainnet.mirrornode.hedera.com/api/v1
  Hashscan:       https://hashscan.io/mainnet
  USDC Token:     0.0.456858
  PRSM Token:     (to be created)
  xPRSM Token:    (to be created)


================================================================================
USAGE EXAMPLES
================================================================================

1. Import the singleton config:
-------------------------------
   import { hederaConfig } from '@/config/hedera';

   // Access any property
   const mirrorUrl = hederaConfig.mirrorNodeUrl;
   const usdcTokenId = hederaConfig.tokens.usdc.id;
   const chainId = hederaConfig.chainId;

2. Use helper functions:
------------------------
   import { 
     isMainnet, 
     isTestnet, 
     getAccountHashscanUrl,
     getTransactionHashscanUrl,
     getTokenHashscanUrl 
   } from '@/config/hedera';

   // Check network
   if (isMainnet()) {
     console.log('Running on mainnet');
   }

   // Generate Hashscan URLs
   const accountUrl = getAccountHashscanUrl('0.0.12345');
   const txUrl = getTransactionHashscanUrl('0.0.12345@1234567890.123456789');
   const tokenUrl = getTokenHashscanUrl('0.0.429274');

3. Access full network config:
------------------------------
   import { getNetworkConfig, getCurrentNetwork } from '@/config/hedera';

   const network = getCurrentNetwork();  // 'testnet' or 'mainnet'
   const config = getNetworkConfig();    // Full NetworkConfig object


================================================================================
SWITCHING NETWORKS
================================================================================

To switch from TESTNET to MAINNET:

1. Update your .env file:
   VITE_HEDERA_NETWORK=mainnet

2. (Optional) Set mainnet-specific token IDs if needed:
   VITE_PRSM_TOKEN_ID=0.0.XXXXXX
   VITE_XPRSM_TOKEN_ID=0.0.XXXXXX

3. Restart the development server or rebuild for production.

Note: The utility automatically uses the correct URLs, chain IDs, and default
token IDs based on the VITE_HEDERA_NETWORK setting.


================================================================================
ADDING NEW TOKENS
================================================================================

To add a new token to the configuration:

1. Open src/config/hedera.ts

2. Add the token to the NetworkConfig interface:
   tokens: {
     usdc: { ... },
     prsm: { ... },
     xprsm: { ... },
     newToken: {          // Add this
       id: string;
       decimals: number;
       symbol: string;
     };
   };

3. Add default values in TESTNET_CONFIG and MAINNET_CONFIG:
   tokens: {
     ...
     newToken: {
       id: '0.0.XXXXXX',
       decimals: 8,
       symbol: 'NEW',
     },
   },

4. (Optional) Add environment variable override in getNetworkConfig():
   newToken: {
     ...baseConfig.tokens.newToken,
     id: import.meta.env.VITE_NEW_TOKEN_ID || baseConfig.tokens.newToken.id,
   },

5. Add the new variable to .env.example for documentation.


================================================================================
FILES USING THIS CONFIGURATION
================================================================================

The following files import and use the centralized config:

  - src/contexts/WalletContext.tsx      (wallet connection, ledger selection)
  - src/components/Wallet/WalletButton.tsx   (hashscan links, network display)
  - src/components/Wallet/NetworkStatus.tsx  (network status display)
  - src/hooks/useUsdcBalance.ts         (USDC balance fetching)
  - src/hooks/useNetworkStatus.ts       (network health checks)
  - src/utils/apiClient.ts              (API base URL)


================================================================================
CURRENT STATUS
================================================================================

Network:    Testnet
Status:     Active and configured
PRSM Token: 0.0.6890168 (testnet)


================================================================================
