/**
 * Wallet connect orchestration — single DAppConnector stack.
 *
 * Two entry points:
 *  - `connectExtension(id)`: routes to the modern Hedera extension
 *    protocol via `DAppConnector.connectExtension(extensionId)`. Used
 *    when the wallet's extension has announced itself via
 *    `hedera-extension-response`.
 *  - `connectWalletConnect(preferred?)`: opens the WalletConnect modal.
 *    A dedicated Kabila-filtered modal is used when `preferred === 'kabila'`
 *    so the user is deep-linked into Kabila instead of the generic grid.
 *
 * HashConnect has been removed. Wallets that only speak the legacy
 * HashConnect broadcast fall through to the WalletConnect modal.
 */
import toast from 'react-hot-toast'
import { WalletConnectModal } from '@walletconnect/modal'
import { initDAppConnector, getDAppConnector } from './appkit'
import { walletConnectProjectId } from '../constants'
import { type WalletId, getExtensionId } from './walletDetect'

const TOAST_AUTO_DISMISS_MS = 15_000

/** WalletConnect Cloud Explorer id for Kabila Wallet. */
const KABILA_WC_ID =
  'c40c24b39500901a330a025938552d70def4890fffe9bd315046bd33a2ece24d'

const loadingToast = (msg: string): string => {
  const id = toast.loading(msg)
  if (typeof window !== 'undefined') {
    window.setTimeout(() => toast.dismiss(id), TOAST_AUTO_DISMISS_MS)
  }
  return id
}

/** Notify the rest of the app that a new wallet session may be available. */
const announceSessionChange = (): void => {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent('prism:wallet-session-changed'))
  } catch { /* noop */ }
}

type DAppConnectorLike = Awaited<ReturnType<typeof initDAppConnector>>

/**
 * Best-effort: clear any stale WalletConnect pairings/sessions cached in
 * localStorage. Wallets reject `wc_sessionPropose` with "Pairing already
 * exists" when a topic from a prior tab/session is still in our
 * SignClient store but no live session exists for it.
 */
const purgeStaleWcPairings = async (dc: DAppConnectorLike): Promise<void> => {
  try {
    const anyDc = dc as unknown as {
      walletConnectClient?: {
        core?: {
          pairing?: {
            getPairings?: () => Array<{ topic: string }>
            disconnect?: (args: { topic: string }) => Promise<void>
          }
        }
        session?: {
          getAll?: () => Array<{ topic: string }>
        }
        disconnect?: (args: { topic: string; reason: { code: number; message: string } }) => Promise<void>
      }
      disconnectAll?: () => Promise<void>
    }
    const client = anyDc.walletConnectClient
    if (!client) return

    const sessions = client.session?.getAll?.() ?? []
    for (const s of sessions) {
      try {
        await client.disconnect?.({
          topic: s.topic,
          reason: { code: 6000, message: 'New connection requested' },
        })
      } catch { /* noop */ }
    }

    const pairings = client.core?.pairing?.getPairings?.() ?? []
    for (const p of pairings) {
      try {
        await client.core?.pairing?.disconnect?.({ topic: p.topic })
      } catch { /* noop */ }
    }
  } catch (e) {
    console.warn('[connectWallet] purgeStaleWcPairings failed:', e)
  }
}

/**
 * Open a Kabila-only WalletConnect modal: a fresh `WalletConnectModal`
 * built per click with the explorer filtered to Kabila so the user is
 * deep-linked into Kabila (extension / mobile universal link) instead
 * of a generic wallet grid.
 */
