import { useEffect, useState } from 'react'
import { useAppContext } from '../AppProvider'
import { getSpenderAllowanceUsd, getTokenBalance } from '../lib/hedera'
import { formatNumberShort } from '../lib/utils'

const Balances = () => {
  const { smartContractIds, usdcTokenIds, spenderAllowanceUsd, usdcNdecimals, setSpenderAllowanceUsd, networkSelected, signerZero, setShowPopupAllowance, tokenIds, userPortfolio } = useAppContext()
  const [prsmBalance, setPrsmBalance] =  useState<number>(0)
  const [thinger, setThinger] = useState<boolean>(false)
  
  useEffect(() => {
    const fetchPrsmBalance = async () => {
      if (!signerZero) return
      const prsmTokenId = tokenIds[networkSelected.toString().toLowerCase()]
      if (!prsmTokenId) {
        console.warn('PRSM token ID not found for network:', networkSelected.toString())
        return
      } 
      console.log('signerZero.getAccountId().toString()', signerZero.getAccountId().toString())
      console.log('prsmTokenId', prsmTokenId)
      console.log('networkSelected', networkSelected.toString())
      const balance = await getTokenBalance(networkSelected, prsmTokenId, signerZero.getAccountId().toString())
      setPrsmBalance(balance)
    }
    fetchPrsmBalance()
  }, [signerZero, networkSelected, tokenIds])

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
            balance: 
              <span
                className="inline-block align-middle mr-1 cursor-pointer"
                title="Refresh balance"
                onClick={async () => {
                  try {
                    setThinger(true)
                    await updateSpenderAllowance()
                  } catch (error) {
                    console.error('Error refreshing spender allowance:', error)
                  } finally {
                    setThinger(false)
                  }
                }}
              >
                <svg
                  className={`${thinger ? 'animate-spin' : ''} h-3 w-3 text-blue-500 inline`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4l3-3-3-3v4a10 10 0 100 20v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
                  ></path>
                </svg>

              </span>
            <a className='text-blue-500 cursor-pointer'>
              ${spenderAllowanceUsd.toFixed(2)}
            </a>
          </span>

          &nbsp;&nbsp;|&nbsp;&nbsp;
          <span 
            title='The USD value if you sold all your positions at their current market prices'
          >
            liquidated value: <a className='text-blue-500 cursor-pointer'>
              ${(Object.values(userPortfolio.positions).reduce((acc, pos) => {
                return (
                  acc +
                  Number(pos.position.yes) * pos.priceUsd +
                  Number(pos.position.no) * (1 - pos.priceUsd)
                )
              }, 0) * ( 1 / 10 ** usdcNdecimals)).toFixed(2) }
            </a>
          </span>

          &nbsp;&nbsp;|&nbsp;&nbsp;
          <span 
            title='PRSM balance'
          >
            <a className='text-blue-500' onClick={() => {
              // open wallet
              // https://www.alchemy.com/docs/wallets/api-reference/smart-wallets/wallet-api-endpoints/wallet-api-endpoints/wallet-get-calls-status
              // signerZero.request({ method: 'wallet_getCapabilities', params: [] })
            }}>
              {formatNumberShort(prsmBalance)} PRSM
            </a>
          </span>

          &nbsp;&nbsp;|&nbsp;&nbsp;
          <span 
            title='Frozen PRSM - PRSM that is not yet allocated to you'
          >
            PRSM 🧊: <a className='text-blue-500 cursor-pointer'>
              {/* TODO */}
              {0.00}
            </a>
            </span>
        </span>
      </div>            
    </div>
  )
}

export default Balances