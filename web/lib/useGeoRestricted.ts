import { useNetworkContext } from '../src/contexts/NetworkContext'
import { useGeoCountry } from './useGeoCountry'
import { geoOverrideCountry, isRestrictedCountry } from './geoRestriction'

/**
 * Advisory browser-side region check used to block trading (not browsing).
 * Only enforced on mainnet — testnet/previewnet trading stays open so the
 * restricted regions can still use the test environment.
 * Fails open: if the country lookup fails, trading stays available.
 */
export const useGeoRestricted = (): { restricted: boolean; country: string | null } => {
  const { networkSelected } = useNetworkContext()
  const geo = useGeoCountry()
  const override = geoOverrideCountry()
  const country = override ?? geo.country
  const isMainnet = networkSelected?.isMainnet?.() ?? false
  return { restricted: isMainnet && isRestrictedCountry(country), country }
}
