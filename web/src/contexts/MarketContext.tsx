import { createContext, useContext, useState } from 'react'
import { BookSnapshot } from '../../gen/clob'
import { MarketResponse } from '../../gen/api'

interface MarketContextType {
  book: BookSnapshot
  setBook: React.Dispatch<React.SetStateAction<BookSnapshot>>
  marketId: string | undefined
  setMarketId: React.Dispatch<React.SetStateAction<string | undefined>>
  market: MarketResponse | undefined
  setMarket: React.Dispatch<React.SetStateAction<MarketResponse | undefined>>
  markets: MarketResponse[]
  setMarkets: React.Dispatch<React.SetStateAction<MarketResponse[]>>
  categories: { id: number; name: string }[]
  setCategories: React.Dispatch<React.SetStateAction<{ id: number; name: string }[]>>
}

const MarketContext = createContext<MarketContextType | undefined>(undefined)

export const useMarketContext = () => {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarketContext must be used within MarketProvider')
  return ctx
}

export const MarketProvider = ({ children }: { children: React.ReactNode }) => {
  const [book, setBook] = useState<BookSnapshot>({ bids: [], asks: [] })
  const [marketId, setMarketId] = useState<string | undefined>(undefined)
  const [market, setMarket] = useState<MarketResponse | undefined>(undefined)
  const [markets, setMarkets] = useState<MarketResponse[]>([])
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])

  return (
    <MarketContext.Provider value={{
      book, setBook,
      marketId, setMarketId,
      market, setMarket,
      markets, setMarkets,
      categories, setCategories,
    }}>
      {children}
    </MarketContext.Provider>
  )
}
