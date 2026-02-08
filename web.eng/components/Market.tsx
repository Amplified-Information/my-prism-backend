import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useAppContext } from '../AppProvider'
import { apiClient, clobClient } from '../grpcClient'
import GraphPrice from './GraphPrice'
import GraphOrderbook from './GraphOrderbook'
import Comments from './Comments'
import { isValidUUIDv7 } from '../lib/utils'

const Market = () => {
  const { markets, setMarkets, setMarket, setMarketId, setShowPopupTradePanel, userPortfolio, usdcNdecimals } = useAppContext()
  const [ bidUsd, setBidUsd ] = useState<number>(0.00)
  const [ askUsd, setAskUsd ] = useState<number>(0.00)
  const { marketId } = useParams()

  useEffect(() => {
    ;(async () => {
      
      if (!isValidUUIDv7(marketId!)){
        return
      }
      // retrieve one market (marketId)
      // update/add this market to markets (setMarkets), where marketId matches
      const result = await apiClient.getMarketById({ marketId: marketId! })
      
      setMarketId(result.response.marketId)
      setMarket(result.response)
      setMarkets([result.response, ...markets.filter(m => m.marketId !== marketId)])
      
      console.log('market: ', result.response)
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      if (!isValidUUIDv7(marketId!)){
        console.warn('Invalid marketId:', marketId)
        return
      }
      const priceResult = await clobClient.getPrice({ marketId })
      setBidUsd(priceResult.response.priceBidUsd)
      setAskUsd(Math.abs(priceResult.response.priceAskUsd))
    })()
  })
 
  return (
    <>
      <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <MarketEndDate endDate="31/12/2025" />
          <span className="text-xs text-muted-foreground">marketId: {marketId}</span>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
        <img
          className="rounded-lg w-full h-64 object-cover border border-zinc-200 dark:border-zinc-800 shadow"
          src={
            markets.find(m => m.marketId === marketId)?.imageUrl?.trim()
          ? markets.find(m => m.marketId === marketId)!.imageUrl
          : `${window.location.origin}/640_480.png`
          }
          alt="Market"
        />
        <div className="mt-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100 italic">
          "{markets.find(m => m.marketId === marketId)?.statement}"
        </div>
        <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          My positions:
          <br/>
          <span className="ml-2 font-bold text-green-600 dark:text-green-400">
            Yes ${(Number(userPortfolio.positions[marketId!]?.position.yes) / (10 ** usdcNdecimals)).toFixed(2)}
          </span>
          <span className="ml-4 font-bold text-red-600 dark:text-red-400">
            No ${(Number(userPortfolio.positions[marketId!]?.position.no) / (10 ** usdcNdecimals)).toFixed(2)}
          </span>
        </div>
        <button
          className="mt-6 w-full from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow transition-all duration-200 text-lg"
          onClick={() => { setShowPopupTradePanel(true) }}
        >
          Bet now ${ ((bidUsd + askUsd) / 2).toFixed(2) }
        </button>
          </div>
          <div className="flex-1 flex flex-col gap-4">
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 shadow">
          <span className="block text-sm font-semibold mb-2 text-zinc-700 dark:text-zinc-200">Price Chart</span>
          <div style={{ width: '100%', height: 240 }}>
            <GraphPrice marketId={marketId!} />
          </div>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 shadow">
          <span className="block text-sm font-semibold mb-2 text-zinc-700 dark:text-zinc-200">Order Book</span>
          <GraphOrderbook marketId={marketId!} />
        </div>
          </div>
        </div>
        <div className="mt-8">
          <Comments marketId={marketId!} />
        </div>
      </div>
    </>
  )
}

const MarketEndDate: React.FC<{ endDate: string }> = ({ endDate }) => {
  return (
    <div className="flex items-center text-sm text-muted-foreground mb-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lucide lucide-clock mr-1 h-4 w-4"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      Ends {endDate}
    </div>
  )
}

export default Market
