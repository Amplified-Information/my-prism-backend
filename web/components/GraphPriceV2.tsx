import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { ChevronDown, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../src/components/ui/collapsible'
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../src/components/ui/tooltip'
import { priceHistoryCached } from '../grpcClient'
import { Skeleton } from '../src/components/ui/skeleton'
import { Badge } from '../src/components/ui/badge'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { useMarketContext } from '../src/contexts/MarketContext'
import { getOutcomeStyles } from '../lib/marketLabels'
import { cn } from '../src/lib/utils'

interface GraphPriceV2Props {
  marketId: string
  closesAt?: string
  createdAt?: string
}

type RangeKey = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL'

const ONE_MIN = 60_000
const ONE_HOUR = 60 * ONE_MIN
const ONE_DAY = 24 * ONE_HOUR

// Backend caps each resolution to a max span (e.g. `minute` ≈ 1h12m, `hour` ≈ 240h).
// To get finer detail than a single capped request allows, we fan out multiple
// parallel sub-requests (`chunkSpanMs` each) at the finest viable `resolution`
// and re-bucket the merged points client-side at `stepMs`.
type RangeConfig = {
  resolution: 'minute' | 'hour' | 'day'
  chunkSpanMs: number
  chunkLimit: number
  stepMs: number
  spanMs: number
}
const RANGE_CONFIG: Record<Exclude<RangeKey, 'ALL'>, RangeConfig> = {
  '1H': { resolution: 'minute', chunkSpanMs: ONE_HOUR,      chunkLimit: 60,  stepMs: ONE_MIN,      spanMs: ONE_HOUR },
  '6H': { resolution: 'minute', chunkSpanMs: ONE_HOUR,      chunkLimit: 60,  stepMs: 5 * ONE_MIN,  spanMs: 6 * ONE_HOUR },
  '1D': { resolution: 'minute', chunkSpanMs: ONE_HOUR,      chunkLimit: 60,  stepMs: 15 * ONE_MIN, spanMs: ONE_DAY },
  '1W': { resolution: 'hour',   chunkSpanMs: 7 * ONE_DAY,   chunkLimit: 168, stepMs: 2 * ONE_HOUR, spanMs: 7 * ONE_DAY },
  '1M': { resolution: 'hour',   chunkSpanMs: 10 * ONE_DAY,  chunkLimit: 240, stepMs: 2 * ONE_HOUR, spanMs: 30 * ONE_DAY },
}

// Pick the finest viable resolution + smallest stepMs that keeps the total
// bucket count under MAX_POINTS, so the ALL view shows as much detail as
// the market's age and backend caps allow.
const MAX_POINTS = 480
const ONE_WEEK = 7 * ONE_DAY
const STEP_LADDER_MS = [
  ONE_MIN, 5 * ONE_MIN, 15 * ONE_MIN, 30 * ONE_MIN,
  ONE_HOUR, 2 * ONE_HOUR, 4 * ONE_HOUR, 6 * ONE_HOUR, 12 * ONE_HOUR,
  ONE_DAY, 2 * ONE_DAY, ONE_WEEK,
]

function deriveAllConfig(createdMs: number, now: number): Omit<RangeConfig, 'spanMs'> & { fromMs: number } {
  // Hard safety cap: don't fetch more than ~1y even for ancient markets.
  const fromMs = Math.max(createdMs, now - 365 * ONE_DAY)
  const ageMs = Math.max(now - fromMs, ONE_HOUR)

  // Pick resolution by age — the largest backend chunk span at each tier.
  let resolution: 'minute' | 'hour' | 'day'
  let chunkSpanMs: number
  let chunkLimit: number
  let minStepMs: number
  if (ageMs <= ONE_DAY) {
    resolution = 'minute'; chunkSpanMs = ONE_HOUR;     chunkLimit = 60;  minStepMs = ONE_MIN
  } else if (ageMs <= 30 * ONE_DAY) {
    resolution = 'hour';   chunkSpanMs = 10 * ONE_DAY; chunkLimit = 240; minStepMs = ONE_HOUR
  } else {
    resolution = 'day';    chunkSpanMs = 365 * ONE_DAY;chunkLimit = 365; minStepMs = ONE_DAY
  }

  // Smallest step on the ladder that fits the budget and respects resolution.
  let stepMs = STEP_LADDER_MS[STEP_LADDER_MS.length - 1]
  for (const s of STEP_LADDER_MS) {
    if (s < minStepMs) continue
    if (ageMs / s <= MAX_POINTS) { stepMs = s; break }
  }

  return { resolution, chunkSpanMs, chunkLimit, stepMs, fromMs }
}

const RANGES: RangeKey[] = ['1H', '6H', '1D', '1W', '1M', 'ALL']

interface Point {
  t: number
  p: number // probability 0..1
}

const fmtPct = (v: number) => `${Math.round(v * 100)}%`

const ONE_YEAR = 365 * ONE_DAY

function fmtXAxis(ts: number, span: number): string {
  const d = new Date(ts)
  if (span <= ONE_DAY) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  if (span <= 14 * ONE_DAY) {
    const isMidnight = d.getHours() === 0 && d.getMinutes() === 0
    return isMidnight
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
  }
  if (span <= ONE_YEAR) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  if (span <= 3 * ONE_YEAR) {
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  return String(d.getFullYear())
}

function fmtTooltipTime(ts: number, span: number): string {
  const d = new Date(ts)
  if (span <= ONE_DAY) {
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  if (span <= ONE_YEAR) {
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Calendar-aligned x-axis ticks. Walks natural boundaries (hour/day/week/month/year)
// based on span so the axis reads cleanly at any zoom level. Falls back to evenly
// spaced ticks if fewer than 2 boundaries fit.
function generateTicks(fromMs: number, toMs: number, spanMs: number): number[] {
  const MAX_TICKS = 12
  const out: number[] = []

  // Minute/hour-based intervals use simple ms arithmetic on an aligned start.
  const fixedIntervalMs =
    spanMs <= 2 * ONE_HOUR ? 15 * ONE_MIN :
    spanMs <= 6 * ONE_HOUR ? ONE_HOUR :
    spanMs <= ONE_DAY ? 3 * ONE_HOUR :
    spanMs <= 3 * ONE_DAY ? 6 * ONE_HOUR :
    spanMs <= 14 * ONE_DAY ? ONE_DAY :
    0

  if (fixedIntervalMs > 0) {
    // Align to local boundary (handles ≥ ONE_DAY via Date for DST safety).
    let start: number
    if (fixedIntervalMs >= ONE_DAY) {
      const d = new Date(fromMs)
      d.setHours(0, 0, 0, 0)
      if (d.getTime() < fromMs) d.setDate(d.getDate() + 1)
      start = d.getTime()
    } else {
      start = Math.ceil(fromMs / fixedIntervalMs) * fixedIntervalMs
    }
    for (let t = start; t <= toMs && out.length < MAX_TICKS; t += fixedIntervalMs) {
      out.push(t)
    }
  } else if (spanMs <= 60 * ONE_DAY) {
    // Weekly (Monday 00:00 local)
    const d = new Date(fromMs)
    d.setHours(0, 0, 0, 0)
    const dow = d.getDay() // 0=Sun
    const daysToMonday = (8 - (dow === 0 ? 7 : dow)) % 7
    d.setDate(d.getDate() + daysToMonday)
    while (d.getTime() <= toMs && out.length < MAX_TICKS) {
      if (d.getTime() >= fromMs) out.push(d.getTime())
      d.setDate(d.getDate() + 7)
    }
  } else if (spanMs <= ONE_YEAR) {
    // Monthly (day 1, 00:00 local)
    const d = new Date(fromMs)
    d.setDate(1); d.setHours(0, 0, 0, 0)
    if (d.getTime() < fromMs) d.setMonth(d.getMonth() + 1)
    while (d.getTime() <= toMs && out.length < MAX_TICKS) {
      out.push(d.getTime())
      d.setMonth(d.getMonth() + 1)
    }
  } else if (spanMs <= 3 * ONE_YEAR) {
    // Quarterly (Jan/Apr/Jul/Oct day 1)
    const d = new Date(fromMs)
    d.setDate(1); d.setHours(0, 0, 0, 0)
    const m = d.getMonth()
    d.setMonth(m + ((3 - (m % 3)) % 3))
    if (d.getTime() < fromMs) d.setMonth(d.getMonth() + 3)
    while (d.getTime() <= toMs && out.length < MAX_TICKS) {
      out.push(d.getTime())
      d.setMonth(d.getMonth() + 3)
    }
  } else {
    // Yearly (Jan 1, 00:00 local)
    const d = new Date(fromMs)
    d.setMonth(0, 1); d.setHours(0, 0, 0, 0)
    if (d.getTime() < fromMs) d.setFullYear(d.getFullYear() + 1)
    while (d.getTime() <= toMs && out.length < MAX_TICKS) {
      out.push(d.getTime())
      d.setFullYear(d.getFullYear() + 1)
    }
  }

  // Fallback: evenly spaced ticks if calendar walk produced too few.
  if (out.length < 2) {
    const n = 5
    const step = (toMs - fromMs) / (n - 1)
    return Array.from({ length: n }, (_, i) => Math.round(fromMs + i * step))
  }
  return out
}

// Bucket raw points into evenly-spaced steps with forward-fill, so x-axis
// divides the window evenly.
function bucketPoints(raw: Point[], stepMs: number, fromMs: number, toMs: number): Point[] {
  if (stepMs <= 0 || toMs <= fromMs || raw.length === 0) return raw
  const sorted = [...raw].sort((a, b) => a.t - b.t)
  const start = Math.floor(fromMs / stepMs) * stepMs
  const out: Point[] = []
  let idx = 0
  let last: number | null = null
  for (const p of sorted) {
    if (p.t <= start) { last = p.p; idx++ } else break
  }
  for (let t = start; t <= toMs; t += stepMs) {
    while (idx < sorted.length && sorted[idx].t <= t) {
      last = sorted[idx].p
      idx++
    }
    if (last === null) continue
    out.push({ t, p: last })
  }
  return out
}

const RangePill = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={
      'px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors ' +
      (active
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted')
    }
  >
    {label}
  </button>
)

const CustomTooltip = ({ active, payload, span, yesLabel, noLabel }: { active?: boolean; payload?: Array<{ payload: Point }>; span: number; yesLabel: string; noLabel: string }) => {
  if (!active || !payload || payload.length === 0) return null
  const pt = payload[0].payload
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg">
      <div className="text-xs font-medium text-outcome-a">{yesLabel} {fmtPct(pt.p)}</div>
      <div className="text-xs font-medium text-outcome-b">{noLabel} {fmtPct(1 - pt.p)}</div>
      <div className="text-xs text-muted-foreground mt-1">{fmtTooltipTime(pt.t, span)}</div>
    </div>
  )
}


const GraphPriceV2 = ({ marketId, closesAt, createdAt }: GraphPriceV2Props) => {
  const { networkSelected } = useNetworkContext()
  const { market } = useMarketContext()
  const net = networkSelected?.toString().toLowerCase() || 'testnet'

  const [range, setRange] = useState<RangeKey>(() => {
    if (!createdAt || createdAt === '0001-01-01T00:00:00Z') return 'ALL'
    const created = new Date(createdAt).getTime()
    if (!Number.isFinite(created)) return 'ALL'
    const age = Date.now() - created
    if (age < ONE_HOUR) return '1H'
    if (age < 6 * ONE_HOUR) return '6H'
    if (age < ONE_DAY) return '1D'
    if (age < 7 * ONE_DAY) return '1W'
    if (age < 30 * ONE_DAY) return '1M'
    return 'ALL'
  })
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [points, setPoints] = useState<Point[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [nowAnchor, setNowAnchor] = useState<number>(() => Date.now())

  const createdMs = useMemo(() => {
    if (!createdAt || createdAt === '0001-01-01T00:00:00Z') return null
    const t = new Date(createdAt).getTime()
    return Number.isFinite(t) ? t : null
  }, [createdAt])

  // Quantized "now" tick — 30s cadence is enough for V2 visual.
  useEffect(() => {
    const id = setInterval(() => setNowAnchor(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const window = useMemo(() => {
    if (range === 'ALL') {
      // Snap ALL to the matching fixed-range tier based on market age, so a
      // young market shows a 1H/6H/1D/1W/1M-style axis until it crosses 1 month.
      const ageMs = createdMs ? nowAnchor - createdMs : Infinity
      let tier: Exclude<RangeKey, 'ALL'> | null = null
      if (ageMs < ONE_HOUR) tier = '1H'
      else if (ageMs < 6 * ONE_HOUR) tier = '6H'
      else if (ageMs < ONE_DAY) tier = '1D'
      else if (ageMs < 7 * ONE_DAY) tier = '1W'
      else if (ageMs < 30 * ONE_DAY) tier = '1M'

      if (tier) {
        const c = RANGE_CONFIG[tier]
        const toMs = Math.ceil(nowAnchor / c.stepMs) * c.stepMs
        return { ...c, toMs, fromMs: toMs - c.spanMs }
      }

      const created = createdMs ?? (nowAnchor - 30 * ONE_DAY)
      const cfg = deriveAllConfig(created, nowAnchor)
      // Ceil to the next step boundary so the latest (in-progress) bucket is
      // always included — flooring drops trades that happened after the
      // boundary and can produce an empty window for newly-created markets.
      const toMs = Math.ceil(nowAnchor / cfg.stepMs) * cfg.stepMs
      return { ...cfg, toMs, spanMs: toMs - cfg.fromMs }
    }
    const c = RANGE_CONFIG[range]
    const toMs = Math.ceil(nowAnchor / c.stepMs) * c.stepMs
    return { ...c, toMs, fromMs: toMs - c.spanMs }
  }, [range, createdMs, nowAnchor])

  const fetchHistory = useCallback(async () => {
    if (!marketId) return
    setIsLoading(true)
    try {
      // Fan out parallel chunked requests to maximize granularity within
      // the backend's per-resolution span caps.
      const chunks: Array<{ from: number; to: number }> = []
      for (let start = window.fromMs; start < window.toMs; start += window.chunkSpanMs) {
        chunks.push({ from: start, to: Math.min(start + window.chunkSpanMs, window.toMs) })
      }
      // The gateway 502s when a large fan-out lands at once (e.g. 1D = 24
      // minute-resolution chunks), which is why 1D rendered empty while 1W
      // (a single request) worked. Throttle to a small pool and retry each
      // chunk a couple of times with backoff.
      const CONCURRENCY = 3
      const results: Array<{ response: { timestampMs?: unknown[]; priceUsd?: number[] } } | null> = new Array(chunks.length).fill(null)
      let next = 0
      const worker = async () => {
        while (next < chunks.length) {
          const idx = next++
          const c = chunks[idx]
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              results[idx] = await priceHistoryCached({
                marketId,
                net,
                resolution: window.resolution,
                from: new Date(c.from).toISOString(),
                to: new Date(c.to).toISOString(),
                limit: window.chunkLimit,
              })
              break
            } catch (err) {
              if (attempt === 2) console.error('[GraphPriceV2] priceHistory chunk failed:', err)
              else await new Promise(r => setTimeout(r, 200 * (attempt + 1)))
            }
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker))

      const raw: Point[] = []
      for (const r of results) {
        if (!r) continue
        const timestamps = r.response.timestampMs || []
        const prices = r.response.priceUsd || []
        for (let i = 0; i < timestamps.length; i++) {
          const t = typeof timestamps[i] === 'bigint' ? Number(timestamps[i]) : Number(timestamps[i])
          const p = prices[i]
          if (Number.isFinite(t) && Number.isFinite(p)) raw.push({ t, p })
        }
      }
      raw.sort((a, b) => a.t - b.t)

      // Seed with the last known price before the window so empty/sparse
      // windows still render a flat line at the most recent price.
      const seedFrom = createdMs ?? (window.fromMs - 90 * ONE_DAY)
      if (seedFrom < window.fromMs) {
        try {
          const seed = await priceHistoryCached({
            marketId,
            net,
            resolution: 'hour',
            from: new Date(seedFrom).toISOString(),
            to: new Date(window.fromMs).toISOString(),
            limit: 1000,
          })
          const ts = seed.response.timestampMs || []
          const ps = seed.response.priceUsd || []
          let lastT = -Infinity, lastP: number | null = null
          for (let i = 0; i < ts.length; i++) {
            const t = typeof ts[i] === 'bigint' ? Number(ts[i]) : Number(ts[i])
            const p = ps[i]
            if (Number.isFinite(t) && Number.isFinite(p) && t > lastT) { lastT = t; lastP = p }
          }
          if (lastP !== null) raw.unshift({ t: window.fromMs, p: lastP })
        } catch (err) {
          console.warn('[GraphPriceV2] seed price fetch failed:', err)
        }
      }

      const bucketed = bucketPoints(raw, window.stepMs, window.fromMs, window.toMs)
      setPoints(bucketed.length > 0 ? bucketed : raw)
    } catch (err) {
      console.error('[GraphPriceV2] priceHistory failed:', err)
      setPoints([])
    } finally {
      setIsLoading(false)
    }
  }, [marketId, net, createdMs, window.resolution, window.chunkLimit, window.chunkSpanMs, window.fromMs, window.toMs, window.stepMs])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // Auto Y-domain with small padding, percent-clamped. Includes both YES (p)
  // and NO (1-p) so both lines stay visible.
  const yDomain = useMemo<[number, number]>(() => {
    if (points.length === 0) return [0, 1]
    let lo = Infinity, hi = -Infinity
    for (const p of points) {
      const a = p.p, b = 1 - p.p
      if (a < lo) lo = a; if (a > hi) hi = a
      if (b < lo) lo = b; if (b > hi) hi = b
    }
    if (lo === hi) { lo = Math.max(0, lo - 0.05); hi = Math.min(1, hi + 0.05) }
    const pad = (hi - lo) * 0.15
    return [Math.max(0, lo - pad), Math.min(1, hi + pad)]
  }, [points])


  const labels = getOutcomeStyles(market as Parameters<typeof getOutcomeStyles>[0])

  const { yesPrice, priceChange, trend } = useMemo(() => {
    if (points.length === 0) {
      const fallback = (market as { currentProbability?: number } | undefined)?.currentProbability
      const y = typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : 0.5
      return { yesPrice: y, priceChange: 0, trend: 'flat' as const }
    }
    const first = points[0].p
    const last = points[points.length - 1].p
    const delta = last - first
    const t: 'up' | 'down' | 'flat' = Math.abs(delta) < 0.005 ? 'flat' : delta > 0 ? 'up' : 'down'
    return { yesPrice: last, priceChange: delta, trend: t }
  }, [points, market])

  const sparkPath = useMemo(() => {
    if (points.length < 2) return null
    const w = 80, h = 20
    let lo = Infinity, hi = -Infinity
    for (const p of points) { if (p.p < lo) lo = p.p; if (p.p > hi) hi = p.p }
    if (lo === hi) { lo -= 0.01; hi += 0.01 }
    const stepX = w / (points.length - 1)
    return points.map((p, i) => {
      const x = i * stepX
      const y = h - ((p.p - lo) / (hi - lo)) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }, [points])

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const sparkStroke = trend === 'up' ? 'hsl(var(--up))' : trend === 'down' ? 'hsl(var(--down))' : 'hsl(var(--muted-foreground))'

  return (
    <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="px-4 py-3 border-b border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                  <h3 className="text-sm font-semibold text-foreground">Price History</h3>
                  <TooltipProvider>
                    <UiTooltip>
                      <TooltipTrigger onClick={(e) => e.stopPropagation()}>
                        <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>History of last matched trade prices</p>
                      </TooltipContent>
                    </UiTooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-outcome-a">{labels.yes.shortLabel}</span>
                    <span className="text-lg font-bold text-outcome-a">{Math.round(yesPrice * 100)}¢</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-outcome-b">{labels.no.shortLabel}</span>
                    <span className="text-lg font-bold text-outcome-b">{Math.round((1 - yesPrice) * 100)}¢</span>
                  </div>
                </div>
                {sparkPath && (
                  <svg width={80} height={20} viewBox="0 0 80 20" className="opacity-80">
                    <path d={sparkPath} fill="none" stroke={sparkStroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                )}
                <div className="flex items-center gap-1">
                  <TrendIcon className={cn('h-4 w-4', trend === 'up' ? 'text-up' : trend === 'down' ? 'text-down' : 'text-muted-foreground')} />
                  <span className={cn('text-sm font-medium', priceChange >= 0 ? 'text-up' : 'text-down')}>
                    {priceChange >= 0 ? '+' : ''}{(priceChange * 100).toFixed(1)}pp
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4">
            <div className="h-[260px] w-full">
              {isLoading && points.length === 0 ? (
                <Skeleton className="h-full w-full" />
              ) : points.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No price history yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 8, right: 64, bottom: 8, left: 0 }}>
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                      strokeOpacity={0.4}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="t"
                      type="number"
                      domain={[window.fromMs, window.toMs]}
                      scale="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickFormatter={(v: number) => fmtXAxis(v, window.spanMs)}
                      ticks={generateTicks(window.fromMs, window.toMs, window.spanMs)}
                      minTickGap={24}
                    />
                    <YAxis
                      orientation="right"
                      domain={yDomain}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickFormatter={(v: number) => fmtPct(v)}
                    />
                    <Tooltip
                      content={<CustomTooltip span={window.spanMs} yesLabel={labels.yes.label} noLabel={labels.no.label} />}
                      cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '3 3' }}
                    />
                    <Line
                      type="linear"
                      dataKey="p"
                      name="Yes"
                      stroke="hsl(var(--outcome-a))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'hsl(var(--outcome-a))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="linear"
                      dataKey={(d: Point) => 1 - d.p}
                      name="No"
                      stroke="hsl(var(--outcome-b))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'hsl(var(--outcome-b))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
              <div className="flex items-center gap-0.5 bg-background rounded-lg p-0.5">
                {RANGES.map(r => (
                  <RangePill key={r} active={range === r} label={r === 'ALL' ? 'ALL' : r} onClick={() => setRange(r)} />
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export default GraphPriceV2
