import { useState, useEffect, useCallback } from 'react'
import { roundToTick } from '../utils'
import type { TradingFormState } from './types'

export function useTradingForm(initialLimitPrice: number): TradingFormState {
  const [outcome, setOutcomeInternal] = useState<'yes' | 'no'>('yes')
  const [amountUsd, setAmountUsdInternal] = useState(10)
  const [sharesInput, setSharesInputInternal] = useState(0)
  const [limitPrice, setLimitPrice] = useState(0.50)

  // Sync limit price when initial price loads from order book
  useEffect(() => {
    setLimitPrice(initialLimitPrice)
  }, [initialLimitPrice])

  const setOutcome = useCallback((newOutcome: 'yes' | 'no') => {
    if (newOutcome !== outcome) {
      setLimitPrice(prev => roundToTick(1 - prev))
    }
    setOutcomeInternal(newOutcome)
  }, [outcome])

  const setAmountUsd = useCallback((value: number) => {
    const rounded = Math.round(value * 100) / 100
    setAmountUsdInternal(Math.max(0.10, rounded))
  }, [])

  const setSharesInput = useCallback((value: number) => {
    const rounded = Math.round(value * 1000000) / 1000000
    setSharesInputInternal(Math.max(0, rounded))
  }, [])

  const prefillOrder = useCallback((newOutcome: 'yes' | 'no', price: number, amount?: number) => {
    setOutcomeInternal(newOutcome)
    setLimitPrice(roundToTick(price))
    if (amount !== undefined) {
      setAmountUsdInternal(Math.round(amount * 100) / 100)
    }
  }, [])

  return {
    outcome,
    setOutcome,
    amountUsd,
    setAmountUsd,
    sharesInput,
    setSharesInput,
    limitPrice,
    setLimitPrice,
    prefillOrder,
  }
}
