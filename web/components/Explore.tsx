import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient, clobClient } from '../grpcClient'
import { fetchAllPaged } from '../lib/fetchAllPaged'
import { MarketResponse } from '../gen/api'
import { Skeleton } from '../src/components/ui/skeleton'
import { Badge } from '../src/components/ui/badge'
import { Input } from '../src/components/ui/input'
import { Button } from '../src/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../src/components/ui/tooltip'
import MiniOutcomeWidget from './MiniOutcomeWidget'
import { getBestPricesFromBook } from '../lib/utils'
import { DEPTH } from '../constants'
import { useMarketContext } from '../src/contexts/MarketContext'
import CategoryCarousel from './CategoryCarousel'
import { getMarketStatus } from '../lib/marketStatus'
import { Grid2X2, List } from 'lucide-react'

type ExploreView = 'grid' | 'list'

const Explore = () => {
  const navigate = useNavigate()
  const { categories } = useMarketContext()
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<ExploreView>('grid')

  const { data: marketsResult, isLoading, error } = useQuery({
    queryKey: ['markets'],
    queryFn: async () => {
      const { rows, truncated } = await fetchAllPaged(async ({ limit, offset }) => {
        const result = await apiClient.getMarkets({ limit, offset })
        return { rows: result.response.markets ?? [], pagination: undefined }
      }, { maxPages: 4 })
      return { markets: rows, truncated }
    },
    staleTime: 30000
  })

  const filteredByStatus = useMemo(() => {
    return (marketsResult?.markets ?? []).filter((m: MarketResponse) => getMarketStatus(m) === 'active')
  }, [marketsResult])

  const filtered = useMemo(() => {
    let result = filteredByStatus
    if (selectedCategoryId) {
      result = result.filter((m: MarketResponse) => m.categoryIds.includes(selectedCategoryId))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((m: MarketResponse) =>
        m.statement?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.rules?.toLowerCase().includes(q) ||
        m.marketId?.toLowerCase().includes(q)
      )
    }
    return result
  }, [filteredByStatus, selectedCategoryId, searchQuery])

  // Carousel uses active markets for counts

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <p className="text-destructive font-bold mb-2">Error</p>
          <p className="text-destructive">{(error as Error).message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}

      {/* Search Bar - same width as carousel */}
      <div className="mb-4 max-w-3xl mx-auto w-full">
        <Input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-card border-primary text-foreground placeholder:text-muted-foreground w-full focus-visible:ring-primary transition-shadow duration-300 hover:shadow-[0_0_15px_hsl(var(--primary)/0.5)]"
        />
      </div>

      {/* 3D Category Carousel */}
      {categories.length > 0 && (
        <CategoryCarousel
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
          markets={filteredByStatus}
        />
      )}

      <div className="mb-3 flex min-h-9 items-center justify-between gap-3">
        {!isLoading ? (
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {filteredByStatus.length} active markets
            {marketsResult?.truncated ? ' (list truncated)' : ''}
          </p>
        ) : <span />}

        <TooltipProvider delayDuration={300}>
          <div className="flex shrink-0 items-center rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Market view">
            <ViewButton
              active={view === 'grid'}
              label="Grid view"
              onClick={() => setView('grid')}
            >
              <Grid2X2 aria-hidden="true" />
            </ViewButton>
            <ViewButton
              active={view === 'list'}
              label="List view"
              onClick={() => setView('list')}
            >
              <List aria-hidden="true" />
            </ViewButton>
          </div>
        </TooltipProvider>
      </div>

      <div className={view === 'grid' ? 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-2'}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => view === 'grid' ? (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <Skeleton className="h-40 w-full" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          ) : (
            <div key={i} className="flex min-h-24 items-center gap-4 rounded-lg border border-border bg-card p-3">
              <Skeleton className="h-20 w-28 shrink-0 rounded-md" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-4 w-2/5" />
              </div>
              <Skeleton className="hidden h-8 w-44 sm:block" />
            </div>
          ))
        ) : (
          filtered?.map((market: MarketResponse) => view === 'grid' ? (
              <MarketCard
                key={market.marketId}
                market={market}
                categories={categories}
                onClick={() => navigate(`/market/${market.marketId}`)}
              />
            ) : (
              <MarketRow
                key={market.marketId}
                market={market}
                categories={categories}
                onClick={() => navigate(`/market/${market.marketId}`)}
              />
            ))
        )}
      </div>

      {!isLoading && filtered?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">No markets found</p>
        </div>
      )}
    </div>
  )
}

