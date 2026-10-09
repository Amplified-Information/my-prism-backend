import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Trophy, RefreshCw, X, Sparkles, PartyPopper, ArrowRight } from 'lucide-react'
import { useWalletContext } from '../src/contexts/WalletContext'
import { usePortfolio } from '../lib/usePortfolio'
import { useRedeem } from '../lib/useRedeem'
import { Button } from '../src/components/ui/button'

/**
 * Global popup: when the wallet is connected, polls the portfolio every 60s
 * (paused when the tab is hidden) and surfaces resolved positions with
 * redeemable USDC winnings. Dismissal is per-session and resets when the set
 * of redeemable markets changes.
 */
const RedeemableWinningsNotice = () => {
  const { signerZero } = useWalletContext()
  const { resolvedPositions, refresh, isConnected } = usePortfolio()
  const { redeem, cancelRedeem, isRedeeming } = useRedeem()
  const navigate = useNavigate()

  const [dismissedSig, setDismissedSig] = useState<string | null>(null)
  const [redeemingMarketId, setRedeemingMarketId] = useState<string | null>(null)
  const lastRefreshRef = useRef(0)

  // Reset dismissal whenever the wallet (re)connects so the popup re-appears
  // on every connect.
  useEffect(() => {
    if (isConnected) setDismissedSig(null)
  }, [isConnected])

  // Fetch once when the wallet connects.
  useEffect(() => {
    if (!isConnected) return
    lastRefreshRef.current = Date.now()
    refresh()
  }, [isConnected, refresh])

  const redeemable = useMemo(
    () => resolvedPositions.filter(p => p.redeemableUsd > 0),
    [resolvedPositions],
  )

  // Stable signature of redeemable markets — dismissal only sticks while this
  // set is unchanged. New redeemable market => popup re-appears.
  const sig = useMemo(
    () => redeemable.map(p => `${p.marketId}:${p.redeemableUsd.toFixed(4)}`).sort().join('|'),
    [redeemable],
  )

  const totalRedeemable = redeemable.reduce((s, p) => s + p.redeemableUsd, 0)

  // Deterministic confetti pieces (so they don't reshuffle each render).
  // MUST be declared before any early returns to satisfy the rules of hooks.
  const confetti = useMemo(
    () => Array.from({ length: 40 }, (_, i) => {
      const colors = ['#3B82F6', '#22C55E', '#F59E0B', '#EC4899', '#A855F7', '#FACC15']
      return {
        left: (i * 53) % 100,
        delay: (i * 137) % 2500,
        duration: 2400 + ((i * 91) % 1800),
        color: colors[i % colors.length],
        size: 6 + (i % 4) * 2,
        rotate: (i * 47) % 360,
      }
    }),
    [],
  )

  // Debug: surface why the popup may not be appearing.
  console.log('[RedeemableWinningsNotice]', {
    isConnected,
    hasSigner: !!signerZero,
    resolvedCount: resolvedPositions.length,
    redeemableCount: redeemable.length,
    totalRedeemable,
    sample: resolvedPositions.slice(0, 3).map(p => ({
      marketId: p.marketId,
      isResolved: p.isResolved,
      resolution: p.resolution,
      hasMarket: !!p.market,
      outcome: p.market?.outcome,
      qtyYes: p.qtyYes,
      qtyNo: p.qtyNo,
      redeemableUsd: p.redeemableUsd,
    })),
  })

  const handleRedeem = async (marketUuid: string, expectedPayoutUsd: number, marketContractId?: string) => {
    setRedeemingMarketId(marketUuid)
    try {
      const r = await redeem({ marketUuid, expectedPayoutUsd, marketContractId })
      if (r.success) {
        lastRefreshRef.current = 0
        await refresh()
      }
    } finally {
      setRedeemingMarketId(null)
    }
  }

  if (!signerZero) return null
  if (redeemable.length === 0) return null
  if (dismissedSig === sig) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[1002] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={() => setDismissedSig(sig)}
      />

      {/* Confetti rain */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confetti.map((c, i) => (
          <span
            key={i}
            className="absolute top-[-20px] block rounded-sm"
            style={{
              left: `${c.left}%`,
              width: `${c.size}px`,
              height: `${c.size * 1.6}px`,
              backgroundColor: c.color,
              transform: `rotate(${c.rotate}deg)`,
              animation: `winnings-confetti-fall ${c.duration}ms linear ${c.delay}ms infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes winnings-confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0.9; }
        }
        @keyframes winnings-pop-in {
          0%   { transform: scale(0.6); opacity: 0; }
          60%  { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes winnings-trophy-bounce {
          0%, 100% { transform: translateY(0) rotate(-6deg); }
          50%      { transform: translateY(-8px) rotate(6deg); }
        }
        @keyframes winnings-glow-pulse {
          0%, 100% { box-shadow: 0 0 40px 0 hsl(var(--primary) / 0.45), 0 0 80px 0 hsl(var(--primary) / 0.25); }
          50%      { box-shadow: 0 0 60px 6px hsl(var(--primary) / 0.65), 0 0 120px 12px hsl(var(--primary) / 0.35); }
        }
      `}</style>

      {/* Card */}
      <div
        className="relative max-w-md w-full rounded-2xl border border-primary/50 bg-card shadow-2xl"
        style={{
          animation: 'winnings-pop-in 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both, winnings-glow-pulse 2.4s ease-in-out infinite',
        }}
      >
        <button
          type="button"
          onClick={() => setDismissedSig(sig)}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 space-y-5">
          {/* Celebratory header */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div
              className="relative inline-flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg"
              style={{ animation: 'winnings-trophy-bounce 1.4s ease-in-out infinite' }}
            >
              <Trophy className="h-9 w-9 text-white drop-shadow" />
              <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-amber-200" />
              <Sparkles className="absolute -bottom-1 -left-1 h-4 w-4 text-amber-200" />
            </div>

            <h2 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <PartyPopper className="h-7 w-7 text-primary" />
              You Won!
              <PartyPopper className="h-7 w-7 text-primary scale-x-[-1]" />
            </h2>

            <p className="text-sm text-muted-foreground">
              You have{' '}
              <span
                className="text-2xl font-bold text-primary"
                title="Total payable after the 2% protocol fee withheld by the Prism contract on redeem."
              >
                ${totalRedeemable.toFixed(2)}
              </span>{' '}
              <span className="text-foreground font-medium">USDC</span> waiting across{' '}
              {redeemable.length} market{redeemable.length === 1 ? '' : 's'}.
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              Net of 2% protocol fee withheld on redeem.
            </p>

          </div>

          {/* Winning markets */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {redeemable.map(p => {
              const title = p.market?.statement || p.marketId
              const isThisRedeeming = redeemingMarketId === p.marketId && isRedeeming
              return (
                <div
                  key={p.marketId}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 border border-border px-3 py-2.5"
                >
                  <div className="text-xs min-w-0 flex-1">
                    <div className="text-foreground truncate font-medium" title={title}>{title}</div>
                    <div className="text-muted-foreground mt-0.5">
                      <span className="text-primary font-semibold">${p.redeemableUsd.toFixed(2)}</span>
                      {' · '}
                      {p.resolution} won
                    </div>
                  </div>
                  {isThisRedeeming ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" disabled className="pointer-events-none">
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Redeeming…
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={cancelRedeem}
                        title="Cancel redemption"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleRedeem(p.marketId, p.redeemableUsd, p.market?.smartContractId)}
                      disabled={redeemingMarketId !== null}
                      className="shrink-0"
                    >
                      Redeem
                    </Button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer action */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setDismissedSig(sig)
              navigate('/portfolio')
            }}
          >
            Go to Portfolio
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default RedeemableWinningsNotice
