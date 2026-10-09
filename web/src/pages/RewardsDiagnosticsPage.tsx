import { Fragment, useState } from 'react'
import { apiClient, authHeaders } from '../../grpcClient'
import { buildClaimSigningPayload } from '../../lib/claimPrism'
import { useWalletContext } from '../contexts/WalletContext'
import { useNetworkContext } from '../contexts/NetworkContext'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Activity, Check, Copy, Minus, Play, X } from 'lucide-react'

/**
 * Live connectivity check for the rewards APIs.
 *
 * Hidden, non-production route (`/diagnostics/rewards`, gated by the same
 * `showRewards` flag as `/rewards`). It calls the RPCs directly rather than via
 * the reward hooks, so a hook-level bug cannot mask a backend-level one.
 *
 * Offline unit coverage of the reward math lives in lib/rewardsMath.test.ts.
 */

type Status = 'idle' | 'running' | 'pass' | 'empty' | 'failed' | 'skipped'

interface CheckResult {
  name: string
  rpc: string
  status: Status
  ms?: number
  rows?: number
  note?: string
  sample?: unknown
}

const INITIAL: CheckResult[] = [
  { name: '$PRSM balances', rpc: 'GetPrism', status: 'idle' },
  { name: 'My LOM rewards', rpc: 'GetRewardsByAccountId', status: 'idle' },
  { name: 'Market LOM rewards', rpc: 'GetRewardsByMarketId', status: 'idle' },
  { name: 'Market list (for market id)', rpc: 'GetMarkets', status: 'idle' },
  // Read-only: reports what a claim would move. Never calls ClaimPrism.
  { name: 'Claim preflight (read-only)', rpc: 'ClaimPrism (preflight)', status: 'idle' },
]

// bigint values cannot go through JSON.stringify unaided.
const stringify = (value: unknown) =>
  JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? `${v.toString()}n` : v), 2)

const STATUS_STYLE: Record<Status, string> = {
  idle: 'bg-muted text-muted-foreground',
  running: 'bg-primary/15 text-primary',
  pass: 'bg-emerald-500/15 text-emerald-400',
  empty: 'bg-amber-500/15 text-amber-400',
  failed: 'bg-destructive/15 text-destructive',
  skipped: 'bg-muted text-muted-foreground',
}

