import { useState, useEffect } from 'react'
import type { TradingFormState, TradingDerivedValues } from './types'

interface ValidationOptions {
  action: 'buy' | 'sell'
  isWalletConnected: boolean
  spenderAllowanceUsd: number
}

interface ValidationResult {
  isValid: boolean
  validationError: string | null
}

export function useTradingValidation(
  form: TradingFormState,
  derived: TradingDerivedValues,
  options: ValidationOptions
): ValidationResult {
  const { outcome, amountUsd, sharesInput, limitPrice } = form
  const { maxSellableShares } = derived
  const { action, isWalletConnected, spenderAllowanceUsd } = options

  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (!isWalletConnected) {
      setValidationError('Connect wallet to trade')
      return
    }

    if (action === 'buy') {
      if (amountUsd > spenderAllowanceUsd) {
        setValidationError(`Insufficient allowance: $${spenderAllowanceUsd.toFixed(2)}`)
        return
      }
      if (limitPrice <= 0 || limitPrice >= 1) {
        setValidationError('Price must be between $0.01 and $0.99')
        return
      }
    } else {
      if (maxSellableShares <= 0) {
        setValidationError(`No ${outcome.toUpperCase()} shares to sell`)
        return
      }
      if (sharesInput <= 0) {
        setValidationError('Enter shares to sell')
        return
      }
      if (sharesInput > maxSellableShares) {
        setValidationError(`Max: ${maxSellableShares.toFixed(3)} shares`)
        return
      }
      if (limitPrice <= 0 || limitPrice >= 1) {
        setValidationError('Price must be between $0.01 and $0.99')
        return
      }
    }

    setValidationError(null)
  }, [amountUsd, sharesInput, limitPrice, spenderAllowanceUsd, isWalletConnected, action, maxSellableShares, outcome])

  return {
    isValid: !validationError && isWalletConnected,
    validationError,
  }
}
