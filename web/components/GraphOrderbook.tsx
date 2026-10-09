import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getBookCached } from '../grpcClient'
import { BookSnapshot } from '../gen/clob'
import { toLegacyBook, toLegacyOrder, type LegacyOrder as OrderDetail } from '../lib/prismV2'
import { Skeleton } from '../src/components/ui/skeleton'
import { Badge } from '../src/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../src/components/ui/tooltip'
import { cn } from '../lib/utils'
import { X, Loader2, HelpCircle, ChevronDown, RefreshCw } from 'lucide-react'
import { CancelOrderDialog } from './CancelOrderDialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../src/components/ui/collapsible'
import { DEPTH } from '../constants'
import { useMarketContext } from '../src/contexts/MarketContext'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { useLastTradePrice } from '../lib/useLastTradePrice'
import { getOutcomeStyles, getOutcomeHslValues } from '../lib/marketLabels'

interface GraphOrderbookProps {
  marketId: string
  marketName?: string
  userAccountId?: string
  onPriceClick?: (price: number, side: 'yes' | 'no', quantity: number) => void
  onCancelOrder?: (orderId: string) => Promise<void>
  selectedSide?: 'yes' | 'no'
  onSideChange?: (side: 'yes' | 'no') => void
}

interface AggregatedLevel {
  priceUsd: number
  totalQty: number
  orderCount: number
  userOrders: OrderDetail[]
  ps: string
}

const aggregateByPrice = (orders: OrderDetail[], userAccountId?: string): AggregatedLevel[] => {
  // Merge primary + secondary orders at the same price into a single level —
  // the orderbook no longer distinguishes between them visually.
  const priceMap = new Map<number, { priceUsd: number; ps: string; totalQty: number; orderCount: number; userOrders: OrderDetail[] }>()

  for (const order of orders) {
    const priceKey = Math.round(order.priceUsd * 10000) / 10000
    const existing = priceMap.get(priceKey)
    const isUserOrder = userAccountId && order.accountId === userAccountId

    if (existing) {
      existing.totalQty += order.qty
      existing.orderCount += 1
      if (isUserOrder) existing.userOrders.push(order)
    } else {
      priceMap.set(priceKey, {
        priceUsd: priceKey,
        ps: 'p',
        totalQty: order.qty,
        orderCount: 1,
        userOrders: isUserOrder ? [order] : []
      })
    }
  }

  return Array.from(priceMap.values())
    .map((data) => ({
      priceUsd: data.priceUsd,
      totalQty: data.totalQty,
      orderCount: data.orderCount,
      userOrders: data.userOrders,
      ps: data.ps
    }))
    .filter(l => l.totalQty >= 0.005)
}


const ROW_HEIGHT = 36 // px per row
const SPREAD_DIVIDER_HEIGHT = 36 // approx height of Last/Spread row incl. margins
const SCROLL_THRESHOLD_ROWS = 10 // Only enable scrolling when at least 5 levels are present