function StatusBadge({ status }: { status: Status }) {
  const Icon = status === 'pass' ? Check : status === 'failed' ? X : status === 'running' ? Activity : Minus
  return (
    <Badge className={`gap-1 border-0 ${STATUS_STYLE[status]}`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  )
}

export function RewardsDiagnosticsPage() {
  const { signerZero } = useWalletContext()
  const { networkSelected } = useNetworkContext()

  const accountId = signerZero?.getAccountId()?.toString()
  const net = networkSelected.toString().toLowerCase()

  const [marketId, setMarketId] = useState('')
  const [results, setResults] = useState<CheckResult[]>(INITIAL)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)

  const update = (rpc: string, patch: Partial<CheckResult>) =>
    setResults(prev => prev.map(r => (r.rpc === rpc ? { ...r, ...patch } : r)))

  const time = async <T,>(rpc: string, fn: () => Promise<T>): Promise<T | undefined> => {
    update(rpc, { status: 'running', ms: undefined, rows: undefined, note: undefined, sample: undefined })
    const started = performance.now()
    try {
      const value = await fn()
      update(rpc, { ms: Math.round(performance.now() - started) })
      return value
    } catch (err) {
      update(rpc, {
        status: 'failed',
        ms: Math.round(performance.now() - started),
        note: err instanceof Error ? err.message : String(err),
      })
      return undefined
    }
  }

  const runChecks = async () => {
    setRunning(true)
    setResults(INITIAL.map(r => ({ ...r, status: 'idle' })))

    // 1. Market list — also supplies a default market id for check 3.
    let firstMarketId = marketId
    await time('GetMarkets', async () => {
      const { response } = await apiClient.getMarkets({ limit: 10, offset: 0 })
      const markets = response.markets ?? []
      if (!firstMarketId && markets[0]?.marketId) {
        firstMarketId = markets[0].marketId
        setMarketId(firstMarketId)
      }
      update('GetMarkets', {
        status: markets.length ? 'pass' : 'empty',
        rows: markets.length,
        sample: markets.slice(0, 2),
      })
    })

    // 2. $PRSM balances (needs a connected wallet).
    if (!accountId) {
      update('GetPrism', { status: 'skipped', note: 'No wallet connected' })
    } else {
      await time('GetPrism', async () => {
        const { response } = await apiClient.getPrism({ accountId, net }, authHeaders())
        update('GetPrism', {
          status: 'pass',
          rows: 1,
          sample: {
            prismBalance: response.prismBalance,
            prismUnredeemed: response.prismUnredeemed,
            prismRedeemable: response.prismRedeemable,
          },
        })
      })
    }

    // 3. My LOM rows (needs a connected wallet).
    if (!accountId) {
      update('GetRewardsByAccountId', { status: 'skipped', note: 'No wallet connected' })
    } else {
      await time('GetRewardsByAccountId', async () => {
        const { response } = await apiClient.getRewardsByAccountId({ accountId, net }, authHeaders())
        const rows = response.lomRewards ?? []
        update('GetRewardsByAccountId', {
          status: rows.length ? 'pass' : 'empty',
          rows: rows.length,
          note: rows.length ? undefined : 'Responded, but this account has no scored rows',
          sample: rows.slice(0, 3),
        })
      })
    }

    // 4. Per-market LOM rows.
    if (!firstMarketId) {
      update('GetRewardsByMarketId', { status: 'skipped', note: 'No market id available' })
    } else {
      await time('GetRewardsByMarketId', async () => {
        const { response } = await apiClient.getRewardsByMarketId({ marketId: firstMarketId }, authHeaders())
        const rows = response.lomRewards ?? []
        update('GetRewardsByMarketId', {
          status: rows.length ? 'pass' : 'empty',
          rows: rows.length,
          note: rows.length ? `market ${firstMarketId}` : `Responded, but market ${firstMarketId} has no scored rows`,
          sample: rows.slice(0, 3),
        })
      })
    }

    // 5. Claim preflight — read-only. Reports the amount `ClaimPrism` would
    //    transfer (the backend pays out the unredeemed total) and the signing
    //    message that would be produced. It never submits a claim.
    if (!accountId) {
      update('ClaimPrism (preflight)', { status: 'skipped', note: 'No wallet connected' })
    } else {
      await time('ClaimPrism (preflight)', async () => {
        const { response } = await apiClient.getPrism({ accountId, net }, authHeaders())
        const claimable = response.prismUnredeemed ?? 0n
        const { messageToSign, keccakHex } = buildClaimSigningPayload(accountId, net)
        update('ClaimPrism (preflight)', {
          status: claimable > 0n ? 'pass' : 'empty',
          rows: claimable > 0n ? 1 : 0,
          note: claimable > 0n
            ? 'Claimable amount available (no claim submitted)'
            : 'Nothing to claim for this account',
          sample: { claimableRaw: claimable, messageToSign, keccakHex },
        })
      })
    }

    setRunning(false)
  }

  const copyAll = async () => {
    const text = results
      .map(r => `${r.rpc} — ${r.status}${r.ms !== undefined ? ` (${r.ms}ms)` : ''}${r.rows !== undefined ? `, ${r.rows} rows` : ''}${r.note ? `\n  ${r.note}` : ''}`)
      .join('\n')
    await navigator.clipboard.writeText(`Rewards API check — net=${net} account=${accountId ?? 'none'}\n${text}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Rewards API check</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Calls the live rewards endpoints once and reports what came back. Nothing runs until you press Run.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          network <span className="text-foreground">{net}</span> · account{' '}
          <span className="text-foreground">{accountId ?? 'not connected'}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={runChecks} disabled={running} className="gap-2">
          <Play className="h-4 w-4" />
          {running ? 'Running…' : 'Run checks'}
        </Button>
        <Input
          value={marketId}
          onChange={e => setMarketId(e.target.value)}
          placeholder="Market ID (optional — first market is used)"
          className="w-80"
        />
        <Button variant="outline" onClick={copyAll} className="gap-2">
          <Copy className="h-4 w-4" />
          {copied ? 'Copied' : 'Copy results'}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Endpoint</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Time</th>
                <th className="px-4 py-3 text-right font-medium">Rows</th>
                <th className="px-4 py-3 text-right font-medium">Sample</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <Fragment key={r.rpc}>
                  <tr key={r.rpc} className="border-b border-border/40">
                    <td className="px-4 py-3">
                      <div className="text-foreground">{r.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.rpc}</div>
                      {r.note && <div className="text-xs text-muted-foreground mt-1 max-w-md">{r.note}</div>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{r.ms !== undefined ? `${r.ms} ms` : '—'}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{r.rows ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {r.sample !== undefined ? (
                        <button
                          type="button"
                          className="text-primary hover:underline text-xs"
                          onClick={() => setExpanded(expanded === r.rpc ? null : r.rpc)}
                        >
                          {expanded === r.rpc ? 'hide' : 'show'}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                  {expanded === r.rpc && (
                    <tr key={`${r.rpc}-sample`} className="border-b border-border/40">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                          {stringify(r.sample)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

export default RewardsDiagnosticsPage
