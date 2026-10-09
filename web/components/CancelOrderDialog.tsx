import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../src/components/ui/dialog'
import { Button } from '../src/components/ui/button'
import { Loader2, AlertTriangle } from 'lucide-react'

interface CancelOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  marketName?: string
  orderDetails?: {
    side?: 'BID' | 'ASK' | 'bid' | 'ask'
    price?: number
    qty?: number
  }
}

export const CancelOrderDialog = ({ 
  open, 
  onOpenChange, 
  onConfirm,
  marketName,
  orderDetails 
}: CancelOrderDialogProps) => {
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setIsLoading(false)
    }
  }

  const sideLabel = orderDetails?.side 
    ? (orderDetails.side.toUpperCase() === 'BID' ? 'BUY' : 'SELL')
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancel Order
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this order? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {(marketName || (orderDetails && (orderDetails.price || orderDetails.qty))) && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-2">
            {marketName && (
              <p className="text-foreground font-medium line-clamp-2">{marketName}</p>
            )}
            {orderDetails && (orderDetails.price || orderDetails.qty) && (
              <div className="flex items-center justify-between">
                {sideLabel && (
                  <span className={sideLabel === 'BUY' ? 'text-up font-medium' : 'text-down font-medium'}>
                    {sideLabel}
                  </span>
                )}
                <span className="font-mono text-muted-foreground">
                  {orderDetails.qty?.toFixed(3)} @ ${orderDetails.price?.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Keep Order
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              'Cancel Order'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
