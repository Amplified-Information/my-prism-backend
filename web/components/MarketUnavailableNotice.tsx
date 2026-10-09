import { Link } from 'react-router-dom'
import { Lock, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Badge } from '../src/components/ui/badge'
import { Button } from '../src/components/ui/button'
import type { MarketStatus } from '../lib/marketStatus'
import { STATUS_LABEL } from '../lib/marketStatus'
import { getOutcomeStyles } from '../lib/marketLabels'
import type { MarketResponse } from '../gen/api'

type InactiveStatus = Exclude<MarketStatus, 'active'>

interface Props {
  status: InactiveStatus
  /** Resolved outcome: 0=NO wins, 1=YES wins, 2=cancelled (50/50). undefined=unresolved. */
  outcome?: number
  resolvedAt?: string
  market?: MarketResponse
}

const COPY: Record<InactiveStatus, { title: string; body: string; icon: React.ReactNode }> = {
  resolved: {
    title: 'Market Resolved',
    body: 'This market has been resolved. Trading is closed. Winnings can be redeemed from your Portfolio.',
    icon: <CheckCircle2 className="h-5 w-5 text-primary" />,
  },
  closed: {
    title: 'Market Closed',
    body: 'This market is closed and awaiting resolution. New orders are disabled.',
    icon: <Lock className="h-5 w-5 text-muted-foreground" />,
  },
  suspended: {
    title: 'Market Suspended',
    body: 'This market is currently suspended. Trading is temporarily unavailable.',
    icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
  },
}

const formatResolvedAt = (s?: string): string | null => {
  if (!s || s.startsWith('0001-01-01')) return null
  try {
    return new Date(s).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return null
  }
}

const MarketUnavailableNotice: React.FC<Props> = ({ status, outcome, resolvedAt, market }) => {
  const { title, body, icon } = COPY[status]
  const resolvedDate = formatResolvedAt(resolvedAt)
  const labels = getOutcomeStyles(market)

  const winnerPill =
    status === 'resolved' ? (
      outcome === 1 ? (
        <div className="rounded-lg border border-outcome-a/30 bg-outcome-a/10 px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Winning Outcome</p>
          <p className="mt-1 text-2xl font-bold text-outcome-a">{labels.yes.shortLabel} Won</p>
        </div>
      ) : outcome === 0 ? (
        <div className="rounded-lg border border-outcome-b/30 bg-outcome-b/10 px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Winning Outcome</p>
          <p className="mt-1 text-2xl font-bold text-outcome-b">{labels.no.shortLabel} Won</p>
        </div>
      ) : outcome === 2 ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Market Cancelled</p>
          <p className="mt-1 text-2xl font-bold text-primary">50/50 Refund</p>
          <p className="mt-1 text-xs text-muted-foreground">Both sides redeem at $0.50/share</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Winning Outcome</p>
          <p className="mt-1 text-base font-semibold text-muted-foreground italic">Awaiting outcome</p>
        </div>
      )
    ) : null

  return (
    <div
      id="trade-panel"
      className="bg-card border border-border rounded-xl p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <Badge variant="outline" className="ml-auto">
          {STATUS_LABEL[status]}
        </Badge>
      </div>

      {winnerPill}

      {status === 'resolved' && resolvedDate && (
        <p className="text-xs text-muted-foreground text-center">
          Resolved {resolvedDate}
        </p>
      )}

      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>

      {status === 'resolved' && (
        <Button asChild variant="secondary" className="w-full">
          <Link to="/portfolio">Go to Portfolio</Link>
        </Button>
      )}
    </div>
  )
}

export default MarketUnavailableNotice
