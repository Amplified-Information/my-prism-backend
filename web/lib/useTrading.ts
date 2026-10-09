import { useWalletContext } from '../src/contexts/WalletContext'
import { useOrderBookPrice } from './trading/useOrderBookPrice'
import { useTradingForm } from './trading/useTradingForm'
import { useTradingDerived } from './trading/useTradingDerived'
import { useTradingValidation } from './trading/useTradingValidation'
import { useOrderLifecycle } from './trading/useOrderLifecycle'
import type { UseTradingOptions, UseTradingResult } from './trading/types'

export type { UseTradingOptions, UseTradingResult }

export function useTrading({
  marketId,
  orderType = 'limit',
  action = 'buy',
  positionYes = 0,
  positionNo = 0
}: UseTradingOptions): UseTradingResult {
  const { signerZero, spenderAllowanceUsd } = useWalletContext()
  const isWalletConnected = !!signerZero

  const prices = useOrderBookPrice(marketId)
  const form = useTradingForm(prices.initialLimitPrice)
  const derived = useTradingDerived(form, prices, { orderType, action, positionYes, positionNo })
  const validation = useTradingValidation(form, derived, { action, isWalletConnected, spenderAllowanceUsd })
  const lifecycle = useOrderLifecycle(form, derived, { marketId, orderType, action, positionYes, positionNo, hasYesBids: prices.hasYesBids, hasNoBids: prices.hasNoBids })

  return {
    // Prices
    bidUsd: prices.bidUsd,
    askUsd: prices.askUsd,
    midPrice: prices.midPrice,
    hasYesBids: prices.hasYesBids,
    hasNoBids: prices.hasNoBids,

    // Form
    outcome: form.outcome,
    setOutcome: form.setOutcome,
    amountUsd: form.amountUsd,
    setAmountUsd: form.setAmountUsd,
    sharesInput: form.sharesInput,
    setSharesInput: form.setSharesInput,
    limitPrice: form.limitPrice,
    setLimitPrice: form.setLimitPrice,
    prefillOrder: form.prefillOrder,

    // Derived
    shares: derived.shares,
    potentialPayout: derived.potentialPayout,
    potentialProfit: derived.potentialProfit,
    estimatedProceeds: derived.estimatedProceeds,
    maxSellableShares: derived.maxSellableShares,
    effectivePrice: derived.effectivePrice,
    yesAskPrice: derived.yesAskPrice,
    noAskPrice: derived.noAskPrice,
    yesSellPrice: derived.yesSellPrice,
    noSellPrice: derived.noSellPrice,

    // Validation
    isValid: validation.isValid,
    validationError: validation.validationError,

    // Lifecycle
    signOrder: lifecycle.signOrder,
    submitOrder: lifecycle.submitOrder,
    cancelOrder: lifecycle.cancelOrder,
    cancelSigning: lifecycle.cancelSigning,
    cancelPendingOrder: lifecycle.cancelPendingOrder,
    resetOrder: lifecycle.resetOrder,
    isSigned: lifecycle.isSigned,
    isProcessing: lifecycle.isProcessing,
    processingStep: lifecycle.processingStep,


    // Wallet
    isWalletConnected,
    spenderAllowanceUsd
  }
}
