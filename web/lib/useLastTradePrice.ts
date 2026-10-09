import { useEffect, useRef, useState } from 'react'
import { priceHistoryCached } from '../grpcClient'

/**
 * Last executed trade price (YES frame, 0..1) for a market, sourced from the
 * backend `PriceHistory` feed — the same feed the price chart renders. Each
 * point in that series is a settled trade print, so the newest point is the
 * real last-trade price (no orderbook approximation).
 *
 * Polls on the same cadence as the orderbook refresh (15s) and looks back far
 * enough to survive quiet markets.
 */
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const POLL_MS = 15_000

export function useLastTradePrice(marketId: string | undefined, net: string) {
  const [lastTradeYes, setLastTradeYes] = useState<number | null>(null)
  const [lastTradeAtMs, setLastTradeAtMs] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    if (!marketId) {
      setLastTradeYes(null)
      setLastTradeAtMs(null)
      setLoading(false)
      return
    }

    let timer: ReturnType<typeof setTimeout> | undefined

    const fetchLast = async (force: boolean) => {
      const to = Date.now()
      try {
        const res = await priceHistoryCached(
          {
            marketId,
            net,
            resolution: 'hour',
            from: new Date(to - LOOKBACK_MS).toISOString(),
            to: new Date(to).toISOString(),
            limit: 1000,
          },
          force ? { force: true } : undefined
        )
        const ts = res.response.timestampMs || []
        const ps = res.response.priceUsd || []
        let bestT = -Infinity
        let bestP: number | null = null
        for (let i = 0; i < ts.length; i++) {
          const t = Number(ts[i])
          const p = ps[i]
          if (Number.isFinite(t) && Number.isFinite(p) && p > 0 && p < 1 && t > bestT) {
            bestT = t
            bestP = p
          }
        }
        if (!aliveRef.current) return
        setLastTradeYes(bestP)
        setLastTradeAtMs(bestP !== null ? bestT : null)
      } catch (err) {
        console.error('[useLastTradePrice] priceHistory failed:', err)
      } finally {
        if (aliveRef.current) setLoading(false)
      }
    }

    void fetchLast(false)
    const tick = () => {
      timer = setTimeout(async () => {
        await fetchLast(true)
        if (aliveRef.current) tick()
      }, POLL_MS)
    }
    tick()

    return () => {
      aliveRef.current = false
      if (timer) clearTimeout(timer)
    }
  }, [marketId, net])

  return { lastTradeYes, lastTradeAtMs, loading }
}
