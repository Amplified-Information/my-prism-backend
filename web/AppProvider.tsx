import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NetworkProvider, useNetworkContext } from './src/contexts/NetworkContext'
import { WalletProvider, useWalletContext } from './src/contexts/WalletContext'
import { StatsProvider, useStatsContext } from './src/contexts/StatsContext'
import { UIProvider, useUIContext } from './src/contexts/UIContext'
import { MarketProvider, useMarketContext } from './src/contexts/MarketContext'


// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000)
    }
  }
})

/**
 * Facade hook — combines all five domain contexts into the legacy shape.
 * Consumers should migrate to domain-specific hooks over time.
 */
const useAppContext = () => {
  const wallet = useWalletContext()
  const network = useNetworkContext()
  const stats = useStatsContext()
  const ui = useUIContext()
  const market = useMarketContext()

  return {
    // Wallet
    isLoggedIn: wallet.isLoggedIn,
    setIsLoggedIn: wallet.setIsLoggedIn,
    signerZero: wallet.signerZero,
    setSignerZero: wallet.setSignerZero,
    userAccountInfo: wallet.userAccountInfo,
    setUserAccountInfo: wallet.setUserAccountInfo,
    isWalletLoading: wallet.isWalletLoading,
    setIsWalletLoading: wallet.setIsWalletLoading,
    spenderAllowanceUsd: wallet.spenderAllowanceUsd,
    setSpenderAllowanceUsd: wallet.setSpenderAllowanceUsd,
    userPortfolio: wallet.userPortfolio,
    setUserPortfolio: wallet.setUserPortfolio,

    // Network
    networkSelected: network.networkSelected,
    setNetworkSelected: network.setNetworkSelected,
    availableNetworks: network.availableNetworks,
    setAvailableNetworks: network.setAvailableNetworks,
    smartContractIds: network.smartContractIds,
    setSmartContractIds: network.setSmartContractIds,
    usdcTokenIds: network.usdcTokenIds,
    setUsdcTokenIds: network.setUsdcTokenIds,
    usdcNdecimals: network.usdcNdecimals,
    setUsdcNdecimals: network.setUsdcNdecimals,
    tokenIds: network.tokenIds,
    setTokenIds: network.setTokenIds,
    marketCreationFeeScaledUsdc: network.marketCreationFeeScaledUsdc,
    setMarketCreationFeeScaledUsdc: network.setMarketCreationFeeScaledUsdc,
    minOrderSizeUsd: network.minOrderSizeUsd,
    setMinOrderSizeUsd: network.setMinOrderSizeUsd,
    selectedLang: network.selectedLang,
    setSelectedLang: network.setSelectedLang,

    // Stats
    nMarkets: stats.nMarkets,
    setNmarkets: stats.setNmarkets,
    tvlUsd: stats.tvlUsd,
    setTvlUsd: stats.setTvlUsd,
    tvMatchedUsd: stats.tvMatchedUsd,
    setTvMatchedUsd: stats.setTvMatchedUsd,
    tvPendingUsd: stats.tvPendingUsd,
    setTvPendingUsd: stats.setTvPendingUsd,
    totalVolumeUsd: stats.totalVolumeUsd,
    setTotalVolumeUsd: stats.setTotalVolumeUsd,
    activeTraders: stats.activeTraders,
    setActiveTraders: stats.setActiveTraders,

    // UI
    isToggled: ui.isToggled,
    setIsToggled: ui.setIsToggled,
    showPopupAllowance: ui.showPopupAllowance,
    setShowPopupAllowance: ui.setShowPopupAllowance,
    showPopupTradePanel: ui.showPopupTradePanel,
    setShowPopupTradePanel: ui.setShowPopupTradePanel,
    showAllowanceSidebar: ui.showAllowanceSidebar,
    setShowAllowanceSidebar: ui.setShowAllowanceSidebar,

    // Market
    book: market.book,
    setBook: market.setBook,
    marketId: market.marketId,
    setMarketId: market.setMarketId,
    market: market.market,
    setMarket: market.setMarket,
    markets: market.markets,
    setMarkets: market.setMarkets,
    categories: market.categories,
    setCategories: market.setCategories,
  }
}

// Provider nesting: Network (outermost) → Wallet → Stats → UI → Market (innermost)
const AppProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <NetworkProvider>
        <WalletProvider>
          <StatsProvider>
            <UIProvider>
              <MarketProvider>
                {children}
                
              </MarketProvider>
            </UIProvider>
          </StatsProvider>
        </WalletProvider>
      </NetworkProvider>
    </QueryClientProvider>
  )
}

export default AppProvider

export {
  useAppContext
}