const GraphOrderbook = ({ marketId, marketName, userAccountId, onPriceClick, onCancelOrder, selectedSide, onSideChange }: GraphOrderbookProps) => {
  const { market } = useMarketContext()
  const { userPortfolio } = useWalletContext()
  const { networkSelected } = useNetworkContext()
  const net = networkSelected?.toString().toLowerCase() || 'testnet'
  // Real last-trade price from the backend PriceHistory feed (YES frame).
  const { lastTradeYes } = useLastTradePrice(marketId, net)
  const labels = getOutcomeStyles(market)
  const hslColors = getOutcomeHslValues(market)
  const view: 'yes' | 'no' = selectedSide ?? 'yes'
  const setView = (s: 'yes' | 'no') => onSideChange?.(s)
  const { t } = useTranslation()
  const [book, setBook] = useState<BookSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  const [highlightUserOrders, setHighlightUserOrders] = useState(false)
  const [orderToCancel, setOrderToCancel] = useState<{ orderId: string; side: 'bid' | 'ask'; price: number; qty: number } | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  // Locally-cancelled txIds. The wire book usually drops them within a poll or
  // two, but userPortfolio.openPredictionIntents can lag several seconds and
  // would otherwise re-inject the ghost order via the intent-merge below.
  // Entries auto-expire so a stuck cancel can't permanently hide a live order.
  const [cancelledTxIds, setCancelledTxIds] = useState<Set<string>>(() => new Set())
  const [refreshTick, setRefreshTick] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const spinUntilRef = useRef<number>(0)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const spreadDividerRef = useRef<HTMLDivElement | null>(null)
  const asksBlockRef = useRef<HTMLDivElement | null>(null)
  const bidsBlockRef = useRef<HTMLDivElement | null>(null)
  const [spacers, setSpacers] = useState<{ top: number; bottom: number }>({ top: 0, bottom: 0 })

  const clearRefreshingWithFloor = useCallback(() => {
    const remaining = spinUntilRef.current - Date.now()
    if (remaining > 0) setTimeout(() => setIsRefreshing(false), remaining)
    else setIsRefreshing(false)
  }, [])

  useEffect(() => {
    let isMounted = true
    let interval: ReturnType<typeof setInterval> | null = null

    const fetchBook = async (force = false) => {
      try {
        const result = await getBookCached({ marketId, depth: DEPTH }, force ? { force: true } : undefined)

        if (isMounted) {
          setBook(result.response)
          setError(null)
          setIsLive(true)
        }
      } catch (err) {
        const errMsg = String(err?.message || err || '')
        const isFatal = /not found|invalid|unknown market/i.test(errMsg)
        console.error('Failed to fetch orderbook:', err)
        if (isMounted) {
          setError('Failed to load orderbook')
          setIsLive(false)
          if (isFatal && interval) { clearInterval(interval); interval = null }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
          if (force) clearRefreshingWithFloor()
        }
      }
    }

    if (marketId) {
      fetchBook(refreshTick > 0)
      interval = setInterval(() => fetchBook(false), 5000)
      return () => { isMounted = false; if (interval) clearInterval(interval) }
    }

  }, [marketId, refreshTick, clearRefreshingWithFloor])

  const handleManualRefresh = useCallback(() => {
    console.log('[orderbook] manual refresh requested', { marketId })
    spinUntilRef.current = Date.now() + 600
    setIsRefreshing(true)
    setRefreshTick(t => t + 1)
    // Notify sibling consumers (trade panel best-price hook, portfolio) so the
    // whole market view refreshes together instead of only the book table.
    try {
      window.dispatchEvent(new CustomEvent('orderbook:refresh', { detail: { marketId } }))
    } catch {}
  }, [marketId])


  const handleConfirmCancel = useCallback(async () => {
    if (!onCancelOrder || !orderToCancel) return
    const { orderId } = orderToCancel
    setCancellingOrderId(orderId)
    try {
      await onCancelOrder(orderId)
      // Optimistically suppress this order from the merged book until the
      // wire book and the portfolio's openPredictionIntents both drop it.
      setCancelledTxIds(prev => {
        const next = new Set(prev)
        next.add(orderId)
        return next
      })
      // Safety net: forget the suppression after 60s so a backend hiccup
      // can never permanently hide a still-live order from the user.
      setTimeout(() => {
        setCancelledTxIds(prev => {
          if (!prev.has(orderId)) return prev
          const next = new Set(prev)
          next.delete(orderId)
          return next
        })
      }, 60_000)
      handleManualRefresh()
    } finally { setCancellingOrderId(null) }
  }, [onCancelOrder, orderToCancel, handleManualRefresh])

  const handleRequestCancel = useCallback((orderId: string, side: 'bid' | 'ask', price: number, qty: number) => {
    setOrderToCancel({ orderId, side, price, qty })
  }, [])

  // Reconcile the suppression set: as soon as an order is absent from BOTH
  // the wire book and the portfolio intents, drop it from cancelledTxIds so
  // memory doesn't grow unbounded across a long session.
  useEffect(() => {
    if (cancelledTxIds.size === 0) return
    const liveIds = new Set<string>()
    for (const o of book?.bids ?? []) liveIds.add(o.txId)
    for (const o of book?.asks ?? []) liveIds.add(o.txId)
    for (const i of userPortfolio?.openPredictionIntents?.[marketId]?.predictionIntents ?? []) liveIds.add(i.txId)
    let changed = false
    const next = new Set(cancelledTxIds)
    for (const id of cancelledTxIds) {
      if (!liveIds.has(id)) { next.delete(id); changed = true }
    }
    if (changed) setCancelledTxIds(next)
  }, [book, userPortfolio, marketId, cancelledTxIds])

  // Merge user's own open intents (from portfolio) into the book.
  // The CLOB GetBook can lag or omit resting orders the user knows about; the
  // portfolio's open_prediction_intents is the authoritative list of the user's
  // active orders. De-dupe by txId so we don't double-count.
  const userIntents = userPortfolio?.openPredictionIntents?.[marketId]?.predictionIntents ?? []
  // Filter cancelled orders out of BOTH the wire book and the intent merge —
  // the wire feed occasionally re-emits a resting order for one poll cycle
  // after a cancel is accepted, which produced the "ghost order" the user saw.
  const legacyBook = toLegacyBook(book)
  const wireBids = legacyBook.bids.filter(o => !cancelledTxIds.has(o.txId))
  const wireAsks = legacyBook.asks.filter(o => !cancelledTxIds.has(o.txId))
  const knownTxIds = new Set<string>([...wireBids, ...wireAsks].map(o => o.txId))
  const intentBids: OrderDetail[] = []
  const intentAsks: OrderDetail[] = []
  for (const intent of userIntents) {
    if (knownTxIds.has(intent.txId)) continue
    if (cancelledTxIds.has(intent.txId)) continue
    const od = toLegacyOrder(intent)
    if (!od.qty || od.qty < 0.005) continue
    if (od.priceUsd >= 0) intentBids.push(od)
    else intentAsks.push(od)
  }
  const actualBids = [...wireBids, ...intentBids]
  const actualAsks = [...wireAsks, ...intentAsks]
  const isEmpty = actualBids.length === 0 && actualAsks.length === 0

  // YES bids: descending by price (best at top)
  const aggregatedBids = aggregateByPrice(actualBids, userAccountId)
    .sort((a, b) => b.priceUsd - a.priceUsd)

  // NO bids (stored as "asks" on the wire). Ordering is done per-view in the render.
  const aggregatedAsks = aggregateByPrice(actualAsks, userAccountId)

  const allLevels = [...aggregatedBids, ...aggregatedAsks]
  const totalLevels = allLevels.length
  const maxQty = Math.max(...allLevels.map(l => l.totalQty), 1)

  const userBidCount = aggregatedBids.reduce((sum, l) => sum + l.userOrders.length, 0)
  const userAskCount = aggregatedAsks.reduce((sum, l) => sum + l.userOrders.length, 0)
  const totalUserOrders = userBidCount + userAskCount

  // Track view changes so we only recenter when the user toggles YES/NO
  // (or on first layout), never on background book refreshes.
  const pendingRecenterRef = useRef(true)
  const prevViewRef = useRef(view)
  if (prevViewRef.current !== view) {
    prevViewRef.current = view
    pendingRecenterRef.current = true
  }

  // Compute symmetric spacers around the spread divider, then — only when a
  // recenter is pending — scroll the divider to the vertical middle. All of
  // this runs in a layout effect so measurements always reflect the final
  // DOM for the current view, synchronously before paint. The effect re-runs
  // after setSpacers settles, at which point the recenter executes against
  // the settled layout.
  useLayoutEffect(() => {
    const container = scrollContainerRef.current
    const divider = spreadDividerRef.current
    if (!container || !divider) return
    if (totalLevels < SCROLL_THRESHOLD_ROWS) {
      if (spacers.top !== 0 || spacers.bottom !== 0) {
        setSpacers({ top: 0, bottom: 0 })
        return
      }
      if (pendingRecenterRef.current) {
        pendingRecenterRef.current = false
        container.scrollTop = 0
      }
      return
    }
    const asksH = asksBlockRef.current?.offsetHeight ?? 0
    const bidsH = bidsBlockRef.current?.offsetHeight ?? 0
    const half = container.clientHeight / 2 - divider.offsetHeight / 2
    const top = Math.max(0, half - asksH)
    const bottom = Math.max(0, half - bidsH)
    if (top !== spacers.top || bottom !== spacers.bottom) {
      setSpacers({ top, bottom })
      return
    }
    // Spacers are settled for this view. Recenter only if the view just
    // changed; otherwise preserve the user's scroll position across refreshes.
    if (pendingRecenterRef.current) {
      pendingRecenterRef.current = false
      // Measure the divider relative to the scroll container's content using
      // bounding rects — offsetTop is unreliable here because the scroll
      // container is not the divider's offsetParent.
      const dividerTop =
        divider.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop
      container.scrollTop = Math.max(0, dividerTop - half)
    }
  }, [book, view, isCollapsed, spacers, totalLevels])




  const formatPrice = (usd: number) => `$${usd.toFixed(2)}`
  // Show 1-decimal precision for edge-range levels (<5¢ or >95¢) where the
  // valid tick is 0.1¢, and 2-decimal precision elsewhere. This makes 0.1¢
  // ticks like 97.3¢ visible instead of being padded to 97.30¢.
  const formatCents = (usd: number) => {
    const cents = usd * 100
    const isEdge = cents < 5 - 1e-9 || cents > 95 + 1e-9
    const maxDecimals = isEdge ? 1 : 2
    const rounded = Number(cents.toFixed(maxDecimals))
    // Only show decimals when present in the (rounded) value
    return `${Number.isInteger(rounded) ? rounded.toString() : rounded.toString()}¢`
  }


  if (isLoading && !book) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      </div>
    )
  }

  if (error && !book) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 min-h-[260px]">
        <h3 className="font-semibold text-foreground mb-4">Order Book</h3>
        <div className="text-center text-muted-foreground py-8">{error}</div>
      </div>
    )
  }

  return (
    <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <CollapsibleTrigger asChild>
          <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', isCollapsed && '-rotate-90')} />
              <h3 className="font-semibold text-foreground">{t('orderbook.title', 'Order Book')}</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[250px]">
                    <p className="text-xs">{t('orderbook.clickToFill', 'The order book shows pending orders. Click any row to fill at that price.')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {isLive && !isEmpty && (
                <span className="text-xs text-up flex items-center gap-1">
                  <span className="w-2 h-2 bg-up rounded-full animate-pulse" />
                  Live
                </span>
              )}
              {totalUserOrders > 0 && (
                <Badge 
                  variant="outline" 
                  className="bg-primary/10 text-primary border-primary/30 text-xs cursor-pointer hover:bg-primary/20 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    setHighlightUserOrders(true)
                    setTimeout(() => setHighlightUserOrders(false), 1000)
                  }}
                  title="Counted once. Each order appears in both views (a YES bid is the same order as the equivalent NO ask). Click to highlight."
                >
                  Your {totalUserOrders} Order{totalUserOrders > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2" />

          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4">
            {!isEmpty && (() => {
              type DisplayLevel = {
                level: AggregatedLevel
                displayPrice: number
                originalPrice: number
                orderSide: 'bid' | 'ask'
              }

              // Per-view framing (Polymarket-style): each order appears
              // ONCE per view. Toggling YES ↔ NO flips the frame:
              //   YES view: YES bids → bids, YES asks → asks
              //   NO view : YES asks → bids @ (1 − p), YES bids → asks @ (1 − p)
              // Same liquidity, inverse presentation.
              const asks: DisplayLevel[] = []
              const bids: DisplayLevel[] = []

              const push = (level: AggregatedLevel, rawSide: 'bid' | 'ask') => {
                // Wire is YES-frame: |priceUsd| is the YES-equivalent magnitude.
                //   YES bid (rawSide 'bid')  → natural YES price = |p|
                //   NO  bid (rawSide 'ask')  → natural NO  price = 1 − |p|
                const wireAbs = Math.abs(level.priceUsd)
                const naturalPrice = rawSide === 'bid' ? wireAbs : 1 - wireAbs
                let displaySide: 'bid' | 'ask'
                let displayPrice: number
                if (view === 'yes') {
                  if (rawSide === 'bid') { displaySide = 'bid'; displayPrice = naturalPrice }     // YES bid @ p_yes
                  else                   { displaySide = 'ask'; displayPrice = 1 - naturalPrice } // NO bid → YES ask @ (1 − p_no)
                } else {
                  if (rawSide === 'bid') { displaySide = 'ask'; displayPrice = 1 - naturalPrice } // YES bid → NO ask @ (1 − p_yes)
                  else                   { displaySide = 'bid'; displayPrice = naturalPrice }     // NO bid @ p_no
                }
                const entry: DisplayLevel = { level, displayPrice, originalPrice: naturalPrice, orderSide: rawSide }
                ;(displaySide === 'ask' ? asks : bids).push(entry)
              }

              aggregatedBids.forEach(l => push(l, 'bid'))
              aggregatedAsks.forEach(l => push(l, 'ask'))

              // Worst (highest) ask at top, best (lowest) ask at bottom.
              asks.sort((a, b) => b.displayPrice - a.displayPrice)
              // Best (highest) bid at top.
              bids.sort((a, b) => b.displayPrice - a.displayPrice)

              // Show ALL active orders. (Previously we netted out crossing
              // bid/ask levels for "display clarity," which hid legitimate
              // resting orders. Users want to see every active order.)



              // Single source of truth for best prices: derive from the SAME
              // rows the UI renders. asks/bids here are the aggregated,
              // dust-filtered display levels in YES-or-NO frame, so the spread
              // matches the visible top of book exactly. Earlier versions used
              // the raw wire book and got fooled by tiny near-zero asks that
              // were filtered out of the display, producing a phantom spread.
              const bestAsk = asks.length > 0 ? asks[asks.length - 1].displayPrice : null
              const bestBid = bids.length > 0 ? bids[0].displayPrice : null
              const displaySpread = bestAsk !== null && bestBid !== null ? Math.abs(bestAsk - bestBid) : null
              // Real last-trade print from the PriceHistory feed, re-framed for
              // the active view (wire is YES-frame). If the market has never
              // traded we show — rather than pretending a resting order is a
              // trade.
              const lastPrice = lastTradeYes === null
                ? null
                : (view === 'yes' ? lastTradeYes : 1 - lastTradeYes)
              if (import.meta.env.DEV) {
                console.debug('[orderbook]', {
                  view,
                  displayedBestAsk: bestAsk,
                  displayedBestBid: bestBid,
                  spread: displaySpread
                })
              }

              const renderRow = (d: DisplayLevel, kind: 'ask' | 'bid', key: string) => {
                const rowTotal = d.displayPrice * d.level.totalQty
                const barWidth = (d.level.totalQty / maxQty) * 100
                const hasUserOrders = d.level.userOrders.length > 0
                const shouldGlow = highlightUserOrders && hasUserOrders
                const priceColor = kind === 'ask' ? 'text-down' : 'text-up'
                const barColor = kind === 'ask' ? 'bg-down/10' : 'bg-up/10'

                return (
                  <div
                    key={key}
                    className={cn(
                      'relative',
                      shouldGlow && 'ring-1 ring-primary/40',
                      hasUserOrders && 'bg-primary/5',
                      onPriceClick && 'cursor-pointer hover:bg-muted/30'
                    )}
                    style={{ height: `${ROW_HEIGHT}px` }}
                    onClick={() => onPriceClick?.(d.displayPrice, view, d.level.totalQty)}
                  >
                    {/* Full-row depth bar */}
                    <div
                      className={cn('absolute inset-y-0 left-0 pointer-events-none', barColor)}
                      style={{ width: `${barWidth}%` }}
                    />
                    {hasUserOrders && (
                      <div className="absolute inset-y-0 left-0 w-[2px] bg-primary pointer-events-none" />
                    )}
                    <div className="relative grid grid-cols-[6rem_4rem_1fr_6rem] gap-x-0 h-full">
                      <div className={cn('flex items-center justify-start px-3 font-mono font-medium text-sm', priceColor)}>
                        {formatCents(d.displayPrice)}
                      </div>
                      <div className="flex items-center gap-0.5 px-1 justify-start">
                        {hasUserOrders && <UserBadge userOrders={d.level.userOrders} shouldGlow={shouldGlow} />}
                        {hasUserOrders && onCancelOrder && (
                          d.level.userOrders.map((order) => (
                            <button
                              key={order.txId}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRequestCancel(order.txId, d.orderSide, d.originalPrice, order.qty)
                              }}
                              disabled={cancellingOrderId === order.txId}
                              className="relative z-20 pointer-events-auto p-0 rounded hover:bg-destructive/30 text-destructive"
                              title={`Cancel order (${order.qty.toFixed(3)} shares)`}
                            >
                              {cancellingOrderId === order.txId ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                            </button>
                          ))
                        )}
                      </div>
                      <div className="flex items-center px-2 justify-end">
                        <span className="font-mono text-sm text-muted-foreground">{d.level.totalQty.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-end px-3 font-mono text-sm text-muted-foreground">
                        {formatPrice(rowTotal)}
                      </div>
                    </div>

                  </div>
                )
              }

              const bidsTotalQty = bids.reduce((s, d) => s + d.level.totalQty, 0)
              const bidsTotalUsd = bids.reduce((s, d) => s + d.displayPrice * d.level.totalQty, 0)

              return (
                <>
                  {/* Trade Yes / Trade No sub-row */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                    <div className="inline-flex items-center gap-4 text-sm font-medium">
                      <button
                        onClick={() => setView('yes')}
                        className={cn(
                          'pb-1 border-b-2 transition-colors',
                          view === 'yes'
                            ? 'border-current'
                            : 'text-muted-foreground border-transparent hover:text-foreground'
                        )}
                        style={view === 'yes' && hslColors.yes
                          ? { color: `hsl(${hslColors.yes})`, borderColor: `hsl(${hslColors.yes})` }
                          : view === 'yes' ? { color: 'hsl(var(--outcome-a))', borderColor: 'hsl(var(--outcome-a))' } : undefined}
                      >
                        Trade {labels.yes.label}
                      </button>
                      <button
                        onClick={() => setView('no')}
                        className={cn(
                          'pb-1 border-b-2 transition-colors',
                          view === 'no'
                            ? 'border-current'
                            : 'text-muted-foreground border-transparent hover:text-foreground'
                        )}
                        style={view === 'no' && hslColors.no
                          ? { color: `hsl(${hslColors.no})`, borderColor: `hsl(${hslColors.no})` }
                          : view === 'no' ? { color: 'hsl(var(--outcome-b))', borderColor: 'hsl(var(--outcome-b))' } : undefined}
                      >
                        Trade {labels.no.label}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <button
                        onClick={handleManualRefresh}
                        className="p-1 rounded hover:bg-muted/40 transition-colors"
                        title="Refresh order book"
                        aria-label="Refresh"
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                      </button>
                      <span className="font-mono">0.1¢</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-[6rem_4rem_1fr_6rem] gap-x-0 text-xs text-muted-foreground font-medium mb-1 pl-9">
                    <span className="text-left px-3">PRICE</span>
                    <span className="text-left px-1">YOU</span>
                    <span className="text-right px-2">SHARES</span>
                    <span className="text-right px-3">TOTAL</span>
                  </div>


                  {/* Scrollable order book body — grows with content up to 10 rows */}
                  {(() => null)()}
                  <div
                    ref={scrollContainerRef}
                    className={(totalLevels < SCROLL_THRESHOLD_ROWS ? 'overflow-y-hidden' : 'overflow-y-auto') + ' scrollbar-cosmic'}
                    style={{ maxHeight: `${Math.min((asks.length || 1) + (bids.length || 1), 10) * ROW_HEIGHT + SPREAD_DIVIDER_HEIGHT + 6}px` }}
                  >
                    <div style={{ height: `${spacers.top}px` }} aria-hidden />
                    {/* Asks block — highest ask at top, best (lowest) ask
                        rendered last so it sits directly above the spread
                        divider. asks is already sorted desc by displayPrice. */}
                    <div ref={asksBlockRef} className="relative pl-9">
                      <div className="absolute left-0 bottom-1 z-10 pointer-events-none">
                        <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-down/20 text-down">Asks</span>
                      </div>
                      {asks.length === 0 ? (
                        <div className="text-center text-xs text-muted-foreground py-3">No asks</div>
                      ) : (
                        asks.map((d, i) => renderRow(d, 'ask', `ask-${i}`))
                      )}
                    </div>

                    {/* Divider: Last / Spread */}
                    <div ref={spreadDividerRef} className="flex items-center gap-4 px-3 py-2 my-1 border-y border-border text-xs">
                      <span className="text-muted-foreground">
                        Last: <span className="text-foreground font-medium font-mono">{lastPrice !== null ? formatCents(lastPrice) : '—'}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Spread: <span className="text-foreground font-medium font-mono">{displaySpread !== null ? formatCents(displaySpread) : '—'}</span>
                      </span>
                    </div>

                    {/* Bids block — best (highest) bid at top */}
                    <div ref={bidsBlockRef} className="relative pl-9">
                      <div className="absolute left-0 top-1 z-10 pointer-events-none">
                        <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-up/20 text-up">Bids</span>
                      </div>
                      {bids.length === 0 ? (
                        <div className="text-center text-xs text-muted-foreground py-3">No bids</div>
                      ) : (
                        bids.map((d, i) => renderRow(d, 'bid', `bid-${i}`))
                      )}
                    </div>
                    <div style={{ height: `${spacers.bottom}px` }} aria-hidden />
                  </div>

                  {/* Totals (bids depth) */}
                  {bids.length > 0 && (
                    <div className="grid grid-cols-[6rem_4rem_1fr_6rem] gap-x-0 border-t border-border mt-1 pt-2 text-xs font-medium text-foreground pl-9" style={{ height: `${ROW_HEIGHT}px` }}>
                      <div className="flex items-center px-3 text-muted-foreground uppercase tracking-wide">Total</div>
                      <div />
                      <div className="flex items-center px-2 font-mono justify-end">{bidsTotalQty.toFixed(3)}</div>
                      <div className="flex items-center justify-end px-3 font-mono">{formatPrice(bidsTotalUsd)}</div>
                    </div>

                  )}
                </>
              )
            })()}

            {isEmpty && (
              <div className="text-center text-sm text-muted-foreground py-8">
                No active orders
              </div>
            )}
          </div>

        </CollapsibleContent>

        <CancelOrderDialog
          open={!!orderToCancel}
          onOpenChange={(open) => !open && setOrderToCancel(null)}
          onConfirm={handleConfirmCancel}
          marketName={marketName}
          orderDetails={orderToCancel ? {
            side: orderToCancel.side,
            price: orderToCancel.price,
            qty: orderToCancel.qty
          } : undefined}
        />
      </div>
    </Collapsible>
  )
}

// Compact user badge showing "You" + quantity
interface UserBadgeProps {
  userOrders: OrderDetail[]
  shouldGlow?: boolean
}

const UserBadge = ({ userOrders, shouldGlow }: UserBadgeProps) => {
  const userQty = userOrders.reduce((sum, o) => sum + o.qty, 0)
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        'relative z-10 text-[10px] px-1 py-0 h-4 bg-primary/10 text-primary border-primary/30 flex items-center gap-0.5 transition-all duration-300 whitespace-nowrap',
        shouldGlow && 'drop-shadow-[0_0_8px_hsl(var(--primary))] scale-105'
      )}
    >
      <span>You</span>
      <span>{userQty.toFixed(1)}</span>
    </Badge>
  )
}

export default GraphOrderbook
