import { describe, expect, it } from 'vitest'
import { deriveCostBasis } from './costBasis'

describe('deriveCostBasis', () => {
  it('returns costBasisAvailable=false when backend omits the fields', () => {
    const r = deriveCostBasis({}, 10, 0, 0.6, 0.4)
    expect(r.costBasisAvailable).toBe(false)
    expect(r.avgPriceYes).toBe(0)
    expect(r.totalCost).toBe(0)
    expect(r.unrealizedPnL).toBe(0)
    expect(r.pnlPercent).toBe(0)
    // Market value should still be computed (drives "value" column).
    expect(r.marketValue).toBeCloseTo(6.0)
  })

  it('derives avg price as cost/qty for a YES-only position', () => {
    const r = deriveCostBasis(
      { costBasisYes: 4.0 },
      10, 0,
      0.60, 0.40,
    )
    expect(r.costBasisAvailable).toBe(true)
    expect(r.avgPriceYes).toBeCloseTo(0.40)
    expect(r.totalCost).toBeCloseTo(4.0)
    expect(r.marketValue).toBeCloseTo(6.0)
    expect(r.unrealizedPnL).toBeCloseTo(2.0)
    expect(r.pnlPercent).toBeCloseTo(50)
  })

  it('sums YES + NO cost basis across a BOTH position', () => {
    const r = deriveCostBasis(
      { costBasisYes: 5.0, costBasisNo: 1.5 },
      10, 5,
      0.55, 0.20,
    )
    expect(r.avgPriceYes).toBeCloseTo(0.50)
    expect(r.avgPriceNo).toBeCloseTo(0.30)
    expect(r.totalCost).toBeCloseTo(6.5)
    expect(r.marketValue).toBeCloseTo(10 * 0.55 + 5 * 0.20)
    expect(r.unrealizedPnL).toBeCloseTo(10 * 0.55 + 5 * 0.20 - 6.5)
  })

  it('realizedPnL falls back to 0 when backend omits the field', () => {
    const r = deriveCostBasis({ costBasisYes: 1 }, 1, 0, 0.5, 0.5)
    expect(r.realizedPnL).toBe(0)
  })

  it('prefers backend-provided avgPriceYesUsd / avgPriceNoUsd', () => {
    const r = deriveCostBasis(
      { avgPriceYesUsd: 0.42, avgPriceNoUsd: 0.31, costBasisYesUsd: 4.2, costBasisNoUsd: 1.55 },
      10, 5,
      0.55, 0.20,
    )
    expect(r.avgPriceYes).toBeCloseTo(0.42)
    expect(r.avgPriceNo).toBeCloseTo(0.31)
    // totalCost is derived from qty × avgPrice (not the cost-basis sums)
    // because the backend currently emits cost_basis_*_usd in raw base units.
    expect(r.totalCost).toBeCloseTo(10 * 0.42 + 5 * 0.31)
  })

  it('ignores cost_basis_*_usd when it leaks raw USDC base units (×1e6)', () => {
    // Regression for the visible "-$5,753,915" bug: backend 66b90827 emits
    // cost_basis_*_usd in 1e6 fixed-point. With avg prices present we must
    // derive totalCost from qty × avgPrice and ignore the inflated field.
    const r = deriveCostBasis(
      {
        avgPriceYesUsd: 0.52,
        avgPriceNoUsd: 0.49,
        costBasisYesUsd: 949_999.96,
        costBasisNoUsd: 4_803_921.78,
      },
      1.826923, 9.803922,
      0.985, 0.5,
    )
    expect(r.totalCost).toBeCloseTo(1.826923 * 0.52 + 9.803922 * 0.49, 4)
    expect(Math.abs(r.unrealizedPnL)).toBeLessThan(10)
  })

  it('ignores backend realized_pnl_usd (currently unit-bugged)', () => {
    const r = deriveCostBasis(
      { costBasisYesUsd: 4, realizedPnlUsd: 1_230_000 },
      10, 0, 0.5, 0.5,
    )
    expect(r.realizedPnL).toBe(0)
  })

  it('still reads legacy costBasisYes/No fields (transitional)', () => {
    const r = deriveCostBasis({ costBasisYes: 4.0 }, 10, 0, 0.5, 0.5)
    expect(r.costBasisAvailable).toBe(true)
    expect(r.avgPriceYes).toBeCloseTo(0.40)
  })
})
