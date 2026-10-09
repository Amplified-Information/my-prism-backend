/**
 * Dev-only wallet signing diagnostics panel.
 *
 * Not user-facing. Enabled when any of:
 *   - URL has `?debug=1` or `?walletDebug=1`
 *   - `localStorage.walletDebug === '1'`
 *   - Keyboard toggle: Alt+Shift+D (also Option+Shift+D on macOS)
 *
 * Renders a floating panel listing the most recent signing lifecycle
 * events emitted by `lib/walletDiagnostics.ts` (order sign, cancel,
 * allowance, redeem, login, comment). Read-only — no behavior changes.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  subscribeSignEvents,
  clearSignEvents,
  snapshotSessions,
  type SignEvent,
} from '../lib/walletDiagnostics'
import { activeWalletLabel, forceResetWalletLock, walletLockHeldMs } from '../lib/walletMutex'

const isEnabledFromEnv = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('debug') === '1' || q.get('walletDebug') === '1') return true
  } catch { /* noop */ }
  return false
}

const phaseColor: Record<SignEvent['phase'], string> = {
  start:     '#60a5fa',
  heartbeat: '#a78bfa',
  ack:       '#34d399',
  error:     '#f87171',
  note:      '#94a3b8',
}

const fmtTime = (ms: number) => {
  const d = new Date(ms)
  return `${d.toLocaleTimeString([], { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

const fmtDur = (ms?: number) => {
  if (ms == null) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

const WalletSignDebugPanel = () => {
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(true)
  const [events, setEvents] = useState<SignEvent[]>([])
  const [filter, setFilter] = useState<string>('')
  const [autoscroll, setAutoscroll] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const listRef = useRef<HTMLDivElement>(null)

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Enablement is URL-only; keyboard/localStorage toggles are disabled
  // so the panel cannot be opened accidentally in production.
  useEffect(() => {
    setEnabled(isEnabledFromEnv())
  }, [])

  useEffect(() => {
    if (!enabled) return
    return subscribeSignEvents(setEvents)
  }, [enabled])

  useEffect(() => {
    if (!autoscroll || !listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [events, autoscroll])

  const filtered = useMemo(() => {
    if (!filter) return events
    const f = filter.toLowerCase()
    return events.filter((e) =>
      e.label.toLowerCase().includes(f) || e.phase.toLowerCase().includes(f)
    )
  }, [events, filter])

  const copyJson = async () => {
    try {
      const payload = {
        capturedAt: new Date().toISOString(),
        sessions: snapshotSessions(),
        events,
      }
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    } catch (e) {
      console.warn('[walletDebug] copy failed', e)
    }
  }

  if (!enabled) return null

  const wrapStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 12,
    left: 12,
    zIndex: 99999,
    width: open ? 480 : 'auto',
    maxHeight: open ? '55vh' : 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11,
    color: '#e2e8f0',
    background: 'rgba(15,23,42,0.92)',
    border: '1px solid rgba(59,130,246,0.5)',
    borderRadius: 8,
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 8px',
    background: 'rgba(30,41,59,0.9)',
    borderBottom: '1px solid rgba(59,130,246,0.35)',
    cursor: 'default',
  }

  const btn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    background: 'rgba(59,130,246,0.15)',
    border: '1px solid rgba(59,130,246,0.45)',
    color: '#e2e8f0',
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: 10,
    cursor: 'pointer',
    ...extra,
  })

  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <span style={{ color: '#60a5fa', fontWeight: 600 }}>wallet-sign debug</span>
        <span style={{ opacity: 0.6 }}>· {events.length} events</span>
        <div style={{ flex: 1 }} />
        {open && (
          <>
            <input
              placeholder="filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                background: 'rgba(15,23,42,0.6)',
                color: '#e2e8f0',
                border: '1px solid rgba(148,163,184,0.35)',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 10,
                width: 90,
              }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 3, opacity: 0.75 }}>
              <input
                type="checkbox"
                checked={autoscroll}
                onChange={(e) => setAutoscroll(e.target.checked)}
                style={{ margin: 0 }}
              />
              auto
            </label>
            <button style={btn()} onClick={copyJson} title="Copy events + sessions JSON">copy</button>
            <button style={btn()} onClick={clearSignEvents} title="Clear ring buffer">clear</button>
            <button
              style={btn()}
              onClick={() => {
                const held = walletLockHeldMs()
                const label = activeWalletLabel()
                forceResetWalletLock()
                console.warn('[debug] wallet lock reset', { label, heldMs: held })
              }}
              title="Force-release the wallet call lock"
            >
              reset lock
            </button>
          </>
        )}
        <button style={btn()} onClick={() => setOpen((v) => !v)}>
          {open ? '–' : '+'}
        </button>
      </div>

      {open && (
        <div ref={listRef} style={{ overflowY: 'auto', padding: '4px 6px' }}>
          {filtered.length === 0 && (
            <div style={{ opacity: 0.6, padding: 6 }}>No signing events yet.</div>
          )}
          {filtered.map((e) => (
            <div key={e.id}>
              <div
                onClick={() => e.error?.stack && toggleExpand(e.id)}
                style={{
                  padding: '3px 4px',
                  borderBottom: '1px solid rgba(148,163,184,0.12)',
                  display: 'grid',
                  gridTemplateColumns: '86px 62px 1fr 60px',
                  gap: 6,
                  alignItems: 'baseline',
                  cursor: e.error?.stack ? 'pointer' : 'default',
                }}
              >
                <span style={{ opacity: 0.7 }}>{fmtTime(e.t)}</span>
                <span style={{ color: phaseColor[e.phase], fontWeight: 600 }}>{e.phase}</span>
                <span>
                  <span style={{ color: '#f8fafc' }}>{e.label}</span>
                  {e.error?.message && (
                    <span style={{ color: '#fca5a5' }}> — {e.error.message}</span>
                  )}
                  {e.error?.stack && (
                    <span style={{ opacity: 0.5 }}> [stack]</span>
                  )}
                  {e.meta && Object.keys(e.meta).length > 0 && (
                    <span style={{ opacity: 0.6 }}> {JSON.stringify(e.meta)}</span>
                  )}
                </span>
                <span style={{ opacity: 0.7, textAlign: 'right' }}>{fmtDur(e.durMs)}</span>
              </div>
              {expandedIds.has(e.id) && e.error?.stack && (
                <pre
                  style={{
                    margin: 0,
                    padding: '6px 8px',
                    borderBottom: '1px solid rgba(148,163,184,0.12)',
                    background: 'rgba(0,0,0,0.25)',
                    color: '#fca5a5',
                    fontSize: 10,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 240,
                    overflow: 'auto',
                  }}
                >
                  {e.error.stack}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default WalletSignDebugPanel
