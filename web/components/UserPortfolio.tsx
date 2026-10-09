import { useEffect } from 'react'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { useWalletContext } from '../src/contexts/WalletContext'
import { apiClient } from '../grpcClient'

/**
 * Component that fetches and stores portfolio data globally.
 * Matches reference implementation pattern for cross-component access.
 * Renders nothing - just manages global state.
 */
const UserPortfolio = () => {
  const { networkSelected } = useNetworkContext()
  const { userAccountInfo, setUserPortfolio } = useWalletContext()

  useEffect(() => {
    const getUserPortfolio = async () => {
      if (!userAccountInfo?.evm_address) return

      try {
        const evmAddress = userAccountInfo.evm_address.replace(/^0x/, '').toLowerCase()
        const net = networkSelected.toString().toLowerCase()

        console.log('[UserPortfolio] Fetching global portfolio for:', { evmAddress, net })

        const result = await apiClient.getUserPortfolio({ evmAddress, net })
        setUserPortfolio(result.response)

        console.log('[UserPortfolio] Portfolio stored globally:', result.response)
      } catch (error) {
        console.error('[UserPortfolio] Error fetching portfolio:', error)
        setUserPortfolio(undefined)
      }
    }

    if (userAccountInfo) {
      getUserPortfolio()
    } else {
      setUserPortfolio(undefined)
    }
  }, [networkSelected, userAccountInfo, setUserPortfolio])

  return null
}

export default UserPortfolio
