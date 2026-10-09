import { useState, useEffect } from 'react'
import { getBookCached } from '../../grpcClient'
import { DEPTH } from '../../constants'
import { getBestPricesFromBookWithIntents, roundToTick } from '../utils'
import { useWalletContext } from '../../src/contexts/WalletContext'
import type { OrderBookPriceState } from './types'

export function useOrderBookPrice(marketId: string): OrderBookPriceState {
  // bidUsd = best YES bid (YES frame). askUsd = best YES ask (= 1 − best NO bid).
  const [bidUsd, setBidUsd] = useState(0.50)
  const [askUsd, setAskUsd] = useState(0.50)
  const [hasYesBids, setHasYesBids] = useState(false)
  const [hasNoBids, setHasNoBids] = useState(false)
  const [initialLimitPrice, setInitialLimitPrice] = useState(0.50)

  const { userPortfolio } = useWalletContext()
  // Intents for this market — fold them into the book so the panel agrees
  // with what GraphOrderbook displays (which merges intents client-side).
  const intents = userPortfolio?.openPredictionIntents?.[marketId]?.predictionIntents ?? []

  const midPrice = (bidUsd + askUsd) / 2

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    const fetchPrice = async () => {
      try {
        const bookResult = await getBookCached({ marketId, depth: DEPTH })
        const { bestYesBid, bestYesAsk, yesProbability, hasYesBids: hyb, hasNoBids: hnb } =
          getBestPricesFromBookWithIntents(bookResult.response, intents)
        setBidUsd(bestYesBid)
        setAskUsd(bestYesAsk)
        setHasYesBids(hyb)
        setHasNoBids(hnb)
        setInitialLimitPrice(roundToTick(yesProbability))
      } catch (err) {
        console.error('Failed to fetch price:', err)
        if (String(err).includes('not found')) {
          if (interval) clearInterval(interval)
        }
      }
    }

    if (marketId) {
      fetchPrice()
      interval = setInterval(fetchPrice, 5000)
    }

    return () => { if (interval) clearInterval(interval) }
  }, [marketId, intents])

  return { bidUsd, askUsd, hasYesBids, hasNoBids, midPrice, initialLimitPrice }
}
