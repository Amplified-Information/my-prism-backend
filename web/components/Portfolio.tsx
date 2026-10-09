import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RefreshCw, TrendingUp, TrendingDown, Wallet, ArrowRight, Briefcase, History, CheckCircle, XCircle, ClipboardList, X, Loader2, Trophy, Tag, ChevronDown, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../src/components/ui/popover'
import { useMarketContext } from '../src/contexts/MarketContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../src/components/ui/card'
import { Button } from '../src/components/ui/button'
import { Skeleton } from '../src/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../src/components/ui/tabs'
import { Badge } from '../src/components/ui/badge'
import { usePortfolio, EnrichedPosition, OpenOrder } from '../lib/usePortfolio'
import { useWallet } from '../lib/useWallet'
import { useRedeem } from '../lib/useRedeem'
import { cn } from '../lib/utils'


import { CancelOrderDialog } from './CancelOrderDialog'
import { apiClient } from '../grpcClient'
import { submitSignedCancel } from '../lib/cancelOrder'
import { getUserAccountInfo } from '../lib/hedera'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import toast from 'react-hot-toast'
import { getMarketStatus, STATUS_BADGE_VARIANT, STATUS_LABEL } from '../lib/marketStatus'
import { MarketResponse } from '../gen/api'
import { getOutcomeStyles, getOutcomeColorVars } from '../lib/marketLabels'
import { usePrism } from '../lib/usePrism'
import { ClaimPrismDialog } from './ClaimPrismDialog'
import { RedeemWinningsDialog } from './RedeemWinningsDialog'
import { useLomAccountRewards, useLomMarketRewards } from '../lib/useLomRewards'
import { formatAge } from '../lib/formatAge'
import { showRewards } from '../env'


// $PRSM is a 6-decimal HTS token (scs/scripts/launchToken.ts).
const PRSM_DECIMALS = 6
const formatPrsm = (raw: bigint) =>
  (Number(raw) / 10 ** PRSM_DECIMALS).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatLomScore = (value: number) => {
  if (!value) return '0'
  return value >= 1000
    ? value.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : value.toFixed(2)
}

const PrsmStat = ({ label, value, loading, hint }: { label: string; value: bigint; loading: boolean; hint?: string }) => (
  <div className="rounded-lg border border-border bg-card p-3" title={hint}>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-lg font-semibold text-foreground mt-1">
      {loading ? <Skeleton className="h-6 w-20" /> : formatPrsm(value)}
    </div>
  </div>
)

interface RewardsListProps {
  marketIds: string[]
  scoreByMarket: Record<string, number>
  lastScoredAtByMarket: Record<string, string | undefined>
  statsByMarket: Record<string, { totalScore: number }>
  markets: (MarketResponse | undefined)[]
  onNavigate: (marketId: string) => void
}

