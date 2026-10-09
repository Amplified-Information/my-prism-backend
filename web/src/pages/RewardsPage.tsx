import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiClient } from '../../grpcClient'
import { fetchAllPaged } from '../../lib/fetchAllPaged'
import type { MarketResponse } from '../../gen/api'
import { useAppContext } from '../../AppProvider'
import { usePrism } from '../../lib/usePrism'
import { useLomMarketRewards, useLomAccountRewards } from '../../lib/useLomRewards'
import { getMarketStatus } from '../../lib/marketStatus'
import { formatAge } from '../../lib/formatAge'
import { ClaimPrismDialog } from '../../components/ClaimPrismDialog'


import { Card, CardContent } from '../../src/components/ui/card'
import { Input } from '../../src/components/ui/input'
import { Badge } from '../../src/components/ui/badge'
import { Skeleton } from '../../src/components/ui/skeleton'
import { Coins, Search, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Trophy, Clock } from 'lucide-react'

type SortKey = 'market' | 'score' | 'miners' | 'distance' | 'size' | 'duration' | 'yours' | 'price'

interface SortConfig {
  key: SortKey
  dir: 'asc' | 'desc'
}

// $PRSM is a 6-decimal HTS token (see scs/scripts/launchToken.ts).
const PRSM_DECIMALS = 6


function formatPrsm(raw: bigint | number | undefined): string {
  if (raw === undefined) return '0'
  const asBigInt = typeof raw === 'bigint' ? raw : BigInt(Math.max(0, Math.floor(raw)))
  const divisor = 10n ** BigInt(PRSM_DECIMALS)
  const whole = asBigInt / divisor
  const frac = asBigInt % divisor
  const fracStr = frac.toString().padStart(PRSM_DECIMALS, '0').slice(0, 2)
  return `${whole.toLocaleString()}.${fracStr}`
}

// LOM scores and weighting factors come straight off the backend's hourly
// `prism_lom` rows. Format them compactly for the table.
function formatScore(value: number | undefined): string {
  if (!value) return '0'
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return value.toFixed(2)
}

function formatFactor(value: number | undefined): string {
  if (!value) return '—'
  return value.toFixed(2)
}

// `LOMreward.created_at` is the hourly cron's write time — shown as an age so
// users can tell whether the board is fresh or a scoring run has been missed.
// Shared with the Portfolio rewards tab.



interface SortHeaderProps {
  label: string
  sortKey: SortKey
  sort: SortConfig
  onSort: (key: SortKey) => void
  title?: string
  align?: 'left' | 'center'
}

