export interface UseTradingOptions {
  marketId: string
  orderType?: 'market' | 'limit'
  action?: 'buy' | 'sell'
  positionYes?: number
  positionNo?: number
}

export interface UseTradingResult {
  // Price data
  bidUsd: number
  askUsd: number
  midPrice: number

  // Form state
  outcome: 'yes' | 'no'
  setOutcome: (outcome: 'yes' | 'no') => void
  amountUsd: number
  setAmountUsd: (amount: number) => void
  sharesInput: number
  setSharesInput: (shares: number) => void
  limitPrice: number
  setLimitPrice: (price: number) => void

  // Computed values
  shares: number
  potentialPayout: number
  potentialProfit: number
  estimatedProceeds: number
  effectivePrice: number
  yesAskPrice: number
  noAskPrice: number
  yesSellPrice: number
  noSellPrice: number

  // Position data for sell mode
  maxSellableShares: number

  // Validation
  isValid: boolean
  validationError: string | null

  // Actions - Two-step flow
  signOrder: () => Promise<void>
  submitOrder: () => Promise<void>
  cancelOrder: () => void
  cancelSigning: () => void
  cancelPendingOrder: (txId: string) => Promise<void>
  resetOrder: () => void

  // Signed state
  isSigned: boolean

  // Loading states
  isProcessing: boolean
  processingStep: 'idle' | 'signing' | 'submitting'


  // Wallet state
  isWalletConnected: boolean
  spenderAllowanceUsd: number

  // Liquidity flags
  hasYesBids: boolean
  hasNoBids: boolean

  // Prefill from order book
  prefillOrder: (outcome: 'yes' | 'no', price: number, amount?: number) => void
}

export interface OrderBookPriceState {
  bidUsd: number
  askUsd: number
  hasYesBids: boolean
  hasNoBids: boolean
  midPrice: number
  initialLimitPrice: number
}

export interface TradingFormState {
  outcome: 'yes' | 'no'
  setOutcome: (outcome: 'yes' | 'no') => void
  amountUsd: number
  setAmountUsd: (amount: number) => void
  sharesInput: number
  setSharesInput: (shares: number) => void
  limitPrice: number
  setLimitPrice: (price: number) => void
  prefillOrder: (outcome: 'yes' | 'no', price: number, amount?: number) => void
}

export interface TradingDerivedValues {
  effectivePrice: number
  shares: number
  potentialPayout: number
  potentialProfit: number
  estimatedProceeds: number
  maxSellableShares: number
  sellPrice: number
  yesAskPrice: number
  noAskPrice: number
  yesSellPrice: number
  noSellPrice: number
}
