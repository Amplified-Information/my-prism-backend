import { useCallback, useRef } from 'react'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { buildSigner, setActiveNetwork, getDAppConnector, initDAppConnector } from './appkit'
import { getUserAccountInfo } from './hedera'
import { abortActiveWalletCall, forceResetWalletLock } from './walletMutex'
import toast from 'react-hot-toast'

// Module-level guard so only the first useWallet owner attaches the session
// subscription (avoids duplicate listeners / mirror-node fetches).
let _sessionSubscribed = false

export const useWallet = () => {
  const {
    signerZero,
    setSignerZero,
    setUserAccountInfo,
    isWalletLoading,
    setIsWalletLoading,
    setIsConnectSheetOpen,
  } = useWalletContext()
  const { networkSelected } = useNetworkContext()

  // Keep the latest selected network reachable from the (once-registered)
  // subscription callback without re-subscribing on every change.
  const networkRef = useRef(networkSelected)
  networkRef.current = networkSelected

  // Rebuild the signer from the current DAppConnector session. Account-info
  // enrichment is non-fatal — a transient mirror-node failure must never
  // unbind the wallet.
  const bindFromSession = useCallback(async (preferredAccountId?: string) => {
    const signer = buildSigner(networkRef.current, preferredAccountId)
    if (!signer) {
      setSignerZero(undefined)
      setUserAccountInfo(undefined)
      return
    }
    setSignerZero(signer)
    console.log(`[dapp] signer bound: ${signer.getAccountId().toString()} (${networkRef.current.toString()})${preferredAccountId ? ` [preferred=${preferredAccountId}]` : ''}`)
    try {
      const uai = await getUserAccountInfo(networkRef.current, signer.getAccountId().toString())
      setUserAccountInfo(uai)
    } catch (e) {
      console.warn('[dapp] user account info lookup failed (non-fatal):', e)
    }
  }, [setSignerZero, setUserAccountInfo])

  const connect = useCallback(async () => {
    if (isWalletLoading) {
      console.log('[dapp] connect ignored — already in progress')
      return
    }
    // Open the custom Prism Connect Wallet sheet. The sheet drives the
    // DAppConnector via `lib/connectWallet.ts` when the user picks a tile.
    setIsConnectSheetOpen(true)
  }, [isWalletLoading, setIsConnectSheetOpen])

  const disconnect = useCallback(async (options?: { silent?: boolean }) => {
    // Flip UI to disconnected immediately; relay teardown happens after.
    setIsWalletLoading(true)
    setSignerZero(undefined)
    setUserAccountInfo(undefined)
    // Release any in-flight wallet mutex lock so a reconnect-and-sign in
    // the same tab (or the idle-timeout auto-disconnect path) doesn't queue
    // behind a wedged sign request that will never resolve.
    abortActiveWalletCall('wallet disconnected')
    forceResetWalletLock()
    try {
      const dc = getDAppConnector()
      if (dc) await dc.disconnectAll()
    } catch (e) {
      console.warn('[dappconnector] disconnectAll failed:', e)
    } finally {
      if (!options?.silent) toast.success('Wallet disconnected')
      setIsWalletLoading(false)
    }
  }, [setIsWalletLoading, setSignerZero, setUserAccountInfo])

  // Bind an already-created connector on mount. Startup stays passive
  // (no `connect*` calls) so the wallet extension is only woken by an
  // explicit user click.
  const initializeOnMount = useCallback(async () => {
    try {
      // CRITICAL: initialize the DAppConnector before binding. Without this,
      // buildSigner() short-circuits on the missing singleton and the
      // persisted WalletConnect session is never rehydrated after a reload —
      // signerZero stays undefined and the first order-sign click throws
      // before anything reaches HashPack. See .lovable/plan.md (Bug 1).
      const dc = await initDAppConnector()
      await bindFromSession()

      if (_sessionSubscribed) return
      _sessionSubscribed = true

      if (dc?.walletConnectClient) {
        const wc = dc.walletConnectClient
        wc.on('session_event', () => { void bindFromSession() })
        wc.on('session_update', () => { void bindFromSession() })
        wc.on('session_delete', () => {
          setSignerZero(undefined)
          setUserAccountInfo(undefined)
        })
      }

      // Fallback: connectWallet.ts dispatches this after a successful
      // pairing (covers the case where the DAppConnector was created
      // lazily *after* initializeOnMount ran, so its session events
      // were never subscribed to above).
      if (typeof window !== 'undefined') {
        window.addEventListener('prism:wallet-session-changed', () => {
          void bindFromSession()
        })
      }
    } catch (error) {
      console.error('[wallet] error initializing wallet on mount:', error)
    }
  }, [bindFromSession, setSignerZero, setUserAccountInfo])

  // Switch network: tear down current session and rebind from the
  // freshly-initialized connector. `setActiveNetwork` internally does
  // `disconnectAll()` on the existing connector, so if we were paired
  // before the switch we must surface that to the user — otherwise the
  // header just silently flips back to "Connect Wallet".
  const handleNetworkChange = useCallback(async () => {
    // Ensure the singleton exists before we try to switch — avoids racing
    // `initializeOnMount` on the same module-level `_dapp`.
    await initDAppConnector()
    const hadSigner = !!getDAppConnector()?.signers?.length
    try {
      await setActiveNetwork(networkSelected)
    } catch (e) {
      console.warn('[wallet] setActiveNetwork failed:', e)
    }
    const dcHas = !!getDAppConnector()?.signers?.length
    if (!dcHas) {
      setSignerZero(undefined)
      setUserAccountInfo(undefined)
      if (hadSigner) {
        toast(`Network changed to ${networkSelected.toString()}. Please reconnect your wallet.`)
      }
    } else {
      await bindFromSession()
    }
  }, [networkSelected, bindFromSession, setSignerZero, setUserAccountInfo])


  return {
    isConnected: !!signerZero,
    accountId: signerZero?.getAccountId().toString(),
    connect,
    disconnect,
    isLoading: isWalletLoading,
    network: networkSelected,
    initializeOnMount,
    handleNetworkChange,
  }
}
