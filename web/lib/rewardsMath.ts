import type { LOMreward, PrismResponse } from '../gen/api'

/**
 * Pure reward math shared by the LOM hooks, the rewards page and the rewards
 * API diagnostics page. Kept free of React and of the gRPC client so it can be
 * unit tested offline (see lib/rewardsMath.test.ts).
 */

export interface MarketLomStats {
  /** Sum of every account's LOM score for this market. */
  totalScore: number
  /** Distinct accounts with at least one scored row. */
  participants: number
  /** Score-weighted average price-distance factor. */
  avgDistance: number
  /** Score-weighted average order-size factor. */
  avgSize: number
  /** Score-weighted average order-duration factor. */
  avgDuration: number
  /** Most recent `created_at` seen across rows. */
  lastScoredAt: string | undefined
}

/** One miner's aggregated LOM score across every loaded market. */
export interface LeaderboardEntry {
  accountId: string
  score: number
  /** Number of scored rows contributed by this account. */
  markets: number
}

export const EMPTY_STATS: MarketLomStats = {
  totalScore: 0,
  participants: 0,
  avgDistance: 0,
  avgSize: 0,
  avgDuration: 0,
  lastScoredAt: undefined,
}

const safeScore = (row: LOMreward): number =>
  Number.isFinite(row.lomScore) ? row.lomScore : 0

/** Aggregate every scored row of a single market into display stats. */
export const aggregate = (rows: LOMreward[] | undefined): MarketLomStats => {
  if (!rows || rows.length === 0) return EMPTY_STATS

  const accounts = new Set<string>()
  let totalScore = 0
  let wDistance = 0
  let wSize = 0
  let wDuration = 0
  let lastScoredAt: string | undefined

  for (const r of rows) {
    const score = safeScore(r)
    if (r.accountId) accounts.add(r.accountId)
    totalScore += score
    wDistance += (r.distance || 0) * score
    wSize += (r.size || 0) * score
    wDuration += (r.duration || 0) * score
    if (r.createdAt && (!lastScoredAt || r.createdAt > lastScoredAt)) lastScoredAt = r.createdAt
  }

  // Fall back to a plain mean when every score is zero, so the factors still
  // render something meaningful instead of collapsing to 0.
  const weighted = totalScore > 0
  const mean = (pick: (r: LOMreward) => number) =>
    rows.reduce((a, r) => a + (pick(r) || 0), 0) / rows.length

  return {
    totalScore,
    participants: accounts.size,
    avgDistance: weighted ? wDistance / totalScore : mean(r => r.distance),
    avgSize: weighted ? wSize / totalScore : mean(r => r.size),
    avgDuration: weighted ? wDuration / totalScore : mean(r => r.duration),
    lastScoredAt,
  }
}

/**
 * Cross-market miner leaderboard, folded client-side out of the per-market
 * rows: there is no `GetLomLeaderboard` RPC on the wire yet.
 */
export const buildLeaderboard = (rowLists: (LOMreward[] | undefined)[]): LeaderboardEntry[] => {
  const byAccount: Record<string, LeaderboardEntry> = {}
  for (const rows of rowLists) {
    for (const row of rows ?? []) {
      if (!row.accountId) continue
      const entry = (byAccount[row.accountId] ??= { accountId: row.accountId, score: 0, markets: 0 })
      entry.score += safeScore(row)
      entry.markets += 1
    }
  }
  return Object.values(byAccount).sort((a, b) => b.score - a.score)
}

/** Group an account's rows by market id. */
export const groupRowsByMarket = (rows: LOMreward[] | undefined): Record<string, LOMreward[]> => {
  const map: Record<string, LOMreward[]> = {}
  for (const r of rows ?? []) {
    ;(map[r.marketId] ??= []).push(r)
  }
  return map
}

/** Summed score per market for one account. */
export const scoreByMarketFrom = (rows: LOMreward[] | undefined): Record<string, number> => {
  const map: Record<string, number> = {}
  for (const r of rows ?? []) {
    map[r.marketId] = (map[r.marketId] ?? 0) + safeScore(r)
  }
  return map
}

/** Most recent scoring run per market. */
export const lastScoredAtByMarketFrom = (
  rowsByMarket: Record<string, LOMreward[]>,
): Record<string, string | undefined> => {
  const map: Record<string, string | undefined> = {}
  for (const [marketId, rows] of Object.entries(rowsByMarket)) {
    let latest: string | undefined
    for (const r of rows) {
      if (r.createdAt && (!latest || r.createdAt > latest)) latest = r.createdAt
    }
    map[marketId] = latest
  }
  return map
}

/** Newest `lastScoredAt` across a set of per-market stats. */
export const latestScoredAt = (stats: MarketLomStats[]): string | undefined => {
  let latest: string | undefined
  for (const s of stats) {
    if (s.lastScoredAt && (!latest || s.lastScoredAt > latest)) latest = s.lastScoredAt
  }
  return latest
}

export interface PrismBalances {
  prismBalance: bigint
  prismUnredeemed: bigint
  prismRedeemable: bigint
}

/** Map a `GetPrism` response onto the balances the UI renders. */
export const mapPrismResponse = (res: Partial<PrismResponse> | undefined): PrismBalances => ({
  prismBalance: res?.prismBalance ?? 0n,
  prismUnredeemed: res?.prismUnredeemed ?? 0n,
  prismRedeemable: res?.prismRedeemable ?? 0n,
})
