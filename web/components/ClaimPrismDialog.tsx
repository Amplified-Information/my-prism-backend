/**
 * Claim $PRSM — shared by the rewards page and the portfolio rewards tab.
 *
 * Amount shown is the backend's *unredeemed* total, because that is what
 * `ClaimPrism` transfers (see lib/claimPrism.ts).
 */
import { useState } from 'react'
import { Coins, Loader2 } from 'lucide-react'
import { Button } from '../src/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../src/components/ui/dialog'
import { useClaimPrism } from '../lib/useClaimPrism'

const PRSM_DECIMALS = 6

const formatPrsm = (raw: bigint): string => {
  const divisor = 10n ** BigInt(PRSM_DECIMALS)
  const whole = raw / divisor
  const frac = (raw % divisor).toString().padStart(PRSM_DECIMALS, '0').slice(0, 2)
  return `${whole.toLocaleString()}.${frac}`
}

interface ClaimPrismDialogProps {
  /** Unredeemed (claimable) amount in the token's smallest unit. */
  amount: bigint
  isConnected: boolean
  loading?: boolean
  size?: 'sm' | 'default'
  className?: string
}

export function ClaimPrismDialog({ amount, isConnected, loading, size = 'default', className }: ClaimPrismDialogProps) {
  const [open, setOpen] = useState(false)
  const { claim, isClaiming, accountId } = useClaimPrism()

  const nothingToClaim = amount <= 0n
  const disabled = !isConnected || loading || nothingToClaim || isClaiming
  const reason = !isConnected
    ? 'Connect your wallet to claim'
    : nothingToClaim
      ? 'No unclaimed $PRSM yet'
      : undefined

  const onConfirm = async () => {
    const ok = await claim()
    if (ok) setOpen(false)
  }

  return (
    <>
      <Button
        size={size}
        variant="default"
        className={className}
        disabled={disabled}
        title={reason}
        onClick={() => setOpen(true)}
      >
        {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
        {isClaiming ? 'Claiming…' : 'Claim $PRSM'}
      </Button>

      <Dialog open={open} onOpenChange={o => { if (!isClaiming) setOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim $PRSM</DialogTitle>
            <DialogDescription>
              Sign once in your wallet to receive your unclaimed rewards on Hedera.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold text-primary">{formatPrsm(amount)} $PRSM</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
              <span className="text-muted-foreground">To account</span>
              <span className="font-mono">{accountId ?? '—'}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Tokens usually arrive within a minute. Your wallet must have the $PRSM token
              associated, otherwise the transfer is rejected.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isClaiming}>Cancel</Button>
            <Button onClick={onConfirm} disabled={isClaiming}>
              {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isClaiming ? 'Waiting for wallet…' : 'Confirm claim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
