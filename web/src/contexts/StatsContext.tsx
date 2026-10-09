import { createContext, useContext, useState } from 'react'

interface StatsContextType {
  nMarkets: number
  setNmarkets: React.Dispatch<React.SetStateAction<number>>
  tvlUsd: number
  setTvlUsd: React.Dispatch<React.SetStateAction<number>>
  tvMatchedUsd: number
  setTvMatchedUsd: React.Dispatch<React.SetStateAction<number>>
  tvPendingUsd: number
  setTvPendingUsd: React.Dispatch<React.SetStateAction<number>>
  totalVolumeUsd: { [key: string]: number }
  setTotalVolumeUsd: React.Dispatch<React.SetStateAction<{ [key: string]: number }>>
  activeTraders: number
  setActiveTraders: React.Dispatch<React.SetStateAction<number>>
}

const StatsContext = createContext<StatsContextType | undefined>(undefined)

export const useStatsContext = () => {
  const ctx = useContext(StatsContext)
  if (!ctx) throw new Error('useStatsContext must be used within StatsProvider')
  return ctx
}

export const StatsProvider = ({ children }: { children: React.ReactNode }) => {
  const [nMarkets, setNmarkets] = useState(0)
  const [tvlUsd, setTvlUsd] = useState(0)
  const [tvMatchedUsd, setTvMatchedUsd] = useState(0)
  const [tvPendingUsd, setTvPendingUsd] = useState(0)
  const [totalVolumeUsd, setTotalVolumeUsd] = useState<{ [key: string]: number }>({})
  const [activeTraders, setActiveTraders] = useState(0)

  return (
    <StatsContext.Provider value={{
      nMarkets, setNmarkets,
      tvlUsd, setTvlUsd,
      tvMatchedUsd, setTvMatchedUsd,
      tvPendingUsd, setTvPendingUsd,
      totalVolumeUsd, setTotalVolumeUsd,
      activeTraders, setActiveTraders,
    }}>
      {children}
    </StatsContext.Provider>
  )
}
