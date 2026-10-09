/**
 * Single wallet-connector singleton.
 *
 * Unified stack: `@hashgraph/hedera-wallet-connect` v2 `DAppConnector`.
 * This mirrors SaucerSwap's approach — a single WalletConnect-based
 * connector that supports both the modern Hedera extension protocol
 * (`connectExtension`) and the standard WalletConnect relay/modal flow.
 *
 * HashConnect has been removed. All extension pairings now go through
 * `DAppConnector.connectExtension(extensionId)`; relay pairings go
 * through `DAppConnector.openModal()`. The rest of the app is agnostic
 * to which of the two paths produced the signer.
 */
import { LedgerId } from '@hiero-ledger/sdk'
import {
  DAppConnector,
  HederaChainId,
  HederaJsonRpcMethod,
  HederaSessionEvent,
  type DAppSigner as HwcDAppSigner,
} from '@hashgraph/hedera-wallet-connect'
import { walletConnectProjectId, walletMetaData } from '../constants'

/** Signer produced by the unified DAppConnector stack. */
export type DAppSigner = HwcDAppSigner

export const hederaNamespace = 'hedera'

let _dapp: DAppConnector | undefined
let _dappInitPromise: Promise<DAppConnector> | undefined
let _currentNetwork: LedgerId = LedgerId.TESTNET

const ledgerToChain = (network: LedgerId): HederaChainId =>
  network.toString().toLowerCase() === 'mainnet'
    ? HederaChainId.Mainnet
    : HederaChainId.Testnet

export const ledgerToCaipNetwork = (network: LedgerId): string =>
  ledgerToChain(network)

const buildDAppConnector = (network: LedgerId): DAppConnector =>
  new DAppConnector(
    {
      name: walletMetaData.name,
      description: walletMetaData.description,
      url: walletMetaData.url,
      icons: walletMetaData.icons,
    },
    network,
    walletConnectProjectId,
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
    [ledgerToChain(network)],
  )

/**
 * Lazily initialise the DAppConnector singleton. Safe to call from
 * anywhere. The connector broadcasts a `hedera-extension-query`
 * ~200ms after construction to discover installed extensions; it does
 * not initiate any pairing on its own.
 */
export const initDAppConnector = async (): Promise<DAppConnector> => {
  if (_dapp) return _dapp
  if (_dappInitPromise) return _dappInitPromise

  _dappInitPromise = (async () => {
    const dc = buildDAppConnector(_currentNetwork)
    try {
      await dc.init({ logger: 'error' })
    } catch (e) {
      console.warn('[dappconnector] init warning:', e)
    }
    _dapp = dc
    return dc
  })()

  try {
    return await _dappInitPromise
  } finally {
    _dappInitPromise = undefined
  }
}

/** Direct access to the connector singleton (may be undefined). */
export const getDAppConnector = (): DAppConnector | undefined => _dapp

/**
 * Ping the active WalletConnect session (if any) to confirm the
 * wallet's relay socket is alive before we send an
 * `executeWithSigner` request. Returns:
 *  - 'ok'         — session ack'd within the timeout
 *  - 'no-session' — no signer active; skip check
 *  - 'stale'      — session exists but did not ack in time; caller
 *                   should surface an actionable "wallet not
 *                   responding" error instead of waiting minutes.
 */
