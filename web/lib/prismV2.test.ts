import { describe, it, expect } from 'vitest'
import {
  authorizationStructHash, authorizationSigningMessage, computeCollateralCap, toLimitYesPrice,
  toBaseUnits, toLegacyOrder, isBidSide,
} from './prismV2'

const vector = {
  chainId: 296n,
  verifyingContract: '1111111111111111111111111111111111111111',
  signer: '2222222222222222222222222222222222222222',
  marketId: '01890f3e-7c10-7cc1-98bc-0242ac120002',
  txId: '01890f3e-7c10-7cc1-98bc-0242ac120003',
  side: 0, action: 0,
  limitYesPrice: 625000n, qtyShares: 10000000n, collateralCap: 6250000n, deadline: 2000000000n,
}

describe('PrismV2 authorization', () => {
  it('matches the backend reference struct hash', () => {
    expect(authorizationStructHash(vector)).toBe('0x29ab294f817112bc815c5cc131ca9375e9e8bd7b935fb41bedaad2557f9f36c0')
  })
  it('signing message is 44-char base64', () => {
    expect(authorizationSigningMessage(vector)).toHaveLength(44)
  })
})

describe('PrismV2 units', () => {
  it('Buy YES cap = ceil(qty*price/1e6)', () => {
    expect(computeCollateralCap(0, 0, 10_000_000n, 625_000n)).toBe(6_250_000n)
  })
  it('Buy NO cap adds 100 units slack', () => {
    expect(computeCollateralCap(1, 0, 10_000_000n, 625_000n)).toBe(3_750_100n)
  })
  it('SELL cap is 0', () => {
    expect(computeCollateralCap(0, 1, 10_000_000n, 625_000n)).toBe(0n)
  })
  it('NO price q maps to 1e6 - q', () => {
    expect(toLimitYesPrice('no', 0.4)).toBe(600_000n)
    expect(toLimitYesPrice('yes', 0.625)).toBe(625_000n)
  })
  it('shares scale by 6 decimals', () => {
    expect(toBaseUnits(10)).toBe(10_000_000n)
    expect(toBaseUnits(0.01)).toBe(10_000n)
  })
  it('bid side = BUY YES or SELL NO', () => {
    expect(isBidSide(0, 0)).toBe(true)
    expect(isBidSide(1, 1)).toBe(true)
    expect(isBidSide(0, 1)).toBe(false)
    expect(isBidSide(1, 0)).toBe(false)
  })
  it('legacy view signs ask prices negative', () => {
    const o = toLegacyOrder({ txId: 't', accountId: 'a', limitYesPrice: 400_000n, sharesRemaining: 2_000_000n, side: 1, action: 0 })
    expect(o.priceUsd).toBe(-0.4)
    expect(o.qty).toBe(2)
    expect(o.ps).toBe('p')
  })
})
