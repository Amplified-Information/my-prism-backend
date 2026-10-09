/**
 * Redeem winnings — guided wallet confirmation.
 *
 * Redemption is an on-chain call (Prism.redeem), so the user must approve a
 * transaction in their wallet. This dialog explains that up front, then keeps
 * the "check your wallet" guidance visible while the wallet prompt is open.
 */
import { useState } from 'react'
import { Trophy, Loader2, Wallet, X } from 'lucide-react'
import { Button } from '../src/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../src/components/ui/dialog'

interface RedeemWinningsDialogProps {
  /** Market question / statement shown for context. */
  title: string
  /** Winning shares being redeemed. */
  winningShares: number
  /** Expected payout in USDC (net of the protocol fee). */
  payoutUsd: number
  /** Destination account that receives the USDC. */
  accountId?: string | null
  /** True while this position's wallet approval is in flight. */
  isPending: boolean
  /** Disable the trigger (e.g. another redemption in flight). */
  disabled?: boolean
  onConfirm: () => Promise<void> | void
  onCancel: () => void
  triggerLabel: string
  pendingLabel: string
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value)

export function RedeemWinningsDialog({
  title, winningShares, payoutUsd, accountId, isPending, disabled,
  onConfirm, onCancel, triggerLabel, pendingLabel,
}: RedeemWinningsDialogProps) {
  const [open, setOpen] = useState(false)

  const handleConfirm = async () => {
    await onConfirm()
    setOpen(false)
  }

  const handleCancel = () => {
    onCancel()
    setOpen(false)
  }

  return (
    <>
      {isPending ? (
        <div className="flex items-center gap-1">
          <Button size="sm" disabled className="min-w-[88px] pointer-events-none">
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            {pendingLabel}
          </Button>
          <Button size="sm" variant="destructive" onClick={onCancel} title="Cancel redemption">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="min-w-[88px]"
        >
          {triggerLabel}
        </Button>
      )}

      <Dialog open={open} onOpenChange={o => { if (!isPending) setOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-up" />
              Collect your winnings
            </DialogTitle>
            <DialogDescription>
              Approve one transaction in your wallet to send this payout to your account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-card px-3 py-2">
              <p className="text-xs text-muted-foreground mb-0.5">Market</p>
              <p className="font-medium text-foreground line-clamp-2">{title}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
              <span className="text-muted-foreground">Winning shares</span>
              <span className="font-mono">{winningShares.toFixed(3)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
              <span className="text-muted-foreground">You receive</span>
              <span className="font-semibold text-up font-mono">{formatCurrency(payoutUsd)} USDC</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
              <span className="text-muted-foreground">To account</span>
              <span className="font-mono">{accountId ?? '—'}</span>
            </div>

            <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside">
              <li>Press Confirm below.</li>
              <li>Open your wallet app or extension — a request will be waiting.</li>
              <li>Approve it, then keep this page open until the payout lands.</li>
            </ol>
            <p className="text-[11px] text-muted-foreground/80">
              Amount shown is net of the 2% protocol fee. USDC must be associated with your account.
            </p>

            {isPending && (
              <div className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2">
                <Wallet className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-foreground">
                  Check your wallet — approve the request to receive your winnings. This can take
                  a few moments to confirm.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              {isPending ? 'Waiting for wallet…' : 'Confirm & open wallet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
