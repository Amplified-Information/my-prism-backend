import { PrismPredictionIntentRequest } from './gen/api'
import { v7 as uuidv7 } from 'uuid'

const DEPTH = 25

// Helper: resolve mirror node base URL for a given network (case-insensitive).
const getMirrorNodeUrl = (network: string): string => {
  return `https://${network.toLowerCase()}.mirrornode.hedera.com`
}

const walletConnectProjectId = 'cbb03b18843023dab2fb6f85f9857823'
const walletMetaData = {
  name: 'Prism Market',
  description: 'A decentralized prediction market on Hedera',
  url: window.location.origin,
  icons: ['https://prism.market/logo.png']
}

const defaultPredictionIntentRequest = (net: string = 'testnet'): PrismPredictionIntentRequest => {
  return {
    txId: uuidv7(),
    net,
    marketId: '',
    accountId: '0.0.1',
    sig: '',
    publicKey: '',
    evmAddress: '0123456789012345678901234567890123456789',
    keyType: 0, // 1 = ed25519, 2 = ecdsa_secp256k1, 0 would be rejected
    chainId: 296n,
    verifyingContract: '',
    side: 0,
    action: 0,
    limitYesPrice: 500000n,
    qtyShares: 0n,
    collateralCap: 0n,
    deadline: 0n,
  }
}

// Countries where the app is not offered. Two-letter ISO codes, uppercase.
// Browser-side check only (advisory). Empty array disables the block.
const RESTRICTED_COUNTRIES: string[] = [
  'AF', 'DZ', 'AO', 'AU', 'BY', 'BE', 'BO', 'BG', 'BF', 'BI',
  'CA', 'CM', 'CF', 'CI', 'CU', 'CD', 'ET', 'FR', 'DE', 'HT',
  'HU', 'IR', 'IQ', 'IE', 'IT', 'JP', 'KE', 'LA', 'LB', 'LY',
  'ML', 'MC', 'MZ', 'MM', 'NA', 'NZ', 'NI', 'NE', 'KP', 'CN',
  'PL', 'PT', 'RU', 'SG', 'SO', 'SS', 'SD', 'CH', 'SY', 'TW',
  'TH', 'UA', 'AE', 'GB', 'US', 'VE', 'YE', 'ZW',
]

export {
  DEPTH,
  RESTRICTED_COUNTRIES,

  walletConnectProjectId,
  walletMetaData,

  defaultPredictionIntentRequest,
  getMirrorNodeUrl
}
