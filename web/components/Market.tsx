import { useEffect, useRef, useCallback, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useMarketContext } from '../src/contexts/MarketContext'
import { apiClient } from '../grpcClient'
import GraphPriceV2 from './GraphPriceV2'
import GraphOrderbook from './GraphOrderbook'
import Comments from './Comments'
import TradePanel from './TradePanel'
import MarketUnavailableNotice from './MarketUnavailableNotice'


import { isValidUUIDv7 } from '../lib/utils'
import { getMarketStatus } from '../lib/marketStatus'
import { getOutcomeStyles, getOutcomeColorVars } from '../lib/marketLabels'
import { ChevronRight, Home, Clock, Trophy } from 'lucide-react'
import { Badge } from '../src/components/ui/badge'
import { Skeleton } from '../src/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../src/components/ui/tabs'
import { useTrading } from '../lib/useTrading'

const Market = () => {
  const { setMarket, setMarketId } = useMarketContext()
  const { signerZero } = useWalletContext()
  
  const { marketId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Parse URL params for sell pre-fill from Portfolio
  const initialAction = searchParams.get('action') as 'buy' | 'sell' | null
  const initialOutcome = searchParams.get('outcome') as 'yes' | 'no' | null
  const initialShares = searchParams.get('shares') ? Number(searchParams.get('shares')) : undefined
  
  // Clear URL params after reading (so refresh doesn't re-apply)
  useEffect(() => {
    if (initialAction || initialOutcome || initialShares) {
      setSearchParams({}, { replace: true })
    }
  }, []) // Only run once on mount
  
  // Get user's account ID for order book highlighting
  const userAccountId = signerZero?.getAccountId()?.toString()
  
  // Use trading hook for cancel functionality
  const { cancelPendingOrder } = useTrading({ marketId: marketId || '' })
  
  // Ref for prefilling trade panel from order book clicks
  const prefillRef = useRef<((outcome: 'yes' | 'no', price: number, amount?: number) => void) | null>(null)

  // Shared YES/NO selection between TradePanel outcome and OrderBook view
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes')

  // Handle cancel order from order book
  const handleCancelOrder = useCallback(async (orderId: string) => {
    await cancelPendingOrder(orderId)
  }, [cancelPendingOrder])

  const handleOrderBookClick = useCallback((price: number, side: 'yes' | 'no', quantity: number) => {
    if (prefillRef.current) {
      // The clicked row is an ask (resting sell). To actually cross and buy it,
      // the limit price must be strictly greater than the ask — bump by $0.01
      // (the order-book tick), capped to $0.99 so it stays a valid probability.
      const bumped = Math.min(0.99, Math.round((price + 0.01) * 100) / 100)
      const amount = Math.round(bumped * quantity * 100) / 100
      prefillRef.current(side, bumped, amount > 0 ? amount : undefined)

      // Only scroll to trade panel on mobile/tablet (below lg breakpoint)
      if (window.innerWidth < 1024) {
        document.getElementById('trade-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [])


  // Fetch market data with React Query
  const { data: market, isLoading, error } = useQuery({
    queryKey: ['market', marketId],
    queryFn: async () => {
      const result = await apiClient.getMarketById({ marketId: marketId! })
      // Debug: Log full market response to check description and closesAt
      console.log('[Market] GetMarketById response:', {
        marketId: result.response.marketId,
        description: result.response.description,
        closesAt: result.response.closesAt,
        createdAt: result.response.createdAt,
        fullResponse: result.response
      })
      return result.response
    },
    enabled: !!marketId && isValidUUIDv7(marketId),
    staleTime: 30000
  })

  // Update global state when market data changes
  useEffect(() => {
    if (market) {
      setMarketId(market.marketId)
      setMarket(market)
      console.log('market: ', market)
    }
  }, [market, setMarket, setMarketId])


  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === '0001-01-01T00:00:00Z') return null
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-up/20 text-up border-up/30'
      case 'paused': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
      case 'suspended': return 'bg-down/20 text-down border-down/30'
      case 'closed': return 'bg-muted text-muted-foreground border-border'
      case 'resolved': return 'bg-primary/20 text-primary border-primary/30'
      default: return 'bg-up/20 text-up border-up/30'
    }
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <Breadcrumbs />
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 text-center">
          <p className="text-destructive">Failed to load market: {(error as Error).message}</p>
          <Link to="/explore" className="text-primary hover:underline mt-2 inline-block">
            ← Back to Explore
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4" style={getOutcomeColorVars(market)}>
      <Breadcrumbs marketStatement={market?.statement} />

      {isLoading ? (
        <MarketSkeleton />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Section */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Market Image */}
              <div className="h-56 relative overflow-hidden bg-muted">
                <img
                  src={
                    market?.imageUrl?.trim()
                      ? market.imageUrl
                      : `${window.location.origin}/640_480.png`
                  }
                  alt={market?.statement || 'Market'}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = `${window.location.origin}/640_480.png`
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                
                {/* Status Badge */}
                <div className="absolute top-4 left-4">
                  {(() => {
                    const heroStatus = getMarketStatus(market)
                    const labels = getOutcomeStyles(market)
                    if (heroStatus === 'resolved') {
                      // outcome: 0=NO wins, 1=YES wins, 2=cancelled (50/50)
                      const oc = market?.outcome
                      const winner = oc === 1 ? labels.yes.shortLabel
                        : oc === 0 ? labels.no.shortLabel
                        : oc === 2 ? 'Cancelled (50/50)'
                        : null
                      const cls = oc === 1
                        ? 'bg-outcome-a/20 text-outcome-a border-outcome-a/30'
                        : oc === 0
                          ? 'bg-outcome-b/20 text-outcome-b border-outcome-b/30'
                          : 'bg-primary/20 text-primary border-primary/30'
                      return (
                        <Badge variant="outline" className={cls}>
                          {winner ? `Resolved · ${winner}` : 'Resolved'}
                        </Badge>
                      )
                    }
                    const label = market?.isPaused ? 'Paused' : market?.isSuspended ? 'Suspended' : heroStatus === 'closed' ? 'Closed' : 'Active'
                    return (
                      <Badge variant="outline" className={getStatusColor(label)}>
                        {label}
                      </Badge>
                    )
                  })()}
                </div>
              </div>

              {/* Market Info */}
              <div className="p-5">
                <h1 className="text-xl font-bold text-foreground">
                  {market?.statement}
                </h1>

                {/* Market & Contract IDs */}
                <div className="mt-2 flex justify-between items-center">
                  <p className="text-xs text-muted-foreground font-mono">
                    Market ID: {marketId}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Contract ID: {market?.smartContractId || 'N/A'}
                  </p>
                </div>

                {/* Creation & Resolution Date Row */}
                <div className="mt-4 flex gap-4">
                  {/* Creation Date */}
                  <div className="flex-1 p-3 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Created</p>
                        <p className={`text-base font-semibold ${formatDate(market?.createdAt) ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                          {formatDate(market?.createdAt) || 'Not set'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Resolution Date */}
                  <div className="flex-1 p-3 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Resolution Date</p>
                        <p className={`text-base font-semibold ${formatDate(market?.closesAt) ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                          {formatDate(market?.closesAt) || 'Not set'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description / Rules tabs */}
                {(() => {
                  const hasRules = !!market?.rules && market.rules.trim().length > 0
                  const lomEnabled = market?.isLomEnabled !== false
                  return (
                    <Tabs defaultValue="description" className="mt-4">
                      <TabsList>
                        <TabsTrigger value="description" className="uppercase tracking-wide text-xs">
                          Description
                        </TabsTrigger>
                        <TabsTrigger value="rules" disabled={!hasRules} className="uppercase tracking-wide text-xs">
                          Rules
                        </TabsTrigger>
                        <TabsTrigger value="rewards" className="uppercase tracking-wide text-xs">
                          Rewards
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="description" className="p-4 bg-muted/30 rounded-lg border border-border">
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${market?.description ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                          {market?.description || 'No description provided'}
                        </p>
                      </TabsContent>
                      <TabsContent value="rules" className="p-4 bg-muted/30 rounded-lg border border-border">
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${hasRules ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                          {hasRules ? market!.rules : 'No rules provided'}
                        </p>
                      </TabsContent>
                      <TabsContent value="rewards" className="p-4 bg-muted/30 rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <Trophy className={`h-5 w-5 ${lomEnabled ? 'text-[var(--prism-yellow)]' : 'text-muted-foreground'}`} />
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {lomEnabled ? 'LOM Rewards Enabled' : 'LOM Rewards Disabled'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {lomEnabled
                                ? 'This market is eligible for Limit Order Mining rewards.'
                                : 'This market is not currently earning LOM rewards.'}
                            </p>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  )
                })()}
              </div>
            </div>

            {/* Charts Section */}
            <GraphPriceV2 marketId={marketId!} closesAt={market?.closesAt} createdAt={market?.createdAt} />
            <GraphOrderbook 
              marketId={marketId!} 
              marketName={market?.statement}
              userAccountId={userAccountId}
              onPriceClick={handleOrderBookClick}
              onCancelOrder={userAccountId ? handleCancelOrder : undefined}
              selectedSide={selectedSide}
              onSideChange={setSelectedSide}
            />

            {/* Comments Section */}
            <Comments marketId={marketId!} />
          </div>

          {/* Trade Panel - Right Side (only when market is active) */}
          <div className="lg:col-span-1">
            <div>
              {marketId && (() => {
                const status = getMarketStatus(market)
                return status === 'active' ? (
                  <TradePanel 
                    marketId={marketId} 
                    marketStatement={market?.statement}
                    onPrefillRef={(fn) => { prefillRef.current = fn }}
                    initialAction={initialAction || undefined}
                    initialOutcome={initialOutcome || undefined}
                    initialShares={initialShares}
                    selectedSide={selectedSide}
                    onSideChange={setSelectedSide}
                  />
                ) : (
                  <MarketUnavailableNotice
                    status={status}
                    outcome={market?.outcome}
                    resolvedAt={market?.resolvedAt}
                    market={market}
                  />
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// interface MetadataItemProps {
//   icon: React.ReactNode
//   label: string
//   value: string
//   mono?: boolean
//   className?: string
// }
// 
// const MetadataItem = ({ icon, label, value, mono, className = '' }: MetadataItemProps) => (
//   <div className={`flex items-start gap-2 ${className}`}>
//     <span className="text-muted-foreground mt-0.5">{icon}</span>
//     <div className="min-w-0">
//       <p className="text-xs text-muted-foreground">{label}</p>
//       <p className={`text-sm text-foreground truncate ${mono ? 'font-mono' : ''}`}>
//         {value}
//       </p>
//     </div>
//   </div>
// )

const MarketSkeleton = () => (
  <div className="bg-card border border-border rounded-xl overflow-hidden">
    <Skeleton className="h-64 w-full" />
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <div className="flex gap-4">
        <Skeleton className="h-12 w-32" />
        <Skeleton className="h-10 w-28 ml-auto" />
      </div>
      <div className="grid grid-cols-2 gap-4 pt-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  </div>
)

const Breadcrumbs: React.FC<{ marketStatement?: string }> = ({ marketStatement }) => {
  const truncatedStatement = marketStatement 
    ? (marketStatement.length > 40 ? marketStatement.slice(0, 40) + '...' : marketStatement)
    : 'Market'

  return (
    <nav className="flex items-center text-sm text-muted-foreground mb-4" aria-label="Breadcrumb">
      <Link to="/" className="flex items-center hover:text-foreground transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      <ChevronRight className="h-4 w-4 mx-2" />
      <Link to="/explore" className="hover:text-foreground transition-colors">
        Explore
      </Link>
      <ChevronRight className="h-4 w-4 mx-2" />
      <span className="text-foreground font-medium">{truncatedStatement}</span>
    </nav>
  )
}

export default Market