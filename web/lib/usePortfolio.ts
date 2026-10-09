import { useState, useCallback, useEffect, useSyncExternalStore } from 'react'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { apiClient } from '../grpcClient'
import { fetchAllPaged } from './fetchAllPaged'
import type { MarketResponse, PositionInfo, PredictionIntentResponse, PredictionIntents } from '../gen/api'
import { getBestPricesFromBook } from './utils'
import { getBookCached } from '../grpcClient'
import { DEPTH } from '../constants'
import { snapshotRedeemedMarkets, subscribeRedeemedMarkets } from './redeemSuppression'
import { snapshotPendingSells, subscribePendingSells, reconcilePendingSells } from './pendingSells'
import { toLegacyOrder, toLegacyBook, describeOrder, ACTION_SELL } from './prismV2'
import { deriveCostBasis, type CostBasisFields } from './costBasis'

export interface OpenOrder {
  marketId: string
  market?: MarketResponse
  orderId: string
  action: 'buy' | 'sell'   // Explicit action type
  outcome: 'yes' | 'no'    // Explicit outcome type
  side: 'BID' | 'ASK'      // Keep for compatibility
  priceUsd: number
  qty: number
  generatedAt?: string
  accountId?: string
  primarySecondary?: string  // 'p' (primary, opening) | 's' (secondary, closing)
}

export interface EnrichedPosition {
  marketId: string
  market?: MarketResponse
  side: 'YES' | 'NO' | 'BOTH'
  qtyYes: number
  qtyNo: number
  // Cost-basis fields — populated from the backend's `costBasisYes` /
  // `costBasisNo` USD totals on `PositionInfo` (commit 788dd7f5). Avg price is
  // derived client-side as cost / qty. Realized P&L is not yet shipped by the
  // backend (see deferred section in `docs/cost-basis-and-pnl-spec.md`) and
  // therefore remains 0 — resolved-position P&L falls back to the in-app
  // payout calculation below.

  costBasisAvailable: boolean
  avgPriceYes: number
  avgPriceNo: number
  totalCost: number
  unrealizedPnL: number
  pnlPercent: number
  // Live best bids from the order book (YES bid, NO bid). Used to compute
  // mark-to-market value: value = qtyYes * yesBid + qtyNo * noBid.
  currentBidPrice: number      // alias of currentYesBidPrice (legacy name)
  currentYesBidPrice: number
  currentNoBidPrice: number
  currentAskPrice: number
  marketValue: number
  isResolved: boolean
  // History fields
  // 'CANCELLED' => market resolved as 50/50 refund (EmergClose5050) — both YES and NO redeem at $0.50.
  resolution?: 'YES' | 'NO' | 'CANCELLED'
  resolvedAt?: string
  payout: number
  realizedPnL: number
  // Redeemed timestamp from backend — shown in Redeemable Winnings UI.
  redeemedAt?: string
  // Redeemable USDC for resolved positions where the user holds winning shares.
  // Equals winning-side share count (1:1 USDC payout per Prism.sol redeem()).
  redeemableUsd: number
}

export interface PortfolioSummary {
  totalValue: number
  totalCost: number
  totalPnL: number
  totalPnLPercent: number
  positionCount: number
  marketCount: number
  // History summary
  openPositionCount: number
  resolvedPositionCount: number
  unrealizedPnL: number
  realizedPnL: number
  // Orders summary
  openOrderCount: number
  // True only when EVERY open position has cost-basis data (stricter than
  // "any" per spec §6.3 — avoids misleading mixed totals). Until backend
  // ships the new PositionInfo fields this stays false and the UI renders
  // Cost / P&L as "—" instead of $0.00.
  costBasisAvailable: boolean
}

