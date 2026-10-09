import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient, authHeaders } from '../grpcClient'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import type { LOMreward } from '../gen/api'
import {
  aggregate,
  buildLeaderboard,
  groupRowsByMarket,
  scoreByMarketFrom,
  lastScoredAtByMarketFrom,
  latestScoredAt,
  type MarketLomStats,
  type LeaderboardEntry,
} from './rewardsMath'

/**
 * Limit Order Mining (LOM) reward rows sourced from the backend.
 *
 * Backed by two public RPCs (api.proto / ApiServicePublic):
 *   - GetRewardsByMarketId -> every scored row for one market
 *   - GetRewardsByAccountId -> every scored row for one account
 *
 * Rows are written hourly by the backend cron into `prism_lom`; each row is a
 * per-account, per-market score with its `distance` / `size` / `duration`
 * weighting factors. There is no per-market emission or APR on the wire yet —
 * see docs/lom-rewards-api-spec.md for the outstanding backend work.
 *
 * The pure aggregation lives in lib/rewardsMath.ts and is unit tested there.
 */

export type { MarketLomStats, LeaderboardEntry }

/** Max markets fetched per page load — bounds total work on large feeds. */
export const LOM_MARKET_FETCH_CAP = 60
/** Concurrent in-flight reward reads; the gRPC-web gateway 502s on bursts. */
const LOM_FETCH_CONCURRENCY = 3

/** Runs `worker` over `items` with a bounded number of parallel calls. */
async function runWithPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++
      if (i >= items.length) return
      out[i] = await worker(items[i])
    }
  })
  await Promise.all(runners)
  return out
}

/**
 * Per-market LOM aggregates. The backend has no batched variant, so the reads
 * are issued through a small concurrency pool (not all at once) and the id list
 * is capped — firing one request per market simultaneously made the gateway
 * return 502s and left the table and leaderboard empty.
 */
export const useLomMarketRewards = (marketIds: string[]) => {
  const ids = useMemo(
    () => Array.from(new Set(marketIds.filter(Boolean))).slice(0, LOM_MARKET_FETCH_CAP),
    [marketIds],
  )

  const query = useQuery<Record<string, LOMreward[]>>({
    queryKey: ['lom-rewards', 'markets', ids.join(',')],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const rows = await runWithPool(ids, LOM_FETCH_CONCURRENCY, async (marketId) => {
        try {
          const { response } = await apiClient.getRewardsByMarketId({ marketId }, authHeaders())
          return response.lomRewards ?? []
        } catch {
          // One failing market must not blank the whole table.
          return [] as LOMreward[]
        }
      })
      const map: Record<string, LOMreward[]> = {}
      ids.forEach((id, i) => { map[id] = rows[i] ?? [] })
      return map
    },
  })

  const statsByMarket = useMemo(() => {
    const map: Record<string, MarketLomStats> = {}
    const data = query.data
    if (data) {
      for (const [id, rows] of Object.entries(data)) map[id] = aggregate(rows)
    }
    return map
  }, [query.data])

  /**
   * Cross-market miner leaderboard. There is no `GetLomLeaderboard` RPC on the
   * wire (see docs/lom-rewards-api-spec.md — still "Proposed"), so it is folded
   * client-side out of the per-market rows already fetched above.
   */
  const leaderboard = useMemo(
    () => buildLeaderboard(Object.values(query.data ?? {})),
    [query.data],
  )

  /** Most recent scoring run seen across every loaded market. */
  const lastScoredAt = useMemo(
    () => latestScoredAt(Object.values(statsByMarket)),
    [statsByMarket],
  )

  return {
    statsByMarket,
    leaderboard,
    lastScoredAt,
    isLoading: query.isLoading,
  }
}



/**
 * The connected account's own LOM rows, indexed by market id.
 */
export const useLomAccountRewards = () => {
  const { signerZero } = useWalletContext()
  const { networkSelected } = useNetworkContext()

  const accountId = signerZero?.getAccountId()?.toString()
  const net = networkSelected.toString().toLowerCase()

  const query = useQuery<LOMreward[]>({
    queryKey: ['lom-rewards', 'account', accountId, net],
    enabled: !!accountId,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { response } = await apiClient.getRewardsByAccountId({ accountId: accountId!, net }, authHeaders())
      return response.lomRewards ?? []
    },
  })

  const scoreByMarket = useMemo(() => scoreByMarketFrom(query.data), [query.data])

  /** Raw rows grouped by market — kept for per-row factors and timestamps. */
  const rowsByMarket = useMemo(() => groupRowsByMarket(query.data), [query.data])

  /** Most recent scoring run per market for this account. */
  const lastScoredAtByMarket = useMemo(() => lastScoredAtByMarketFrom(rowsByMarket), [rowsByMarket])

  const marketIds = useMemo(() => Object.keys(scoreByMarket), [scoreByMarket])

  const totalScore = useMemo(
    () => Object.values(scoreByMarket).reduce((a, b) => a + b, 0),
    [scoreByMarket],
  )

  return {
    scoreByMarket,
    rowsByMarket,
    lastScoredAtByMarket,
    marketIds,
    totalScore,
    accountId,
    isConnected: !!accountId,

    isLoading: query.isLoading,
  }
}
