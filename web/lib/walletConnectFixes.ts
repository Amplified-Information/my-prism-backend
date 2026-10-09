import { Buffer } from 'buffer'
import process from 'process'

if (typeof window !== 'undefined') {
  // Node.js polyfills required by WalletConnect dependencies
  const w = window as unknown as { Buffer?: typeof Buffer; process?: typeof process }
  w.Buffer = w.Buffer || Buffer
  w.process = w.process || process

  // DataCloneError surfaces as an unhandledrejection somewhere inside the
  // WalletConnect/HashPack message-passing stack (most likely the extension's
  // own postMessage bridging — @walletconnect/keyvaluestorage's IndexedDB
  // layer JSON-stringifies before writing, so it isn't the storage layer).
  // It doesn't crash the page, but if it fires while a wallet-facing call
  // (order sign / allowance / redeem / cancel / login / comment) is
  // in-flight, whatever response that call is waiting on may never get
  // processed — the ack looks "dropped" and the caller would otherwise sit
  // out the full 5-minute hard timeout with no explanation.
  //
  // Previously this was a blind console.warn + preventDefault with no stack
  // and no link to which call (if any) was active when it happened, so every
  // occurrence was a dead end. Now: log full diagnostics into the same
  // ring buffer the rest of the wallet stack uses (visible in
  // WalletSignDebugPanel), and if a wallet call is active when it fires,
  // abort it immediately instead of leaving the user to wait out a timeout
  // for something we already have positive evidence broke.
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { name?: string; message?: string; stack?: string } | undefined
    const isDataCloneError =
      reason?.name === 'DataCloneError' || reason?.message?.includes('DataCloneError')
    if (!isDataCloneError) return

    event.stopImmediatePropagation()
    event.preventDefault()

    // Lazy import: this file is the first thing main.tsx loads, so pulling
    // in the wallet mutex/diagnostics/toast modules eagerly here would pull
    // the whole wallet stack into the app's very first evaluated module.
    //
    // Only surface a user-visible toast when the wallet debug panel is
    // enabled (Alt+Shift+D, ?debug=1, or localStorage.walletDebug='1').
    // In production this would otherwise dump a persistent full-stack red
    // toast for a background bridge error the user cannot act on.
    const isDebugEnabled = (() => {
      try {
        const q = new URLSearchParams(window.location.search)
        if (q.get('debug') === '1' || q.get('walletDebug') === '1') return true
        if (window.localStorage.getItem('walletDebug') === '1') return true
      } catch { /* noop */ }
      return false
    })()

    const toastPromise = isDebugEnabled
      ? import('react-hot-toast').catch(() => undefined)
      : Promise.resolve(undefined)
    void Promise.all([import('./walletMutex'), import('./walletDiagnostics'), toastPromise])
      .then(([walletMutexMod, walletDiagnosticsMod, toastMod]) => {
        const { activeWalletLabel } = walletMutexMod
        const { recordSignEvent } = walletDiagnosticsMod
        const toast = toastMod?.default

        const activeLabel = activeWalletLabel()
        const errorSummary = {
          name: reason?.name ?? 'DataCloneError',
          message: reason?.message ?? 'WalletConnect internal DataCloneError',
          stack: reason?.stack,
        }

        console.warn('[wc-fix] suppressed DataCloneError', {
          ...errorSummary,
          activeWalletCall: activeLabel,
        })

        recordSignEvent(activeLabel ?? 'unknown', 'error', {
          error: errorSummary,
          meta: { dataCloneError: true, activeWalletCall: activeLabel },
        })

        if (toast && isDebugEnabled) {
          const toastBody = [
            'WalletConnect internal DataCloneError',
            errorSummary.message,
            errorSummary.stack ? errorSummary.stack.slice(0, 1200) : '',
          ].filter(Boolean).join('\n\n')
          toast.error(toastBody, { duration: Infinity })
        }

        // Do NOT abort the active wallet call here: DataCloneError is a
        // background bridge error and aborting the awaiter racing the
        // wallet's real response corrupts session state (see plan).
      })
      .catch(() => { /* diagnostics best-effort only — never throw from here */ })

  })
}

export {}
