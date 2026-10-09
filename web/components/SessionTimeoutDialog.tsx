import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../src/components/ui/dialog'
import { Button } from '../src/components/ui/button'
import { Clock } from 'lucide-react'

interface SessionTimeoutDialogProps {
  open: boolean
  countdown: number
  onStayConnected: () => void
  onDisconnect: () => void
}

const SessionTimeoutDialog = ({
  open,
  countdown,
  onStayConnected,
  onDisconnect,
}: SessionTimeoutDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onStayConnected()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <DialogTitle>Session Timeout Warning</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Your wallet session will be disconnected due to inactivity.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-4">
          <div className="text-4xl font-bold text-foreground tabular-nums">
            {countdown}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            seconds remaining
          </p>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onDisconnect}
            className="flex-1 sm:flex-none"
          >
            Disconnect
          </Button>
          <Button
            onClick={onStayConnected}
            className="flex-1 sm:flex-none"
          >
            Stay Connected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SessionTimeoutDialog
