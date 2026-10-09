import { useState, useEffect, useCallback, useRef } from 'react'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { apiClient } from '../grpcClient'
import { getUserAccountInfo } from './hedera'
import { debugLog, debugWarn } from './debugLog'
import { PositionInfo } from '../gen/api'

export interface MarketPosition {
  qtyYes: number
  qtyNo: number
  avgPriceYes: number
  avgPriceNo: number
  hasPosition: boolean
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// Light background refresh so a fill in the current session unlocks Sell
// without needing a page reload.
const POSITION_REFRESH_MS = 15000

/** Pick this market's position out of a portfolio map, tolerating key drift. */
function selectPosition(
  positions: { [k: string]: PositionInfo },
  marketId: string
): PositionInfo | null {
  const keys = Object.keys(positions)
  if (positions[marketId]) return positions[marketId]

  const lower = marketId.toLowerCase()
  const ciKey = keys.find(k => k.toLowerCase() === lower)
  if (ciKey) return positions[ciKey]

  // Market-filtered responses sometimes come back with a single entry keyed
  // differently (e.g. an internal id). One entry = unambiguously this market.
  if (keys.length === 1) return positions[keys[0]]

  return null
}

/**
 * Hook to fetch user's position for a specific market.
 * Returns quantity of YES/NO shares owned with average prices from portfolio data.
 */
export function useMarketPosition(marketId: string): MarketPosition {
  const { signerZero, userAccountInfo } = useWalletContext()
  const { networkSelected, usdcNdecimals } = useNetworkContext()
  
  const [positionInfo, setPositionInfo] = useState<PositionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  // Transient backend hiccups ("Failed to fetch", empty portfolio while the
  // indexer catches up) used to blank the position instantly, which made the
  // Sell panel flip between the real balance and "No shares". Keep the last
  // known-good position and only clear it after repeated empty successes.
  const emptyStreakRef = useRef(0)
  const EMPTY_STREAK_TO_CLEAR = 2

  const fetchPosition = useCallback(async () => {
    if (!signerZero || !marketId) {
      emptyStreakRef.current = 0
      setPositionInfo(null)
      return
    }
    if (inFlightRef.current) return
    inFlightRef.current = true

    setIsLoading(true)
    setError(null)

    try {
      // userAccountInfo comes from a non-fatal mirror-node lookup on connect
      // (lib/useWallet.ts). If it hasn't landed yet the wallet is still usable —
      // resolve it on demand instead of silently reporting "no position".
      let accountInfo = userAccountInfo
      if (!accountInfo) {
        debugWarn('[useMarketPosition] userAccountInfo missing; fetching on-demand')
        accountInfo = await getUserAccountInfo(networkSelected, signerZero.getAccountId().toString())
      }

      const evmAddress = accountInfo.evm_address.replace(/^0x/, '').toLowerCase()
      const net = networkSelected.toString().toLowerCase()

      debugLog('[useMarketPosition] Fetching position for market:', marketId)

      // Fetch position from GetUserPortfolio with market filter
      const filtered = await apiClient.getUserPortfolio({ evmAddress, net, marketId })
      const filteredPositions = filtered.response.positions ?? {}
      debugLog('[useMarketPosition] filtered position keys:', Object.keys(filteredPositions))

      let posInfo = selectPosition(filteredPositions, marketId)

      // Fall back to the unfiltered portfolio when the filtered call returns
      // nothing — covers backends that ignore or mis-key the marketId filter.
      if (!posInfo) {
        const all = await apiClient.getUserPortfolio({ evmAddress, net, marketId: '' })
        const allPositions = all.response.positions ?? {}
        debugLog('[useMarketPosition] unfiltered position keys:', Object.keys(allPositions))
        posInfo = allPositions[marketId]
          ?? Object.entries(allPositions).find(([k]) => k.toLowerCase() === marketId.toLowerCase())?.[1]
          ?? null
      }

      debugLog('[useMarketPosition] PositionInfo:', posInfo)
      if (posInfo) {
        emptyStreakRef.current = 0
        setPositionInfo(posInfo)
      } else {
        emptyStreakRef.current += 1
        if (emptyStreakRef.current >= EMPTY_STREAK_TO_CLEAR) setPositionInfo(null)
      }
    } catch (err) {
      console.error('[useMarketPosition] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch position')
      // Keep the last known-good position: a network/gateway blip is not
      // evidence that the user's shares disappeared.
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }, [signerZero, userAccountInfo, networkSelected, marketId])


  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchPosition()
  }, [fetchPosition])

  // Background refresh while the market page is open
  useEffect(() => {
    if (!signerZero || !marketId) return
    const id = setInterval(() => { fetchPosition() }, POSITION_REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchPosition, signerZero, marketId])


  // Scale quantities by USDC decimals to get human-readable values
  // Access nested Position from PositionInfo wrapper
  const scaleFactor = Math.pow(10, usdcNdecimals)
  const qtyYes = (Number(positionInfo?.position?.yes) || 0) / scaleFactor
  const qtyNo = (Number(positionInfo?.position?.no) || 0) / scaleFactor
  // Prefer backend's weighted-avg entry price (backend commit 66b90827:
  // PositionInfo.avgPriceYesUsd / avgPriceNoUsd). Fall back to cost/qty,
  // then to the legacy field names (≤ 788dd7f5), then to current mark.
  const markYes = positionInfo?.priceUsd ?? 0.50
  const pAny = positionInfo as unknown as {
    avgPriceYesUsd?: number; avgPriceNoUsd?: number
    costBasisYesUsd?: number; costBasisNoUsd?: number
    costBasisYes?: number; costBasisNo?: number
  } | null
  const cbYes = (pAny?.costBasisYesUsd ?? pAny?.costBasisYes ?? 0) as number
  const cbNo = (pAny?.costBasisNoUsd ?? pAny?.costBasisNo ?? 0) as number
  const avgYesBackend = pAny?.avgPriceYesUsd
  const avgNoBackend = pAny?.avgPriceNoUsd
  const avgPriceYes = (avgYesBackend && avgYesBackend > 0)
    ? avgYesBackend
    : (qtyYes > 0 && cbYes > 0 ? cbYes / qtyYes : markYes)
  const avgPriceNo = (avgNoBackend && avgNoBackend > 0)
    ? avgNoBackend
    : (qtyNo > 0 && cbNo > 0 ? cbNo / qtyNo : 1 - markYes)


  return {
    qtyYes,
    qtyNo,
    avgPriceYes,
    avgPriceNo,
    hasPosition: qtyYes > 0 || qtyNo > 0,
    isLoading,
    error,
    refresh: fetchPosition
  }
}
