import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTradingDerived } from './useTradingDerived'
import type { TradingFormState, OrderBookPriceState } from './types'

const makeForm = (overrides: Partial<TradingFormState> = {}): TradingFormState => ({
  outcome: 'yes',
  setOutcome: () => {},
  amountUsd: 10,
  setAmountUsd: () => {},
  sharesInput: 0,
  setSharesInput: () => {},
  limitPrice: 0.50,
  setLimitPrice: () => {},
  prefillOrder: () => {},
  ...overrides,
})

const makePrices = (overrides: Partial<OrderBookPriceState> = {}): OrderBookPriceState => ({
  bidUsd: 0.45,
  askUsd: 0.55,
  hasYesBids: true,
  hasNoBids: true,
  midPrice: 0.50,
  initialLimitPrice: 0.50,
  ...overrides,
})

describe('useTradingDerived', () => {
  it('calculates shares for buy YES limit order', () => {
    const { result } = renderHook(() =>
      useTradingDerived(
        makeForm({ outcome: 'yes', amountUsd: 10, limitPrice: 0.50 }),
        makePrices(),
        { orderType: 'limit', action: 'buy', positionYes: 0, positionNo: 0 }
      )
    )
    // shares = amountUsd / limitPrice = 10 / 0.50 = 20
    expect(result.current.shares).toBe(20)
    expect(result.current.potentialPayout).toBe(20)
    expect(result.current.potentialProfit).toBe(10) // 20 - 10
    expect(result.current.estimatedProceeds).toBe(0) // buy order
  })

  it('calculates shares for buy NO limit order', () => {
    const { result } = renderHook(() =>
      useTradingDerived(
        makeForm({ outcome: 'no', amountUsd: 20, limitPrice: 0.25 }),
        makePrices(),
        { orderType: 'limit', action: 'buy', positionYes: 0, positionNo: 0 }
      )
    )
    // shares = 20 / 0.25 = 80
    expect(result.current.shares).toBe(80)
    expect(result.current.potentialPayout).toBe(80)
    expect(result.current.potentialProfit).toBe(60)
  })

  it('calculates shares for buy YES market order using YES ask price', () => {
    const { result } = renderHook(() =>
      useTradingDerived(
        makeForm({ outcome: 'yes', amountUsd: 10 }),
        // askUsd is now the YES ask directly (= 1 − best NO bid).
        makePrices({ askUsd: 0.40 }),
        { orderType: 'market', action: 'buy', positionYes: 0, positionNo: 0 }
      )
    )
    expect(result.current.yesAskPrice).toBeCloseTo(0.40)
    expect(result.current.effectivePrice).toBeCloseTo(0.40)
    expect(result.current.shares).toBeCloseTo(25, 2)
  })

  it('calculates shares for buy NO market order using implied NO ask', () => {
    const { result } = renderHook(() =>
      useTradingDerived(
        makeForm({ outcome: 'no', amountUsd: 10 }),
        makePrices({ bidUsd: 0.70 }),
        { orderType: 'market', action: 'buy', positionYes: 0, positionNo: 0 }
      )
    )
    // noAskPrice = 1 - 0.70 = 0.30, shares = 10 / 0.30 ≈ 33.333
    expect(result.current.noAskPrice).toBeCloseTo(0.30)
    expect(result.current.shares).toBeCloseTo(33.333, 2)
  })

  it('sell NO market order proceeds use 1 − askUsd', () => {
    const { result } = renderHook(() =>
      useTradingDerived(
        makeForm({ outcome: 'no', sharesInput: 10 }),
        // YES ask = 0.40 ⇒ best NO bid = 0.60 ⇒ NO sell @ 0.60
        makePrices({ askUsd: 0.40 }),
        { orderType: 'market', action: 'sell', positionYes: 0, positionNo: 100 }
      )
    )
    expect(result.current.noSellPrice).toBeCloseTo(0.60)
    expect(result.current.estimatedProceeds).toBeCloseTo(6)
  })

  it('caps sell shares at maxSellableShares', () => {
    const { result } = renderHook(() =>
      useTradingDerived(
        makeForm({ outcome: 'yes', sharesInput: 100, limitPrice: 0.80 }),
        makePrices(),
        { orderType: 'limit', action: 'sell', positionYes: 50, positionNo: 0 }
      )
    )
    expect(result.current.maxSellableShares).toBe(50)
    expect(result.current.shares).toBe(50) // capped
  })

  it('calculates estimatedProceeds for sell orders', () => {
    const { result } = renderHook(() =>
      useTradingDerived(
        makeForm({ outcome: 'yes', sharesInput: 10, limitPrice: 0.80 }),
        makePrices(),
        { orderType: 'limit', action: 'sell', positionYes: 100, positionNo: 0 }
      )
    )
    // sellPrice = limitPrice = 0.80, proceeds = 10 * 0.80 = 8
    expect(result.current.estimatedProceeds).toBe(8)
  })

  it('returns zero shares when effectivePrice is zero', () => {
    const { result } = renderHook(() =>
      useTradingDerived(
        makeForm({ outcome: 'yes', amountUsd: 10, limitPrice: 0 }),
        makePrices(),
        { orderType: 'limit', action: 'buy', positionYes: 0, positionNo: 0 }
      )
    )
    expect(result.current.shares).toBe(0)
  })

  it('uses positionNo for NO sell maxSellableShares', () => {
    const { result } = renderHook(() =>
      useTradingDerived(
        makeForm({ outcome: 'no', sharesInput: 5 }),
        makePrices(),
        { orderType: 'limit', action: 'sell', positionYes: 100, positionNo: 30 }
      )
    )
    expect(result.current.maxSellableShares).toBe(30)
    expect(result.current.shares).toBe(5)
  })
})
