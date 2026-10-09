import { useEffect, useRef } from 'react'
import { Wallet as WalletIcon } from 'lucide-react'
import { useWallet } from '../lib/useWallet'
import { useWalletContext } from '../src/contexts/WalletContext'
import WalletMenu from './WalletMenu'
import SessionTimeoutDialog from './SessionTimeoutDialog'
import { ConnectWalletList } from './ConnectWalletSheet'
import { Popover, PopoverContent, PopoverTrigger } from '../src/components/ui/popover'
import { useActivityTimeout } from '../lib/useActivityTimeout'
import { useIdleDisconnect24h } from '../lib/useIdleDisconnect24h'

const Wallet = () => {
  const {
    isConnected,
    disconnect,
    isLoading,
    initializeOnMount,
    handleNetworkChange,
    network: networkSelected,
  } = useWallet()

  const { isConnectSheetOpen, setIsConnectSheetOpen } = useWalletContext()

  const {
    showTimeoutWarning,
    countdown,
    handleStayConnected,
    handleDisconnect,
  } = useActivityTimeout({
    isConnected,
    onDisconnect: disconnect,
  })

  // Hard 24h idle ceiling: silently disconnect if the user hasn't interacted
  // with the app for a full day (timestamp persists across reloads).
  useIdleDisconnect24h({
    isConnected,
    onDisconnect: disconnect,
  })

  // Initialize wallet on mount
  useEffect(() => {
    initializeOnMount()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle network changes, but skip the first effect run: the connector is
  // already initialized for the default network by initializeOnMount().
  const isFirstNetworkEffect = useRef(true)
  useEffect(() => {
    if (isFirstNetworkEffect.current) {
      isFirstNetworkEffect.current = false
      return
    }
    handleNetworkChange()
  }, [networkSelected]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center gap-2 ml-auto">
      {!isConnected ? (
        <Popover open={isConnectSheetOpen} onOpenChange={setIsConnectSheetOpen}>
          <PopoverTrigger asChild>
            <button
              className="btn-primary flex items-center gap-2 px-2 sm:px-4"
              title="Connect wallet"
              disabled={isLoading}
            >
              <WalletIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{isLoading ? 'Connecting...' : 'Connect Wallet'}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-80 rounded-xl border-border/60 bg-background p-0"
          >
            <ConnectWalletList />
          </PopoverContent>
        </Popover>
      ) : (
        <WalletMenu />
      )}

      <SessionTimeoutDialog
        open={showTimeoutWarning}
        countdown={countdown}
        onStayConnected={handleStayConnected}
        onDisconnect={handleDisconnect}
      />
    </div>
  )
}

export default Wallet

