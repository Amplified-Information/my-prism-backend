import { describe, it, expect } from 'vitest'
import type { LOMreward } from '../gen/api'
import {
  aggregate,
  buildLeaderboard,
  groupRowsByMarket,
  scoreByMarketFrom,
  lastScoredAtByMarketFrom,
  latestScoredAt,
  mapPrismResponse,
  EMPTY_STATS,
} from './rewardsMath'

const row = (over: Partial<LOMreward>): LOMreward => ({
  marketId: 'm1',
  accountId: '0.0.1',
  distance: 0,
  size: 0,
  duration: 0,
  lomScore: 0,
  createdAt: '',
  ...over,
} as LOMreward)

describe('aggregate', () => {
  it('returns empty stats for no rows', () => {
    expect(aggregate([])).toEqual(EMPTY_STATS)
    expect(aggregate(undefined)).toEqual(EMPTY_STATS)
  })

  it('sums scores and counts distinct accounts', () => {
    const s = aggregate([
      row({ accountId: '0.0.1', lomScore: 10 }),
      row({ accountId: '0.0.2', lomScore: 30 }),
      row({ accountId: '0.0.1', lomScore: 60 }),
    ])
    expect(s.totalScore).toBe(100)
    expect(s.participants).toBe(2)
  })

  it('weights factors by score', () => {
    const s = aggregate([
      row({ lomScore: 75, distance: 1, size: 4, duration: 2 }),
      row({ accountId: '0.0.2', lomScore: 25, distance: 5, size: 0, duration: 6 }),
    ])
    // 0.75 * 1 + 0.25 * 5
    expect(s.avgDistance).toBeCloseTo(2)
    expect(s.avgSize).toBeCloseTo(3)
    expect(s.avgDuration).toBeCloseTo(3)
  })

  it('falls back to a plain mean when every score is zero', () => {
    const s = aggregate([
      row({ lomScore: 0, distance: 2, size: 2, duration: 4 }),
      row({ accountId: '0.0.2', lomScore: 0, distance: 4, size: 6, duration: 8 }),
    ])
    expect(s.totalScore).toBe(0)
    expect(s.avgDistance).toBeCloseTo(3)
    expect(s.avgSize).toBeCloseTo(4)
    expect(s.avgDuration).toBeCloseTo(6)
  })

  it('ignores non-finite scores', () => {
    const s = aggregate([row({ lomScore: Number.NaN }), row({ lomScore: 5 })])
    expect(s.totalScore).toBe(5)
  })

  it('keeps the most recent created_at', () => {
    const s = aggregate([
      row({ createdAt: '2026-09-01T00:00:00Z' }),
      row({ createdAt: '2026-09-08T12:00:00Z' }),
      row({ createdAt: '2026-09-05T00:00:00Z' }),
    ])
    expect(s.lastScoredAt).toBe('2026-09-08T12:00:00Z')
  })
})

describe('buildLeaderboard', () => {
  it('folds rows across markets, ordered by score', () => {
    const board = buildLeaderboard([
      [row({ accountId: '0.0.1', lomScore: 5 }), row({ accountId: '0.0.2', lomScore: 20 })],
      [row({ marketId: 'm2', accountId: '0.0.1', lomScore: 30 })],
      undefined,
    ])
    expect(board.map(e => e.accountId)).toEqual(['0.0.1', '0.0.2'])
    expect(board[0]).toMatchObject({ score: 35, markets: 2 })
    expect(board[1]).toMatchObject({ score: 20, markets: 1 })
  })

  it('skips rows without an account id', () => {
    expect(buildLeaderboard([[row({ accountId: '' })]])).toEqual([])
  })
})

describe('per-account grouping', () => {
  const rows = [
    row({ marketId: 'm1', lomScore: 2, createdAt: '2026-09-01T00:00:00Z' }),
    row({ marketId: 'm1', lomScore: 3, createdAt: '2026-09-04T00:00:00Z' }),
    row({ marketId: 'm2', lomScore: 7, createdAt: '2026-09-02T00:00:00Z' }),
  ]

  it('groups rows by market', () => {
    const grouped = groupRowsByMarket(rows)
    expect(Object.keys(grouped).sort()).toEqual(['m1', 'm2'])
    expect(grouped.m1).toHaveLength(2)
  })

  it('sums score per market', () => {
    expect(scoreByMarketFrom(rows)).toEqual({ m1: 5, m2: 7 })
  })

  it('tracks the newest scoring run per market', () => {
    expect(lastScoredAtByMarketFrom(groupRowsByMarket(rows))).toEqual({
      m1: '2026-09-04T00:00:00Z',
      m2: '2026-09-02T00:00:00Z',
    })
  })

  it('handles no rows', () => {
    expect(groupRowsByMarket(undefined)).toEqual({})
    expect(scoreByMarketFrom(undefined)).toEqual({})
  })
})

describe('latestScoredAt', () => {
  it('picks the newest across markets', () => {
    expect(
      latestScoredAt([
        { ...EMPTY_STATS, lastScoredAt: '2026-09-01T00:00:00Z' },
        { ...EMPTY_STATS, lastScoredAt: undefined },
        { ...EMPTY_STATS, lastScoredAt: '2026-09-09T00:00:00Z' },
      ]),
    ).toBe('2026-09-09T00:00:00Z')
  })

  it('is undefined when nothing was scored', () => {
    expect(latestScoredAt([EMPTY_STATS])).toBeUndefined()
  })
})

describe('mapPrismResponse', () => {
  it('maps balance, vesting and redeemable', () => {
    expect(mapPrismResponse({ prismBalance: 10n, prismUnredeemed: 4n, prismRedeemable: 6n })).toEqual({
      prismBalance: 10n,
      prismUnredeemed: 4n,
      prismRedeemable: 6n,
    })
  })

  it('defaults every field to zero when the response is missing', () => {
    expect(mapPrismResponse(undefined)).toEqual({
      prismBalance: 0n,
      prismUnredeemed: 0n,
      prismRedeemable: 0n,
    })
    expect(mapPrismResponse({ prismBalance: 3n }).prismRedeemable).toBe(0n)
  })
})