/** Per-market Limit Order Mining breakdown for the connected account. */
const RewardsList = ({ marketIds, scoreByMarket, lastScoredAtByMarket, statsByMarket, markets, onNavigate }: RewardsListProps) => {
  const [sortDesc, setSortDesc] = useState(true)

  const titleById: Record<string, string> = {}
  for (const m of markets) {
    if (m?.marketId) titleById[m.marketId] = m.statement
  }

  const rows = [...marketIds].sort((a, b) => {
    const diff = (scoreByMarket[b] ?? 0) - (scoreByMarket[a] ?? 0)
    return sortDesc ? diff : -diff
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border">
            <th className="text-left font-medium py-2">Market</th>
            <th className="text-right font-medium py-2">
              <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSortDesc(s => !s)}>
                Your score
                <ChevronDown className={cn('w-3 h-3 transition-transform', !sortDesc && 'rotate-180')} />
              </button>
            </th>
            <th className="text-right font-medium py-2">Share</th>
            <th className="text-right font-medium py-2">Last scored</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(marketId => {
            const mine = scoreByMarket[marketId] ?? 0
            const total = statsByMarket[marketId]?.totalScore ?? 0
            return (
              <tr
                key={marketId}
                className="border-b border-border/50 hover:bg-muted/40 cursor-pointer"
                onClick={() => onNavigate(marketId)}
              >
                <td className="py-2 pr-3 max-w-[380px] truncate text-foreground">
                  {titleById[marketId] ?? `${marketId.slice(0, 8)}…`}
                </td>
                <td className="py-2 text-right font-medium text-foreground">{formatLomScore(mine)}</td>
                <td className="py-2 text-right text-muted-foreground">
                  {total > 0 ? `${((mine / total) * 100).toFixed(1)}%` : '—'}
                </td>
                <td className="py-2 text-right text-muted-foreground">{formatAge(lastScoredAtByMarket[marketId])}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const MarketStatusBadge = ({ market }: { market?: MarketResponse }) => {

  const status = getMarketStatus(market)
  return (
    <Badge variant={STATUS_BADGE_VARIANT[status]} className="text-[10px] px-1.5 py-0 uppercase">
      {STATUS_LABEL[status]}
    </Badge>
  )
}

const Portfolio = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { connect, isConnected } = useWallet()
  const { openPositions, resolvedPositions, openOrders: rawOpenOrders, summary, isLoading, error, refresh, rawPortfolio } = usePortfolio()
  // Personal rewards data — $PRSM balances plus this account's LOM scores.
  const { prismBalance, prismUnredeemed, prismRedeemable, isLoading: prismLoading, isConnected: prismConnected } = usePrism()
  const {
    scoreByMarket,
    lastScoredAtByMarket,
    marketIds: rewardMarketIds,
    totalScore: myTotalLomScore,
    isLoading: lomLoading,
  } = useLomAccountRewards()
  const { statsByMarket } = useLomMarketRewards(showRewards ? rewardMarketIds : [])
  // Hide orders whose market is missing or not active (resolved/closed/suspended) — they can't fill.
  const openOrders = rawOpenOrders.filter(o => !!o.market && getMarketStatus(o.market) === 'active')
  const visibleOpenOrderCount = openOrders.length
  const [orderToCancel, setOrderToCancel] = useState<{ marketId: string; order: OpenOrder } | null>(null)
  // Controlled so background portfolio/rewards refreshes can never reset the
  // visible tab (uncontrolled Radix Tabs lose their value on remount).
  const [activeTab, setActiveTab] = useState('orders')
  // Rows shown in the Active Positions tab (YES and NO split into separate rows).
  const splitRowCount = openPositions.reduce((count, pos) => {
    let c = count
    if (pos.qtyYes > 0) c++
    if (pos.qtyNo > 0) c++
    return c
  }, 0)


  const { signerZero, userAccountInfo } = useWalletContext()
  const { networkSelected } = useNetworkContext()

  const handleCancelOrder = async () => {
    if (!orderToCancel) return
    if (!signerZero) {
      toast.error('Connect your wallet to cancel an order')
      throw new Error('Wallet not connected')
    }
    // userAccountInfo is populated by a non-fatal mirror-node lookup on
    // connect (see lib/useWallet.ts). If that lookup failed silently the
    // wallet still shows as connected — fetch on-demand rather than
    // making the user reconnect.
    let userKey = userAccountInfo
    if (!userKey) {
      try {
        userKey = await getUserAccountInfo(networkSelected, signerZero.getAccountId().toString())
      } catch (e) {
        console.error('[Portfolio] mirror-node userAccountInfo fetch failed:', e)
        toast.error('Could not load account key from mirror node. Please try again.')
        throw new Error('userAccountInfo unavailable')
      }
    }
    try {
      await submitSignedCancel({
        marketId: orderToCancel.marketId,
        txId: orderToCancel.order.orderId,
        net: networkSelected.toString(),
        signer: signerZero,
        userKey,
      })
      toast.success('Order cancelled')
      refresh()
    } catch (err) {
      console.error('Failed to cancel order:', err)
      const message = String((err as Error)?.message || '')
      toast.error(
        /invalid signature|failed to verify signature|key.*mismatch|public key mismatch/i.test(message)
          ? 'Cancel verification failed. Please refresh and retry once.'
          : 'Failed to cancel order'
      )
      throw err
    }
  }

  // Fetch portfolio on mount and when wallet connects
  useEffect(() => {
    if (isConnected) {
      refresh()
    }
  }, [isConnected, refresh])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t('portfolio.title')}</CardTitle>
            <CardDescription>{t('portfolio.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={connect} size="lg" className="w-full">
              {t('wallet.connect')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('portfolio.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('portfolio.subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isLoading}
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{t('portfolio.errors.loadFailed')} {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Value */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('portfolio.summary.totalValue')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(summary.totalValue)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Unrealized P&L */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('portfolio.summary.unrealizedPnL', 'Unrealized P&L')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                <p className={cn(
                  "text-2xl font-bold",
                  summary.unrealizedPnL >= 0 ? "text-up" : "text-down"
                )}>
                  {formatCurrency(summary.unrealizedPnL)}
                </p>
                {summary.unrealizedPnL !== 0 && (
                  summary.unrealizedPnL >= 0 
                    ? <TrendingUp className="w-5 h-5 text-up" />
                    : <TrendingDown className="w-5 h-5 text-down" />
                )}
              </div>
            )}
            {!isLoading && (
              <p className="text-sm text-muted-foreground">
                {t('portfolio.summary.openPositions', '{{count}} open', { count: summary.openPositionCount })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Realized P&L */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('portfolio.summary.realizedPnL', 'Realized P&L')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                <p className={cn(
                  "text-2xl font-bold",
                  summary.realizedPnL >= 0 ? "text-up" : "text-down"
                )}>
                  {formatCurrency(summary.realizedPnL)}
                </p>
                {summary.realizedPnL !== 0 && (
                  summary.realizedPnL >= 0 
                    ? <TrendingUp className="w-5 h-5 text-up" />
                    : <TrendingDown className="w-5 h-5 text-down" />
                )}
              </div>
            )}
            {!isLoading && (
              <p className="text-sm text-muted-foreground">
                {t('portfolio.summary.resolvedPositions', '{{count}} resolved', { count: summary.resolvedPositionCount })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Position Count */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('portfolio.summary.positions', 'Positions')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-foreground">
                {summary.positionCount}
              </p>
            )}
            {!isLoading && (
              <p className="text-sm text-muted-foreground">
                {t('portfolio.summary.acrossMarkets', 'across {{count}} market(s)', { count: summary.marketCount })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Redeemable Winnings (resolved markets where the user holds winning shares) */}
      <RedeemableWinnings positions={resolvedPositions} onRedeemed={refresh} rawPortfolio={rawPortfolio} />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="orders" className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                {t('portfolio.tabs.orders', 'Open Orders')}
                {!isLoading && visibleOpenOrderCount > 0 && (
                  <Badge variant="secondary" className="ml-1">{visibleOpenOrderCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="holdings" className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                {t('portfolio.tabs.holdings', 'Active Positions')}
                {!isLoading && splitRowCount > 0 && (
                  <Badge variant="secondary" className="ml-1">{splitRowCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="w-4 h-4" />
                {t('portfolio.tabs.history', 'History')}
                {!isLoading && summary.resolvedPositionCount > 0 && (
                  <Badge variant="secondary" className="ml-1">{summary.resolvedPositionCount}</Badge>
                )}
              </TabsTrigger>
              {showRewards && (
                <TabsTrigger value="rewards" className="flex items-center gap-2">
                  <Trophy className="w-4 h-4" style={{ color: 'var(--prism-yellow)' }} />
                  {t('portfolio.tabs.rewards', 'Rewards')}
                  {!lomLoading && rewardMarketIds.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{rewardMarketIds.length}</Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>


        {/* Open Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                {t('portfolio.orders.title', 'Open Orders')}
              </CardTitle>
              <CardDescription>
                {t('portfolio.orders.description', 'Your pending orders waiting to be filled')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : openOrders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <ClipboardList className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-4">{t('portfolio.orders.empty', 'No open orders. Place an order on a market to see it here.')}</p>
                  <Button onClick={() => navigate('/explore')}>
                    {t('portfolio.empty.exploreMarkets', 'Explore Markets')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <GroupedOrdersList 
                  orders={openOrders} 
                  onNavigate={(id) => navigate(`/market/${id}`)} 
                  onRequestCancel={(marketId, order) => setOrderToCancel({ marketId, order })}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holdings Tab */}
        <TabsContent value="holdings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                {t('portfolio.holdings.title', 'Active Positions')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : openPositions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Briefcase className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-4">{t('portfolio.empty.message')}</p>
                  <Button onClick={() => navigate('/explore')}>
                    {t('portfolio.empty.exploreMarkets', 'Explore Markets')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <HoldingsList 
                  positions={openPositions} 
                  openOrders={openOrders}
                  onNavigate={(id) => navigate(`/market/${id}`)} 
                  onRequestCancel={(marketId, order) => setOrderToCancel({ marketId, order })}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                {t('portfolio.history.title', 'Resolved Positions')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : resolvedPositions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <History className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">{t('portfolio.empty.noHistory', 'No resolved positions yet. Your trading history will appear here once markets settle.')}</p>
                </div>
              ) : (
                <HistoryList 
                  positions={resolvedPositions} 
                  onNavigate={(id) => navigate(`/market/${id}`)} 
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rewards Tab */}
        {showRewards && (
        <TabsContent value="rewards">
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <PrsmStat label={t('portfolio.rewards.balance', '$PRSM Balance')} value={prismBalance} loading={prismLoading} />
              <PrsmStat label={t('portfolio.rewards.vesting', 'Vesting $PRSM')} value={prismUnredeemed} loading={prismLoading} hint="Earned but not yet allocated to you" />
              <PrsmStat label={t('portfolio.rewards.redeemable', 'Redeemable $PRSM')} value={prismRedeemable} loading={prismLoading} hint="Matured rewards tracked by the protocol" />
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-xs text-muted-foreground">{t('portfolio.rewards.yourScore', 'Your LOM Score')}</div>
                <div className="text-lg font-semibold text-foreground mt-1">
                  {lomLoading ? <Skeleton className="h-6 w-20" /> : formatLomScore(myTotalLomScore)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <ClaimPrismDialog amount={prismUnredeemed} isConnected={prismConnected} loading={prismLoading} size="sm" />
              <p className="text-xs text-muted-foreground">
                {t('portfolio.rewards.claimHint', 'Claiming sends your unclaimed $PRSM to your wallet on Hedera.')}
              </p>
            </div>



            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" style={{ color: 'var(--prism-yellow)' }} />
                  {t('portfolio.rewards.title', 'Limit Order Mining')}
                </CardTitle>
                <CardDescription>
                  {t('portfolio.rewards.description', 'Your mining score per market, scored hourly by the backend.')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lomLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : rewardMarketIds.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Trophy className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-4">
                      {t('portfolio.rewards.empty', 'No rewards scored yet. Place resting limit orders to start mining $PRSM.')}
                    </p>
                    <Button onClick={() => navigate('/explore')}>
                      {t('portfolio.empty.exploreMarkets', 'Explore Markets')}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                ) : (
                  <RewardsList
                    marketIds={rewardMarketIds}
                    scoreByMarket={scoreByMarket}
                    lastScoredAtByMarket={lastScoredAtByMarket}
                    statsByMarket={statsByMarket}
                    markets={[
                      ...openPositions.map(p => p.market),
                      ...resolvedPositions.map(p => p.market),
                      ...openOrders.map(o => o.market),
                    ]}
                    onNavigate={(id) => navigate(`/market/${id}`)}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        )}



          </Tabs>

      {/* Cancel Order Confirmation Dialog */}
      <CancelOrderDialog
        open={!!orderToCancel}
        onOpenChange={(open) => !open && setOrderToCancel(null)}
        onConfirm={handleCancelOrder}
        marketName={orderToCancel?.order.market?.statement}
        orderDetails={orderToCancel ? {
          side: orderToCancel.order.side,
          price: orderToCancel.order.priceUsd,
          qty: orderToCancel.order.qty
        } : undefined}
      />
    </div>
  )
}

interface GroupedOrdersListProps {
  orders: OpenOrder[]
  onNavigate: (marketId: string) => void
  onRequestCancel: (marketId: string, order: OpenOrder) => void
}

const GroupedOrdersList = ({ orders, onNavigate, onRequestCancel }: GroupedOrdersListProps) => {
  const { t } = useTranslation()
  type OrderSort = 'newest' | 'oldest' | 'priceHigh' | 'priceLow' | 'marketName'
  const [sort, setSort] = useState<OrderSort>('newest')

  // Group orders by marketId
  const grouped = orders.reduce((acc, order) => {
    if (!acc[order.marketId]) {
      acc[order.marketId] = {
        market: order.market,
        orders: []
      }
    }
    acc[order.marketId].orders.push(order)
    return acc
  }, {} as Record<string, { market?: OpenOrder['market'], orders: OpenOrder[] }>)

  // Sort groups
  const sortedEntries = Object.entries(grouped).sort(([, a], [, b]) => {
    switch (sort) {
      case 'newest': {
        const aMax = Math.max(...a.orders.map(o => o.generatedAt ? Date.parse(o.generatedAt) : 0))
        const bMax = Math.max(...b.orders.map(o => o.generatedAt ? Date.parse(o.generatedAt) : 0))
        return bMax - aMax
      }
      case 'oldest': {
        const aMax = Math.max(...a.orders.map(o => o.generatedAt ? Date.parse(o.generatedAt) : 0))
        const bMax = Math.max(...b.orders.map(o => o.generatedAt ? Date.parse(o.generatedAt) : 0))
        return aMax - bMax
      }
      case 'priceHigh': {
        const aMax = Math.max(...a.orders.map(o => o.priceUsd))
        const bMax = Math.max(...b.orders.map(o => o.priceUsd))
        return bMax - aMax
      }
      case 'priceLow': {
        const aMin = Math.min(...a.orders.map(o => o.priceUsd))
        const bMin = Math.min(...b.orders.map(o => o.priceUsd))
        return aMin - bMin
      }
      case 'marketName':
      default:
        return (a.market?.statement || '').localeCompare(b.market?.statement || '')
    }
  })

  // Sort orders within each group
  const getSortedOrders = (marketOrders: OpenOrder[]) => {
    switch (sort) {
      case 'newest':
        return [...marketOrders].sort((a, b) => {
          const aTs = a.generatedAt ? Date.parse(a.generatedAt) : 0
          const bTs = b.generatedAt ? Date.parse(b.generatedAt) : 0
          return bTs - aTs
        })
      case 'oldest':
        return [...marketOrders].sort((a, b) => {
          const aTs = a.generatedAt ? Date.parse(a.generatedAt) : 0
          const bTs = b.generatedAt ? Date.parse(b.generatedAt) : 0
          return aTs - bTs
        })
      case 'priceHigh':
        return [...marketOrders].sort((a, b) => b.priceUsd - a.priceUsd)
      case 'priceLow':
        return [...marketOrders].sort((a, b) => a.priceUsd - b.priceUsd)
      case 'marketName':
      default:
        return marketOrders
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <SortMenu<OrderSort>
          value={sort}
          onChange={setSort}
          options={[
            { value: 'newest', label: t('portfolio.orders.sortNewest', 'Newest first') },
            { value: 'oldest', label: t('portfolio.orders.sortOldest', 'Oldest first') },
            { value: 'priceHigh', label: t('portfolio.orders.sortPriceHigh', 'Price: high to low') },
            { value: 'priceLow', label: t('portfolio.orders.sortPriceLow', 'Price: low to high') },
            { value: 'marketName', label: t('portfolio.orders.sortMarketName', 'Market name') },
          ]}
        />
      </div>
      {sortedEntries.map(([marketId, { market, orders: marketOrders }]) => {
        const labels = getOutcomeStyles(market)
        // Dynamic SIDE column width: fits the longest outcome label in this market.
        const sideColCh = Math.max(4, labels.yes.label.length, labels.no.label.length)
        const sideColStyle = { minWidth: `${sideColCh}ch` }
        const displayOrders = getSortedOrders(marketOrders)
        return (
        <div
          key={marketId}
          className="rounded-lg border border-border/50 overflow-hidden"
          style={getOutcomeColorVars(market)}
        >
          {/* Market Header */}
          <div 
            className="flex items-center gap-3 px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => onNavigate(marketId)}
          >
            <p className="text-sm font-medium text-foreground truncate flex-1">
              {market?.statement || marketId.slice(0, 8) + '...'}
            </p>
            <MarketStatusBadge market={market} />
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
              {marketOrders.length} order{marketOrders.length > 1 ? 's' : ''}
            </Badge>
          </div>
          {/* Column Headers */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/10 border-b border-border/30 text-[10px] font-medium text-muted-foreground uppercase">
            <span className="w-10">Type</span>
            <span style={sideColStyle}>Side</span>
            <span className="w-16 text-right">Price</span>
            <span className="w-14 text-right">Qty</span>
            <span className="w-16 text-right">Total</span>
            <span className="w-8 text-right"></span>
          </div>
          {/* Orders */}
          <div className="divide-y divide-border/30">
            {displayOrders.map((order) => (
              <OrderRow 
                key={order.orderId} 
                order={order} 
                market={market}
                sideColStyle={sideColStyle}
                onCancel={() => onRequestCancel(marketId, order)}
              />
            ))}
          </div>
        </div>
        )
      })}
    </div>
  )
}

interface OrderRowProps {
  order: OpenOrder
  market?: MarketResponse
  sideColStyle?: React.CSSProperties
  onCancel: () => void
}

const OrderRow = ({ order, market, sideColStyle, onCancel }: OrderRowProps) => {
  const total = order.priceUsd * order.qty
  const isBuy = order.action === 'buy'
  const isYes = order.outcome === 'yes'
  const labels = getOutcomeStyles(market)
  const outcomeLabel = isYes ? labels.yes.label : labels.no.label

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-l-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors">
      {/* Type — Buy/Sell */}
      <span className={cn("w-10 text-xs font-bold", isBuy ? "text-blue-400" : "text-yellow-400")}>
        {isBuy ? 'Buy' : 'Sell'}
      </span>
      {/* Side — outcome label (dynamic width) */}
      <span
        className={cn("text-xs font-bold whitespace-nowrap", isYes ? "text-outcome-a" : "text-outcome-b")}
        style={sideColStyle}
        title={outcomeLabel}
      >
        {outcomeLabel}
      </span>
      {/* Price */}
      <span className="w-16 text-right text-xs font-mono">
        {Math.round(order.priceUsd * 100)}¢
      </span>
      {/* Qty */}
      <span className="w-14 text-right text-xs font-mono text-muted-foreground">
        {order.qty.toFixed(3)}
      </span>
      {/* Total */}
      <span className="w-16 text-right text-xs font-mono font-medium">
        ${total.toFixed(2)}
      </span>
      {/* Cancel */}
      <div className="w-8 flex justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onCancel()
          }}
          className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"
          title="Cancel order"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// Holdings List Component - matches History tab layout
interface HoldingsListProps {
  positions: EnrichedPosition[]
  openOrders: OpenOrder[]
  onNavigate: (marketId: string) => void
  onRequestCancel?: (marketId: string, order: OpenOrder) => void
}

interface PositionRow {
  marketId: string
  market?: EnrichedPosition['market']
  side: 'YES' | 'NO'
  qty: number
  avgPrice: number
  currentPrice: number
  cost: number
  marketValue: number
  unrealizedPnL: number
  pnlPercent: number
  costBasisAvailable: boolean
}

const HoldingsList = ({ positions, openOrders, onNavigate, onRequestCancel }: HoldingsListProps) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { categories } = useMarketContext()
  type HoldingsSort = 'valueHigh' | 'valueLow' | 'marketName' | 'newest' | 'oldest'
  const [sort, setSort] = useState<HoldingsSort>('valueHigh')

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(value)

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  const categoryName = (ids?: number[]) => {
    if (!ids || ids.length === 0) return null
    const cat = categories.find(c => c.id === ids[0])
    return cat?.name ?? null
  }

  // Aggregate open sell orders by `${marketId}-${side}` for quick lookup.
  // Computed up-front so splitPositions can include escrowed shares as rows.
  const sellOrderMap = openOrders.reduce((acc, o) => {
    if (o.action !== 'sell') return acc
    const key = `${o.marketId}-${o.outcome.toUpperCase()}`
    const cur = acc.get(key) ?? { count: 0, qty: 0, prices: [] as number[] }
    cur.count += 1
    cur.qty += o.qty
    cur.prices.push(o.priceUsd)
    acc.set(key, cur)
    return acc
  }, new Map<string, { count: number; qty: number; prices: number[] }>())

  // Split positions into individual YES/NO rows.
  // The portfolio API position quantities already include shares reserved by
  // open sell orders, so do not add escrowed order qty here. Separate synthetic
  // rows below still cover the edge case where only open sell orders are present.
  //
  // "Wash" positions — where matching trades net qtyYes and qtyNo to zero —
  // are still surfaced as a single 0-share row so the user can see the market
  // in Active Positions even when both sides fully offset.
  const splitPositions = (position: EnrichedPosition): PositionRow[] => {
    const rows: PositionRow[] = []
    const totalYes = position.qtyYes
    const totalNo  = position.qtyNo
    if (totalYes > 0) {
      const value = totalYes * position.currentYesBidPrice
      const cost = totalYes * position.avgPriceYes
      const pnl = value - cost
      rows.push({
        marketId: position.marketId, market: position.market, side: 'YES',
        qty: totalYes, avgPrice: position.avgPriceYes,
        currentPrice: position.currentYesBidPrice, cost,
        marketValue: value, unrealizedPnL: pnl,
        pnlPercent: cost > 0 ? (pnl / cost) * 100 : 0,
        costBasisAvailable: position.costBasisAvailable
      })
    }
    if (totalNo > 0) {
      const value = totalNo * position.currentNoBidPrice
      const cost = totalNo * position.avgPriceNo
      const pnl = value - cost
      rows.push({
        marketId: position.marketId, market: position.market, side: 'NO',
        qty: totalNo, avgPrice: position.avgPriceNo,
        currentPrice: position.currentNoBidPrice, cost,
        marketValue: value, unrealizedPnL: pnl,
        pnlPercent: cost > 0 ? (pnl / cost) * 100 : 0,
        costBasisAvailable: position.costBasisAvailable
      })
    }
    // Wash: both sides zero. Show a placeholder YES row with 0 qty so the
    // market still appears in Active Positions.
    if (rows.length === 0) {
      const cost = position.totalCost
      rows.push({
        marketId: position.marketId, market: position.market, side: 'YES',
        qty: 0, avgPrice: 0,
        currentPrice: position.currentYesBidPrice, cost,
        marketValue: 0, unrealizedPnL: -cost,
        pnlPercent: 0,
        costBasisAvailable: position.costBasisAvailable
      })
    }
    return rows
  }


  const groupedByMarket = positions.reduce((acc, position) => {
    const rows = splitPositions(position)
    if (rows.length === 0) return acc
    if (!acc[position.marketId]) {
      acc[position.marketId] = { market: position.market, rows: [] }
    }
    acc[position.marketId].rows.push(...rows)
    return acc
  }, {} as Record<string, { market?: EnrichedPosition['market'], rows: PositionRow[] }>)

  // Synthesize rows for markets that have open sell orders but no position
  // record (every share escrowed and backend dropped the row). Pulls market
  // metadata off the OpenOrder. Price-based columns fall back to 0 / "—".
  const positionMarketIds = new Set(positions.map(p => p.marketId))
  for (const o of openOrders) {
    if (o.action !== 'sell') continue
    if (positionMarketIds.has(o.marketId)) continue
    if (groupedByMarket[o.marketId]) {
      const side = o.outcome.toUpperCase() as 'YES' | 'NO'
      if (groupedByMarket[o.marketId].rows.some(r => r.side === side)) continue
    }
    const side = o.outcome.toUpperCase() as 'YES' | 'NO'
    const escrowQty = sellOrderMap.get(`${o.marketId}-${side}`)?.qty ?? o.qty
    const row: PositionRow = {
      marketId: o.marketId,
      market: o.market,
      side,
      qty: escrowQty,
      avgPrice: 0,
      currentPrice: 0,
      cost: 0,
      marketValue: 0,
      unrealizedPnL: 0,
      pnlPercent: 0,
      costBasisAvailable: false,
    }
    if (!groupedByMarket[o.marketId]) {
      groupedByMarket[o.marketId] = { market: o.market, rows: [] }
    }
    groupedByMarket[o.marketId].rows.push(row)
  }

  // Sort market groups
  const sortedMarketEntries = Object.entries(groupedByMarket).sort(([, a], [, b]) => {
    const aValue = a.rows.reduce((s, r) => s + r.marketValue, 0)
    const bValue = b.rows.reduce((s, r) => s + r.marketValue, 0)
    switch (sort) {
      case 'valueHigh': return bValue - aValue
      case 'valueLow': return aValue - bValue
      case 'newest': {
        const aTs = a.market?.createdAt ? Date.parse(a.market.createdAt) : 0
        const bTs = b.market?.createdAt ? Date.parse(b.market.createdAt) : 0
        return bTs - aTs
      }
      case 'oldest': {
        const aTs = a.market?.createdAt ? Date.parse(a.market.createdAt) : 0
        const bTs = b.market?.createdAt ? Date.parse(b.market.createdAt) : 0
        return aTs - bTs
      }
      case 'marketName':
      default: return (a.market?.statement || '').localeCompare(b.market?.statement || '')
    }
  })

  // Summary across all rows. Cost / P&L are only meaningful if every row
  // has cost-basis data; today the backend doesn't expose it (see
  // usePortfolio) so we render "—" instead of a misleading $0.00.
  const allRows = Object.values(groupedByMarket).flatMap(g => g.rows)
  const costBasisAvailable = allRows.length > 0 && allRows.every(r => r.costBasisAvailable)
  const totalCost = allRows.reduce((s, r) => s + r.cost, 0)
  const totalValue = allRows.reduce((s, r) => s + r.marketValue, 0)
  const totalPnL = allRows.reduce((s, r) => s + r.unrealizedPnL, 0)


  const handleSell = (marketId: string, side: 'YES' | 'NO', qty: number) => {
    navigate(`/market/${marketId}?action=sell&outcome=${side.toLowerCase()}&shares=${qty}`)
  }

  const costBasisTooltip = t(
    'portfolio.holdings.costBasisUnavailable',
    'Cost basis is not yet exposed by the backend, so average entry price and P&L cannot be computed.'
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SortMenu<HoldingsSort>
          value={sort}
          onChange={setSort}
          options={[
            { value: 'valueHigh', label: t('portfolio.holdings.sortValueHigh', 'Value: high to low') },
            { value: 'valueLow', label: t('portfolio.holdings.sortValueLow', 'Value: low to high') },
            { value: 'newest', label: t('portfolio.holdings.sortNewest', 'Newest first') },
            { value: 'oldest', label: t('portfolio.holdings.sortOldest', 'Oldest first') },
            { value: 'marketName', label: t('portfolio.holdings.sortMarketName', 'Market name') },
          ]}
        />
      </div>
      {/* Summary strip — mirrors History */}
      <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-muted/20 border border-border/40 text-xs flex-wrap">
        <span className="text-muted-foreground">
          {t('portfolio.holdings.cost', 'Cost')}:{' '}
          <span
            className="font-bold font-mono text-foreground"
            title={costBasisAvailable ? undefined : costBasisTooltip}
          >
            {costBasisAvailable ? formatCurrency(totalCost) : '—'}
          </span>
        </span>
        <span className="text-muted-foreground">
          {t('portfolio.holdings.value', 'Value')}:{' '}
          <span className="font-bold font-mono text-foreground">{formatCurrency(totalValue)}</span>
        </span>
        <span className="ml-auto text-muted-foreground">
          {t('portfolio.holdings.unrealized', 'Unrealized P&L')}:{' '}
          <span
            className={cn(
              "font-bold font-mono",
              costBasisAvailable ? (totalPnL >= 0 ? "text-up" : "text-down") : "text-foreground"
            )}
            title={costBasisAvailable ? undefined : costBasisTooltip}
          >
            {costBasisAvailable ? formatCurrency(totalPnL) : '—'}
          </span>
        </span>
      </div>

      <div className="space-y-3">
        {sortedMarketEntries.map(([marketId, { market, rows }]) => {
          const cat = categoryName(market?.categoryIds)
          const groupLabels = getOutcomeStyles(market)
          const sideColCh = Math.max(4, groupLabels.yes.label.length, groupLabels.no.label.length)
          const sideColStyle = { minWidth: `${sideColCh}ch` }
          return (
            <div key={marketId} className="rounded-lg border border-border/50 overflow-hidden" style={getOutcomeColorVars(market)}>
              {/* Market Header */}
              <div
                className="flex items-center gap-2 px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onNavigate(marketId)}
              >
                <p className="text-sm font-medium text-foreground truncate flex-1">
                  {market?.statement || marketId.slice(0, 8) + '...'}
                </p>
                {cat && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px]">
                    <Tag className="w-2.5 h-2.5" />
                    {cat}
                  </span>
                )}
                <MarketStatusBadge market={market} />
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                  {rows.length} {rows.length > 1 ? t('portfolio.holdings.positions', 'positions') : t('portfolio.holdings.position', 'position')}
                </Badge>
              </div>
              {/* Column Headers — same widths as History */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/10 border-b border-border/30 text-[10px] font-medium text-muted-foreground uppercase">
                <span style={sideColStyle}>{t('portfolio.history.colSide', 'Side')}</span>
                <span className="w-16 text-right">{t('portfolio.history.colShares', 'Shares')}</span>
                <span className="w-12 text-right">{t('portfolio.history.colAvg', 'Avg')}</span>
                <span className="w-16 text-right">{t('portfolio.history.colCost', 'Cost')}</span>
                <span className="w-12 text-right">{t('portfolio.holdings.colNow', 'Now')}</span>
                <span className="w-16 text-right">{t('portfolio.holdings.colValue', 'Value')}</span>
                <span className="flex-1 text-right">{t('portfolio.history.colPnl', 'P&L')}</span>
                <span className="w-14 text-right"></span>
              </div>
              {/* Position Rows */}
              <div className="divide-y divide-border/30">
                {rows.map((row, idx) => {
                  const sideLabel = row.side === 'YES' ? groupLabels.yes.label : groupLabels.no.label
                  return (
                  <div
                    key={`${row.marketId}-${row.side}-${idx}`}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 border-l-2 transition-colors",
                      row.side === 'YES'
                        ? "border-outcome-a bg-outcome-a/5 hover:bg-outcome-a/10"
                        : "border-outcome-b bg-outcome-b/5 hover:bg-outcome-b/10"
                    )}
                  >
                    {/* Side — outcome label (dynamic width, matches Open Orders style) */}
                    <span
                      className={cn(
                        "text-xs font-bold whitespace-nowrap",
                        row.side === 'YES' ? "text-outcome-a" : "text-outcome-b"
                      )}
                      style={sideColStyle}
                      title={sideLabel}
                    >
                      {sideLabel}
                    </span>
                    {/* Shares */}
                    <span className="w-16 text-right text-xs font-mono">{row.qty.toFixed(3)}</span>
                    {/* Avg */}
                    <span
                      className="w-12 text-right text-xs font-mono text-muted-foreground"
                      title={row.costBasisAvailable ? undefined : costBasisTooltip}
                    >
                      {row.costBasisAvailable ? `${Math.round(row.avgPrice * 100)}¢` : '—'}
                    </span>
                    {/* Cost */}
                    <span
                      className="w-16 text-right text-xs font-mono text-muted-foreground"
                      title={row.costBasisAvailable ? undefined : costBasisTooltip}
                    >
                      {row.costBasisAvailable ? formatCurrency(row.cost) : '—'}
                    </span>
                    {/* Now */}
                    <span className="w-12 text-right text-xs font-mono">
                      {Math.round(row.currentPrice * 100)}¢
                    </span>
                    {/* Value */}
                    <span className="w-16 text-right text-xs font-mono font-medium">
                      {formatCurrency(row.marketValue)}
                    </span>
                    {/* P&L */}
                    <div
                      className="flex-1 text-right"
                      title={row.costBasisAvailable ? undefined : costBasisTooltip}
                    >
                      {row.costBasisAvailable ? (
                        <>
                          <span className={cn(
                            "text-xs font-mono font-medium",
                            row.unrealizedPnL >= 0 ? "text-up" : "text-down"
                          )}>
                            {formatCurrency(row.unrealizedPnL)}
                          </span>
                          <span className={cn(
                            "text-[10px] ml-1",
                            row.pnlPercent >= 0 ? "text-up" : "text-down"
                          )}>
                            ({formatPercent(row.pnlPercent)})
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground">—</span>
                      )}
                    </div>
                    {/* Sell button */}
                    <div className="w-14 flex justify-end">
                      {(() => {
                        const status = getMarketStatus(row.market)
                        const sellInfo = sellOrderMap.get(`${row.marketId}-${row.side}`)
                        const allSelling = !!sellInfo && sellInfo.qty >= row.qty - 0.001
                        if (allSelling) return null
                        const tradable = status === 'active' && row.qty > 0
                        const tooltip = !tradable
                          ? (row.qty <= 0 ? 'No shares to sell' : `Market ${STATUS_LABEL[status].toLowerCase()}`)
                          : 'Sell on the open market'
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (tradable) handleSell(row.marketId, row.side, row.qty)
                            }}
                            disabled={!tradable}
                            title={tooltip}
                            className={cn(
                              "px-2 py-1 text-[10px] font-bold rounded transition-colors border",
                              tradable
                                ? "bg-down/10 text-down border-down/30 hover:bg-down/20"
                                : "bg-muted/10 text-muted-foreground/50 border-muted/30 cursor-not-allowed opacity-50"
                            )}
                          >
                            Sell
                          </button>
                        )
                      })()}
                    </div>
                    {/* Open sell-order indicator */}
                    {(() => {
                      const sellInfo = sellOrderMap.get(`${row.marketId}-${row.side}`)
                      if (!sellInfo) return null
                      const matchingOrders = openOrders.filter(o =>
                        o.marketId === row.marketId &&
                        o.action === 'sell' &&
                        o.outcome === row.side.toLowerCase()
                      )
                      const handleCancel = () => {
                        if (!onRequestCancel || matchingOrders.length === 0) return
                        onRequestCancel(row.marketId, matchingOrders[0])
                      }
                      const minPrice = Math.min(...sellInfo.prices)
                      const maxPrice = Math.max(...sellInfo.prices)
                      const priceLabel = minPrice === maxPrice
                        ? `${Math.round(minPrice * 100)}¢`
                        : `${Math.round(minPrice * 100)}–${Math.round(maxPrice * 100)}¢`
                      return (
                        <span
                          title={`${sellInfo.count} open sell order${sellInfo.count > 1 ? 's' : ''} totaling ${sellInfo.qty.toFixed(3)} shares @ ${priceLabel}`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[hsl(45,100%,51%)]/15 text-[hsl(45,100%,60%)] border border-[hsl(45,100%,51%)]/30"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          Selling {sellInfo.qty.toFixed(3)} @ {priceLabel}
                          {onRequestCancel && matchingOrders.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCancel()
                              }}
                              className="ml-0.5 p-0.5 rounded hover:bg-[hsl(45,100%,51%)]/30 text-[hsl(45,100%,60%)] transition-colors"
                              title="Cancel sell order"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </span>
                      )
                    })()}
                  </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Themed dropdown matching site styling
interface SortMenuProps<T extends string> {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}

function SortMenu<T extends string>({ value, onChange, options }: SortMenuProps<T>) {
  const [open, setOpen] = useState(false)
  const current = options.find(o => o.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 text-xs bg-muted/20 hover:bg-muted/40 border border-border/40 rounded-md px-2.5 py-1 text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-primary/40"
        >
          <span>{current?.label}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        {options.map(opt => {
          const selected = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-2 py-1.5 text-xs rounded-sm transition-colors text-left",
                selected
                  ? "bg-primary/15 text-primary"
                  : "text-foreground hover:bg-muted/40"
              )}
            >
              <span>{opt.label}</span>
              {selected && <Check className="w-3.5 h-3.5" />}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}

interface HistoryListProps {
  positions: EnrichedPosition[]
  onNavigate: (marketId: string) => void
}

interface HistoryRow {
  marketId: string
  position: EnrichedPosition
  side: 'YES' | 'NO'
  qty: number
  avg: number
  cost: number
  payout: number
  pnl: number
  pnlPercent: number
  won: boolean
  resolvedAt?: string
  resolvedTs: number
}

type HistoryFilter = 'all' | 'won' | 'lost'
type HistorySort = 'recent' | 'oldest' | 'biggestWin' | 'biggestLoss' | 'largest'
type HistoryTimeframe = 'all' | '24h' | '7d' | '30d' | '90d'

// Platform rake: a flat 2% across all markets, applied by the backend at
// redemption time. Not a per-market value — no proto field is expected.
const RAKE_PCT = 0.02

const getMarketRakePct = (_market?: EnrichedPosition['market']): number => RAKE_PCT


const TIMEFRAME_MS: Record<HistoryTimeframe, number | null> = {
  all: null,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
}


const HistoryList = ({ positions, onNavigate }: HistoryListProps) => {
  const { t } = useTranslation()
  const { categories } = useMarketContext()
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [sort, setSort] = useState<HistorySort>('recent')
  const [timeframe, setTimeframe] = useState<HistoryTimeframe>('all')

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(value)

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr || dateStr.startsWith('0001-01-01')) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  // Build split rows: one per side held.
  // Payout shown is NET of platform rake (gross winnings * (1 - rakePct)).
  // Losing sides have gross = 0, so net is also 0. P&L uses the net payout.
  const allRows: HistoryRow[] = []
  for (const p of positions) {
    const resolvedTs = p.resolvedAt ? Date.parse(p.resolvedAt) : 0
    const rakePct = getMarketRakePct(p.market)
    if (p.qtyYes > 0) {
      const cost = p.qtyYes * p.avgPriceYes
      // CANCELLED (EmergClose5050) pays $0.50/share on both sides.
      const grossPayout = p.resolution === 'YES' ? p.qtyYes : p.resolution === 'CANCELLED' ? p.qtyYes * 0.5 : 0
      const payout = grossPayout * (1 - rakePct)
      const pnl = payout - cost
      allRows.push({
        marketId: p.marketId, position: p, side: 'YES',
        qty: p.qtyYes, avg: p.avgPriceYes, cost, payout, pnl,
        pnlPercent: cost > 0 ? (pnl / cost) * 100 : 0,
        won: payout > 0, resolvedAt: p.resolvedAt,
        resolvedTs: isNaN(resolvedTs) ? 0 : resolvedTs
      })
    }
    if (p.qtyNo > 0) {
      const cost = p.qtyNo * p.avgPriceNo
      const grossPayout = p.resolution === 'NO' ? p.qtyNo : p.resolution === 'CANCELLED' ? p.qtyNo * 0.5 : 0
      const payout = grossPayout * (1 - rakePct)
      const pnl = payout - cost
      allRows.push({
        marketId: p.marketId, position: p, side: 'NO',
        qty: p.qtyNo, avg: p.avgPriceNo, cost, payout, pnl,
        pnlPercent: cost > 0 ? (pnl / cost) * 100 : 0,
        won: payout > 0, resolvedAt: p.resolvedAt,
        resolvedTs: isNaN(resolvedTs) ? 0 : resolvedTs
      })
    }
  }


  // Summary across all rows (not filtered)
  // A row counts as "lost" whenever the side received zero payout (losing side
  // of a resolved market). Cost basis is not currently exposed by the backend,
  // so we must NOT gate on `r.cost > 0` — that would always be false and hide
  // every lost row from both the count and the Lost filter.
  const wonCount = allRows.filter(r => r.won).length
  const lostCount = allRows.filter(r => !r.won).length
  const netRealized = allRows.reduce((s, r) => s + r.pnl, 0)

  // Filter by timeframe (based on resolved timestamp)
  const tfWindow = TIMEFRAME_MS[timeframe]
  const nowTs = Date.now()
  const filtered = allRows.filter(r => {
    if (filter === 'won' && !r.won) return false
    if (filter === 'lost' && r.won) return false
    if (tfWindow !== null) {
      if (!r.resolvedTs || nowTs - r.resolvedTs > tfWindow) return false
    }
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'oldest': return a.resolvedTs - b.resolvedTs
      case 'biggestWin': return b.pnl - a.pnl
      case 'biggestLoss': return a.pnl - b.pnl
      case 'largest': return b.cost - a.cost
      case 'recent':
      default: return b.resolvedTs - a.resolvedTs
    }
  })

  // Group sorted rows by market for display, preserving sort order via first-seen index
  const groupOrder: string[] = []
  const groups: Record<string, HistoryRow[]> = {}
  for (const r of sorted) {
    if (!groups[r.marketId]) {
      groups[r.marketId] = []
      groupOrder.push(r.marketId)
    }
    groups[r.marketId].push(r)
  }

  const categoryName = (ids?: number[]) => {
    if (!ids || ids.length === 0) return null
    const cat = categories.find(c => c.id === ids[0])
    return cat?.name ?? null
  }

  const filterChip = (val: HistoryFilter, label: string) => (
    <button
      key={val}
      onClick={() => setFilter(val)}
      className={cn(
        "px-2.5 py-1 text-xs rounded-full border transition-colors",
        filter === val
          ? "bg-primary/20 text-primary border-primary/40"
          : "bg-muted/20 text-muted-foreground border-border/40 hover:bg-muted/40"
      )}
    >
      {label}
    </button>
  )

  const timeframeChip = (val: HistoryTimeframe, label: string) => (
    <button
      key={val}
      onClick={() => setTimeframe(val)}
      className={cn(
        "px-2.5 py-1 text-xs rounded-full border transition-colors",
        timeframe === val
          ? "bg-primary/20 text-primary border-primary/40"
          : "bg-muted/20 text-muted-foreground border-border/40 hover:bg-muted/40"
      )}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      {/* Controls + Summary */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {filterChip('all', t('portfolio.history.filterAll', 'All'))}
          {filterChip('won', t('portfolio.history.filterWon', 'Won'))}
          {filterChip('lost', t('portfolio.history.filterLost', 'Lost'))}
          <span className="mx-1 h-4 w-px bg-border/60" />
          {timeframeChip('all', t('portfolio.history.tfAll', 'All time'))}
          {timeframeChip('24h', t('portfolio.history.tf24h', '24h'))}
          {timeframeChip('7d', t('portfolio.history.tf7d', '7d'))}
          {timeframeChip('30d', t('portfolio.history.tf30d', '30d'))}
          {timeframeChip('90d', t('portfolio.history.tf90d', '90d'))}
        </div>
        <SortMenu<HistorySort>
          value={sort}
          onChange={setSort}
          options={[
            { value: 'recent', label: t('portfolio.history.sortRecent', 'Most recent') },
            { value: 'oldest', label: t('portfolio.history.sortOldest', 'Oldest') },
            { value: 'biggestWin', label: t('portfolio.history.sortBiggestWin', 'Biggest win') },
            { value: 'biggestLoss', label: t('portfolio.history.sortBiggestLoss', 'Biggest loss') },
            { value: 'largest', label: t('portfolio.history.sortLargest', 'Largest position') },
          ]}
        />
      </div>


      {/* Summary strip */}
      <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-muted/20 border border-border/40 text-xs flex-wrap">
        <span className="flex items-center gap-1 text-up">
          <CheckCircle className="w-3.5 h-3.5" />
          <span className="font-semibold">{wonCount}</span>
          <span className="text-muted-foreground">{t('portfolio.history.won', 'Won')}</span>
        </span>
        <span className="flex items-center gap-1 text-down">
          <XCircle className="w-3.5 h-3.5" />
          <span className="font-semibold">{lostCount}</span>
          <span className="text-muted-foreground">{t('portfolio.history.lost', 'Lost')}</span>
        </span>
        <span className="ml-auto text-muted-foreground">
          {t('portfolio.history.netRealized', 'Net realized')}:{' '}
          <span className={cn("font-bold font-mono", netRealized >= 0 ? "text-up" : "text-down")}>
            {formatCurrency(netRealized)}
          </span>
        </span>
      </div>

      {/* Rows */}
      {sorted.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {t('portfolio.history.noMatches', 'No positions match this filter.')}
        </div>
      ) : (
        <div className="space-y-3">
          {groupOrder.map(marketId => {
            const rows = groups[marketId]
            const market = rows[0].position.market
            const resolution = rows[0].position.resolution
            const cat = categoryName(market?.categoryIds)
            const labels = getOutcomeStyles(market)
            const resolutionLabel = resolution === 'YES' ? labels.yes.shortLabel
              : resolution === 'NO' ? labels.no.shortLabel
              : resolution === 'CANCELLED' ? 'Cancelled (50/50)'
              : null
            return (
              <div key={marketId} className="rounded-lg border border-border/50 overflow-hidden" style={getOutcomeColorVars(market)}>
                {/* Market Header */}
                <div
                  className="flex items-center gap-2 px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onNavigate(marketId)}
                >
                  <p className="text-sm font-medium text-foreground truncate flex-1">
                    {market?.statement || marketId.slice(0, 8) + '...'}
                  </p>
                  {cat && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px]">
                      <Tag className="w-2.5 h-2.5" />
                      {cat}
                    </span>
                  )}
                  <MarketStatusBadge market={market} />
                  {resolution && (
                    <span
                      className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border",
                        resolution === 'YES'
                          ? "bg-outcome-a/20 text-outcome-a border-outcome-a/40"
                          : resolution === 'NO'
                            ? "bg-outcome-b/20 text-outcome-b border-outcome-b/40"
                            : "bg-primary/20 text-primary border-primary/40"
                      )}
                    >
                      {resolutionLabel}
                    </span>
                  )}
                </div>
                {/* Column Headers */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/10 border-b border-border/30 text-[10px] font-medium text-muted-foreground uppercase">
                  <span className="w-12">{t('portfolio.history.colSide', 'Side')}</span>
                  <span className="w-16 text-right">{t('portfolio.history.colShares', 'Shares')}</span>
                  <span className="w-12 text-right">{t('portfolio.history.colAvg', 'Avg')}</span>
                  <span className="w-16 text-right">{t('portfolio.history.colCost', 'Cost')}</span>
                  <span className="w-16 text-right" title={t('portfolio.history.payoutTip', 'Net payout after {{pct}}% platform fee', { pct: (RAKE_PCT * 100).toFixed(0) })}>{t('portfolio.history.colPayout', 'Net Payout')}</span>
                  <span className="w-14 text-center">{t('portfolio.history.colResult', 'Result')}</span>
                  <span className="flex-1 text-right">{t('portfolio.history.colPnl', 'P&L')}</span>
                  <span className="w-32 text-right hidden md:inline">{t('portfolio.history.colResolved', 'Resolved')}</span>
                </div>
                {/* Rows for this market */}
                <div className="divide-y divide-border/30">
                  {rows.map((row, i) => {
                    const sideLabel = row.side === 'YES' ? labels.yes.shortLabel : labels.no.shortLabel
                    return (
                    <div
                      key={`${row.marketId}-${row.side}-${i}`}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 border-l-2 transition-colors cursor-pointer",
                        row.won ? "border-up bg-up/5 hover:bg-up/10" : "border-down bg-down/5 hover:bg-down/10"
                      )}
                      onClick={() => onNavigate(row.marketId)}
                    >
                      {/* Side */}
                      <span className={cn(
                        "w-12 px-1.5 py-0.5 rounded text-[10px] font-bold text-center truncate",
                        row.side === 'YES' ? "bg-outcome-a/20 text-outcome-a" : "bg-outcome-b/20 text-outcome-b"
                      )} title={sideLabel}>
                        {sideLabel}
                      </span>
                      {/* Shares */}
                      <span className="w-16 text-right text-xs font-mono">{row.qty.toFixed(3)}</span>
                      {/* Avg */}
                      <span className="w-12 text-right text-xs font-mono text-muted-foreground">
                        {Math.round(row.avg * 100)}¢
                      </span>
                      {/* Cost */}
                      <span className="w-16 text-right text-xs font-mono text-muted-foreground">
                        {formatCurrency(row.cost)}
                      </span>
                      {/* Payout */}
                      <span className="w-16 text-right text-xs font-mono font-medium">
                        {formatCurrency(row.payout)}
                      </span>
                      {/* Result */}
                      <div className="w-14 flex justify-center">
                        <span className={cn(
                          "text-[10px] font-medium flex items-center gap-0.5",
                          row.won ? "text-up" : "text-down"
                        )}>
                          {row.won ? (
                            <><CheckCircle className="w-3 h-3" />{t('portfolio.history.won', 'Won')}</>
                          ) : (
                            <><XCircle className="w-3 h-3" />{t('portfolio.history.lost', 'Lost')}</>
                          )}
                        </span>
                      </div>
                      {/* P&L */}
                      <div className="flex-1 text-right">
                        <span className={cn(
                          "text-xs font-mono font-medium",
                          row.pnl >= 0 ? "text-up" : "text-down"
                        )}>
                          {formatCurrency(row.pnl)}
                        </span>
                        <span className={cn(
                          "text-[10px] ml-1",
                          row.pnlPercent >= 0 ? "text-up" : "text-down"
                        )}>
                          ({formatPercent(row.pnlPercent)})
                        </span>
                      </div>
                      {/* Resolved date */}
                      <span className="w-32 text-right text-[10px] text-muted-foreground hidden md:inline">
                        {formatDateTime(row.resolvedAt)}
                      </span>
                    </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface RedeemableWinningsProps {
  positions: EnrichedPosition[]
  onRedeemed: () => void
  rawPortfolio?: unknown
}

const RedeemableWinnings = ({ positions, onRedeemed, rawPortfolio }: RedeemableWinningsProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { redeem, cancelRedeem, isRedeeming } = useRedeem()
  const { signerZero: redeemSigner } = useWalletContext()
  const accountId = redeemSigner?.getAccountId()?.toString()
  const [pendingId, setPendingId] = useState<string | null>(null)

  // Only show resolved positions with unredeemed winnings.
  const unredeemed = positions.filter(p => p.isResolved && p.redeemableUsd > 0)
  if (unredeemed.length === 0) return null

  const totalRedeemable = unredeemed.reduce((sum, p) => sum + p.redeemableUsd, 0)

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)

  const formatDateTime = (iso: string | undefined) => {
    if (!iso || iso === '' || iso.startsWith('0001-01-01')) return ''
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const handleRedeem = async (position: EnrichedPosition) => {
    setPendingId(position.marketId)
    const result = await redeem({
      marketUuid: position.marketId,
      expectedPayoutUsd: position.redeemableUsd,
      marketContractId: position.market?.smartContractId,
    })
    setPendingId(null)
    if (result.success) onRedeemed()
  }

  const renderPositionRow = (position: EnrichedPosition) => {
    // CANCELLED markets (EmergClose5050): both YES and NO redeem at $0.50/share.
    const winningShares =
      position.resolution === 'YES' ? position.qtyYes
      : position.resolution === 'NO' ? position.qtyNo
      : position.resolution === 'CANCELLED' ? (position.qtyYes + position.qtyNo)
      : 0
    const isPending = pendingId === position.marketId
    const labels = getOutcomeStyles(position.market)
    const resolutionLabel = position.resolution === 'YES' ? labels.yes.shortLabel
      : position.resolution === 'NO' ? labels.no.shortLabel
      : 'Cancelled'
    const isRedeemed = !position.redeemableUsd && !!position.redeemedAt

    return (
      <div
        key={position.marketId}
        className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-background/40 hover:bg-background/60 transition-colors"
        style={getOutcomeColorVars(position.market)}
      >
        <button
          type="button"
          className="flex-1 min-w-0 text-left"
          onClick={() => navigate(`/market/${position.marketId}`)}
        >
          <p className="text-sm font-medium text-foreground truncate">
            {position.market?.statement || position.marketId.slice(0, 8) + '…'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {winningShares.toFixed(3)} {t('portfolio.redeem.sharesWon', 'shares won')}
            {isRedeemed && (
              <span className="ml-2 text-[10px] text-muted-foreground/70">
                Redeemed {formatDateTime(position.redeemedAt)}
              </span>
            )}
          </p>
        </button>
        <span
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border",
            position.resolution === 'YES'
              ? "bg-outcome-a/20 text-outcome-a border-outcome-a/40"
              : position.resolution === 'NO'
                ? "bg-outcome-b/20 text-outcome-b border-outcome-b/40"
                : "bg-primary/20 text-primary border-primary/40"
          )}
        >
          {resolutionLabel}
        </span>
        <div className="text-right">
          <p className="text-sm font-bold text-up font-mono">
            {formatCurrency(position.redeemableUsd)}
          </p>
        </div>
        {isRedeemed ? (
          <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">
            Redeemed
          </Badge>
        ) : (
          <RedeemWinningsDialog
            title={position.market?.statement || position.marketId}
            winningShares={winningShares}
            payoutUsd={position.redeemableUsd}
            accountId={accountId}
            isPending={isPending}
            disabled={isRedeeming}
            onConfirm={() => handleRedeem(position)}
            onCancel={cancelRedeem}
            triggerLabel={t('portfolio.redeem.button', 'Redeem')}
            pendingLabel={t('portfolio.redeem.pending', 'Redeeming')}
          />
        )}
      </div>
    )
  }

  return (
    <Card className="border-up/40 bg-up/5">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-up" />
            <CardTitle className="text-lg">
              {t('portfolio.redeem.title', 'Redeemable Winnings')}
            </CardTitle>
            <Badge variant="secondary" className="ml-1">{unredeemed.length}</Badge>
            {/* Debug-only: full GetUserPortfolio API payload for QA/testing. */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] font-mono uppercase tracking-wide text-muted-foreground hover:text-foreground"
                  title="Show raw API response (debug)"
                >
                  debug
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[min(720px,90vw)] max-h-[70vh] overflow-auto p-3"
              >
                <p className="text-[11px] font-semibold text-muted-foreground mb-2">
                  GetUserPortfolio · raw response
                </p>
                <pre className="text-[11px] leading-snug font-mono whitespace-pre-wrap break-all text-foreground/90">
{JSON.stringify(rawPortfolio, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2)}
                </pre>
              </PopoverContent>
            </Popover>
          </div>
          <div className="text-sm text-muted-foreground">
            {t('portfolio.redeem.total', 'Total redeemable')}:{' '}
            <span className="font-bold text-up">{formatCurrency(totalRedeemable)}</span>
          </div>
        </div>
        <CardDescription>
          {t(
            'portfolio.redeem.description',
            'Claim your winning shares for USDC.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {unredeemed.map(renderPositionRow)}
        </div>
      </CardContent>
    </Card>
  )
}

export default Portfolio
