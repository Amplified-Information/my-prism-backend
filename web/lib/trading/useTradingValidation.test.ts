import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTradingValidation } from './useTradingValidation'
import type { TradingFormState, TradingDerivedValues } from './types'

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

const makeDerived = (overrides: Partial<TradingDerivedValues> = {}): TradingDerivedValues => ({
  effectivePrice: 0.50,
  shares: 20,
  potentialPayout: 20,
  potentialProfit: 10,
  estimatedProceeds: 0,
  maxSellableShares: 0,
  sellPrice: 0.50,
  yesAskPrice: 0.55,
  noAskPrice: 0.45,
  ...overrides,
})

describe('useTradingValidation', () => {
  // --- Wallet ---
  it('returns error when wallet not connected', () => {
    const { result } = renderHook(() =>
      useTradingValidation(makeForm(), makeDerived(), {
        action: 'buy', isWalletConnected: false, spenderAllowanceUsd: 100,
      })
    )
    expect(result.current.isValid).toBe(false)
    expect(result.current.validationError).toBe('Connect wallet to trade')
  })

  // --- BUY validation ---
  it('valid buy order passes', () => {
    const { result } = renderHook(() =>
      useTradingValidation(
        makeForm({ amountUsd: 10, limitPrice: 0.50 }),
        makeDerived(),
        { action: 'buy', isWalletConnected: true, spenderAllowanceUsd: 100 }
      )
    )
    expect(result.current.isValid).toBe(true)
    expect(result.current.validationError).toBeNull()
  })

  it('rejects buy when amount exceeds allowance', () => {
    const { result } = renderHook(() =>
      useTradingValidation(
        makeForm({ amountUsd: 50 }),
        makeDerived(),
        { action: 'buy', isWalletConnected: true, spenderAllowanceUsd: 20 }
      )
    )
    expect(result.current.isValid).toBe(false)
    expect(result.current.validationError).toContain('Insufficient allowance')
  })

  it('rejects buy with price <= 0', () => {
    const { result } = renderHook(() =>
      useTradingValidation(
        makeForm({ limitPrice: 0 }),
        makeDerived(),
        { action: 'buy', isWalletConnected: true, spenderAllowanceUsd: 100 }
      )
    )
    expect(result.current.isValid).toBe(false)
    expect(result.current.validationError).toContain('Price must be')
  })

  it('rejects buy with price >= 1', () => {
    const { result } = renderHook(() =>
      useTradingValidation(
        makeForm({ limitPrice: 1.00 }),
        makeDerived(),
        { action: 'buy', isWalletConnected: true, spenderAllowanceUsd: 100 }
      )
    )
    expect(result.current.isValid).toBe(false)
    expect(result.current.validationError).toContain('Price must be')
  })

  // --- SELL validation ---
  it('valid sell order passes', () => {
    const { result } = renderHook(() =>
      useTradingValidation(
        makeForm({ sharesInput: 5, limitPrice: 0.60 }),
        makeDerived({ maxSellableShares: 10 }),
        { action: 'sell', isWalletConnected: true, spenderAllowanceUsd: 0 }
      )
    )
    expect(result.current.isValid).toBe(true)
    expect(result.current.validationError).toBeNull()
  })

  it('rejects sell when no shares to sell', () => {
    const { result } = renderHook(() =>
      useTradingValidation(
        makeForm({ outcome: 'yes', sharesInput: 5 }),
        makeDerived({ maxSellableShares: 0 }),
        { action: 'sell', isWalletConnected: true, spenderAllowanceUsd: 0 }
      )
    )
    expect(result.current.isValid).toBe(false)
    expect(result.current.validationError).toContain('No YES shares to sell')
  })

  it('rejects sell when sharesInput is zero', () => {
    const { result } = renderHook(() =>
      useTradingValidation(
        makeForm({ sharesInput: 0 }),
        makeDerived({ maxSellableShares: 10 }),
        { action: 'sell', isWalletConnected: true, spenderAllowanceUsd: 0 }
      )
    )
    expect(result.current.isValid).toBe(false)
    expect(result.current.validationError).toBe('Enter shares to sell')
  })

  it('rejects sell when sharesInput exceeds max', () => {
    const { result } = renderHook(() =>
      useTradingValidation(
        makeForm({ sharesInput: 20 }),
        makeDerived({ maxSellableShares: 10 }),
        { action: 'sell', isWalletConnected: true, spenderAllowanceUsd: 0 }
      )
    )
    expect(result.current.isValid).toBe(false)
    expect(result.current.validationError).toContain('Max:')
  })

  it('rejects sell with invalid price', () => {
    const { result } = renderHook(() =>
      useTradingValidation(
        makeForm({ sharesInput: 5, limitPrice: 1.5 }),
        makeDerived({ maxSellableShares: 10 }),
        { action: 'sell', isWalletConnected: true, spenderAllowanceUsd: 0 }
      )
    )
    expect(result.current.isValid).toBe(false)
    expect(result.current.validationError).toContain('Price must be')
  })
})
