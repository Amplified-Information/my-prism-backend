import { createContext, useContext, useState } from 'react'
import { BookSnapshot } from './gen/clob'
import { LedgerId } from '@hiero-ledger/sdk'
import { DAppConnector, DAppSigner } from '@hashgraph/hedera-wallet-connect'
import { MarketResponse, UserPortfolioResponse } from './gen/api'
import { UserAccountInfo } from './types'

// 1. Define a type for your context
interface AppContextType {
  isLoggedIn: boolean
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>
  networkSelected: LedgerId
  setNetworkSelected: React.Dispatch<React.SetStateAction<LedgerId>>
  dAppConnector: DAppConnector | undefined
  setDappConnector: React.Dispatch<React.SetStateAction<DAppConnector | undefined>>
  signerZero: DAppSigner | undefined
  setSignerZero: React.Dispatch<React.SetStateAction<DAppSigner | undefined>>
  isToggled: boolean[]
  setIsToggled: React.Dispatch<React.SetStateAction<boolean[]>>
  book: BookSnapshot
  setBook: React.Dispatch<React.SetStateAction<BookSnapshot>>
  spenderAllowanceUsd: number
  setSpenderAllowanceUsd: React.Dispatch<React.SetStateAction<number>>
  userAccountInfo: UserAccountInfo | undefined
  setUserAccountInfo: React.Dispatch<React.SetStateAction<UserAccountInfo | undefined>>
  userPortfolio: UserPortfolioResponse
  setUserPortfolio: React.Dispatch<React.SetStateAction<UserPortfolioResponse>>

  availableNetworks: LedgerId[]
  setAvailableNetworks: React.Dispatch<React.SetStateAction<LedgerId[]>>
  smartContractIds: {[key: string]: string }
  setSmartContractIds: React.Dispatch<React.SetStateAction<{[key: string]: string }>>
  usdcTokenIds: {[key: string]: string }
  setUsdcTokenIds: React.Dispatch<React.SetStateAction<{[key: string]: string }>>
  usdcNdecimals: number
  setUsdcNdecimals: React.Dispatch<React.SetStateAction<number>>
  selectedLang: string
  setSelectedLang: React.Dispatch<React.SetStateAction<string>>
  marketCreationFeeScaledUsdc: number
  setMarketCreationFeeScaledUsdc: React.Dispatch<React.SetStateAction<number>>
  tokenIds: {[key: string]: string }
  setTokenIds: React.Dispatch<React.SetStateAction<{[key: string]: string }>>
  nMarkets: number
  setNmarkets: React.Dispatch<React.SetStateAction<number>>
  minOrderSizeUsd: number
  setMinOrderSizeUsd: React.Dispatch<React.SetStateAction<number>>
  tvlUsd: number
  setTvlUsd: React.Dispatch<React.SetStateAction<number>>
  totalVolumeUsd: {[key: string]: number }
  setTotalVolumeUsd: React.Dispatch<React.SetStateAction<{[key: string]: number }>>

  showPopupAllowance: boolean
  setShowPopupAllowance: React.Dispatch<React.SetStateAction<boolean>>
  showPopupTradePanel: boolean
  setShowPopupTradePanel: React.Dispatch<React.SetStateAction<boolean>>
  
  marketId: string | undefined
  setMarketId: React.Dispatch<React.SetStateAction<string | undefined>>
  market: MarketResponse | undefined
  setMarket: React.Dispatch<React.SetStateAction<MarketResponse | undefined>>
  markets: MarketResponse[]
  setMarkets: React.Dispatch<React.SetStateAction<MarketResponse[]>>
}

// 2. Create the context with `undefined` (so we can inject real values later)
const AppContext = createContext<AppContextType | undefined>(undefined)

const useAppContext = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}

// 3. Build the provider with real state
const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [networkSelected, setNetworkSelected] = useState<LedgerId>(LedgerId.TESTNET)
  const [dAppConnector, setDappConnector] = useState<DAppConnector | undefined>(undefined)
  const [signerZero, setSignerZero] = useState<DAppSigner | undefined>(undefined)
  const [isToggled, setIsToggled] = useState<boolean[]>(Array(4).fill(false))
  const [book, setBook] = useState<BookSnapshot>({ bids: [], asks: [] })
  const [spenderAllowanceUsd, setSpenderAllowanceUsd] = useState<number>(0)
  const [userAccountInfo, setUserAccountInfo] = useState<UserAccountInfo | undefined>(undefined)
  const [userPortfolio, setUserPortfolio] = useState<UserPortfolioResponse>({ positions: {}, openPredictionIntents: {} })

  const [availableNetworks, setAvailableNetworks] = useState<LedgerId[]>([])
  const [smartContractIds, setSmartContractIds] = useState<{[key: string]: string }>({})
  const [usdcTokenIds, setUsdcTokenIds] = useState<{[key: string]: string }>({})
  const [usdcNdecimals, setUsdcNdecimals] = useState<number>(2)
  const [selectedLang, setSelectedLang] = useState<string>('en')
  const [marketCreationFeeScaledUsdc, setMarketCreationFeeScaledUsdc] = useState<number>(0)
  const [tokenIds, setTokenIds] = useState<{[key: string]: string }>({})
  const [nMarkets, setNmarkets] = useState<number>(0)
  const [minOrderSizeUsd, setMinOrderSizeUsd] = useState<number>(0.00)
  const [tvlUsd, setTvlUsd] = useState<number>(0)
  const [totalVolumeUsd, setTotalVolumeUsd] = useState<{[key: string]: number }>({})
  
  const [showPopupAllowance, setShowPopupAllowance] = useState<boolean>(false)
  const [showPopupTradePanel, setShowPopupTradePanel] = useState<boolean>(false)

  const [marketId, setMarketId] = useState<string | undefined>(undefined)
  const [market, setMarket] = useState<MarketResponse | undefined>(undefined)
  const [markets, setMarkets] = useState<MarketResponse[]>([])
  return (
    <AppContext.Provider
      value={{
        isLoggedIn,
        setIsLoggedIn,
        networkSelected,
        setNetworkSelected,
        dAppConnector,
        setDappConnector,
        signerZero,
        setSignerZero,
        isToggled,
        setIsToggled,
        book,
        setBook,
        spenderAllowanceUsd,
        setSpenderAllowanceUsd,
        userAccountInfo,
        setUserAccountInfo,
        userPortfolio,
        setUserPortfolio,

        availableNetworks,
        setAvailableNetworks,
        smartContractIds,
        setSmartContractIds,
        usdcTokenIds,
        setUsdcTokenIds,
        usdcNdecimals,
        setUsdcNdecimals,
        selectedLang,
        setSelectedLang,
        marketCreationFeeScaledUsdc,
        setMarketCreationFeeScaledUsdc,
        tokenIds,
        setTokenIds,
        nMarkets,
        setNmarkets,
        minOrderSizeUsd,
        setMinOrderSizeUsd,
        tvlUsd,
        setTvlUsd,
        totalVolumeUsd,
        setTotalVolumeUsd,

        showPopupAllowance,
        setShowPopupAllowance,
        showPopupTradePanel,
        setShowPopupTradePanel,

        marketId,
        setMarketId,
        market,
        setMarket,
        markets,
        setMarkets
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export default AppProvider

export {
  useAppContext
}