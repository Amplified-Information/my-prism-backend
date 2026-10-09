/**
 * Deep WalletConnect / HashPack instrumentation for a single wallet call.
 *
 * `instrumentWcCall(label, fn)` subscribes to every relevant signal the WC
 * client + browser expose for the duration of `fn()` and prints them with a
 * shared correlation id so we can see, in order:
 *
 *   - the JSON-RPC id and method we sent to HashPack over the relay
 *   - the payload size (bytes)
 *   - relayer socket state (connected / disconnected / error)
 *   - pairing + session lifecycle events (proposal, update, ping, expire, delete)
 *   - popup heuristics: document.visibilitychange, window blur/focus (a working
 *     HashPack popup typically blurs the tab within ~500ms of the request)
 *   - the JSON-RPC response id + result/error, or the fact that none arrived
 *
 * Zero behavior change — pure logging. Safe to leave on in production; the
 * output is `console.debug`-level.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { getDAppConnector } from './appkit'

type Unsub = () => void

const CID = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : `wc-${Math.random().toString(36).slice(2, 10)}`

const now = () => Date.now()
const ms = (from: number) => `${now() - from}ms`

const safeSize = (v: unknown): number => {
  try { return JSON.stringify(v ?? null).length } catch { return -1 }
}

const summarizeParams = (params: any) => {
  try {
    // WalletConnect JSON-RPC shape: { topic, chainId, request: { method, params } }
    const inner = params?.request ?? params
    return {
      topic: (params?.topic || '').slice(0, 12),
      chainId: params?.chainId,
      method: inner?.method,
      paramCount: Array.isArray(inner?.params) ? inner.params.length : undefined,
      bytes: safeSize(inner?.params),
    }
  } catch {
    return { bytes: safeSize(params) }
  }
}

/**
 * Subscribe to WC client + browser events. Returns an `unsubscribe`.
 * Safe when there is no active DAppConnector (returns a no-op).
 */
