/**
 * $PRSM claim flow (backend `ClaimPrism`, public API service).
 *
 * Backend behaviour (api/server/services/prismRewards.go @ 77604f9):
 *   - requires the destination account to have the $PRSM token associated
 *   - pays out `GetTotalUnredeemedPrismRewardsByUser(net, accountId)` from the
 *     project hot wallet on Hedera and marks those rewards claimed
 *   - returns `StdResponse{errorCode, message}`; errorCode 1 + "No unredeemed
 *     PRISM rewards available" when there is nothing to claim
 *   - signature verification is still a TODO server-side. We sign anyway (same
 *     protocol shape as cancel-order signing) so the payload is already correct
 *     when the backend starts verifying. Until then the claim UI stays behind
 *     the `showRewards` flag — see docs/backend-sync.md.
 *
 * Signing protocol (mirrors lib/signCancel.ts):
 *   payload  = utf8(`${accountId}:${net}`)
 *   keccak   = keccak256(payload)
 *   message  = base64(keccak)            // 44 chars, wallet adds the
 *                                        // "\x19Hedera Signed Message:\n44" prefix
 */

import { keccak256 } from 'ethers'
import { PublicKey } from '@hiero-ledger/sdk'
import { apiClient } from '../grpcClient'
import type { ClaimPrismRequest } from '../gen/api'
import { keyTypeToInt, normalizeSignatureBase64 } from './utils'
import { signWithWallet } from './signWithWallet'
import { debugLog } from './debugLog'

export interface ClaimSigningPayload {
  /** keccak hex of the payload bytes (includes the 0x prefix) */
  keccakHex: string
  /** base64(keccak) — the 44-char string handed to the wallet */
  messageToSign: string
  /** raw payload bytes as hex (diagnostics only) */
  payloadHex: string
}

/** Build the message the wallet must sign for a $PRSM claim. */
export function buildClaimSigningPayload(accountId: string, net: string): ClaimSigningPayload {
  if (!/^\d+\.\d+\.\d+$/.test(accountId)) {
    throw new Error(`buildClaimSigningPayload: not a Hedera account id: ${accountId}`)
  }
  if (!net) throw new Error('buildClaimSigningPayload: net is required')

  const payloadBytes = Buffer.from(`${accountId}:${net.toLowerCase()}`, 'utf8')
  const keccakHex = keccak256(new Uint8Array(payloadBytes)) as string
  const messageToSign = Buffer.from(keccakHex.slice(2), 'hex').toString('base64')

  return { keccakHex, messageToSign, payloadHex: payloadBytes.toString('hex') }
}

/** Normalize a mirror-node public key to the raw form the backend expects. */
export function normalizeClaimPublicKey(rawKey: string, keyTypeStr: string): string {
  let publicKey = rawKey
  if (keyTypeStr === 'ED25519' && publicKey.length > 64) {
    publicKey = publicKey.slice(-64)
  }
  if (keyTypeStr === 'ECDSA_SECP256K1') {
    const compressed = publicKey.length === 66 && (publicKey.startsWith('02') || publicKey.startsWith('03'))
    if (!compressed && publicKey.length > 66) {
      try {
        publicKey = PublicKey.fromString(publicKey).toStringRaw()
      } catch { /* fall through with the raw key */ }
    }
  }
  return publicKey
}

/** Map a raw backend claim error onto something a user can act on. */
export function mapClaimError(raw: string): string {
  const m = (raw || '').toLowerCase()
  if (m.includes('does not have the prism token associated')) {
    return 'Associate the $PRSM token in your wallet first, then claim again.'
  }
  if (m.includes('no unredeemed prism')) {
    return 'You have no unclaimed $PRSM right now.'
  }
  if (m.includes('prismrewardsrepository is not initialized')) {
    return 'Rewards are temporarily unavailable on the server. Please try again later.'
  }
  if (m.includes('failed to get prism token id') || m.includes('hot payer')) {
    return 'The rewards payout wallet is not configured for this network yet.'
  }
  if (m.includes('did not respond in time')) {
    return 'Your wallet did not respond in time. Open your wallet and try again.'
  }
  if (m.includes('reject') || m.includes('user cancel')) {
    return 'Signature was rejected in your wallet.'
  }
  return raw || 'Claim failed. Please try again.'
}

export interface ClaimSigner {
  sign(messages: Uint8Array[] | Buffer[]): Promise<Array<{ signature: string | Uint8Array }>>
  getAccountId(): { toString(): string }
}

export interface ClaimUserKeyInfo {
  key: { _type: string; key: string }
}

export interface SubmitClaimArgs {
  accountId: string
  net: string
  signer: ClaimSigner
  userKey: ClaimUserKeyInfo
}

/** Build the wire request for a claim, given an already-obtained signature. */
export function buildClaimRequest(
  args: { accountId: string; net: string; sigRaw: string | Uint8Array; userKey: ClaimUserKeyInfo },
): ClaimPrismRequest {
  return {
    accountId: args.accountId,
    net: args.net.toLowerCase(),
    sig: normalizeSignatureBase64(args.sigRaw),
    publicKey: normalizeClaimPublicKey(args.userKey.key.key, args.userKey.key._type),
    keyType: keyTypeToInt(args.userKey.key._type),
  }
}

/** Sign and submit a $PRSM claim. Throws with a friendly message on failure. */
export async function submitClaimPrism(args: SubmitClaimArgs): Promise<string> {
  const { accountId, net, signer, userKey } = args
  const { messageToSign } = buildClaimSigningPayload(accountId, net)

  const sigRaw = await signWithWallet(
    'claimPrism.sign',
    async () => (await signer.sign([Buffer.from(messageToSign, 'utf8')]))[0].signature,
    { meta: { accountId, net, messageLen: messageToSign.length } },
  )

  const request = buildClaimRequest({ accountId, net, sigRaw, userKey })
  const { response } = await apiClient.claimPrism(request)
  debugLog('[claimPrism] response:', { errorCode: response.errorCode, message: response.message })

  if (response.errorCode !== 0) {
    throw new Error(mapClaimError(response.message || 'Failed to claim $PRSM'))
  }
  return response.message || 'Claim submitted'
}
