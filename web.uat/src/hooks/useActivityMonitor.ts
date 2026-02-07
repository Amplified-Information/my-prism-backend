import { useEffect, useRef, useCallback } from 'react';

interface ActivityMonitorConfig {
  onActivity: () => void;
  timeout: number; // in milliseconds
  warningThreshold: number; // in milliseconds before timeout
  onWarning: () => void;
  onTimeout: () => void;
  enabled: boolean;
}

export const useActivityMonitor = ({
  onActivity,
  timeout,
  warningThreshold,
  onWarning,
  onTimeout,
  enabled,
}: ActivityMonitorConfig) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  // Start/restart the timeout timers
  const resetTimer = useCallback(() => {
    if (!enabled) return;

    clearTimers();
    lastActivityRef.current = Date.now();

    // Set warning timer
    warningRef.current = setTimeout(() => {
      onWarning();
    }, timeout - warningThreshold);

    // Set timeout timer
    timeoutRef.current = setTimeout(() => {
      onTimeout();
    }, timeout);
  }, [enabled, timeout, warningThreshold, onWarning, onTimeout, clearTimers]);

  // Debounced activity handler to prevent excessive timer resets
  const handleActivity = useCallback(() => {
    if (!enabled) return;

    // Debounce activity events (max 1 reset per 30 seconds)
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    
    if (timeSinceLastActivity < 30000) return; // 30 seconds debounce

    // Clear existing debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounce timer
    debounceRef.current = setTimeout(() => {
      onActivity();
      resetTimer();
    }, 100); // 100ms debounce
  }, [enabled, onActivity, resetTimer]);

  // Handle page visibility changes
  const handleVisibilityChange = useCallback(() => {
    if (!enabled) return;
    
    if (document.visibilityState === 'visible') {
      handleActivity();
    }
  }, [enabled, handleActivity]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    // Start initial timer
    resetTimer();

    // Activity event listeners
    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Page visibility listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Window focus listeners
    window.addEventListener('focus', handleActivity);
    window.addEventListener('blur', handleActivity);

    return () => {
      clearTimers();
      
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleActivity);
      window.removeEventListener('blur', handleActivity);
    };
  }, [enabled, resetTimer, handleActivity, handleVisibilityChange, clearTimers]);

  // Return current status
  return {
    resetTimer,
    clearTimers,
    lastActivity: lastActivityRef.current,
  };
};