function SortHeader({ label, sortKey, sort, onSort, title, align = 'center' }: SortHeaderProps) {
  const active = sort.key === sortKey
  const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <th className={`px-4 py-3 text-muted-foreground font-medium ${align === 'left' ? 'text-left' : 'text-center'}`} title={title}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? 'text-primary' : 'text-muted-foreground/60'}`} />
      </button>
    </th>
  )
}

export function RewardsPage() {
  const { categories } = useAppContext()
  const {
    prismBalance,
    prismUnredeemed,
    prismRedeemable,
    isLoading: prismLoading,
    isConnected,
  } = usePrism()

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)


  const { data: marketsResult, isLoading: marketsLoading } = useQuery({
    queryKey: ['rewards-markets'],
    queryFn: async (): Promise<{ markets: MarketResponse[]; truncated: boolean }> => {
      const { rows, truncated } = await fetchAllPaged(async ({ limit, offset }) => {
        const { response } = await apiClient.getMarkets({ limit, offset })
        return { rows: response.markets ?? [], pagination: undefined }
      }, { maxPages: 4 })
      return { markets: rows, truncated }
    },
    staleTime: 60_000,
    retry: 1,
  })

  // Live $PRSM balances from the dedicated GetPrism RPC.
  // `prism_unredeemed` is still vesting, `prism_redeemable` has matured and is
  // what a future ClaimPrism flow would draw against (backend RPC is still a
  // stub — see docs/backend-sync.md).
  const { totalPoints, prismTokenBalance, redeemable } = useMemo(() => ({
    totalPoints: formatPrsm(prismUnredeemed),
    prismTokenBalance: formatPrsm(prismBalance),
    redeemable: formatPrsm(prismRedeemable),
  }), [prismBalance, prismUnredeemed, prismRedeemable])



  const filteredMarkets = useMemo(() => {
    const source = marketsResult?.markets ?? []
    return source.filter(m => {
      if (getMarketStatus(m) !== 'active') return false
      // Backend `markets.is_LOM_enabled` (commit f8387e00): the LOM cron skips
      // disabled markets, so they must not be advertised as reward-eligible.
      // `!== false` keeps older backends (field absent) behaving as before.
      if (m.isLomEnabled === false) return false
      if (search && !m.statement.toLowerCase().includes(search.toLowerCase())) return false

      if (selectedCategory !== null && !m.categoryIds.includes(selectedCategory)) return false
      return true
    })
  }, [marketsResult, search, selectedCategory])

  // Live LOM data: per-market aggregates + this account's own scores.
  const marketIds = useMemo(() => filteredMarkets.map(m => m.marketId), [filteredMarkets])
  const { statsByMarket, leaderboard, lastScoredAt, isLoading: lomLoading } = useLomMarketRewards(marketIds)
  const {
    scoreByMarket,
    totalScore: yourTotalScore,
    accountId: myAccountId,
    isConnected: lomConnected,
  } = useLomAccountRewards()



  const [sort, setSort] = useState<SortConfig>({ key: 'score', dir: 'desc' })

  const toggleSort = (key: SortKey) => {
    setSort(prev => {
      if (prev.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      return { key, dir: key === 'market' ? 'asc' : 'desc' }
    })
  }

  const sortedMarkets = useMemo(() => {
    const arr = [...filteredMarkets]
    arr.sort((a, b) => {
      const statsA = statsByMarket[a.marketId]
      const statsB = statsByMarket[b.marketId]
      const yourA = scoreByMarket[a.marketId] ?? 0
      const yourB = scoreByMarket[b.marketId] ?? 0
      let diff = 0
      switch (sort.key) {
        case 'market':
          diff = a.statement.localeCompare(b.statement)
          break
        case 'score':
          diff = (statsA?.totalScore ?? 0) - (statsB?.totalScore ?? 0)
          break
        case 'miners':
          diff = (statsA?.participants ?? 0) - (statsB?.participants ?? 0)
          break
        case 'distance':
          diff = (statsA?.avgDistance ?? 0) - (statsB?.avgDistance ?? 0)
          break
        case 'size':
          diff = (statsA?.avgSize ?? 0) - (statsB?.avgSize ?? 0)
          break

        case 'duration':
          diff = (statsA?.avgDuration ?? 0) - (statsB?.avgDuration ?? 0)
          break
        case 'yours':
          diff = yourA - yourB
          break
        case 'price':
          diff = (a.priceUsd ?? 0) - (b.priceUsd ?? 0)
          break
      }
      return sort.dir === 'asc' ? diff : -diff
    })
    return arr
  }, [filteredMarkets, sort, statsByMarket, scoreByMarket])

  const leaderboardTotal = useMemo(
    () => leaderboard.reduce((a, e) => a + e.score, 0),
    [leaderboard],
  )




  return (
    <div className="max-w-7xl mx-auto py-8 space-y-8">
      {/* Hero */}
      <Card className="border-primary/30 bg-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        <CardContent className="relative p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Coins className="h-6 w-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Limit Order Mining</h1>
            </div>
            <p className="text-muted-foreground max-w-xl">
              Earn <span className="text-primary font-semibold">$PRSM</span> by resting competitive limit orders close to the market price. Scores are calculated hourly across every unresolved market.
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Last scoring run: <span className="text-foreground">{lomLoading ? '…' : formatAge(lastScoredAt)}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Vesting $PRSM</p>
                {prismLoading && isConnected ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-primary">{totalPoints}</p>
                )}
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Redeemable $PRSM</p>
                {prismLoading && isConnected ? (
                  <Skeleton className="h-8 w-20 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-up">{redeemable}</p>
                )}
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">$PRSM Balance</p>
                {prismLoading && isConnected ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-primary">{prismTokenBalance}</p>
                )}
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Your LOM Score</p>
                <p className="text-2xl font-bold text-foreground">
                  {lomConnected ? formatScore(yourTotalScore) : '—'}
                </p>
              </div>
            </div>
            {!isConnected && (
              <p className="text-xs text-muted-foreground italic">Connect your wallet to see your balances</p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <ClaimPrismDialog
                amount={prismUnredeemed}
                isConnected={isConnected}
                loading={prismLoading}
                size="sm"
              />
            </div>
            {isConnected && prismUnredeemed > 0n && (
              <p className="text-xs text-muted-foreground italic">
                Claiming sends your unclaimed $PRSM to your wallet on Hedera.
              </p>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Eligible markets */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">Eligible markets</h2>
          {!marketsLoading && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredMarkets.length} of {marketsResult?.markets.length ?? 0} loaded markets
              {marketsResult?.truncated ? ' (list truncated)' : ''}
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search markets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedCategory === null ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border hover:text-foreground'}`}
            >
              All
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedCategory === c.id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border hover:text-foreground'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Table (desktop) */}
        <div className="hidden md:block">
          <Card className="border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <SortHeader label="Market" sortKey="market" sort={sort} onSort={toggleSort} align="left" />
                    <SortHeader label="LOM Score" sortKey="score" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Miners" sortKey="miners" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Distance" sortKey="distance" sort={sort} onSort={toggleSort} title="Score-weighted average price-distance factor" />
                    <SortHeader label="Size" sortKey="size" sort={sort} onSort={toggleSort} title="Score-weighted average order-size factor" />

                    <SortHeader label="Duration" sortKey="duration" sort={sort} onSort={toggleSort} title="Score-weighted average order-duration factor" />
                    <SortHeader label="Your Score" sortKey="yours" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Price" sortKey="price" sort={sort} onSort={toggleSort} />
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {marketsLoading && Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-4 py-3"><Skeleton className="h-5 w-60" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16 mx-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-10 mx-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-12 mx-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-12 mx-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-12 mx-auto" /></td>

                      <td className="px-4 py-3"><Skeleton className="h-5 w-14 mx-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16 mx-auto" /></td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  ))}
                  {sortedMarkets.map(m => {
                    const stats = statsByMarket[m.marketId]
                    const yourScore = scoreByMarket[m.marketId]
                    const paused = m.isPaused || m.isSuspended
                    const pending = !stats && lomLoading
                    return (
                      <tr key={m.marketId} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <Link to={`/market/${m.marketId}`} className="flex items-center gap-3 group">
                            {m.imageUrl ? (
                              <img src={m.imageUrl} alt="" className="h-8 w-8 rounded-md object-cover flex-shrink-0" />
                            ) : (
                              <div className="h-8 w-8 rounded-md bg-muted flex-shrink-0" />
                            )}
                            <span className="text-foreground group-hover:text-primary transition-colors line-clamp-1">
                              {m.statement}
                            </span>
                            {paused && <Badge variant="outline" className="text-xs border-down text-down ml-2">Paused</Badge>}
                          </Link>
                        </td>
                        <td className="text-center px-4 py-3">
                          {pending ? (
                            <Skeleton className="h-5 w-16 mx-auto" />
                          ) : (
                            <span className="text-primary font-semibold">{formatScore(stats?.totalScore)}</span>
                          )}
                        </td>
                        <td className="text-center px-4 py-3 text-muted-foreground">
                          {pending ? <Skeleton className="h-5 w-10 mx-auto" /> : (stats?.participants ?? 0)}
                        </td>
                        <td className="text-center px-4 py-3 text-muted-foreground">
                          {pending ? <Skeleton className="h-5 w-12 mx-auto" /> : formatFactor(stats?.avgDistance)}
                        </td>
                        <td className="text-center px-4 py-3 text-muted-foreground">
                          {pending ? <Skeleton className="h-5 w-12 mx-auto" /> : formatFactor(stats?.avgSize)}
                        </td>

                        <td className="text-center px-4 py-3 text-muted-foreground">
                          {pending ? <Skeleton className="h-5 w-12 mx-auto" /> : formatFactor(stats?.avgDuration)}
                        </td>
                        <td className="text-center px-4 py-3">
                          {!lomConnected ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={yourScore ? 'text-up font-medium' : 'text-muted-foreground'}>
                              {formatScore(yourScore)}
                            </span>
                          )}
                        </td>
                        <td className="text-center px-4 py-3">
                          <span className="text-up font-medium">Yes {(m.priceUsd * 100).toFixed(0)}¢</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/market/${m.marketId}`}>
                            <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!marketsLoading && filteredMarkets.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No markets found.</div>
            )}
          </Card>
        </div>

        {/* Cards (mobile) */}
        <div className="md:hidden space-y-3">
          {marketsLoading && Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border"><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
          {sortedMarkets.map(m => {
            const stats = statsByMarket[m.marketId]
            const yourScore = scoreByMarket[m.marketId]
            const paused = m.isPaused || m.isSuspended
            return (
              <Link key={m.marketId} to={`/market/${m.marketId}`}>
                <Card className="border-border hover:border-primary/40 transition-colors">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {m.imageUrl ? (
                        <img src={m.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-muted flex-shrink-0" />
                      )}
                      <p className="text-foreground text-sm font-medium line-clamp-2">{m.statement}</p>
                      {paused && <Badge variant="outline" className="text-xs border-down text-down">Paused</Badge>}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-primary font-semibold">Score {formatScore(stats?.totalScore)}</span>
                      <span className="text-muted-foreground">Miners: {stats?.participants ?? 0}</span>
                      <span className="text-muted-foreground">Dist: {formatFactor(stats?.avgDistance)}</span>
                      <span className="text-muted-foreground">Size: {formatFactor(stats?.avgSize)}</span>

                      {lomConnected && <span className="text-up font-medium">You {formatScore(yourScore)}</span>}
                      <span className="text-up">Yes {(m.priceUsd * 100).toFixed(0)}¢</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
          {!marketsLoading && filteredMarkets.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No markets found.</div>
          )}
        </div>

      </div>

      {/* Top miners — folded client-side from the same per-market LOM rows
          (no GetLomLeaderboard RPC exists on the wire yet). */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground">
            <Trophy className="h-4 w-4 text-[var(--prism-yellow)]" />
            Top miners
          </h2>
          <p className="text-xs text-muted-foreground">Across the {marketIds.length} eligible markets shown above</p>
        </div>

        <Card className="border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium w-16">#</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">Account</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">Scored rows</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">LOM Score</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {lomLoading && leaderboard.length === 0 && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3"><Skeleton className="h-5 w-6" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-10 mx-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 mx-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-12 mx-auto" /></td>
                  </tr>
                ))}
                {leaderboard.slice(0, 20).map((entry, i) => {
                  const isYou = !!myAccountId && entry.accountId === myAccountId
                  const share = leaderboardTotal > 0 ? (entry.score / leaderboardTotal) * 100 : 0
                  return (
                    <tr
                      key={entry.accountId}
                      className={`border-b border-border ${isYou ? 'bg-primary/10' : 'hover:bg-muted/30'} transition-colors`}
                    >
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        {entry.accountId}
                        {isYou && <Badge variant="outline" className="ml-2 text-xs border-primary text-primary">You</Badge>}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{entry.markets}</td>
                      <td className="px-4 py-3 text-center text-primary font-semibold">{formatScore(entry.score)}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{share.toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!lomLoading && leaderboard.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No LOM scores recorded yet.</div>
          )}
        </Card>
      </div>
    </div>

  )
}
