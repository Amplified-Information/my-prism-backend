import { useEffect } from 'react'
import { apiClient } from '../grpcClient'
import { useAppContext } from '../AppProvider'
import { LedgerId } from '@hiero-ledger/sdk'

// retrieves the macro metadata
// set shared state variables accordingly
const MacroMetadata = () => {

  const { setTvlUsd, setTotalVolumeUsd, setMinOrderSizeUsd, setAvailableNetworks, setSmartContractIds, setUsdcTokenIds, setUsdcNdecimals, setMarketCreationFeeScaledUsdc, setTokenIds, setNmarkets} = useAppContext()

  useEffect(() => {
    ;(async () => {
      console.log('retrieving macro metadata...')
      const response = (await apiClient.macroMetadata({}).response)
      console.log('macro metadata response:', response)
      
      const _availableNetworks = response.availableNetworks.map(netStr => {
        return LedgerId.fromString(netStr.trim())
      })
      setAvailableNetworks(_availableNetworks)
      //// setNetworkSelected(LedgerId.MAINNET)

      setSmartContractIds(response.smartContractIds)

      setUsdcTokenIds(response.usdcTokenIds)

      setUsdcNdecimals(response.usdcDecimals)

      setMarketCreationFeeScaledUsdc(Number(response.marketCreationFeeScaledUsdc))

      setNmarkets(Number(response.nMarkets))

      setTokenIds(response.tokenIds)

      setMinOrderSizeUsd(response.minOrderSizeUsd)

      setTvlUsd(response.tvlUsd)

      setTotalVolumeUsd(response.totalVolumeUsd)

    })()
  }, [])
  
  return (
    <>
    </>
  )
}

export default MacroMetadata