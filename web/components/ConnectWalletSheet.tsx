/**
 * Prism-branded Connect Wallet dropdown content.
 *
 * Rendered inside a Popover anchored to the header "Connect Wallet" button
 * (see `components/Wallet.tsx`). Previously this was a right-side Sheet;
 * the list logic and click handling are unchanged — only the surface differs.
 *
 * Click handling:
 *  - HashPack / Kabila with the extension installed → fire the extension
 *    flow and close the dropdown.
 *  - Anything else → close the dropdown and open `DAppConnector.openModal()`.
 */
import { useEffect, useState } from 'react'
import { useWalletContext } from '../src/contexts/WalletContext'
import {
  isDetectedSync,
  listenForExtensionResponses,
  refreshExtensionDiscovery,
  subscribeDiscovery,
  type WalletId,
} from '../lib/walletDetect'
import {
  connectExtension,
  connectWalletConnect,
} from '../lib/connectWallet'

import { WalletLogo } from './WalletLogo'
import toast from 'react-hot-toast'

interface WalletDef {
  id: WalletId
  name: string
  disabled?: boolean
  disabledReason?: string
}

const wallets: WalletDef[] = [
  { id: 'hashpack', name: 'HashPack' },
  { id: 'kabila', name: 'Kabila Wallet' },
  { id: 'saucerswap', name: 'SaucerSwap Wallet' },
  { id: 'walletconnect', name: 'WalletConnect' },
  {
    id: 'metamask',
    name: 'MetaMask',
    disabled: true,
    disabledReason: 'MetaMask does not support Hedera signing yet.',
  },
]


const WalletRow = ({
  def,
  detected,
  onClick,
}: {
  def: WalletDef
  detected: boolean
  onClick: () => void
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={def.disabled}
      title={def.disabledReason}
      className="group flex w-full items-center gap-3 rounded-xl bg-card/60 px-3 py-2.5 text-left transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
    >
      <WalletLogo id={def.id} size={26} />
      <span className="flex-1 text-sm font-medium text-foreground">{def.name}</span>
      {def.disabled ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          Coming soon
        </span>
      ) : detected ? (
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
          Detected
        </span>
      ) : null}
    </button>
  )
}

/**
 * Renders the wallet list + footer used inside the Connect Wallet popover.
 * Open/close state is owned by `useWalletContext().isConnectSheetOpen`.
 */
export const ConnectWalletList = () => {
  const { isConnectSheetOpen, setIsConnectSheetOpen, signerZero } = useWalletContext()
  const [detected, setDetected] = useState<Record<WalletId, boolean>>(() => ({
    hashpack: false,
    kabila: false,
    saucerswap: false,
    walletconnect: false,
    metamask: false,
  }))

  // Auto-close once the wallet has bound.
  useEffect(() => {
    if (isConnectSheetOpen && signerZero) {
      setIsConnectSheetOpen(false)
    }
  }, [signerZero, isConnectSheetOpen, setIsConnectSheetOpen])

  // Passive detection only — never warm up HashConnect here.
  useEffect(() => {
    if (!isConnectSheetOpen) return
    listenForExtensionResponses()
    // Re-broadcast on open in case the extension was installed after load.
    refreshExtensionDiscovery()
    const refresh = () => setDetected({
      hashpack: isDetectedSync('hashpack'),
      kabila: isDetectedSync('kabila'),
      saucerswap: isDetectedSync('saucerswap'),
      walletconnect: false,
      metamask: isDetectedSync('metamask'),
    })
    refresh()
    const unsub = subscribeDiscovery(refresh)
    return unsub
  }, [isConnectSheetOpen])

  // Inside an iframe (e.g. the Lovable preview), browser-extension content
  // scripts don't answer postMessage from the embedded origin. Attempting
  // `connectExtension` will burn ~15s waiting on a pairing that can never
  // arrive, making the first click look dead and forcing the user to click
  // again. Skip straight to WalletConnect in that case.
  const isEmbeddedIframe =
    typeof window !== 'undefined' && window.top !== window.self

  const handlePick = async (def: WalletDef) => {
    // Native Hedera wallets: if the extension is detected AND we're the
    // top-level window, route through the modern hedera-extension protocol
    // directly (no WC modal). The loading toast is owned by
    // `connectExtension` so we don't double it.
    if (def.id === 'hashpack' || def.id === 'kabila' || def.id === 'saucerswap') {
      setIsConnectSheetOpen(false)
      if (detected[def.id] && !isEmbeddedIframe) {
        try {
          const triggered = await connectExtension(def.id)
          if (triggered) return
        } catch (e) {
          console.error(`[ConnectWalletSheet] ${def.name} extension connect failed`, e)
          // fall through to WC modal
        }
      }
      // Fallback (and the only path inside an iframe): filtered
      // WalletConnect modal. Kabila has a dedicated path; HashPack /
      // SaucerSwap use the generic modal.
      try {
        await connectWalletConnect(def.id === 'kabila' ? 'kabila' : undefined)
      } catch (e) {
        console.error(`[ConnectWalletSheet] ${def.name} connect failed`, e)
        toast.error(`Could not open ${def.name}. Please retry.`)
      }
      return
    }

    setIsConnectSheetOpen(false)
    try {
      await connectWalletConnect()
    } catch (e) {
      console.error('[ConnectWalletSheet] connectWalletConnect failed', e)
    }
  }



  return (
    <div className="flex flex-col">
      <div className="border-b border-border/60 px-4 pb-3 pt-1">
        <div className="text-sm font-semibold text-foreground">Connect a wallet</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Choose a Hedera wallet to connect to Prism Market.
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-2 py-3">
        {[...wallets]
          .sort((a, b) => Number(!!detected[b.id]) - Number(!!detected[a.id]))
          .map((w) => (
            <WalletRow
              key={w.id}
              def={w}
              detected={!!detected[w.id]}
              onClick={() => handlePick(w)}
            />
          ))}
      </div>

      <div className="border-t border-border/60 px-4 py-3 text-center text-[11px] text-muted-foreground">
        <a
          href="https://www.hashpack.app/"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground hover:underline"
        >
          I don't have a wallet
        </a>
      </div>
    </div>
  )
}

// Back-compat: the previous default export was a Sheet rendered globally in
// AppProvider. The dropdown is now anchored to the header button, so this
// default is a no-op kept only to avoid breaking unrelated imports.
const ConnectWalletSheet = () => null
export default ConnectWalletSheet
