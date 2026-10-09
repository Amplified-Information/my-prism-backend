import type { TradingFormState, TradingDerivedValues } from './types'
import type { OrderBookPriceState } from './types'

interface DerivedOptions {
  orderType: 'market' | 'limit'
  action: 'buy' | 'sell'
  positionYes: number
  positionNo: number
}

export function useTradingDerived(
  form: TradingFormState,
  prices: OrderBookPriceState,
  options: DerivedOptions
): TradingDerivedValues {
  const { outcome, amountUsd, sharesInput, limitPrice } = form
  const { bidUsd, askUsd } = prices
  const { orderType, action, positionYes, positionNo } = options

  // bidUsd / askUsd are already in the YES frame:
  //   bidUsd = best YES bid, askUsd = best YES ask (= 1 − best NO bid)
  const yesAskPrice = askUsd
  const noAskPrice = 1 - bidUsd
  const yesSellPrice = bidUsd
  const noSellPrice = 1 - askUsd

  const effectivePrice = orderType === 'market'
    ? (outcome === 'yes' ? yesAskPrice : noAskPrice)
    : limitPrice

  const maxSellableShares = outcome === 'yes' ? positionYes : positionNo

  const shares = action === 'buy'
    ? (effectivePrice > 0 ? amountUsd / effectivePrice : 0)
    : Math.min(sharesInput, maxSellableShares)

  const potentialPayout = shares * 1
  const potentialProfit = potentialPayout - (action === 'buy' ? amountUsd : 0)

  const sellPrice = orderType === 'market'
    ? (outcome === 'yes' ? yesSellPrice : noSellPrice)
    : limitPrice
  const estimatedProceeds = action === 'sell' ? shares * sellPrice : 0

  return {
    effectivePrice,
    shares,
    potentialPayout,
    potentialProfit,
    estimatedProceeds,
    maxSellableShares,
    sellPrice,
    yesAskPrice,
    noAskPrice,
    yesSellPrice,
    noSellPrice
  }
}
