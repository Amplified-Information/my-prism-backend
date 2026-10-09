import { env } from '../env'
import { RESTRICTED_COUNTRIES } from '../constants'

/**
 * Non-prod only override so the notice can be previewed and so testing a
 * restricted country never locks anyone out of prod: /?geo=US
 */
export const geoOverrideCountry = (): string | null => {
  if (env === 'prod' || typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('geo')
  if (!raw) return null
  const code = raw.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}

export const isRestrictedCountry = (country: string | null): boolean => {
  if (!country) return false
  return RESTRICTED_COUNTRIES.includes(country.toUpperCase())
}
