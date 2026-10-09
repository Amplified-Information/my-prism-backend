import { useEffect, useState } from 'react'

// Browser-side country lookup (IP based, no permission prompt, no GPS).
// Advisory only: a VPN or a blocked request defeats it. Fail-open by design.

export type GeoStatus = 'loading' | 'ok' | 'error'

export interface GeoResult {
  country: string | null   // ISO 3166-1 alpha-2, uppercase
  status: GeoStatus
}

const CACHE_KEY = 'prism.geo.country.v1'
const TIMEOUT_MS = 4000

const normalize = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}

// Cloudflare trace: plain text "key=value" lines including `loc=CA`.
const fromCloudflare = async (): Promise<string | null> => {
  const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace', {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
  if (!res.ok) return null
  const text = await res.text()
  const line = text.split('\n').find(l => l.startsWith('loc='))
  return normalize(line?.slice(4))
}

const fromIpapi = async (): Promise<string | null> => {
  const res = await fetch('https://ipapi.co/json/', {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
  if (!res.ok) return null
  const json = await res.json()
  return normalize(json?.country_code ?? json?.country)
}

export const lookupCountry = async (): Promise<string | null> => {
  try {
    const cf = await fromCloudflare()
    if (cf) return cf
  } catch {
    // fall through to the secondary provider
  }
  try {
    return await fromIpapi()
  } catch {
    return null
  }
}

/**
 * Resolves the visitor's country once per browser session.
 * Only a successful lookup is cached, so failures retry on the next visit.
 */
export const useGeoCountry = (): GeoResult => {
  const [result, setResult] = useState<GeoResult>(() => {
    const cached = typeof sessionStorage !== 'undefined'
      ? normalize(sessionStorage.getItem(CACHE_KEY))
      : null
    return cached ? { country: cached, status: 'ok' } : { country: null, status: 'loading' }
  })

  useEffect(() => {
    if (result.status !== 'loading') return
    let cancelled = false

    lookupCountry().then(country => {
      if (cancelled) return
      if (country) {
        try { sessionStorage.setItem(CACHE_KEY, country) } catch { /* private mode */ }
        setResult({ country, status: 'ok' })
      } else {
        setResult({ country: null, status: 'error' })
      }
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return result
}