const subscribe = (cid: string, label: string, t0: number): Unsub => {
  const dc = getDAppConnector() as any
  const client = dc?.walletConnectClient
  const relayer = client?.core?.relayer
  const heartbeat = client?.core?.heartbeat
  const pairing = client?.core?.pairing
  const session = client?.session

  const tag = (evt: string) => `[wc-instr ${cid} ${label}] ${evt} +${ms(t0)}`
  const log = (evt: string, data?: unknown) =>
    // eslint-disable-next-line no-console
    console.debug(tag(evt), data ?? '')

  if (!client) {
    log('no-client — DAppConnector not initialised; nothing to subscribe')
    return () => {}
  }

  // --- Snapshot connection state at the moment we send the request.
  try {
    const activeSigner = dc?.signers?.[0]
    log('snapshot', {
      relayerConnected: relayer?.connected,
      relayerConnecting: relayer?.connecting,
      pendingRequests: client.getPendingSessionRequests?.()?.length,
      sessions: session?.length,
      activeTopic: activeSigner?.topic?.slice(0, 12),
      account: activeSigner?.getAccountId?.().toString?.(),
      visibility: typeof document !== 'undefined' ? document.visibilityState : 'n/a',
      hasFocus: typeof document !== 'undefined' ? document.hasFocus() : 'n/a',
    })
  } catch (e) {
    log('snapshot-failed', { err: (e as Error)?.message })
  }

  const unsubs: Unsub[] = []
  const on = (emitter: any, evt: string, handler: (...args: any[]) => void) => {
    if (!emitter?.on) return
    try {
      emitter.on(evt, handler)
      unsubs.push(() => { try { emitter.off?.(evt, handler) } catch { /* ignore */ } })
    } catch { /* ignore */ }
  }

  // --- Relayer transport events (raw socket to relay.walletconnect.com).
  on(relayer, 'relayer_connect', () => log('relayer_connect'))
  on(relayer, 'relayer_disconnect', () => log('relayer_disconnect'))
  on(relayer, 'relayer_error', (e: unknown) => log('relayer_error', { err: (e as Error)?.message }))
  on(relayer, 'relayer_transport_closed', () => log('relayer_transport_closed'))
  on(relayer, 'relayer_message', (payload: any) => {
    // Fires when the relay pushes a message to us (this is how HashPack's
    // response comes back). We log topic prefix + size, never content.
    log('relayer_message', {
      topic: (payload?.topic || '').slice(0, 12),
      bytes: safeSize(payload?.message),
    })
  })
  on(relayer, 'relayer_publish', (payload: any) => {
    log('relayer_publish', {
      topic: (payload?.topic || '').slice(0, 12),
      bytes: safeSize(payload?.message),
      tag: payload?.opts?.tag,
    })
  })

  // --- Heartbeat pulse — confirms the WC core is alive and pumping.
  let hbCount = 0
  on(heartbeat, 'heartbeat_pulse', () => {
    hbCount++
    if (hbCount <= 3 || hbCount % 5 === 0) log('heartbeat_pulse', { n: hbCount })
  })

  // --- Session + request lifecycle.
  on(client, 'session_request_sent', (ev: any) =>
    log('session_request_sent', { id: ev?.id, topic: (ev?.topic || '').slice(0, 12), ...summarizeParams(ev?.request) }),
  )
  on(client, 'session_event', (ev: any) => log('session_event', { name: ev?.params?.event?.name, chainId: ev?.params?.chainId }))
  on(client, 'session_update', (ev: any) => log('session_update', { topic: (ev?.topic || '').slice(0, 12) }))
  on(client, 'session_ping', (ev: any) => log('session_ping', { topic: (ev?.topic || '').slice(0, 12) }))
  on(client, 'session_expire', (ev: any) => log('session_expire', { topic: (ev?.topic || '').slice(0, 12) }))
  on(client, 'session_delete', (ev: any) => log('session_delete', { topic: (ev?.topic || '').slice(0, 12) }))
  on(client, 'session_extend', (ev: any) => log('session_extend', { topic: (ev?.topic || '').slice(0, 12) }))
  on(pairing?.events, 'pairing_ping', () => log('pairing_ping'))
  on(pairing?.events, 'pairing_delete', (ev: any) => log('pairing_delete', { topic: (ev?.topic || '').slice(0, 12) }))
  on(pairing?.events, 'pairing_expire', (ev: any) => log('pairing_expire', { topic: (ev?.topic || '').slice(0, 12) }))

  // --- Popup heuristics: HashPack extension blurs the tab within a few
  //     hundred ms when the popup surfaces. If we never see a blur, the
  //     popup almost certainly did not open.
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    const onVis = () => log('visibilitychange', { state: document.visibilityState })
    const onBlur = () => log('window.blur — popup likely surfaced')
    const onFocus = () => log('window.focus — popup likely dismissed')
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    unsubs.push(() => document.removeEventListener('visibilitychange', onVis))
    unsubs.push(() => window.removeEventListener('blur', onBlur))
    unsubs.push(() => window.removeEventListener('focus', onFocus))

    // No-popup warning: no blur within 3s of send.
    const noPopupTimer = setTimeout(() => {
      if (document.hasFocus()) {
        log('WARN no popup detected within 3s — HashPack may not have received the request')
      }
    }, 3000)
    unsubs.push(() => clearTimeout(noPopupTimer))
  }

  // --- Periodic status while the call is in-flight.
  let tick = 0
  const statusTimer = setInterval(() => {
    tick++
    log(`status t+${tick * 5}s`, {
      relayerConnected: relayer?.connected,
      pendingRequests: client.getPendingSessionRequests?.()?.length,
      visibility: typeof document !== 'undefined' ? document.visibilityState : 'n/a',
      hasFocus: typeof document !== 'undefined' ? document.hasFocus() : 'n/a',
    })
  }, 5000)
  unsubs.push(() => clearInterval(statusTimer))

  return () => {
    unsubs.forEach((u) => { try { u() } catch { /* ignore */ } })
  }
}

/**
 * Wrap a wallet-facing async call with deep WC instrumentation. Result is
 * unchanged; only logs are added.
 */
export const instrumentWcCall = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  const cid = CID()
  const t0 = now()
  // eslint-disable-next-line no-console
  console.debug(`[wc-instr ${cid} ${label}] BEGIN`, { t0 })
  const unsubscribe = subscribe(cid, label, t0)
  try {
    const result = await fn()
    // eslint-disable-next-line no-console
    console.debug(`[wc-instr ${cid} ${label}] END-ok +${ms(t0)}`, {
      resultType: result && typeof result === 'object' ? (result.constructor?.name || 'object') : typeof result,
    })
    return result
  } catch (e) {
    // eslint-disable-next-line no-console
    console.debug(`[wc-instr ${cid} ${label}] END-err +${ms(t0)}`, {
      name: (e as Error)?.name,
      message: (e as Error)?.message,
    })
    throw e
  } finally {
    unsubscribe()
  }
}
