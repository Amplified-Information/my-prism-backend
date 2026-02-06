import { Client, PrivateKey } from '@hashgraph/sdk'
// import dotenv from 'dotenv'
// import { __dirname } from './utils.ts'
import type { HederaKeyType, HederaNetwork } from './types.d.ts'

// dotenv.config({ path: __dirname + '/../../.secrets.local' }) // Load environment variables from .env file

/**
 * Initialise a Hedera Client with safe operator key + network handling
 */
const initHederaClient = (
  // network: HederaNetwork
  // operatorAccountId: string | AccountId,
  // operatorKeyType: HederaKeyType
): [ Client, HederaNetwork, PrivateKey ] => {
  if (!process.env.HEDERA_NETWORK_SELECTED) {
    throw new Error('HEDERA_NETWORK_SELECTED not set in environment variables')
  }
  const network: HederaNetwork = process.env.HEDERA_NETWORK_SELECTED as 'testnet' | 'mainnet' | 'previewnet'
  const accountId: string = process.env[`${network.toUpperCase()}_HEDERA_OPERATOR_ID`] as string
  const keyType: HederaKeyType = process.env[`${network.toUpperCase()}_HEDERA_OPERATOR_KEY_TYPE`] as HederaKeyType
 
  const rawKey = process.env[`${network.toUpperCase()}_HEDERA_OPERATOR_KEY`]
  if (!rawKey) {
    throw new Error(`${network.toUpperCase()}_HEDERA_OPERATOR_KEY not set in environment variables`)
  }

  // Load operator key safely
  let operatorKey: PrivateKey
  if (keyType === 'ecdsa') {
    console.log(`Using "ecdsa" key type for operator on network "${network}"`)
    operatorKey = PrivateKey.fromStringECDSA(rawKey)
  } else if (keyType === 'ed25519') {
    console.log(`Using "ed25519" key type for operator on network "${network}"`)
    operatorKey = PrivateKey.fromStringED25519(rawKey)
  } else {
    throw new Error(`Unknown key type: ${keyType}`)
  }

  // Initialise client safely
  let client: Client
  if (network === 'testnet') {
    client = Client.forTestnet()
  } else if (network === 'mainnet') {
    client = Client.forMainnet()
  } else if (network === 'previewnet') {
    client = Client.forPreviewnet()
  } else {
    throw new Error(`Unknown Hedera network: ${network}`)
  }

  return [
    client.setOperator(accountId, operatorKey),
    network,
    operatorKey
  ]
}

export { initHederaClient }
