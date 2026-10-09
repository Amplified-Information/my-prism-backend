import { useState, useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  snapshotPendingSells,
  subscribePendingSells,
  reconcilePendingSells,
  pendingSellQty,
} from '../lib/pendingSells'
import { useWallet } from '../lib/useWallet'
import toast from 'react-hot-toast'
import { useTrading } from '../lib/useTrading'
import { useMarketPosition } from '../lib/useMarketPosition'
import { getBookCached } from '../grpcClient'
import { DEPTH } from '../constants'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { useUIContext } from '../src/contexts/UIContext'
import { useMarketContext } from '../src/contexts/MarketContext'
import { getTokenBalance, getSpenderAllowanceUsd, UNLIMITED_ALLOWANCE_USD } from '../lib/hedera'
import { BookSnapshot } from '../gen/clob'
import { toLegacyBook, toLegacyOrder, type LegacyOrder as OrderDetail } from '../lib/prismV2'
import { Input } from '../src/components/ui/input'
import { Label } from '../src/components/ui/label'
import { 
  Wallet, 
  CheckCircle2,
  Loader2,
  AlertCircle,
  Check,
  Coins,
  ExternalLink,
  Zap,
  Send,
  X,
  Package,
  ChevronDown,
  ChevronUp,
  Info,
  Globe
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGeoRestricted } from '../lib/useGeoRestricted'
import { cn, getTickSize, roundToTick } from '../lib/utils'
import { getOutcomeStyles, getOutcomeHslValues, getOutcomeButtonStyle } from '../lib/marketLabels'

/**
 * Precomputed array of all valid limit-price values in cents,
 * respecting tick sizes: 0.1¢ ticks below 5¢ and above 95¢, 1¢ ticks in between.
 * Values: 0.1, 0.2, …, 4.9, 5, 6, …, 95, 95.1, 95.2, …, 99.9
 */
const VALID_CENTS: number[] = (() => {
  const vals: number[] = []
  // Edge low: 0.1 to 4.9 step 0.1
  for (let c = 1; c <= 49; c++) vals.push(Number((c / 10).toFixed(1)))
  // Standard: 5 to 95 step 1
  for (let c = 5; c <= 95; c++) vals.push(c)
  // Edge high: 95.1 to 99.9 step 0.1
  for (let c = 951; c <= 999; c++) vals.push(Number((c / 10).toFixed(1)))
  return vals
})()

/** Step through VALID_CENTS by +1 (up) or -1 (down) from the current limitPrice. */
const stepLimitPrice = (currentPrice: number, dir: 1 | -1): number => {
  const currentCents = Number((currentPrice * 100).toFixed(1))
  let idx = VALID_CENTS.findIndex(v => v >= currentCents)
  if (idx === -1) idx = VALID_CENTS.length - 1
  // When stepping down and current value isn't an exact match, stay at the lower neighbor
  if (VALID_CENTS[idx] !== currentCents && dir === -1) {
    idx = Math.max(0, idx - 1)
  } else {
    idx = Math.max(0, Math.min(VALID_CENTS.length - 1, idx + dir))
  }
  return VALID_CENTS[idx]! / 100
}

