import { describe, it, expect } from 'vitest'
import { buildClaimSigningPayload, buildClaimRequest, mapClaimError, normalizeClaimPublicKey } from './claimPrism'

const ED25519_RAW = 'a'.repeat(64)

describe('buildClaimSigningPayload', () => {
  it('produces a 44-char base64 keccak message', () => {
    const { messageToSign, keccakHex } = buildClaimSigningPayload('0.0.1234', 'testnet')
    expect(messageToSign).toHaveLength(44)
    expect(keccakHex.startsWith('0x')).toBe(true)
  })

  it('is deterministic and lowercases the network', () => {
    const a = buildClaimSigningPayload('0.0.1234', 'TESTNET')
    const b = buildClaimSigningPayload('0.0.1234', 'testnet')
    expect(a.messageToSign).toBe(b.messageToSign)
  })

  it('differs per account and per network', () => {
    const a = buildClaimSigningPayload('0.0.1234', 'testnet').messageToSign
    const b = buildClaimSigningPayload('0.0.9999', 'testnet').messageToSign
    const c = buildClaimSigningPayload('0.0.1234', 'mainnet').messageToSign
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })

  it('rejects a non-Hedera account id', () => {
    expect(() => buildClaimSigningPayload('not-an-account', 'testnet')).toThrow()
  })
})

describe('normalizeClaimPublicKey', () => {
  it('trims a DER-wrapped ED25519 key to 64 hex chars', () => {
    const der = `302a300506032b6570032100${ED25519_RAW}`
    expect(normalizeClaimPublicKey(der, 'ED25519')).toBe(ED25519_RAW)
  })

  it('leaves a compressed ECDSA key untouched', () => {
    const compressed = `02${'b'.repeat(64)}`
    expect(normalizeClaimPublicKey(compressed, 'ECDSA_SECP256K1')).toBe(compressed)
  })
})

describe('buildClaimRequest', () => {
  it('maps account, net, signature and key type onto the wire request', () => {
    const req = buildClaimRequest({
      accountId: '0.0.1234',
      net: 'TESTNET',
      sigRaw: new Uint8Array([1, 2, 3, 4]),
      userKey: { key: { _type: 'ED25519', key: ED25519_RAW } },
    })
    expect(req.accountId).toBe('0.0.1234')
    expect(req.net).toBe('testnet')
    expect(req.publicKey).toBe(ED25519_RAW)
    expect(req.keyType).toBe(1)
    expect(typeof req.sig).toBe('string')
    expect(req.sig.length).toBeGreaterThan(0)
  })
})

describe('mapClaimError', () => {
  it('explains a missing token association', () => {
    expect(mapClaimError('destination account 0.0.1 does not have the PRISM token associated on network testnet'))
      .toMatch(/associate the \$PRSM token/i)
  })

  it('explains an empty balance', () => {
    expect(mapClaimError('No unredeemed PRISM rewards available')).toMatch(/no unclaimed/i)
  })

  it('passes unknown errors through', () => {
    expect(mapClaimError('some other failure')).toBe('some other failure')
  })

  it('falls back when the message is empty', () => {
    expect(mapClaimError('')).toMatch(/claim failed/i)
  })
})
