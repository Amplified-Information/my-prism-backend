import { useEffect } from 'react'
import { apiClient } from '../grpcClient'
// import { MarketResponse } from '../gen/api'
import { useNavigate } from 'react-router'
import { useAppContext } from '../AppProvider'

const Explore = () => {
  // const { signerZero } = useAppContext()
  const { markets, setMarkets } = useAppContext()

  const navigate = useNavigate()
  
  useEffect(() => {
    ;(async () => {
      const result = await apiClient.getMarkets({
        limit: 100,
        offset: 0
      })
      console.log(result.response.markets)
      setMarkets(result.response.markets)
    })()
  }, [])

  return (
    <>
      {markets.map((market) => (
        <div
          key={market.marketId}
          className="max-w-2xl mx-auto p-6 rounded-xl shadow-lg mb-6 cursor-pointer transform transition-all duration-200 hover:shadow-2xl border border-gray-200"
          onClick={() => navigate(`/market/${market.marketId}`)}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-purple-600">
              {market.isPaused ? (
                <span className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs">Paused</span>
              ) : (
                <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full text-xs">Active</span>
              )}
            </span>
            <span className="text-xs">
              {new Date(market.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </span>
          </div>
          <div className="mb-4">
            <i className="block text-2xl font-semibold mb-2">"{market.statement}"</i>
            {market.imageUrl && (
              <img
                src={market.imageUrl}
                alt="Market"
                className="w-full h-48 object-cover rounded-lg border border-gray-100 shadow-sm"
                style={{ maxHeight: 200 }}
              />
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-200">Market ID:</span>
            <span className="text-xs font-mono text-gray-700">{market.marketId}</span>
          </div>
          {typeof market.priceUsd !== 'undefined' && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-200">Price:</span>
              <span className="text-lg font-bold text-blue-700">${market.priceUsd.toFixed(4)}</span>
            </div>
          )}
        </div>
      ))}
    </>
  )
}

export default Explore