const connectKabilaViaWalletConnect = async (
  dc: DAppConnectorLike,
): Promise<boolean> => {
  const anyDc = dc as unknown as {
    walletConnectClient?: {
      connect: (opts: {
        pairingTopic?: string
        requiredNamespaces: unknown
      }) => Promise<{ uri?: string; approval: () => Promise<unknown> }>
    }
    network: { toString: () => string }
    supportedMethods: string[]
    supportedEvents: string[]
    onSessionConnected: (s: unknown) => Promise<void>
  }
  const wc = anyDc.walletConnectClient
  if (!wc) {
    console.warn('[connectWallet] Kabila path: WC client not ready')
    return false
  }

  const kabilaModal = new WalletConnectModal({
    projectId: walletConnectProjectId,
    chains: [
      `hedera:${anyDc.network.toString().toLowerCase().includes('mainnet') ? 'mainnet' : 'testnet'}`,
    ],
    explorerRecommendedWalletIds: [KABILA_WC_ID],
    explorerExcludedWalletIds: 'ALL',
  })

  try {
    const requiredNamespaces = {
      hedera: {
        methods: anyDc.supportedMethods,
        chains: [
          `hedera:${anyDc.network.toString().toLowerCase().includes('mainnet') ? 'mainnet' : 'testnet'}`,
        ],
        events: anyDc.supportedEvents,
      },
    }
    const { uri, approval } = await wc.connect({ requiredNamespaces })
    if (!uri) {
      console.warn('[connectWallet] Kabila path: no WC uri returned')
      return false
    }

    kabilaModal.openModal({ uri })
    const session = (await approval()) as Parameters<typeof anyDc.onSessionConnected>[0]
    await anyDc.onSessionConnected(session)
    announceSessionChange()
    return true
  } catch (e) {
    console.warn('[connectWallet] Kabila WC connect failed/cancelled:', e)
    return false
  } finally {
    try { kabilaModal.closeModal() } catch { /* noop */ }
  }
}

export const connectWalletConnect = async (
  preferred?: WalletId,
): Promise<boolean> => {
  const dc = await initDAppConnector()
  await purgeStaleWcPairings(dc)

  if (preferred === 'kabila') {
    const ok = await connectKabilaViaWalletConnect(dc)
    if (ok) return true
    // Fall through to the generic modal as a last resort.
  }

  try {
    const session = await dc.openModal()
    if (session) announceSessionChange()
    return !!session
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/Pairing already exists/i.test(msg)) {
      console.warn('[connectWallet] duplicate pairing, retrying after purge')
      await purgeStaleWcPairings(dc)
      try {
        const session = await dc.openModal()
        if (session) announceSessionChange()
        return !!session
      } catch (e2) {
        console.warn('[connectWallet] retry after purge failed:', e2)
        return false
      }
    }
    console.warn('[connectWallet] WalletConnect modal failed/cancelled:', e)
    return false
  }
}

/**
 * Native Hedera wallet extension flow. Uses the modern
 * `hedera-extension` protocol via `DAppConnector.connectExtension`.
 * Returns false if the extension is not detected or the user does not
 * complete pairing. Callers should fall back to
 * `connectWalletConnect(id)` on false.
 *
 * Mirrors SaucerSwap's minimal shape — no pre-broadcast of
 * `hedera-extension-query`, no readiness polling. DAppConnector's own
 * `findExtensions()` fires a single query at init time and populates
 * its internal `extensions` array; re-broadcasting from our side races
 * with that flow and was the cause of "first click fails, second click
 * works" for HashPack.
 */
export const connectExtension = async (id: WalletId): Promise<boolean> => {
  const label =
    id === 'hashpack' ? 'HashPack' :
    id === 'kabila' ? 'Kabila' :
    'SaucerSwap'

  const t = loadingToast(`Opening ${label}…`)
  try {
    const extensionId = getExtensionId(id)
    if (!extensionId) return false

    const dc = await initDAppConnector()
    try {
      const session = await dc.connectExtension(extensionId)
      if (session) {
        announceSessionChange()
        return true
      }
      return false
    } catch (e) {
      console.warn(`[connectWallet] ${label} connectExtension failed:`, e)
      return false
    }
  } catch (e) {
    console.warn('[connectWallet] extension popup failed:', e)
    return false
  } finally {
    toast.dismiss(t)
  }
}

/** Best-effort modal teardown after a cancel. */
export const cancelEmbeddedConnect = (): void => {
  // DAppConnector's modal closes itself when openModal() rejects/resolves.
  void getDAppConnector()
}