export function usePortfolio() {
  const { signerZero, userAccountInfo } = useWalletContext()
  const { networkSelected, usdcNdecimals } = useNetworkContext()
  const [positions, setPositions] = useState<EnrichedPosition[]>([])
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([])
  // Matched intents were removed from UserPortfolioResponse in backend commit
  // d62ec41f (moved to a dedicated GetPredictionIntentMatches RPC). Kept as
  // empty state for API compatibility with existing consumers.
  const [matchedOrders] = useState<OpenOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Raw API response from GetUserPortfolio — exposed for debugging/testing UIs
  // (e.g. tooltip on Redeemable Winnings showing the full payload).
  const [rawPortfolio, setRawPortfolio] = useState<unknown>(undefined)

  const fetchPortfolio = useCallback(async () => {
    if (!signerZero || !userAccountInfo) {
      setPositions([])
      setOpenOrders([])
      return

    }

    setIsLoading(true)
    setError(null)

    try {
      const evmAddress = userAccountInfo.evm_address.replace(/^0x/, '').toLowerCase()
      const accountId = signerZero.getAccountId().toString()
      const net = networkSelected.toString().toLowerCase()
      
      console.log('[usePortfolio] Fetching portfolio for:', { evmAddress, accountId, net })

      // Fetch portfolio from GetUserPortfolio - includes both positions and open_prediction_intents
      const portfolioResult = await apiClient.getUserPortfolio({ evmAddress, net })
      
      // Backend now sends map<string, PositionInfo> with nested Position
      const rawPositions: { [marketId: string]: PositionInfo } = portfolioResult.response.positions ?? {}
      setRawPortfolio(portfolioResult.response)

      // Parse open_prediction_intents for open orders
      const rawOpenIntents = portfolioResult.response.openPredictionIntents ?? {}

      console.log('[usePortfolio] Raw positions:', rawPositions)
      console.log('[usePortfolio] Raw open intents:', rawOpenIntents)
      
      // Debug: Log individual intent details (primary vs secondary)
      for (const [mId, wrapper] of Object.entries(rawOpenIntents)) {
        for (const intent of ((wrapper as PredictionIntents).predictionIntents ?? [])) {
          console.log('[usePortfolio] Intent detail:', {
            marketId: mId,
            txId: intent.txId?.slice(0, 8),
            side: intent.side,
            action: intent.action,
            limitYesPrice: String(intent.limitYesPrice),
            qtyShares: String(intent.qtyShares),
            sharesFilled: String(intent.sharesFilled),
          })
        }
      }

      // Fetch markets for enrichment
      let markets: MarketResponse[] = []
      try {
        const { rows } = await fetchAllPaged(async ({ limit, offset }) => {
          const marketsResult = await apiClient.getMarkets({ limit, offset })
          return { rows: marketsResult.response.markets ?? [], pagination: undefined }
        }, { maxPages: 4 })
        markets = rows
      } catch (err) {
        console.warn('[usePortfolio] Failed to fetch markets:', err)
      }
      
      const marketMap = new Map<string, MarketResponse>()
      for (const market of markets) {
        marketMap.set(market.marketId, market)
      }

      // Convert open_prediction_intents to OpenOrder format.
      // The paged `getMarkets` walk is capped at a few pages, so orders on any older / paginated market
      // arrive here with market === undefined and get filtered out downstream
      // in Portfolio.tsx (line ~43: `!!o.market && status==='active'`). Fetch
      // the missing markets individually — same fallback the positions loop
      // uses below — so orders on non-top-50 markets still show up.
      const orderMarketIds = Array.from(new Set(Object.keys(rawOpenIntents)))
      const missingOrderMarketIds = orderMarketIds.filter(id => !marketMap.has(id))
      if (missingOrderMarketIds.length > 0) {
        await Promise.all(missingOrderMarketIds.map(async (mId) => {
          try {
            const r = await apiClient.getMarketById({ marketId: mId })
            if (r.response) marketMap.set(mId, r.response)
          } catch (err) {
            console.warn(`[usePortfolio] Failed to fetch market ${mId} for open order:`, err)
          }
        }))
      }

      const foundOrders: OpenOrder[] = []
      for (const [marketId, intentsWrapper] of Object.entries(rawOpenIntents)) {
        const intents: PredictionIntentResponse[] = (intentsWrapper as PredictionIntents).predictionIntents ?? []
        const market = marketMap.get(marketId)
        
        for (const intent of intents) {
          // Backend no longer carries a buy/sell tag on open intents — derive everything
          // from priceUsd sign + the new primary_secondary flag.
          //
          // primary_secondary === 's'  → user is closing/reducing a position (sell)
          // primary_secondary === 'p'  → user is opening (buy)
          //
          // Outcome:
          //   BUY  YES → priceUsd > 0
          //   BUY  NO  → priceUsd < 0   (encoded as -(1-price))
          //   SELL YES → priceUsd < 0   (selling YES means receiving NO-side cash)
          //   SELL NO  → priceUsd > 0
          //
          // TODO: surface primary_secondary === 's' as a "Close" badge in the open-orders UI.
          // PrismV2: explicit side/action; limitYesPrice is integer YES price.
          const isSell = intent.action === ACTION_SELL
          const { outcome, action } = describeOrder(intent.side, intent.action)
          const legacy = toLegacyOrder(intent, usdcNdecimals)
          const isPositivePrice = legacy.priceUsd >= 0
          if (legacy.qty <= 0) continue

          foundOrders.push({
            marketId: intent.marketId || marketId,
            market,
            orderId: intent.txId,
            action,
            outcome,
            side: isPositivePrice ? 'BID' : 'ASK',
            priceUsd: Math.abs(legacy.priceUsd),
            qty: legacy.qty,
            generatedAt: intent.generatedAt,
            accountId: intent.accountId,
            primarySecondary: isSell ? 's' : 'p'
          })
        }
      }
      
      setOpenOrders(foundOrders)
      console.log('[usePortfolio] Found open orders from API:', foundOrders.length, 'markets fetched on-demand:', missingOrderMarketIds.length)

      // Matched intents are no longer part of UserPortfolioResponse (backend
      // d62ec41f). Use GetPredictionIntentMatches per-market when needed.



      console.log('[usePortfolio] Position count:', Object.keys(rawPositions).length)

      const marketIds = Object.keys(rawPositions)
      if (marketIds.length === 0) {
        setPositions([])
        setIsLoading(false)
        return
      }

      // Own open SELL orders discovered in the order book (see below).
      const bookSellOrders: OpenOrder[] = []

      // Enrich each position with market data and current prices
      const enrichedPositions = await Promise.all(
        marketIds.map(async (marketId): Promise<EnrichedPosition> => {

          const posInfo: PositionInfo = rawPositions[marketId]
          const pos = posInfo.position  // Access nested Position from PositionInfo wrapper
          let market: MarketResponse | undefined = marketMap.get(marketId)
          let currentYesBidPrice = 0.50
          let currentNoBidPrice = 0.50
          let currentAskPrice = 0.50

          // Fetch market metadata if not already in map
          if (!market) {
            try {
              const marketResult = await apiClient.getMarketById({ marketId })
              market = marketResult.response
            } catch (err) {
              console.warn(`[usePortfolio] Failed to fetch market ${marketId}:`, err)
            }
          }

          // Skip GetBook for paused or resolved markets — the CLOB drops resolved
          // markets from its in-memory book and returns "Market not found", which
          // pollutes the console on every refresh.
          const isResolvedMarket = !!posInfo.resolvedAt &&
            posInfo.resolvedAt !== '' &&
            !posInfo.resolvedAt.startsWith('0001-01-01')

          if (!posInfo.isPaused && !isResolvedMarket) {
            try {
              const bookResult = await getBookCached({ marketId, depth: DEPTH }, { force: true })
              const { bestYesBid, bestNoBid, bestAsk } = getBestPricesFromBook(bookResult.response)
              currentYesBidPrice = bestYesBid
              currentNoBidPrice = bestNoBid
              currentAskPrice = bestAsk

              // Fallback source for the user's own open SELL orders.
              // GetUserPortfolio.open_prediction_intents does not reliably
              // include secondary (closing) intents, which left the Portfolio
              // "Selling …" badge missing while the order sat in the book.
              // The book carries account_id + ps, so harvest them here.
              const lb = toLegacyBook(bookResult.response, usdcNdecimals)
              const entries = [...lb.bids, ...lb.asks]
              for (const e of entries) {
                if (e.ps !== 's') continue
                if (e.accountId !== accountId) continue
                const isPositivePrice = e.priceUsd >= 0
                bookSellOrders.push({
                  marketId,
                  market,
                  orderId: e.txId,
                  action: 'sell',
                  // SELL YES is encoded with a negative price; SELL NO positive.
                  outcome: isPositivePrice ? 'no' : 'yes',
                  side: isPositivePrice ? 'BID' : 'ASK',
                  priceUsd: Math.abs(e.priceUsd),
                  qty: e.qty,
                  accountId: e.accountId,
                  primarySecondary: 's',
                })
              }
            } catch (err) {
              console.warn(`[usePortfolio] Failed to fetch book for ${marketId}:`, err)
            }
          }


          // Scale quantities by USDC decimals to get human-readable values
          const scaleFactor = Math.pow(10, usdcNdecimals)
          const qtyYes = (Number(pos?.yes) || 0) / scaleFactor
          const qtyNo = (Number(pos?.no) || 0) / scaleFactor

          // Pure cost-basis / P&L derivation. Reads `costBasisYes` /
          // `costBasisNo` from PositionInfo (backend commit 788dd7f5) and
          // derives avg price as cost / qty. When both totals are zero
          // (e.g. legacy positions, no fills yet) `costBasisAvailable`
          // resolves false and the UI renders "—". Mark-to-market value
          // (qtyYes * bestYesBid + qtyNo * bestNoBid) is always computed —
          // best bid = exit price.

          const cb = deriveCostBasis(
            posInfo as unknown as CostBasisFields,
            qtyYes,
            qtyNo,
            currentYesBidPrice,
            currentNoBidPrice,
          )
          const {
            costBasisAvailable,
            avgPriceYes,
            avgPriceNo,
            totalCost,
            marketValue,
            unrealizedPnL,
            pnlPercent,
          } = cb

          // Determine side
          let side: 'YES' | 'NO' | 'BOTH' = 'YES'
          if (qtyYes > 0 && qtyNo > 0) {
            side = 'BOTH'
          } else if (qtyNo > 0) {
            side = 'NO'
          }

          // Check if market is resolved - backend uses '0001-01-01' as sentinel for unresolved
          // Use resolvedAt from PositionInfo wrapper
          const isResolved = !!posInfo.resolvedAt &&
            posInfo.resolvedAt !== '' &&
            !posInfo.resolvedAt.startsWith('0001-01-01')

          // Resolution outcome comes from MarketResponse.outcome (proto field 13, optional int32).
          // 0 => NO wins, 1 => YES wins, 2 => market cancelled (EmergClose5050, 50/50 refund),
          // undefined => not yet ingested.
          const oc = market?.outcome
          const resolution: 'YES' | 'NO' | 'CANCELLED' | undefined =
            isResolved && oc !== undefined && oc !== null
              ? (oc === 1 ? 'YES' : oc === 0 ? 'NO' : oc === 2 ? 'CANCELLED' : undefined)
              : undefined

          // Calculate payout for resolved positions, then derive realized P&L
          // locally as payout − totalCost (cost basis from backend
          // costBasisYes/No totals). Backend does not yet expose realized
          // P&L on PositionInfo, so we ignore `cb.realizedPnL`.
          let payout = 0

          if (isResolved && resolution) {
            // Winning shares pay $1.00, losing shares pay $0.00.
            // Cancelled markets pay $0.50/share on both sides (EmergClose5050).
            if (resolution === 'YES') {
              payout = qtyYes * 1.00
            } else if (resolution === 'NO') {
              payout = qtyNo * 1.00
            } else if (resolution === 'CANCELLED') {
              payout = (qtyYes + qtyNo) * 0.50
            }
          }

          // Realized P&L:
          //   Backend `realized_pnl_usd` (66b90827) is currently emitted
          //   in raw USDC base units (×1e6) — same unit bug as
          //   `cost_basis_*_usd`. Until the producer is fixed we derive
          //   it locally as payout − totalCost for resolved positions
          //   with known cost basis. Otherwise 0 so the UI shows "—".
          const realizedPnL = isResolved && costBasisAvailable ? payout - totalCost : 0


          // Redeemable USDC = winning-side share count (1:1 USDC payout per Prism.sol).
          // For CANCELLED markets, both sides redeem at $0.50/share.
          // Gate on backend `redeemedAt`: once the WinningsRedeemed event is ingested,
          // the field is populated and the row drops out of Redeemable Winnings.
          // Same sentinel pattern as `resolvedAt` ('' or '0001-01-01...' means unset).
          const isRedeemed = !!posInfo.redeemedAt &&
            posInfo.redeemedAt !== '' &&
            !posInfo.redeemedAt.startsWith('0001-01-01')

          const redeemableUsd = isResolved && resolution && !isRedeemed
            ? (resolution === 'YES' ? qtyYes
              : resolution === 'NO' ? qtyNo
              : (qtyYes + qtyNo) * 0.50)
            : 0

          return {
            marketId,
            market,
            side,
            qtyYes,
            qtyNo,
            costBasisAvailable,
            avgPriceYes,
            avgPriceNo,
            currentBidPrice: currentYesBidPrice,
            currentYesBidPrice,
            currentNoBidPrice,
            currentAskPrice,
            marketValue,
            totalCost,
            unrealizedPnL,
            pnlPercent,
            isResolved,
            resolution,
            resolvedAt: posInfo.resolvedAt,
            payout,
            realizedPnL,
            redeemedAt: posInfo.redeemedAt,
            redeemableUsd
          }
        })
      )

      setPositions(enrichedPositions)

      // Merge book-derived sell orders that the portfolio intents feed missed,
      // so the "Selling …" badge appears as soon as the order rests in the book.
      const knownIds = new Set(foundOrders.map(o => o.orderId))
      const extraSells = bookSellOrders.filter(o => !knownIds.has(o.orderId))
      if (extraSells.length > 0) {
        console.log('[usePortfolio] Sell orders recovered from book:', extraSells.length)
        setOpenOrders([...foundOrders, ...extraSells])
      }

      console.log('[usePortfolio] Enriched positions:', enrichedPositions)

    } catch (err) {
      console.error('[usePortfolio] Error fetching portfolio:', err)
      setError(err instanceof Error ? err.message : 'Failed to load portfolio')
    } finally {
      setIsLoading(false)
    }
  }, [signerZero, networkSelected, userAccountInfo, usdcNdecimals])

  // Subscribe to session-local "just-redeemed" suppression so the UI clears
  // claimed winnings the moment the on-chain redeem succeeds, without waiting
  // for backend ingestion (the proto doesn't expose redeemed_at yet — see
  // .lovable/plan.md, Phase 1+2).
  const redeemedSet = useSyncExternalStore(
    subscribeRedeemedMarkets,
    snapshotRedeemedMarkets,
    snapshotRedeemedMarkets,
  )

  // Apply suppression: a redeemed market reports redeemableUsd = 0.
  const positionsAdjusted = redeemedSet.size === 0
    ? positions
    : positions.map(p =>
        redeemedSet.has(p.marketId) && p.redeemableUsd > 0
          ? { ...p, redeemableUsd: 0 }
          : p
      )

  // Separate open and resolved positions
  const openPositions = positionsAdjusted.filter(p => !p.isResolved)
  const resolvedPositions = positionsAdjusted.filter(p => p.isResolved)

  // Calculate summary
  const unrealizedPnL = openPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0)
  const realizedPnL = resolvedPositions.reduce((sum, p) => sum + p.realizedPnL, 0)
  
  // Count individual YES/NO positions (not just markets)
  const openPositionRowCount = openPositions.reduce((count, p) => {
    if (p.qtyYes > 0) count++
    if (p.qtyNo > 0) count++
    return count
  }, 0)
  const resolvedPositionRowCount = resolvedPositions.reduce((count, p) => {
    if (p.qtyYes > 0) count++
    if (p.qtyNo > 0) count++
    return count
  }, 0)

  // Merge sells submitted in this session that the backend hasn't surfaced
  // yet, so the holding shows "Selling …" (and hides its Sell button) instead
  // of inviting the user to sell the same shares again. See lib/pendingSells.ts.
  const pendingSells = useSyncExternalStore(
    subscribePendingSells,
    snapshotPendingSells,
    snapshotPendingSells,
  )
  const knownOrderIds = new Set(openOrders.map(o => o.orderId))
  // Backend now reports these orders itself — stop shadowing them locally.
  useEffect(() => {
    const ids = openOrders.map(o => o.orderId)
    if (ids.length > 0) reconcilePendingSells(ids)
  }, [openOrders])
  const pendingAsOrders: OpenOrder[] = pendingSells
    .filter(p => !knownOrderIds.has(p.txId))
    .map(p => ({
      marketId: p.marketId,
      market: positions.find(pos => pos.marketId === p.marketId)?.market,
      orderId: p.txId,
      action: 'sell' as const,
      outcome: p.outcome,
      side: p.outcome === 'yes' ? ('ASK' as const) : ('BID' as const),
      priceUsd: p.priceUsd,
      qty: p.qty,
      primarySecondary: 's',
    }))
  const openOrdersMerged = pendingAsOrders.length > 0
    ? [...openOrders, ...pendingAsOrders]
    : openOrders

  const summaryPositions = positionsAdjusted

  const summary: PortfolioSummary = {
    totalValue: summaryPositions.reduce((sum, p) => sum + (p.isResolved ? p.payout : p.marketValue), 0),
    totalCost: summaryPositions.reduce((sum, p) => sum + p.totalCost, 0),
    totalPnL: unrealizedPnL + realizedPnL,
    totalPnLPercent: 0,
    positionCount: openPositionRowCount,
    marketCount: new Set(openPositions.map(p => p.marketId)).size,
    openPositionCount: openPositionRowCount,
    resolvedPositionCount: resolvedPositionRowCount,
    unrealizedPnL,
    realizedPnL,
    openOrderCount: openOrdersMerged.length,
    // Per spec §6.3: only "available" when EVERY open position has data —
    // avoids mixing real $ totals with positions that contribute 0.
    costBasisAvailable: openPositions.length > 0
      && openPositions.every(p => p.costBasisAvailable)
  }
  summary.totalPnLPercent = summary.totalCost > 0 
    ? (summary.totalPnL / summary.totalCost) * 100 
    : 0

  return {
    positions: positionsAdjusted,
    openPositions,
    resolvedPositions,
    openOrders: openOrdersMerged,
    matchedOrders,
    summary,
    isLoading,
    error,
    refresh: fetchPortfolio,
    isConnected: !!signerZero,
    rawPortfolio,
  }
}
