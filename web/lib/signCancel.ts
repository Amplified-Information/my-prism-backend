// Sign a CancelOrderRequest payload.
//
// Backend `CancelPredictionIntent` (as of `7228e725`) wraps the hyphenated
// `txId` with `Utf82hex` before calling `VerifySig`, so the verifier runs:
//
//     payload  = Hex2utf8(Utf82hex(txId)) == txId          (utf8 bytes)
//     keccak   = keccak256(payload)
//     keccak64 = base64(keccak)
//     prefixed = "\x19Hedera Signed Message:\n44" + keccak64
//     verify(publicKey, prefixed, sig)
//
// Canonical frontend path: sign utf8 bytes of `base64(keccak256(utf8(txId)))`
// — mode `'utf8-hyphenated'`. All other modes are diagnostic-only and remain
// here purely to compare against historical backend states:
//
//   - 'utf8-hyphenated'  : payload = utf8(txId)  ← canonical, matches backend
//   - 'uuid-bytes'       : payload = 16 raw UUID bytes (hex-decoded)
//   - 'utf8-no-hyphens'  : payload = utf8(txId without hyphens)
//   - 'empty'            : payload = empty bytes (pre-`7228e725` broken backend)
//   - 'base64-uuid'      : message = base64(16 raw UUID bytes)
//   - 'base64-uuid-hash' : payload = utf8(base64(16 raw UUID bytes))
//
// Production cancel flow must not auto-retry with another mode because that
// triggers a second wallet approval.

import { keccak256 } from 'ethers'
import { debugLog } from './debugLog'

export type CancelPayloadMode =
  | 'uuid-bytes'
  | 'utf8-hyphenated'
  | 'utf8-no-hyphens'
  | 'empty'
  | 'base64-uuid'
  | 'base64-uuid-hash'

// Default to canonical cancel signing protocol: utf8(txId with hyphens).
// Aligned with backend `7228e725` (2026-07-08) — do not change without a
// matching backend protocol change.
export const DEFAULT_CANCEL_PAYLOAD_MODE: CancelPayloadMode = 'utf8-hyphenated'

export interface CancelSigningPayload {
  /** keccak hex of payload bytes (includes 0x prefix) */
  keccakHex: string
  /** base64(keccak), the 44-char string the wallet wraps in the Hedera prefix */
  keccakB64: string
  /** UTF-8 string passed to the wallet for Hedera message signing */
  messageToSign: string
  /** Mode actually used (for logging / diagnostics) */
  mode: CancelPayloadMode
  /** Raw payload bytes (for diagnostic logging) */
  payloadHex: string
}

/**
 * Build the bytes the wallet must sign for cancel-order.
 * Caller passes `Buffer.from(messageToSign, 'utf8')` to `signer.sign`.
 */
export function buildCancelSigningPayload(
  txId: string,
  mode: CancelPayloadMode = DEFAULT_CANCEL_PAYLOAD_MODE
): CancelSigningPayload {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(txId)) {
    throw new Error(`buildCancelSigningPayload: txId is not a UUID: ${txId}`)
  }

  let payloadBytes: Buffer
  let messageToSign: string | undefined
  switch (mode) {
    case 'empty':
      payloadBytes = Buffer.alloc(0)
      break
    case 'uuid-bytes':
      payloadBytes = Buffer.from(txId.replace(/-/g, ''), 'hex')
      break
    case 'utf8-no-hyphens':
      payloadBytes = Buffer.from(txId.replace(/-/g, ''), 'utf8')
      break
    case 'base64-uuid': {
      const raw = Buffer.from(txId.replace(/-/g, ''), 'hex')
      messageToSign = raw.toString('base64')
      payloadBytes = Buffer.from(messageToSign, 'utf8')
      break
    }
    case 'base64-uuid-hash': {
      const raw = Buffer.from(txId.replace(/-/g, ''), 'hex')
      payloadBytes = Buffer.from(raw.toString('base64'), 'utf8')
      break
    }
    case 'utf8-hyphenated':
    default:
      payloadBytes = Buffer.from(txId, 'utf8')
      break
  }


  const payloadHex = payloadBytes.toString('hex')
  const keccakHex = keccak256(payloadBytes) as string // includes 0x prefix
  const keccakBytes = Buffer.from(keccakHex.slice(2), 'hex')
  const keccakB64 = keccakBytes.toString('base64')
  messageToSign ??= keccakB64

  debugLog('[CANCEL][buildCancelSigningPayload]', {
    txId,
    mode,
    payloadBytesLen: payloadBytes.length,
    signMessageLen: messageToSign.length,
  })

  return { keccakHex, keccakB64, messageToSign, mode, payloadHex }
}
