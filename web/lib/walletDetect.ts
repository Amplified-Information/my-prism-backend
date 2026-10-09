/**
 * Browser-extension probes for the "Detected" badges in the Connect
 * Wallet sheet.
 *
 * Detection uses the modern Hedera extension protocol only: a passive
 * `message` listener is installed app-wide, and on app load we
 * broadcast `hedera-extension-query`. Every Hedera-native wallet
 * extension (HashPack, Kabila, SaucerSwap) replies with its metadata
 * via `hedera-extension-response`. This broadcast is read-only —
 * extensions do not initiate any pairing in response.
 */

export type WalletId = 'hashpack' | 'kabila' | 'saucerswap' | 'walletconnect' | 'metamask'

interface ExtensionMetadata {
  name?: string
  description?: string
  icon?: string
  url?: string
  id?: string
}

interface W extends Window {
  ethereum?: { isMetaMask?: boolean }
}

const discovered: ExtensionMetadata[] = []
const subscribers = new Set<() => void>()
let discoveryStarted = false
let primed = false

const notify = () => {
  for (const cb of subscribers) {
    try { cb() } catch { /* ignore */ }
  }
}

const fireQuery = () => {
  if (typeof window === 'undefined') return
  try {
    // Target the page's own origin explicitly — extension content
    // scripts run in this same window, so they still receive it, but
    // the payload is never exposed to cross-origin frames.
    const target = window.location.origin && window.location.origin !== 'null'
      ? window.location.origin
      : window.location.href
    window.postMessage({ type: 'hedera-extension-query' }, target)
  } catch {
    /* ignore */
  }
}


const startDiscovery = (): void => {
  if (discoveryStarted || typeof window === 'undefined') return
  discoveryStarted = true
  window.addEventListener('message', (event: MessageEvent) => {
    // Defensive origin/source filter. Hedera extension content scripts
    // post from the same window at the page's own origin, so
    // legitimate replies still pass; cross-frame or cross-origin
    // messages that happen to reuse these `type` strings are dropped
    // so they can't spoof the "wallet detected" UI state.
    if (event.source !== window) return
    if (event.origin && event.origin !== window.location.origin) return
    const data = event?.data as { type?: string; metadata?: ExtensionMetadata } | undefined
    if (!data || typeof data.type !== 'string') return

    if (data.type === 'hedera-extension-response') {
      if (data.metadata) {
        const name = (data.metadata.name ?? '').toLowerCase()
        const existing = discovered.find((e) => (e.name ?? '').toLowerCase() === name)
        if (!existing) {
          discovered.push(data.metadata)
          notify()
        } else if (!existing.id && data.metadata.id) {
          existing.id = data.metadata.id
          notify()
        }
      }
    }
  })
}

const matches = (id: WalletId, ext: ExtensionMetadata): boolean => {
  const n = (ext.name ?? '').toLowerCase()
  if (id === 'hashpack') return n.includes('hashpack')
  if (id === 'kabila') return n.includes('kabila')
  if (id === 'saucerswap') return n.includes('saucer')
  return false
}

const findExt = (id: WalletId): ExtensionMetadata | undefined =>
  discovered.find((e) => matches(id, e))

/** Cheap synchronous probe. */
export const isDetectedSync = (id: WalletId): boolean => {
  if (typeof window === 'undefined') return false
  const w = window as W
  switch (id) {
    case 'hashpack':
      return !!findExt('hashpack')
    case 'kabila':
      return !!findExt('kabila')
    case 'saucerswap':
      return !!findExt('saucerswap')
    case 'metamask':
      return !!w.ethereum?.isMetaMask
    default:
      return false
  }
}

export const isDetected = isDetectedSync

/** Discovered Hedera extension id, if the wallet announced one. */
export const getExtensionId = (id: WalletId): string | undefined =>
  findExt(id)?.id

/** Start the passive response listener without broadcasting a query. */
export const listenForExtensionResponses = (): void => {
  startDiscovery()
}

/**
 * App-bootstrap discovery: install the listener and broadcast the
 * Hedera extension query a few times to catch late-injected content
 * scripts. Safe to call repeatedly — the actual broadcast schedule
 * only runs once.
 */
export const primeExtensionDiscovery = (): void => {
  startDiscovery()
  if (primed || typeof window === 'undefined') return
  primed = true
  const schedule = [0, 250, 750, 1500, 3000]
  for (const delay of schedule) {
    window.setTimeout(fireQuery, delay)
  }
}

/** Subscribe to discovery updates. Returns an unsubscribe fn. */
export const subscribeDiscovery = (cb: () => void): (() => void) => {
  subscribers.add(cb)
  return () => { subscribers.delete(cb) }
}

/**
 * Async probe. Re-fires the query every 250ms so late-injected content
 * scripts still get caught.
 */
export const detectHederaExtension = async (
  id: WalletId,
  timeoutMs = 2500,
): Promise<boolean> => {
  if (typeof window === 'undefined') return false

  startDiscovery()
  if (isDetectedSync(id)) return true
  fireQuery()

  return new Promise<boolean>((resolve) => {
    const start = Date.now()
    let lastQuery = Date.now()
    const tick = () => {
      if (isDetectedSync(id)) return resolve(true)
      if (Date.now() - start >= timeoutMs) return resolve(false)
      if (Date.now() - lastQuery >= 250) {
        fireQuery()
        lastQuery = Date.now()
      }
      window.setTimeout(tick, 50)
    }
    tick()
  })
}

/** Unified async detection used by the Connect sheet. */
export const detect = async (id: WalletId): Promise<boolean> => {
  if (id === 'hashpack' || id === 'kabila' || id === 'saucerswap') {
    return detectHederaExtension(id)
  }
  return isDetectedSync(id)
}

/**
 * Re-broadcast the extension query without the one-shot `primed` guard.
 *
 * `primeExtensionDiscovery()` only ever fires once per page load, so a
 * wallet whose content script injected late (or an extension installed
 * after load) stayed "undetected" — the first Connect click then routed to
 * the WalletConnect modal instead of the extension popup, and only the
 * second click (after responses had trickled in) took the native path.
 */
export const refreshExtensionDiscovery = (): void => {
  startDiscovery()
  if (typeof window === 'undefined') return
  for (const delay of [0, 200, 600]) window.setTimeout(fireQuery, delay)
}
