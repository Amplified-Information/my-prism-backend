import { useEffect } from 'react'
import { useAppContext } from '../AppProvider'
import { apiClient } from '../grpcClient'

const UserPortfolio = () => {
  const { networkSelected, userAccountInfo, setUserPortfolio } = useAppContext()
  
  useEffect(() => {
    const getUserPortfolio = async () => {
      const result = await apiClient.getUserPortfolio({
        evmAddress: userAccountInfo.evm_address.replace(/^0x/, '').toLowerCase(),
        net: networkSelected.toString().toLowerCase()
        // marketId
      })
      console.log('User portfolio:', result.response)
      setUserPortfolio(result.response)
    }
    getUserPortfolio()
  }, [networkSelected, userAccountInfo])

  return null
}

export default UserPortfolio