export const pingWalletConnectSession = async (
  timeoutMs: number = 8000,
): Promise<'ok' | 'no-session' | 'stale'> => {
  const dc = _dapp
  const signer = dc?.signers?.[0] as HwcDAppSigner | undefined
  const topic = signer?.topic
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (dc as any)?.walletConnectClient
  if (!dc || !signer || !topic || !client?.ping) return 'no-session'

  try {
    await Promise.race([
      client.ping({ topic }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ping-timeout')), timeoutMs)),
    ])
    return 'ok'
  } catch (e) {
    console.warn('[wc] session ping failed:', e)
    return 'stale'
  }
}

/**
 * Subscribe to WalletConnect session-end events for the active pairing.
 *
 * Fires when the wallet drops the session (`session_delete`), the session
 * expires, or the underlying pairing is deleted. Any of these mean no ack
 * can physically arrive for an in-flight signing request, so callers can
 * safely abort a pending `sign()` without racing the response channel.
 *
 * `pairing_delete` carries the pairing topic, not the session topic, so it
 * can't be matched against `activeTopic` the way session events are. To
 * avoid killing an unrelated in-flight call over the cleanup of some other,
 * unrelated pairing, it's only forwarded when we no longer have any active
 * signer at all — i.e. it's corroborated by an actual loss of session state,
 * not just "some pairing somewhere got deleted."
 *
 * Returns an `unsubscribe` function. Safe to call even when no client is
 * initialised (returns a no-op).
 */
export const onSessionEnd = (
  handler: (reason: 'session_delete' | 'session_expire' | 'pairing_delete') => void,
): (() => void) => {
  const dc = _dapp
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (dc as any)?.walletConnectClient
  if (!client) return () => {}

  const signer = dc?.signers?.[0] as HwcDAppSigner | undefined
  const activeTopic = signer?.topic

  const onDelete = (ev: { topic?: string }) => {
    if (!activeTopic || ev?.topic === activeTopic) handler('session_delete')
  }
  const onExpire = (ev: { topic?: string }) => {
    if (!activeTopic || ev?.topic === activeTopic) handler('session_expire')
  }
  const onPairingDelete = (ev: { topic?: string }) => {
    void ev
    const stillHasSigner = !!dc?.signers?.length
    if (stillHasSigner) return
    handler('pairing_delete')
  }

  try {
    client.on?.('session_delete', onDelete)
    client.on?.('session_expire', onExpire)
    client.core?.pairing?.events?.on?.('pairing_delete', onPairingDelete)
  } catch (e) {
    console.warn('[wc] onSessionEnd subscribe failed:', e)
  }

  return () => {
    try {
      client.off?.('session_delete', onDelete)
      client.off?.('session_expire', onExpire)
      client.core?.pairing?.events?.off?.('pairing_delete', onPairingDelete)
    } catch { /* ignore */ }
  }
}

/**
 * Diagnostic shim used by walletDiagnostics. Returns a small object
 * with the current pairing summary.
 */
export const getHederaProvider = ():
  | {
      session?: {
        topic: string
        peer?: { metadata?: { name?: string } }
        expiry?: number
        namespaces?: Record<string, unknown>
      }
    }
  | undefined => {
  const dc = _dapp
  if (dc && dc.signers?.length) {
    const s = dc.signers[0]
    return {
      session: {
        topic: s.topic,
        peer: { metadata: { name: 'Hedera Wallet' } },
        namespaces: { hedera: { accounts: dc.signers.map((x) => x.getAccountId().toString()) } },
      },
    }
  }
  return undefined
}

/**
 * Switch the connector to a new Hedera ledger. Tears down the active
 * session and re-inits.
 */
export const setActiveNetwork = async (network: LedgerId): Promise<void> => {
  // Avoid tearing down a freshly-initialized connector when the effect
  // fires on mount with the default network. Rebuilding the same network
  // creates a second WalletConnect Core instance and triggers the
  // "WalletConnect Core is already initialized" warning.
  if (_currentNetwork.toString() === network.toString()) return

  _currentNetwork = network

  if (_dapp) {
    try {
      await _dapp.disconnectAll()
    } catch (e) {
      console.warn('[dappconnector] disconnectAll on network switch failed:', e)
    }
    const next = buildDAppConnector(network)
    try {
      await next.init({ logger: 'error' })
    } catch (e) {
      console.warn('[dappconnector] re-init warning:', e)
    }
    _dapp = next
  }
}

/**
 * Build a signer for the active pairing from the DAppConnector's
 * signer list. Returns undefined if no session is active.
 */
export const buildSigner = (
  network: LedgerId,
  preferredAccountId?: string,
): DAppSigner | undefined => {
  void network
  if (!_dapp || _dapp.signers.length === 0) return undefined
  let signer: HwcDAppSigner | undefined
  if (preferredAccountId) {
    signer = _dapp.signers.find(
      (s) => s.getAccountId().toString() === preferredAccountId,
    )
  }
  if (!signer) signer = _dapp.signers[0]
  return signer
}

/**
 * Re-resolve a signer from the connector's *current* signer list just before
 * a wallet-facing call.
 *
 * Signers are held in React state (`WalletContext.signerZero`) for the whole
 * session, but `DAppConnector` rebuilds its signer list whenever the session
 * is updated or extended — which routinely happens right after the first
 * signature. A cached instance can then point at a topic the wallet no longer
 * listens on, so the request is published and simply never surfaces in
 * HashPack. Falls back to the passed-in signer when no match is found.
 */
export const resolveFreshSigner = <T extends DAppSigner>(signer: T): T => {
  try {
    const accountId = signer.getAccountId().toString()
    const fresh = _dapp?.signers?.find((s) => s.getAccountId().toString() === accountId)
    if (fresh && fresh !== (signer as unknown as HwcDAppSigner)) {
      console.debug('[appkit] re-resolved stale signer for', accountId)
      return fresh as unknown as T
    }
  } catch (e) {
    console.warn('[appkit] resolveFreshSigner failed (using cached signer):', e)
  }
  return signer
}

