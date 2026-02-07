// import { LedgerId } from '@hashgraph/sdk'
import { PredictionIntentRequest } from './gen/api'
import { v7 as uuidv7 } from 'uuid'

// const priceUsdStepSize = 0.0001
// const midPriceUsdDefault = 0.5

const walletConnectProjectId = 'ebcd4c5afffdc20de7e4f30a8a9b1344'
const walletMetaData = {
  name: 'Hedera-Prediction',
  description: 'Hedera dAppConnector Example',
  // url: 'http://localhost:5173', // origin must match your domain & subdomain
  url: window.location.origin,
  icons: ['https://avatars.githubusercontent.com/u/31002956']
}

const defaultPredictionIntentRequest = (): PredictionIntentRequest => {
  return {
    txId: uuidv7(),
    net: 'testnet',
    marketId: '019a7e77-39e2-72a3-9bea-a63bdfa79d20',
    generatedAt: new Date().toISOString(),
    accountId: '0.0.1',
    marketLimit: 'limit',
    priceUsd: 0.5,
    qty: 2.00,
    sig: '',
    publicKey: '',
    evmAddress: '0123456789012345678901234567890123456789',
    keyType: 0 // 1 = ed25519, 2 = ecdsa_secp256k1, 0 would be rejected
  }
}

export { 
  // priceUsdStepSize,

  walletConnectProjectId,
  walletMetaData,

  defaultPredictionIntentRequest
}
