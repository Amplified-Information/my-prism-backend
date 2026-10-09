import { useEffect } from 'react'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { useUIContext } from '../src/contexts/UIContext'
import { getSpenderAllowanceUsd } from '../lib/hedera'
import { usePrism } from '../lib/usePrism'
import { PositionInfo } from '../gen/api'

const Balances = () => {
  const { smartContractIds, usdcTokenIds, usdcNdecimals, networkSelected } = useNetworkContext()
  const { spenderAllowanceUsd, setSpenderAllowanceUsd, signerZero, userPortfolio } = useWalletContext()
  const { setShowPopupAllowance } = useUIContext()

  // PRSM token balance now comes from the dedicated GetPrism RPC.
  // $PRSM is a 6-decimal HTS token (scs/scripts/launchToken.ts), so divide by 10^6.
  const { prismBalance, prismUnredeemed } = usePrism()
  const prsmBalance = Number(prismBalance) / Math.pow(10, 6)
  const frozenPrsm = Number(prismUnredeemed) / Math.pow(10, 6)


  const updateSpenderAllowance = async () => {
    if (signerZero === undefined) {
      console.warn('signerZero not yet available, cannot update allowance')
      return
    }
    if (Object.keys(smartContractIds).length === 0) {
      console.warn('smartContractIds not set yet, cannot update allowance')
      return
    }
     if (Object.keys(usdcTokenIds).length === 0) {
      console.warn('usdcTokenIds not set yet, cannot update allowance')
      return
    }

    console.log('***', networkSelected, '***', usdcTokenIds, '***', smartContractIds)

    try {
      const _spenderAllowance = await getSpenderAllowanceUsd(networkSelected, usdcTokenIds, usdcNdecimals, smartContractIds[networkSelected.toString().toLowerCase()], signerZero!.getAccountId().toString())
      setSpenderAllowanceUsd(_spenderAllowance)
    } catch (error) {
      console.error('Error updating spender allowance:', error)
    }
  }

  useEffect(() => {
    ;(async () => {
      await updateSpenderAllowance()
    })()
  }, [signerZero, networkSelected, smartContractIds, usdcTokenIds, usdcNdecimals])

  
  if (signerZero === undefined) {
    return <></>
  }

  // Calculate liquidated value from global portfolio state using reference formula:
  // LiquidatedValue = Sum(pos.yes * priceUsd + pos.no * (1 - priceUsd)) / (10 ** decimals)
  const calculateLiquidatedValue = (): number => {
    if (!userPortfolio?.positions) return 0
    
    const scaleFactor = Math.pow(10, usdcNdecimals)
    let totalValue = 0
    
    // Backend sends map<string, PositionInfo> with nested Position
    for (const [, posInfo] of Object.entries(userPortfolio.positions as { [marketId: string]: PositionInfo })) {
      const yesQty = (Number(posInfo.position?.yes) || 0) / scaleFactor
      const noQty = (Number(posInfo.position?.no) || 0) / scaleFactor
      const price = posInfo.priceUsd || 0.50
      
      totalValue += yesQty * price + noQty * (1 - price)
    }
    
    return totalValue
  }
  
  const liquidatedValue = calculateLiquidatedValue()

  return (
    <div className="flex items-center justify-center -mt-1">
    {/* <div className="px-4 md:px-8 lg:px-24"> */}
      <div>
    {/* <div className="absolute left-0 top-full z-20    px-4 md:px-8 lg:px-24">
      <div className="relative inline-block"> */}
        <span className="inline-block px-2 py-2 rounded-b-md text-white text-xs shadow border border-t-0 border-gray-500 cursor-pointer" >
          
          
          <span 
            title='Your current balance in USD' 
            onClick={ () => { setShowPopupAllowance(true) }}
          >
            balance: <a className='text-blue-500 cursor-pointer'>
              ${spenderAllowanceUsd.toFixed(2)}
            </a>
          </span>

          &nbsp;&nbsp;|&nbsp;&nbsp;
          <span 
            title='The USD value if you sold all your positions at their current market prices'
          >
            liquidated value: <a className='text-blue-500 cursor-pointer'>
              ${liquidatedValue.toFixed(2)}
            </a>
          </span>

          &nbsp;&nbsp;|&nbsp;&nbsp;
          <span 
            title='PRSM balance'
          >
            <a className='text-blue-500'>
              {prsmBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PRSM
            </a>
          </span>

          &nbsp;&nbsp;|&nbsp;&nbsp;
          <span 
            title='Frozen PRSM - PRSM that is earned but not yet allocated to you'
          >
            PRSM 🧊: <a className='text-blue-500 cursor-pointer'>
              {frozenPrsm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </a>
            </span>
        </span>
      </div>            
    </div>
  )
}

export default Balances