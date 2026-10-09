// Shared helper to submit a signed CancelOrderRequest. Used by both:
//   - components/Portfolio.tsx (per-row cancel in open orders)
//   - lib/trading/useOrderLifecycle.ts (TradePanel Cancel button)
//
// Backend commit 66b90827 requires net / accountId / sig / publicKey / keyType
// in addition to marketId + txId. See lib/signCancel.ts header for the
// signing protocol.

import { PublicKey } from '@hiero-ledger/sdk'
import { apiClient } from '../grpcClient'
import { CancelOrderRequest } from '../gen/api'
import { keyTypeToInt, normalizeSignatureBase64 } from './utils'
import { buildCancelSigningPayload, type CancelPayloadMode } from './signCancel'
import { signWithWallet } from './signWithWallet'
import { debugLog, debugWarn } from './debugLog'


// Minimal Hedera signer shape — we only need .sign and .getAccountId here.
export interface CancelSigner {
  sign(messages: Uint8Array[] | Buffer[], opts?: { encoding?: 'utf-8' | 'base64' }): Promise<Array<{ signature: string | Uint8Array }>>
  getAccountId(): { toString(): string }
}

export interface CancelUserKeyInfo {
  key: { _type: string; key: string }
}

export interface SignedCancelArgs {
  marketId: string
  txId: string
  net: string
  signer: CancelSigner
  userKey: CancelUserKeyInfo
}

function normalizePublicKey(rawKey: string, keyTypeStr: string): string {
  let publicKey = rawKey
  if (keyTypeStr === 'ED25519' && publicKey.length > 64) {
    publicKey = publicKey.slice(-64)
  }
  if (keyTypeStr === 'ECDSA_SECP256K1') {
    const looksLikeCompressed = publicKey.length === 66 && (publicKey.startsWith('02') || publicKey.startsWith('03'))
    if (!looksLikeCompressed && publicKey.length > 66) {
      try {
        publicKey = PublicKey.fromString(publicKey).toStringRaw()
      } catch { /* fall through */ }
    }
  }
  return publicKey
}

async function submitSignedCancelWithMode(args: SignedCancelArgs, mode?: CancelPayloadMode): Promise<void> {
  const { marketId, txId, net, signer, userKey } = args
  const { messageToSign, mode: actualMode } = buildCancelSigningPayload(txId, mode)
  // Sign the exact UTF-8 cancel message expected by the backend. The default
  // is base64(<16 raw UUID bytes>), not the hyphenated UUID string.
  // Do not pass `{ encoding: 'base64' }`: the WalletConnect signer interprets
  // that as "base64-encode these bytes before asking the wallet to sign", which
  // changes the message content and makes backend verification fail.
  const sigRaw = await signWithWallet(
    'cancelOrder.sign',
    async () => (await signer.sign([Buffer.from(messageToSign, 'utf8')]))[0].signature,
    { meta: { marketId, txId, mode: actualMode, messageLen: messageToSign.length } },
  )

  const sigB64 = normalizeSignatureBase64(sigRaw)
  const publicKey = normalizePublicKey(userKey.key.key, userKey.key._type)
  const sigByteLen = Buffer.from(sigB64, 'base64').length

  const cancelRequest: CancelOrderRequest = {
    marketId,
    txId,
    net: net.toLowerCase(),
    accountId: signer.getAccountId().toString(),
    sig: sigB64,
    publicKey,
    keyType: keyTypeToInt(userKey.key._type),
  }
  debugWarn('[CANCEL-DEBUG][submitSignedCancel] payload+sig diagnostics:', {
    marketId,
    txId,
    net: cancelRequest.net,
    accountId: cancelRequest.accountId,
    keyType: userKey.key._type,
    keyTypeInt: cancelRequest.keyType,
    publicKeyLen: publicKey.length,
    publicKeyPrefix: publicKey.slice(0, 12),
    payloadMode: actualMode,
    signMessageLen: messageToSign.length,
    sigByteLen,
  })
  const result = await apiClient.cancelPredictionIntent(cancelRequest)
  debugLog('[CANCEL][submitSignedCancel] response:', {
    errorCode: result.response.errorCode,
    message: result.response.message,
  })
  if (result.response.errorCode !== 0) {
    throw new Error(result.response.message || 'Failed to cancel order')
  }
}

export async function submitSignedCancel(args: SignedCancelArgs): Promise<void> {
  await submitSignedCancelWithMode(args)
}

