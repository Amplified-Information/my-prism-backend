import { createContext, useContext, useState } from 'react'
import { LedgerId } from '@hiero-ledger/sdk'

interface NetworkContextType {
  networkSelected: LedgerId
  setNetworkSelected: React.Dispatch<React.SetStateAction<LedgerId>>
  availableNetworks: LedgerId[]
  setAvailableNetworks: React.Dispatch<React.SetStateAction<LedgerId[]>>
  smartContractIds: { [key: string]: string }
  setSmartContractIds: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>
  usdcTokenIds: { [key: string]: string }
  setUsdcTokenIds: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>
  usdcNdecimals: number
  setUsdcNdecimals: React.Dispatch<React.SetStateAction<number>>
  tokenIds: { [key: string]: string }
  setTokenIds: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>
  marketCreationFeeScaledUsdc: number
  setMarketCreationFeeScaledUsdc: React.Dispatch<React.SetStateAction<number>>
  minOrderSizeUsd: number
  setMinOrderSizeUsd: React.Dispatch<React.SetStateAction<number>>
  // Backend-published signature scheme date ranges. Index = scheme version
  // (v0 = no primarySecondary, v1 = current scheme appending primarySecondary).
  // See backend lib/constants.go SigSchemeDateRanges and lib/sign.go.
  sigSchemeDateRanges: { start: number; end: number }[]
  setSigSchemeDateRanges: React.Dispatch<React.SetStateAction<{ start: number; end: number }[]>>
  // PrismV2 signing domain (backend 25fd9bd): proxy EVM address (40 hex, no 0x) and chain id per network.
  prismV2ProxyAddresses: { [key: string]: string }
  setPrismV2ProxyAddresses: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>
  chainIds: { [key: string]: bigint }
  setChainIds: React.Dispatch<React.SetStateAction<{ [key: string]: bigint }>>
  selectedLang: string
  setSelectedLang: React.Dispatch<React.SetStateAction<string>>
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

export const useNetworkContext = () => {
  const ctx = useContext(NetworkContext)
  if (!ctx) throw new Error('useNetworkContext must be used within NetworkProvider')
  return ctx
}

export const NetworkProvider = ({ children }: { children: React.ReactNode }) => {
  const [networkSelected, setNetworkSelected] = useState<LedgerId>(LedgerId.TESTNET)
  const [availableNetworks, setAvailableNetworks] = useState<LedgerId[]>([])
  
  const [smartContractIds, setSmartContractIds] = useState<{ [key: string]: string }>({})
  const [usdcTokenIds, setUsdcTokenIds] = useState<{ [key: string]: string }>({})
  const [usdcNdecimals, setUsdcNdecimals] = useState(6)
  const [tokenIds, setTokenIds] = useState<{ [key: string]: string }>({})
  const [marketCreationFeeScaledUsdc, setMarketCreationFeeScaledUsdc] = useState(0)
  const [minOrderSizeUsd, setMinOrderSizeUsd] = useState(0.01)
  const [sigSchemeDateRanges, setSigSchemeDateRanges] = useState<{ start: number; end: number }[]>([])
  const [prismV2ProxyAddresses, setPrismV2ProxyAddresses] = useState<{ [key: string]: string }>({})
  const [chainIds, setChainIds] = useState<{ [key: string]: bigint }>({ mainnet: 295n, testnet: 296n, previewnet: 297n })
  const [selectedLang, setSelectedLang] = useState('en')

  return (
    <NetworkContext.Provider value={{
      networkSelected, setNetworkSelected,
      availableNetworks, setAvailableNetworks,
      
      smartContractIds, setSmartContractIds,
      usdcTokenIds, setUsdcTokenIds,
      usdcNdecimals, setUsdcNdecimals,
      tokenIds, setTokenIds,
      marketCreationFeeScaledUsdc, setMarketCreationFeeScaledUsdc,
      minOrderSizeUsd, setMinOrderSizeUsd,
      sigSchemeDateRanges, setSigSchemeDateRanges,
      prismV2ProxyAddresses, setPrismV2ProxyAddresses,
      chainIds, setChainIds,
      selectedLang, setSelectedLang,
    }}>
      {children}
    </NetworkContext.Provider>
  )
}
