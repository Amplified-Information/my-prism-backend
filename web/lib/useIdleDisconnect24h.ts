import { useEffect, useRef, useCallback } from 'react'

/**
 * Force-disconnects the wallet after 24h of user inactivity.
 *
 * Activity is measured via a persisted timestamp in localStorage so the
 * timeout survives page reloads and tab restarts. On mount (and when the
 * tab regains focus) the hook checks the stored timestamp and disconnects
 * immediately if more than 24h has elapsed since the last recorded activity.
 *
 * The disconnect is silent — no toast is shown. The user is simply returned
 * to the disconnected state and can reconnect normally on the next action.
 */

const IDLE_LIMIT_MS = 24 * 60 * 60 * 1000 // 24 hours
const STORAGE_KEY = 'prism.lastActivityAt'
const THROTTLE_MS = 30 * 1000 // write to localStorage at most every 30s

interface UseIdleDisconnect24hProps {
  isConnected: boolean
  onDisconnect: (options?: { silent?: boolean }) => void | Promise<void>
}

const readLastActivity = (): number | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

const writeLastActivity = (ts: number) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(ts))
  } catch {
    /* storage unavailable — fall back to in-memory only */
  }
}

const clearLastActivity = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export const useIdleDisconnect24h = ({
  isConnected,
  onDisconnect,
}: UseIdleDisconnect24hProps) => {
  const lastWriteRef = useRef<number>(0)
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onDisconnectRef = useRef(onDisconnect)
  // False until this hook has observed one render. A connection seen on the
  // very first run is a session restored from storage; anything later is a
  // pairing the user just completed.
  const hasMountedRef = useRef(false)


  useEffect(() => {
    onDisconnectRef.current = onDisconnect
  }, [onDisconnect])

  const triggerDisconnect = useCallback(() => {
    clearLastActivity()
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current)
      expiryTimerRef.current = null
    }
    void onDisconnectRef.current({ silent: true })
  }, [])

  const scheduleExpiry = useCallback(
    (lastActivityAt: number) => {
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current)
      const remaining = lastActivityAt + IDLE_LIMIT_MS - Date.now()
      if (remaining <= 0) {
        triggerDisconnect()
        return
      }
      expiryTimerRef.current = setTimeout(triggerDisconnect, remaining)
    },
    [triggerDisconnect],
  )

  const recordActivity = useCallback(
    (force = false) => {
      const now = Date.now()
      if (!force && now - lastWriteRef.current < THROTTLE_MS) return
      lastWriteRef.current = now
      writeLastActivity(now)
      scheduleExpiry(now)
    },
    [scheduleExpiry],
  )

  useEffect(() => {
    if (!isConnected) {
      hasMountedRef.current = true
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current)
        expiryTimerRef.current = null
      }
      return
    }


    // A *fresh* pairing in this tab is itself user activity: the stored
    // timestamp belongs to a previous (already-ended) session and must not
    // kill the connection the user just made. Without this, reconnecting
    // after a day away silently disconnected on the first attempt — the
    // disconnect cleared the timestamp, so the second attempt "worked".
    // Only a session restored on mount is judged against the stored value.
    const isFreshConnect = hasMountedRef.current
    hasMountedRef.current = true

    const stored = readLastActivity()
    if (isFreshConnect || stored == null) {
      recordActivity(true)
    } else if (Date.now() - stored > IDLE_LIMIT_MS) {
      triggerDisconnect()
      return
    } else {
      scheduleExpiry(stored)
    }


    // Keep this list in sync with useActivityTimeout so "activity" is
    // defined identically across both timers guarding the same session.
    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'pointerdown',
    ]
    const handleActivity = () => recordActivity(false)

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const last = readLastActivity()
      if (last != null && Date.now() - last > IDLE_LIMIT_MS) {
        triggerDisconnect()
      } else if (last != null) {
        scheduleExpiry(last)
      }
    }

    activityEvents.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true }),
    )
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)

    return () => {
      activityEvents.forEach((event) =>
        window.removeEventListener(event, handleActivity),
      )
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current)
        expiryTimerRef.current = null
      }
    }
  }, [isConnected, recordActivity, scheduleExpiry, triggerDisconnect])
}
