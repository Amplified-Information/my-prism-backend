import { useState, useEffect, useCallback, useRef } from 'react'

const INACTIVITY_TIMEOUT = 4 * 60 * 60 * 1000 // 4 hours
const WARNING_COUNTDOWN = 60 // 60 seconds

interface UseActivityTimeoutProps {
  isConnected: boolean
  onDisconnect: () => void
}

interface UseActivityTimeoutReturn {
  showTimeoutWarning: boolean
  countdown: number
  handleStayConnected: () => void
  handleDisconnect: () => void
}

export const useActivityTimeout = ({
  isConnected,
  onDisconnect,
}: UseActivityTimeoutProps): UseActivityTimeoutReturn => {
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)
  const [countdown, setCountdown] = useState(WARNING_COUNTDOWN)
  
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)

  const clearAllTimers = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }, [])

  const startInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }
    
    inactivityTimerRef.current = setTimeout(() => {
      setShowTimeoutWarning(true)
      setCountdown(WARNING_COUNTDOWN)
    }, INACTIVITY_TIMEOUT)
  }, [])

  const resetActivity = useCallback(() => {
    if (isConnected && !showTimeoutWarning) {
      startInactivityTimer()
    }
  }, [isConnected, showTimeoutWarning, startInactivityTimer])

  const handleStayConnected = useCallback(() => {
    setShowTimeoutWarning(false)
    setCountdown(WARNING_COUNTDOWN)
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    startInactivityTimer()
  }, [startInactivityTimer])

  const handleDisconnect = useCallback(() => {
    clearAllTimers()
    setShowTimeoutWarning(false)
    setCountdown(WARNING_COUNTDOWN)
    onDisconnect()
  }, [clearAllTimers, onDisconnect])

  // Start countdown when warning dialog is shown
  useEffect(() => {
    if (showTimeoutWarning) {
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Time's up - disconnect
            handleDisconnect()
            return WARNING_COUNTDOWN
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
      }
    }
  }, [showTimeoutWarning, handleDisconnect])

  // Set up activity listeners when connected
  useEffect(() => {
    if (!isConnected) {
      clearAllTimers()
      setShowTimeoutWarning(false)
      setCountdown(WARNING_COUNTDOWN)
      return
    }

    // Keep this list in sync with useIdleDisconnect24h so "activity" is
    // defined identically across both timers guarding the same session.
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'pointerdown']
    
    const handleActivity = () => {
      resetActivity()
    }

    // Start the initial timer
    startInactivityTimer()

    // Add event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      clearAllTimers()
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [isConnected, clearAllTimers, resetActivity, startInactivityTimer])

  return {
    showTimeoutWarning,
    countdown,
    handleStayConnected,
    handleDisconnect,
  }
}
