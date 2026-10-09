import { useEffect } from 'react'
import { apiClient } from '../grpcClient'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { useStatsContext } from '../src/contexts/StatsContext'
import { useMarketContext } from '../src/contexts/MarketContext'
import { LedgerId } from '@hiero-ledger/sdk'
import toast from 'react-hot-toast'

// Normalize backend network-keyed maps so client lookups by
// `network.toString().toLowerCase()` are robust against casing drift
// (e.g. "TESTNET" vs "testnet") and drop empty values that would
// otherwise pass a truthy-key check but fail downstream.
const normalizeNetworkMap = (m: { [k: string]: string } | undefined): { [k: string]: string } => {
  const out: { [k: string]: string } = {}
  if (!m) return out
  for (const [k, v] of Object.entries(m)) {
    if (v && String(v).trim() !== '') out[k.toLowerCase()] = v
  }
  return out
}



// retrieves the macro metadata
// set shared state variables accordingly
const MacroMetadata = () => {

  const { setMinOrderSizeUsd, setAvailableNetworks, setSmartContractIds, setUsdcTokenIds, setUsdcNdecimals, setMarketCreationFeeScaledUsdc, setTokenIds, setSigSchemeDateRanges, setPrismV2ProxyAddresses, setChainIds } = useNetworkContext()
  const { setTvlUsd, setTotalVolumeUsd, setNmarkets, setActiveTraders } = useStatsContext()
  const { setCategories } = useMarketContext()

  useEffect(() => {
    ;(async () => {
      try {
        console.log('retrieving macro metadata...')
        const response = (await apiClient.macroMetadata({}).response)
        console.log('macro metadata response:', response)
        console.log('Backend USDC token IDs:', response.usdcTokenIds)
        console.log('Backend smart contract IDs:', response.smartContractIds)
        console.log('Backend token IDs:', response.tokenIds)
        
        // Handle availableNetworks with fallback
        if (response.availableNetworks && Array.isArray(response.availableNetworks)) {
          const _availableNetworks = response.availableNetworks.map(netStr => {
            return LedgerId.fromString(netStr.trim())
          })
          setAvailableNetworks(_availableNetworks)
        }


        // Map fields may be undefined since we simplified the descriptor.
        // Normalize keys to lowercase so lookups keyed by
        // `LedgerId.toString().toLowerCase()` are casing-safe.
        if (response.prismV2ProxyAddresses) {
          const m = normalizeNetworkMap(response.prismV2ProxyAddresses)
          for (const k of Object.keys(m)) m[k] = m[k].replace(/^0x/i, '').toLowerCase()
          setPrismV2ProxyAddresses(m)
        }
        if (response.chainIds && Object.keys(response.chainIds).length > 0) {
          const ids: { [k: string]: bigint } = { mainnet: 295n, testnet: 296n, previewnet: 297n }
          for (const [k, v] of Object.entries(response.chainIds)) ids[k.toLowerCase()] = BigInt(v)
          setChainIds(ids)
        }
        if (response.smartContractIds) {
          setSmartContractIds(normalizeNetworkMap(response.smartContractIds))
        }

        if (response.usdcTokenIds) {
          const norm = normalizeNetworkMap(response.usdcTokenIds)
          setUsdcTokenIds(norm)
          if (Object.keys(norm).length === 0) {
            console.error('Backend returned empty usdcTokenIds map')
            toast.error('Network config incomplete: no USDC token IDs from backend.')
          }
        }

        if (response.usdcDecimals !== undefined) {
          setUsdcNdecimals(response.usdcDecimals)
        }


        if (response.marketCreationFeeScaledUsdc !== undefined) {
          setMarketCreationFeeScaledUsdc(Number(response.marketCreationFeeScaledUsdc))
        }

        if (response.nMarkets !== undefined) {
          setNmarkets(Number(response.nMarkets))
        }

        if (response.tokenIds) {
          setTokenIds(normalizeNetworkMap(response.tokenIds))
        }


        // Sync minimum order size from backend (allows micro-trades)
        if (response.minOrderSizeUsd !== undefined) {
          setMinOrderSizeUsd(response.minOrderSizeUsd)
        }

        if (response.tvlUsd !== undefined) {
          setTvlUsd(response.tvlUsd)
        }

        // if (response.tvMatchedUsd !== undefined) {
        //   setTvMatchedUsd(response.tvMatchedUsd)
        // }

        // if (response.tvPendingUsd !== undefined) {
        //   setTvPendingUsd(response.tvPendingUsd)
        // }

        if (response.totalVolumeUsd) {
          setTotalVolumeUsd(response.totalVolumeUsd)
        }

        if (response.activeTraders !== undefined) {
          setActiveTraders(response.activeTraders)
        }

        if (response.categories) {
          setCategories(response.categories)
        }

        // Signature scheme date ranges (index = scheme version).
        // Frontend currently produces v1 payloads; this surfaces the backend's
        // published ranges so we can detect drift before signing. See
        // useOrderLifecycle for the runtime guard.
        if (response.sigSchemeDateRanges && Array.isArray(response.sigSchemeDateRanges)) {
          const nowSec = Math.floor(Date.now() / 1000)
          const decoded = response.sigSchemeDateRanges.map((r, i) => ({
            version: i,
            start: r.start,
            end: r.end,
            startISO: new Date(Number(r.start) * 1000).toISOString(),
            endISO: new Date(Number(r.end) * 1000).toISOString(),
            activeNow: nowSec >= Number(r.start) && nowSec < Number(r.end),
          }))
          console.log('Backend sig scheme date ranges:', decoded)
          setSigSchemeDateRanges(response.sigSchemeDateRanges)
        }

        
      } catch (error) {
        console.error('Failed to fetch macro metadata:', error)
        toast.error('Failed to load network config. Some actions will be unavailable — please refresh.')
      }

    })()
  }, [])
  
  return (
    <>
      
    </>
  )
}

export default MacroMetadata