interface TradePanelProps {
  marketId: string
  marketStatement?: string
  onPrefillRef?: (prefill: (outcome: 'yes' | 'no', price: number, amount?: number) => void) => void
  initialAction?: 'buy' | 'sell'
  initialOutcome?: 'yes' | 'no'
  initialShares?: number
  selectedSide?: 'yes' | 'no'
  onSideChange?: (side: 'yes' | 'no') => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TradePanel = ({ marketId, marketStatement, onPrefillRef, initialAction, initialOutcome, initialShares, selectedSide, onSideChange }: TradePanelProps) => {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS (React Rules of Hooks)
  const { setShowAllowanceSidebar, setAllowanceSidebarContractId } = useUIContext()
  const { signerZero, setSpenderAllowanceUsd, userPortfolio } = useWalletContext()
  const { networkSelected, usdcTokenIds, usdcNdecimals, smartContractIds } = useNetworkContext()
  const { market } = useMarketContext()
  const { t } = useTranslation()
  // Advisory region check: browsing stays open, placing orders does not.
  const { restricted: geoRestricted, country: geoCountry } = useGeoRestricted()


  const openAllowanceSidebar = () => {
    // Grant against the exact contract the order will target. Fall back to
    // the network-default when the market hasn't loaded yet, so the sidebar
    // never opens on an unrelated "latest" contract. See .lovable/plan.md (Bug 2).
    const targetContractId =
      market?.smartContractId ||
      smartContractIds[networkSelected.toString().toLowerCase()] ||
      ''
    if (targetContractId) setAllowanceSidebarContractId(targetContractId)
    setShowAllowanceSidebar(true)
  }
  const labels = getOutcomeStyles(market)
  const hslColors = getOutcomeHslValues(market)
  const { connect } = useWallet()
  const [usdcBalance, setUsdcBalance] = useState<number>(0)
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [action, setAction] = useState<'buy' | 'sell'>(initialAction || 'buy')
  const [showOrderSummary, setShowOrderSummary] = useState(true)
  const [limitPriceInput, setLimitPriceInput] = useState<string>('')
  const [book, setBook] = useState<BookSnapshot | null>(null)
  const [amountDraft, setAmountDraft] = useState<string>('10')


  // Fetch user's position for this market (pass empty string if no marketId to satisfy hook rules)
  const { 
    qtyYes, 
    qtyNo, 
    hasPosition, 
    isLoading: positionLoading,
    refresh: refreshPosition 
  } = useMarketPosition(marketId || '')

  const {
    bidUsd,
    askUsd,
    outcome,
    setOutcome,
    amountUsd,
    setAmountUsd,
    sharesInput,
    setSharesInput,
    limitPrice,
    setLimitPrice,
    shares,
    potentialPayout,
    estimatedProceeds,
    effectivePrice,
    yesAskPrice,
    noAskPrice,
    yesSellPrice,
    noSellPrice,
    validationError,
    signOrder,
    submitOrder,
    cancelOrder,
    cancelSigning,
    isSigned,
    isProcessing,
    processingStep,
    isWalletConnected,

    spenderAllowanceUsd,
    hasYesBids,
    hasNoBids,
    prefillOrder
  } = useTrading({ 
    marketId: marketId || '', 
    orderType, 
    action,
    positionYes: qtyYes,
    positionNo: qtyNo
  })

  // Keep the Amount input's local string draft in sync when amountUsd changes
  // from outside the input (quick increments, +Max, order-book prefill, etc.).
  useEffect(() => {
    setAmountDraft(prev => (Number(prev) === amountUsd ? prev : String(amountUsd)))
  }, [amountUsd])

  // Orderbook snapshot for local secondary-order calculations in this panel.
  useEffect(() => {
    let isMounted = true
    let interval: ReturnType<typeof setInterval> | null = null

    const fetchBook = async () => {
      try {
        const result = await getBookCached({ marketId, depth: DEPTH })
        if (isMounted) setBook(result.response)
      } catch {
        // Non-fatal for TradePanel; keep existing book snapshot if fetch fails.
      }
    }

    if (marketId) {
      fetchBook()
      interval = setInterval(fetchBook, 5000)
    }

    return () => {
      isMounted = false
      if (interval) clearInterval(interval)
    }
  }, [marketId])

  const userAccountId = signerZero?.getAccountId()?.toString()
  const userIntents = userPortfolio?.openPredictionIntents?.[marketId]?.predictionIntents ?? []

  const { actualBids, actualAsks } = useMemo(() => {
    const legacyBook = toLegacyBook(book)
    const wireBids = legacyBook.bids
    const wireAsks = legacyBook.asks
    const knownTxIds = new Set<string>([...wireBids, ...wireAsks].map(o => o.txId))
    const intentBids: OrderDetail[] = []
    const intentAsks: OrderDetail[] = []

    for (const intent of userIntents) {
      if (knownTxIds.has(intent.txId)) continue
      const od = toLegacyOrder(intent)
      if (!od.qty || od.qty < 0.005) continue
      if (od.priceUsd >= 0) intentBids.push(od)
      else intentAsks.push(od)
    }

    return {
      actualBids: [...wireBids, ...intentBids],
      actualAsks: [...wireAsks, ...intentAsks]
    }
  }, [book, userIntents])

  // yes, for sells bid/asks may be around the wrong way - intentional
  const bookSecondaryYes = actualAsks.reduce((sum, o) => sum + (o.ps === 's' && (!userAccountId || o.accountId === userAccountId) ? o.qty : 0), 0)
  const bookSecondaryNo = actualBids.reduce((sum, o) => sum + (o.ps === 's' && (!userAccountId || o.accountId === userAccountId) ? o.qty : 0), 0)

  // Sells this tab submitted that the backend hasn't surfaced yet (the book /
  // open-intents feed lags, and positions are not decremented while escrowed).
  // Without this the same shares stay "sellable" and can be offered repeatedly.
  const pendingSells = useSyncExternalStore(
    subscribePendingSells,
    snapshotPendingSells,
    snapshotPendingSells,
  )

  // Once an order is visible in the book/intents, stop double-counting it.
  useEffect(() => {
    const ids = [...actualAsks, ...actualBids].filter(o => o.ps === 's').map(o => o.txId)
    if (ids.length > 0) reconcilePendingSells(ids)
  }, [actualAsks, actualBids])

  const openSecondaryYes = bookSecondaryYes + pendingSellQty(pendingSells, marketId, 'yes')
  const openSecondaryNo = bookSecondaryNo + pendingSellQty(pendingSells, marketId, 'no')


  // Expose prefill function to parent via ref callback
  useEffect(() => {
    if (onPrefillRef) {
      onPrefillRef((outcome, price, amount) => {
        prefillOrder(outcome, price, amount)
        setOrderType('limit') // Switch to limit order mode when clicking order book
      })
    }
  }, [onPrefillRef, prefillOrder])

  // Apply initial values from URL params (e.g., from Portfolio sell button)
  useEffect(() => {
    if (initialOutcome) {
      setOutcome(initialOutcome)
    }
    if (initialShares !== undefined && initialShares > 0) {
      setSharesInput(initialShares)
    }
  }, [initialOutcome, initialShares, setOutcome, setSharesInput])

  // Sync outcome with externally-controlled selectedSide (from OrderBook toggle)
  useEffect(() => {
    if (selectedSide && selectedSide !== outcome) setOutcome(selectedSide)
  }, [selectedSide])

  // Propagate internal outcome changes back to parent
  useEffect(() => {
    if (onSideChange && outcome !== selectedSide) onSideChange(outcome)
  }, [outcome])

  // Keep the limit price text input in sync with the numeric limitPrice when it
  // changes externally (order book click, arrow-key step, outcome flip).
  useEffect(() => {
    const formatted = String(Number((limitPrice * 100).toFixed(1)))
    const currentParsed = parseFloat(limitPriceInput)
    if (limitPriceInput === '' || isNaN(currentParsed) || Math.abs(currentParsed - Number(formatted)) > 1e-9) {
      setLimitPriceInput(formatted)
    }
  }, [limitPrice])


  // Fetch USDC balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!signerZero) return
      const usdcTokenId = usdcTokenIds[networkSelected.toString().toLowerCase()]
      if (!usdcTokenId) return
      
      try {
        const rawBalance = await getTokenBalance(
          networkSelected, 
          usdcTokenId, 
          signerZero.getAccountId().toString()
        )
        setUsdcBalance(rawBalance / (10 ** usdcNdecimals))
      } catch (error) {
        console.error('Error fetching USDC balance:', error)
      }
    }
    fetchBalance()
  }, [signerZero, networkSelected, usdcTokenIds, usdcNdecimals])

  // Fetch allowance for THIS market's smart contract (per-market spender)
  useEffect(() => {
    const fetchMarketAllowance = async () => {
      if (!signerZero || !market?.smartContractId) return
      try {
        const allowance = await getSpenderAllowanceUsd(
          networkSelected,
          usdcTokenIds,
          usdcNdecimals,
          market.smartContractId,
          signerZero.getAccountId().toString()
        )
        setSpenderAllowanceUsd(allowance)
      } catch (error) {
        console.error('[TradePanel] Error fetching market allowance:', error)
      }
    }
    fetchMarketAllowance()
  }, [signerZero, networkSelected, usdcTokenIds, usdcNdecimals, market?.smartContractId, setSpenderAllowanceUsd])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'b':
          setAction('buy')
          break
        case 's':
          if (hasPosition) setAction('sell')
          break
        case 'm':
          setOrderType('market')
          break
        case 'l':
          setOrderType('limit')
          break
        case 'y':
          setOutcome('yes')
          break
        case 'n':
          setOutcome('no')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasPosition, setOutcome])

  // Early return for missing marketId - AFTER all hooks to satisfy React Rules of Hooks
  if (!marketId) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-muted-foreground text-center">Loading market...</p>
      </div>
    )
  }

  // Quick increment buttons for buy mode
  const quickIncrements = [1, 20, 100] as const
  
  // Calculate max amount (lesser of allowance or balance)
  // If both are 0 or undefined, allow manual entry without capping
  const hasLimits = spenderAllowanceUsd > 0 && usdcBalance > 0
  const maxBuyAmount = hasLimits ? Math.min(spenderAllowanceUsd, usdcBalance) : Infinity
  
  // Quick share percentage buttons for sell mode
  const quickPercentages = [25, 50, 75, 100]

  // For market orders, calculate implied ask prices (what you actually pay)
  // askUsd = Math.abs(NO priceUsd) = already the implied YES cost (complement-encoded)
  // Liquidity checks for market orders:
  // Buy YES crosses NO orders, Buy NO crosses YES orders
  const hasLiquidityForYes = hasNoBids   // Need NO bids to fill a YES market buy
  const hasLiquidityForNo = hasYesBids   // Need YES bids to fill a NO market buy
  const selectedHasLiquidity = outcome === 'yes' ? hasLiquidityForYes : hasLiquidityForNo
  const noLiquidityForMarket = orderType === 'market' && action === 'buy' && !selectedHasLiquidity

  // Dynamic tick size based on current limit price
  const tickSize = getTickSize(limitPrice)

  // Handle sell tab - disable if no position
  const availableYesShares = Math.max(0, qtyYes - openSecondaryYes)
  const availableNoShares = Math.max(0, qtyNo - openSecondaryNo)
  const availableSellShares = outcome === 'yes' ? availableYesShares : availableNoShares
  const canSell = availableSellShares > 0

  // Local sell-side cap that accounts for open secondary orders.
  // useTrading validation only knows wallet positions, so enforce this here too.
  const localSellMaxError = action === 'sell' && sharesInput > availableSellShares + 1e-9
    ? `Max: ${availableSellShares.toFixed(3)} shares`
    : null
  const effectiveValidationError = localSellMaxError || validationError

  // Calculate position after trade
  const positionAfterYes = action === 'buy' 
    ? (outcome === 'yes' ? qtyYes + shares : qtyYes)
    : (outcome === 'yes' ? qtyYes - shares : qtyYes)
  const positionAfterNo = action === 'buy' 
    ? (outcome === 'no' ? qtyNo + shares : qtyNo)
    : (outcome === 'no' ? qtyNo - shares : qtyNo)

  // Calculate equivalent opposite-side action for educational tooltip
  // const equivalentPrice = 1 - effectivePrice
  // const equivalentAction = action === 'sell' 
  //   ? `Buy ${outcome === 'yes' ? labels.no.shortLabel : labels.yes.shortLabel} @ ${Math.round(equivalentPrice * 100)}¢`
  //   : null

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header with Buy/Sell + Order Type */}
      <div className="border-b border-border bg-card">
        <div className="flex items-center justify-between px-4">
          {/* Buy/Sell Toggle - Pill style */}
          <div className="flex items-center bg-muted/50 rounded-full p-0.5">
            <button
              onClick={() => setAction('buy')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full transition-all',
                action === 'buy'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Keyboard: B"
            >
              Buy
            </button>
            <button
              onClick={() => { if (hasPosition) setAction('sell') }}
              disabled={!hasPosition}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full transition-all',
                action === 'sell'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
                !hasPosition && 'opacity-40 cursor-not-allowed hover:text-muted-foreground',
                !hasPosition && positionLoading && 'animate-pulse'
              )}
              title={
                hasPosition
                  ? 'Keyboard: S'
                  : positionLoading
                    ? 'Loading your position…'
                    : !isWalletConnected
                      ? 'Connect your wallet to sell'
                      : 'No position to sell'
              }
            >
              Sell
            </button>

          </div>

          {/* Market/Limit Toggle - Pill style */}
          <div className="flex items-center bg-muted/50 rounded-full p-0.5">
            <button
              onClick={() => setOrderType('market')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full transition-all',
                orderType === 'market'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Keyboard: M"
            >
              Market
            </button>
            <button
              onClick={() => setOrderType('limit')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full transition-all',
                orderType === 'limit'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Keyboard: L"
            >
              Limit
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Outcome Selection */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setOutcome('yes')}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-200 font-semibold',
              'border-2 shadow-lg',
              orderType === 'market' ? 'py-5 px-4' : 'py-4 px-4',
              outcome === 'yes'
                ? hslColors.yes
                  ? 'scale-[1.02]'
                  : action === 'buy'
                    ? 'bg-gradient-to-b from-up to-[hsl(142,76%,28%)] border-[hsl(142,76%,45%)] text-white scale-[1.02] shadow-up/30'
                    : 'bg-gradient-to-b from-muted/80 to-muted/40 border-up text-up scale-[1.02] shadow-[0_0_24px_4px_hsl(var(--up)/0.55)]'
                : hslColors.yes
                  ? 'bg-gradient-to-b from-muted/80 to-muted/40 border-border text-muted-foreground hover:border-outcome-a/50 hover:scale-[1.01]'
                  : 'bg-gradient-to-b from-muted/80 to-muted/40 border-border text-muted-foreground hover:border-up/50 hover:scale-[1.01]',
              'active:scale-[0.98]'
            )}
            style={outcome === 'yes' ? getOutcomeButtonStyle(hslColors.yes) : undefined}
            title="Keyboard: Y"
          >
            <div className={cn(
              'absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center transition-all',
              outcome === 'yes' ? 'bg-white/20' : 'bg-transparent'
            )}>
              {outcome === 'yes' && <Check className="h-3 w-3" strokeWidth={3} style={{ color: 'currentColor' }} />}
            </div>
            <span className="text-lg">{action === 'buy' ? 'Buy' : 'Sell'} {labels.yes.label}</span>
            {orderType === 'market' && (
              <span className={cn(
                'text-xl font-bold',
                !hasLiquidityForYes ? 'text-muted-foreground text-sm' :
                outcome === 'yes' ? (hslColors.yes ? '' : action === 'sell' ? 'text-up' : 'text-white') : 'text-outcome-a'
              )}>
                {hasLiquidityForYes 
                  ? `${Math.round((action === 'buy' ? yesAskPrice : yesSellPrice) * 100)}¢`
                  : 'No liquidity'}
              </span>
            )}
          </button>
          <button
            onClick={() => setOutcome('no')}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-200 font-semibold',
              'border-2 shadow-lg',
              orderType === 'market' ? 'py-5 px-4' : 'py-4 px-4',
              outcome === 'no'
                ? hslColors.no
                  ? 'scale-[1.02]'
                  : action === 'buy'
                    ? 'bg-gradient-to-b from-down to-[hsl(0,84%,45%)] border-[hsl(0,84%,70%)] text-white scale-[1.02] shadow-down/30'
                    : 'bg-gradient-to-b from-muted/80 to-muted/40 border-down text-down scale-[1.02] shadow-[0_0_24px_4px_hsl(var(--down)/0.55)]'
                : hslColors.no
                  ? 'bg-gradient-to-b from-muted/80 to-muted/40 border-border text-muted-foreground hover:border-outcome-b/50 hover:scale-[1.01]'
                  : 'bg-gradient-to-b from-muted/80 to-muted/40 border-border text-muted-foreground hover:border-down/50 hover:scale-[1.01]',
              'active:scale-[0.98]'
            )}
            style={outcome === 'no' ? getOutcomeButtonStyle(hslColors.no) : undefined}
            title="Keyboard: N"
          >
            <div className={cn(
              'absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center transition-all',
              outcome === 'no' ? 'bg-white/20' : 'bg-transparent'
            )}>
              {outcome === 'no' && <Check className="h-3 w-3" strokeWidth={3} style={{ color: 'currentColor' }} />}
            </div>
            <span className="text-lg">{action === 'buy' ? 'Buy' : 'Sell'} {labels.no.label}</span>
            {orderType === 'market' && (
              <span className={cn(
                'text-xl font-bold',
                !hasLiquidityForNo ? 'text-muted-foreground text-sm' :
                outcome === 'no' ? (hslColors.no ? '' : action === 'sell' ? 'text-down' : 'text-white') : 'text-outcome-b'
              )}>
                {hasLiquidityForNo
                  ? `${Math.round((action === 'buy' ? noAskPrice : noSellPrice) * 100)}¢`
                  : 'No liquidity'}
              </span>
            )}
          </button>
        </div>

        {/* Position Display with Before/After (Sell Mode) */}
        {action === 'sell' && (
          <div className="bg-muted/40 border-2 border-primary/60 rounded-lg p-3 space-y-3">
            <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-background/40 border border-border/40 rounded-md px-2.5 py-1.5">
              <Info className="h-3.5 w-3.5 mt-px flex-shrink-0 text-primary" />
              <span>
                Selling places an order on the open market. You receive USDC when another trader matches your price.
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Your {(outcome === 'yes' ? labels.yes.shortLabel : labels.no.shortLabel)} Shares</p>
                  <p className="text-lg font-bold text-foreground">
                    {positionLoading && !hasPosition ? '...' : availableSellShares.toFixed(3)}
                  </p>
                </div>
              </div>
              {!canSell && !positionLoading && (
                <span className="text-xs text-amber-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  No shares
                </span>
              )}
            </div>

            {/* Quick Sell All Buttons */}
            {hasPosition && (qtyYes > 0 || qtyNo > 0) && (
              <div className="flex gap-2 pt-2 border-t border-border/50">
                {qtyYes > 0 && (
                  <button
                    onClick={() => {
                      setOutcome('yes')
                      setSharesInput(availableYesShares)
                    }}
                    className="flex-1 py-2 px-3 text-xs font-medium rounded-lg bg-outcome-a/10 text-outcome-a hover:bg-outcome-a/20 transition-colors border border-outcome-a/20"
                  >
                    Sell All {labels.yes.shortLabel} ({availableYesShares.toFixed(3)})
                  </button>
                )}
                {qtyNo > 0 && (
                  <button
                    onClick={() => {
                      setOutcome('no')
                      setSharesInput(availableNoShares)
                    }}
                    className="flex-1 py-2 px-3 text-xs font-medium rounded-lg bg-outcome-b/10 text-outcome-b hover:bg-outcome-b/20 transition-colors border border-outcome-b/20"
                  >
                    Sell All {labels.no.shortLabel} ({availableNoShares.toFixed(3)})
                  </button>
                )}
              </div>
            )}

            {shares > 0 && (
              <div className="bg-muted/30 border-2 border-primary/60 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-2">Secondary Trade Overview</p>
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-4 gap-1 pl-1">
                    <div className="text-center text-muted-foreground">Balance</div>
                    <div className="text-center text-muted-foreground">Open</div>
                    <div className="text-center text-muted-foreground">Avail</div>
                    <div className="text-center text-muted-foreground"><b>After</b></div>
                  </div>

                  <div className={`flex flex-col gap-0.5 ${outcome === 'no' ? 'opacity-50' : ''}`}>
                    <div className="text-outcome-a font-bold truncate" title={labels.yes.label}>{labels.yes.label}</div>
                    <div className="grid grid-cols-4 gap-1">
                      <div className="text-center font-bold">{qtyYes.toFixed(3)}</div>
                      <div className="text-center font-medium">{openSecondaryYes.toFixed(3)}</div>
                      <div className="text-center font-medium">{(qtyYes - openSecondaryYes).toFixed(3)}</div>
                      <div className={cn(
                        'text-center font-medium',
                        (shares < (qtyYes - openSecondaryYes)) ? 'text-blue-500 font-bold' : 'line-through decoration-2 text-purple-500'
                      )}>
                        {outcome !== 'no' && positionAfterYes.toFixed(3)}
                      </div>
                    </div>
                  </div>

                  <div className={`flex flex-col gap-0.5 ${outcome === 'yes' ? 'opacity-50' : ''}`}>
                    <div className="text-outcome-b font-bold truncate" title={labels.no.label}>{labels.no.label}</div>
                    <div className="grid grid-cols-4 gap-1">
                      <div className="text-center font-medium">{qtyNo.toFixed(3)}</div>
                      <div className="text-center font-medium">{openSecondaryNo.toFixed(3)}</div>
                      <div className="text-center font-medium">{(qtyNo - openSecondaryNo).toFixed(3)}</div>
                      <div className={cn(
                        'text-center font-medium',
                        (shares < (qtyNo - openSecondaryNo)) ? 'text-blue-500 font-bold' : 'line-through decoration-2 text-purple-500'
                      )}>
                        {outcome !== 'yes' && positionAfterNo.toFixed(3)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Buy Mode: Position Impact Preview (when has position) */}
        {action === 'buy' && hasPosition && shares > 0 && (
          <div className="bg-muted/30 border-2 border-primary/60 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-2">Position After Trade</p>
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 pl-1">
                <div className="text-center text-muted-foreground">Current</div>
                <div className="text-center text-muted-foreground">After</div>
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="text-outcome-a font-medium truncate" title={labels.yes.label}>{labels.yes.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center font-medium">{qtyYes.toFixed(3)}</div>
                  <div className={cn(
                    'text-center font-medium',
                    positionAfterYes > qtyYes ? 'text-up' : ''
                  )}>
                    {positionAfterYes.toFixed(3)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="text-outcome-b font-medium truncate" title={labels.no.label}>{labels.no.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center font-medium">{qtyNo.toFixed(3)}</div>
                  <div className={cn(
                    'text-center font-medium',
                    positionAfterNo > qtyNo ? 'text-up' : ''
                  )}>
                    {positionAfterNo.toFixed(3)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Amount/Shares Input */}
        {action === 'buy' ? (
          // Buy Mode: Amount in USD
          <div className="space-y-2">
            <Label className="text-muted-foreground text-lg font-medium">Order Amount (USD)</Label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-3xl font-bold text-foreground">$</span>
              <Input
                type="text"
                inputMode="decimal"
                value={amountDraft}
                onChange={(e) => {
                  const raw = e.target.value
                  setAmountDraft(raw)
                  if (raw === '') return
                  const value = Number(raw)
                  if (!Number.isFinite(value)) return
                  setAmountUsd(value > maxBuyAmount ? maxBuyAmount : value)
                }}
                onBlur={() => {
                  if (amountDraft === '' || !Number.isFinite(Number(amountDraft))) {
                    setAmountDraft(String(amountUsd))
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault()
                    const current = Number(amountUsd)
                    if (!Number.isFinite(current)) return
                    if (e.key === 'ArrowUp') {
                      const next = current + 1
                      setAmountUsd(hasLimits ? Math.min(next, maxBuyAmount) : next)
                    } else {
                      setAmountUsd(Math.max(0.10, current - 1))
                    }
                  }
                }}
                className="!text-3xl font-bold h-16 pl-12 pr-16 text-right [appearance:textfield]"
                min={0}
                step={1}
              />
              <div className="absolute right-2 flex flex-col gap-0.5">
                <button
                  type="button"
                  className="h-6 w-8 flex items-center justify-center rounded bg-muted hover:bg-muted-foreground/20 text-foreground text-xs font-bold"
                  tabIndex={-1}
                  onClick={() => {
                    const current = Number(amountUsd)
                    if (!Number.isFinite(current)) return
                    const next = current + 1
                    setAmountUsd(hasLimits ? Math.min(next, maxBuyAmount) : next)
                  }}
                >▲</button>
                <button
                  type="button"
                  className="h-6 w-8 flex items-center justify-center rounded bg-muted hover:bg-muted-foreground/20 text-foreground text-xs font-bold"
                  tabIndex={-1}
                  onClick={() => {
                    const current = Number(amountUsd)
                    if (!Number.isFinite(current)) return
                    setAmountUsd(Math.max(0.10, current - 1))
                  }}
                >▼</button>
              </div>
            </div>
            <div className="flex gap-2">
              {quickIncrements.map((increment) => (
                <button
                  key={increment}
                  onClick={() => {
                    const currentAmount = Number(amountUsd)
                    const newAmount = Math.ceil(currentAmount + increment)
                    if (hasLimits && newAmount > maxBuyAmount) {
                      if (currentAmount >= maxBuyAmount) {
                        toast.error(`Already at max ($${maxBuyAmount.toFixed(2)}). Increase your allowance to trade more.`)
                      } else {
                        setAmountUsd(maxBuyAmount)
                        toast(`Capped at your limit of $${maxBuyAmount.toFixed(2)}`, { icon: '⚠️' })
                      }
                    } else {
                      setAmountUsd(newAmount)
                    }
                  }}
                  className="flex-1 py-1.5 text-sm rounded-md border transition-colors border-primary/50 bg-background text-muted-foreground hover:border-primary"
                >
                  +{increment}
                </button>
              ))}
              <button
                onClick={() => {
                  if (hasLimits) {
                    setAmountUsd(maxBuyAmount)
                  } else {
                    toast.error('Connect wallet to see your max amount')
                  }
                }}
                disabled={!hasLimits}
                className={cn(
                  'flex-1 py-1.5 text-sm rounded-md border transition-colors',
                  !hasLimits
                    ? 'border-border bg-background text-muted-foreground/50 cursor-not-allowed'
                    : Number(amountUsd) === maxBuyAmount && maxBuyAmount > 0
                      ? 'border-primary bg-primary/10 text-primary hover:border-primary'
                      : 'border-primary/50 bg-background text-muted-foreground hover:border-primary'
                )}
              >
                {hasLimits ? '+Max' : 'Max'}
              </button>
            </div>
            {/* Available Balance - below amount input */}
            {isWalletConnected && (
              <div className="flex items-center justify-between text-sm pt-1">
                <span className="text-muted-foreground">Available Balance</span>
                <span className="font-semibold text-foreground">${usdcBalance.toFixed(2)}</span>
              </div>
            )}
          </div>
        ) : (
          // Sell Mode: Shares input
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">Shares to Sell</Label>
            <Input
              type="number"
              value={sharesInput}
              onChange={(e) => setSharesInput(Number(e.target.value))}
              className="text-lg font-semibold h-12"
              min={0}
              max={availableSellShares}
              step={0.01}
            />
            <div className="flex gap-2">
              {quickPercentages.map((pct) => (
                <button
                  key={pct}
                  onClick={() => setSharesInput(availableSellShares * (pct / 100))}
                  className={cn(
                    'flex-1 py-1.5 text-sm rounded-md border transition-colors',
                    'border-down/50 bg-background text-muted-foreground hover:border-down'
                  )}
                >
                  {pct === 100 ? 'Max' : `${pct}%`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Limit Price - only show for limit orders */}
        {orderType === 'limit' ? (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-lg font-medium">Limit Price</Label>
             <div className="relative flex items-center">
               <span className="absolute left-4 text-3xl font-bold text-foreground">¢</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={limitPriceInput}
                  onChange={(e) => {
                    const raw = e.target.value
                    setLimitPriceInput(raw)
                    if (raw === '') return
                    // Allow intermediate states like "26." while typing
                    if (!/^\d*\.?\d*$/.test(raw)) return
                    const parsed = parseFloat(raw)
                    if (isNaN(parsed)) return
                    const clamped = Math.max(0.1, Math.min(99.9, parsed))
                    // Snap to 0.1¢ resolution so users can type e.g. 26.5
                    const snappedCents = Math.round(clamped * 10) / 10
                    setLimitPrice(snappedCents / 100)
                  }}
                  onBlur={() => {
                    const parsed = parseFloat(limitPriceInput)
                    if (limitPriceInput === '' || isNaN(parsed)) {
                      setLimitPriceInput(String(Number((limitPrice * 100).toFixed(1))))
                    } else {
                      const clamped = Math.max(0.1, Math.min(99.9, parsed))
                      const snappedCents = Math.round(clamped * 10) / 10
                      setLimitPrice(snappedCents / 100)
                      setLimitPriceInput(String(snappedCents))
                    }
                  }}
                  onKeyDown={(e) => {
                     if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                       e.preventDefault()
                       setLimitPrice(stepLimitPrice(limitPrice, e.key === 'ArrowUp' ? 1 : -1))
                     }
                   }}
                  className="!text-3xl font-bold h-16 pl-12 pr-16 text-right [appearance:textfield]"
                />

                {/* Custom step buttons */}
                <div className="absolute right-2 flex flex-col gap-0.5">
                  <button
                    type="button"
                    className="h-6 w-8 flex items-center justify-center rounded bg-muted hover:bg-muted-foreground/20 text-foreground text-xs font-bold"
                    tabIndex={-1}
                     onClick={() => {
                       setLimitPrice(stepLimitPrice(limitPrice, 1))
                    }}
                  >▲</button>
                  <button
                    type="button"
                    className="h-6 w-8 flex items-center justify-center rounded bg-muted hover:bg-muted-foreground/20 text-foreground text-xs font-bold"
                    tabIndex={-1}
                     onClick={() => {
                       setLimitPrice(stepLimitPrice(limitPrice, -1))
                     }}
                  >▼</button>
                </div>
             </div>
             <p className="text-xs text-muted-foreground">
               Type any 0.1¢ value • Arrows step by 1¢ (0.1¢ near edges)
             </p>
          </div>
        ) : (
          <div className={cn(
            'border rounded-lg p-3',
            noLiquidityForMarket 
              ? 'bg-amber-500/10 border-amber-500/30' 
              : 'bg-muted/40 border-border'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {noLiquidityForMarket ? (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                ) : (
                  <Zap className="h-4 w-4 text-primary" />
                )}
                <span className="text-sm text-muted-foreground">
                  {noLiquidityForMarket ? 'No Liquidity' : 'Market Price'}
                </span>
              </div>
              {!noLiquidityForMarket && (
                <span className="text-lg font-bold text-foreground">
                  {Math.round(effectivePrice * 100)}¢
                </span>
              )}
            </div>
            {noLiquidityForMarket ? (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted-foreground">
                  No {outcome === 'yes' ? labels.no.shortLabel : labels.yes.shortLabel} orders available to match against. Place a limit order to set your price and wait for a counterparty.
                </p>
                <button
                  onClick={() => setOrderType('limit')}
                  className="w-full py-2 px-3 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Switch to Limit Order
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {action === 'buy' 
                  ? 'Executes immediately at the best available price'
                  : 'Sells at current market bid. Final price may vary.'}
              </p>
            )}
          </div>
        )}

        {/* Order Summary Panel */}
        <div className="bg-muted/30 rounded-lg overflow-hidden border border-border">
          <button
            onClick={() => setShowOrderSummary(!showOrderSummary)}
            className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm font-medium text-muted-foreground">Order Summary</span>
            {showOrderSummary ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {showOrderSummary && (
            <div className="px-3 pb-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Action</span>
                <span
                  className="font-medium"
                  style={{
                    color: hslColors[outcome]
                      ? `hsl(${hslColors[outcome]})`
                      : `hsl(var(${labels[outcome].colorVar}))`
                  }}
                >
                  {action === 'buy' ? 'Buy' : 'Sell'} {labels[outcome].shortLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Type</span>
                <span className="font-medium text-foreground capitalize">{orderType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price</span>
                <span className="font-medium text-foreground">{(effectivePrice * 100).toFixed(1)}¢</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shares</span>
                <span className="font-medium text-foreground">{shares.toFixed(3)}</span>
              </div>
              {action === 'buy' ? (
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-muted-foreground">You Pay</span>
                  <span className="font-bold text-foreground">${amountUsd.toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-muted-foreground">Est. Proceeds</span>
                  <span className="font-bold text-foreground">${estimatedProceeds.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Spending Allowance */}
        {action === 'buy' && isWalletConnected && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Spending Allowance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'font-semibold',
                  spenderAllowanceUsd > 0 ? 'text-up' : 'text-down'
                )}>
                  {spenderAllowanceUsd >= UNLIMITED_ALLOWANCE_USD * 0.99 ? '∞ Max' : `$${spenderAllowanceUsd.toFixed(2)}`}
                </span>
                <button
                  onClick={openAllowanceSidebar}
                  className="text-xs font-medium text-primary border border-primary/40 bg-primary/10 hover:bg-primary/20 rounded-full px-2.5 py-0.5 transition-colors"
                >
                  Manage
                </button>
              </div>
            </div>
            {market?.smartContractId && (
              <div className="flex items-center justify-between text-xs text-muted-foreground pl-6">
                <span>Contract ID:</span>
                <span className="font-mono">{market.smartContractId}</span>
              </div>
            )}
          </div>
        )}

        {/* Validation Error */}
        {effectiveValidationError && (
          <div className="flex items-center gap-2 text-sm text-down bg-down/10 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {effectiveValidationError.startsWith('Insufficient allowance') ? (
              <button
                onClick={openAllowanceSidebar}
                className="underline hover:text-down/80 transition-colors cursor-pointer text-left"
              >
                {effectiveValidationError}
              </button>
            ) : (
              <span>{effectiveValidationError}</span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {geoRestricted ? (
          <div className="w-full rounded-xl border border-border bg-muted/30 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-card-foreground">
              <Globe className="h-4 w-4 text-muted-foreground" />
              {t('geoBlock.title')}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {geoCountry
                ? t('geoBlock.tradingDetected', { country: geoCountry })
                : t('geoBlock.trading')}
            </p>
          </div>
        ) : !isWalletConnected ? (
          <button
            className="w-full py-4 rounded-xl font-semibold text-lg bg-primary text-primary-foreground flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors cursor-pointer"
            onClick={connect}
          >
            <Wallet className="h-5 w-5" />
            Connect Wallet to Trade
          </button>
        ) : !isSigned ? (
          isProcessing && processingStep === 'signing' ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={cancelSigning}
                  className="flex-1 py-4 rounded-xl font-semibold border border-border hover:bg-muted transition-colors flex items-center justify-center gap-2"
                >
                  <X className="h-5 w-5" />
                  Cancel
                </button>
                <button
                  disabled
                  className="flex-1 py-4 rounded-xl font-semibold text-base bg-muted text-muted-foreground flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Waiting for wallet…
                </button>
              </div>
              <SigningPatienceHint />
            </div>
          ) : (

            <button
              onClick={signOrder}
              disabled={!!effectiveValidationError || isProcessing || noLiquidityForMarket}
              className={cn(
                'w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all',
                noLiquidityForMarket
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : !effectiveValidationError && !isProcessing
                    ? action === 'buy'
                      ? 'bg-[var(--prism-yellow)] hover:opacity-90 text-black'
                      : 'bg-[hsl(0,84%,50%)] hover:bg-[hsl(0,84%,60%)] text-white'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              {noLiquidityForMarket ? (
                <>
                  <AlertCircle className="h-5 w-5" />
                  No Liquidity
                </>
              ) : isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {processingStep}
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Sign {action === 'buy' ? 'Buy' : 'Sell'} Order
                </>
              )}
            </button>
          )
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-up text-sm py-2">
              <CheckCircle2 className="h-4 w-4" />
              Order Signed
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelOrder}
                disabled={isProcessing}
                className="flex-1 py-3 rounded-xl font-semibold border border-border hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                onClick={async () => {
                  await submitOrder()
                  refreshPosition()
                }}
                disabled={isProcessing}
                className={cn(
                  'flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all',
                  isProcessing
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-[var(--prism-yellow)] hover:opacity-90 text-black'
                )}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {processingStep}
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4" />
                    Submit Order
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        
        {/* Terms disclaimer */}
        <p className="text-xs text-muted-foreground text-center mt-3">
          By trading, you agree to the{' '}
          <a href="/terms" className="underline hover:text-foreground transition-colors">
            terms of use
          </a>
          .
        </p>
      </div>
    </div>
  )
}

/**
 * Passive hint shown under the "Waiting for wallet…" state. After ~45s
 * we tell the user the request is still valid so they don't cancel and
 * duplicate-sign. No auto-retry, no auto-abort — copy only.
 */
function SigningPatienceHint() {
  const [showHint, setShowHint] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setShowHint(true), 45_000)
    return () => window.clearTimeout(t)
  }, [])
  if (!showHint) return null
  return (
    <p className="text-xs text-muted-foreground text-center px-2 leading-relaxed">
      HashPack is taking longer than usual. If you already approved, keep this open —
      the signature will arrive automatically.
    </p>
  )
}

export default TradePanel
