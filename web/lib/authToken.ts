/**
 * Centralized JWT storage.
 *
 * Security posture:
 * - Primary store: in-memory variable (cleared on full reload).
 * - Reload-survival: sessionStorage (cleared when the tab closes; same-origin only).
 * - Avoids `localStorage`, which persists indefinitely and may sync across devices.
 *
 * Cookie migration:
 * - When the backend issues an `HttpOnly; Secure; SameSite=Strict` cookie on
 *   `verifyChallenge` and reads it on subsequent calls, flip `useCookieAuth`
 *   to `true`. The gRPC transport already sends `credentials: 'include'`,
 *   so no further frontend changes will be needed.
 * - See docs/auth-cookie-migration.md for the backend checklist.
 */

const STORAGE_KEY = 'jwt'

// Toggle to true once the backend issues the auth cookie. When true, the
// frontend stops attaching the `authorization` metadata header and relies
// purely on the browser-managed cookie.
export const useCookieAuth = false

let memoryToken: string | null = null

const readSession = (): string | null => {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const writeSession = (value: string | null) => {
  try {
    if (value === null) {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, value)
    }
  } catch {
    // sessionStorage may be unavailable (private mode, etc.) — in-memory still works.
  }
}

// One-time migration: if a legacy localStorage token exists, move it to the
// safer session store and purge the persistent copy.
try {
  const legacy = window.localStorage.getItem(STORAGE_KEY)
  if (legacy) {
    memoryToken = legacy
    writeSession(legacy)
    window.localStorage.removeItem(STORAGE_KEY)
  }
} catch {
  // ignore
}

export const getToken = (): string | null => {
  if (memoryToken) return memoryToken
  const fromSession = readSession()
  if (fromSession) memoryToken = fromSession
  return memoryToken
}

export const setToken = (jwt: string): void => {
  memoryToken = jwt
  writeSession(jwt)
}

export const clearToken = (): void => {
  memoryToken = null
  writeSession(null)
  // Defensive: ensure no stale localStorage copy lingers.
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
