/**
 * Gated diagnostic logging.
 *
 * Verbose wallet/order diagnostics leak sensitive material (signatures,
 * public keys, keccak payloads, EVM addresses, order sizes) into the browser
 * console. Anything of that nature must go through `debugLog` / `debugWarn` /
 * `debugError` so it only prints when the developer explicitly opts in.
 *
 * Enabled when any of:
 *   - the app is running a dev build (`import.meta.env.DEV`)
 *   - the URL has `?debug=1` or `?walletDebug=1`
 *   - `localStorage.walletDebug === '1'`
 *
 * Genuine user-facing failures should still use plain `console.error` with a
 * short, non-sensitive message.
 */

let cached: boolean | undefined

export const isDebugEnabled = (): boolean => {
  if (cached !== undefined) return cached
  let enabled = false
  try {
    if (import.meta.env?.DEV) enabled = true
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search)
      if (q.get('debug') === '1' || q.get('walletDebug') === '1') enabled = true
      if (window.localStorage.getItem('walletDebug') === '1') enabled = true
    }
  } catch { /* storage blocked — stay off */ }
  cached = enabled
  return enabled
}

/** Reset the memoized flag (used by tests / the debug panel toggle). */
export const resetDebugFlagCache = (): void => { cached = undefined }

export const debugLog = (...args: unknown[]): void => {
  if (isDebugEnabled()) console.log(...args)
}

export const debugWarn = (...args: unknown[]): void => {
  if (isDebugEnabled()) console.warn(...args)
}

export const debugError = (...args: unknown[]): void => {
  if (isDebugEnabled()) console.error(...args)
}