interface ViewButtonProps {
  active: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}

const ViewButton = ({ active, label, onClick, children }: ViewButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={`h-7 w-7 rounded-md ${active ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : 'text-muted-foreground'}`}
      >
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

interface MarketCardProps {
  market: MarketResponse
  categories: { id: number; name: string }[]
  onClick: () => void
}

const MarketCard = ({ market, categories, onClick }: MarketCardProps) => {
  const { data: probability } = useQuery({
    queryKey: ['marketPrice', market.marketId],
    queryFn: async () => {
      const result = await clobClient.getBook({ marketId: market.marketId, depth: DEPTH })
      const { yesProbability } = getBestPricesFromBook(result.response)
      return Math.min(1, Math.max(0, yesProbability))
    },
    staleTime: 30000
  })

  const categoryNames = market.categoryIds
    ?.map((id) => categories.find((c) => c.id === id)?.name)
    .filter(Boolean)

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 group flex flex-col"
      onClick={onClick}
    >
      <div className="h-40 overflow-hidden bg-muted relative">
        {market.imageUrl ? (
          <img
            src={market.imageUrl}
            alt={market.statement || 'Market'}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted to-accent/20 -z-10" />
      </div>

      <div className="p-4 flex-1">
        <p className="text-foreground font-medium leading-snug mb-3 line-clamp-2 group-hover:text-primary transition-colors">
          {market.statement}
        </p>

        <div className="flex justify-center">
          <MiniOutcomeWidget probability={probability ?? 0.5} market={market} />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-muted/30">
        {categoryNames && categoryNames.length > 0 ? (
          <div className="flex flex-wrap gap-1 justify-center">
            {categoryNames.map((name) => (
              <Badge key={name} variant="secondary" className="text-[10px] px-1.5 py-0">
                {name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground font-mono truncate text-center">
            {market.marketId}
          </p>
        )}
      </div>
    </div>
  )
}

const MarketRow = ({ market, categories, onClick }: MarketCardProps) => {
  const { data: probability } = useQuery({
    queryKey: ['marketPrice', market.marketId],
    queryFn: async () => {
      const result = await clobClient.getBook({ marketId: market.marketId, depth: DEPTH })
      const { yesProbability } = getBestPricesFromBook(result.response)
      return Math.min(1, Math.max(0, yesProbability))
    },
    staleTime: 30000
  })

  const categoryNames = market.categoryIds
    ?.map((id) => categories.find((category) => category.id === id)?.name)
    .filter(Boolean)

  return (
    <div
      className="group flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 sm:flex-row sm:items-center"
      onClick={onClick}
    >
      <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-md bg-muted sm:h-20 sm:w-28">
        {market.imageUrl ? (
          <img
            src={market.imageUrl}
            alt={market.statement || 'Market'}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        ) : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/20 via-muted to-accent/20" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
          {market.statement}
        </p>
        <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{market.marketId}</p>
        {categoryNames && categoryNames.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {categoryNames.map((name) => (
              <Badge key={name} variant="secondary" className="px-1.5 py-0 text-[10px]">
                {name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 justify-center border-t border-border pt-3 sm:w-48 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
        <MiniOutcomeWidget probability={probability ?? 0.5} market={market} />
      </div>
    </div>
  )
}

export default Explore
