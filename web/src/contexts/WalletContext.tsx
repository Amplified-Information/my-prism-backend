import { createContext, useContext, useEffect, useState } from 'react'
import type { DAppSigner } from '../../lib/appkit'
import { UserPortfolioResponse } from '../../gen/api'
import { UserAccountInfo } from '../../types'
import { primeExtensionDiscovery } from '../../lib/walletDetect'

interface WalletContextType {
  isLoggedIn: boolean
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>
  signerZero: DAppSigner | undefined
  setSignerZero: React.Dispatch<React.SetStateAction<DAppSigner | undefined>>
  userAccountInfo: UserAccountInfo | undefined
  setUserAccountInfo: React.Dispatch<React.SetStateAction<UserAccountInfo | undefined>>
  isWalletLoading: boolean
  setIsWalletLoading: React.Dispatch<React.SetStateAction<boolean>>
  spenderAllowanceUsd: number
  setSpenderAllowanceUsd: React.Dispatch<React.SetStateAction<number>>
  userPortfolio: UserPortfolioResponse | undefined
  setUserPortfolio: React.Dispatch<React.SetStateAction<UserPortfolioResponse | undefined>>
  isConnectSheetOpen: boolean
  setIsConnectSheetOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const useWalletContext = () => {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWalletContext must be used within WalletProvider')
  return ctx
}

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [signerZero, setSignerZero] = useState<DAppSigner | undefined>(undefined)
  const [userAccountInfo, setUserAccountInfo] = useState<UserAccountInfo | undefined>(undefined)
  const [isWalletLoading, setIsWalletLoading] = useState(false)
  const [spenderAllowanceUsd, setSpenderAllowanceUsd] = useState(0)
  const [userPortfolio, setUserPortfolio] = useState<UserPortfolioResponse | undefined>(undefined)
  const [isConnectSheetOpen, setIsConnectSheetOpen] = useState(false)

  // Broadcast Hedera-extension discovery on app load so "Detected" badges
  // are accurate before the user opens the Connect dropdown.
  useEffect(() => {
    primeExtensionDiscovery()
  }, [])

  return (
    <WalletContext.Provider value={{
      isLoggedIn, setIsLoggedIn,
      signerZero, setSignerZero,
      userAccountInfo, setUserAccountInfo,
      isWalletLoading, setIsWalletLoading,
      spenderAllowanceUsd, setSpenderAllowanceUsd,
      userPortfolio, setUserPortfolio,
      isConnectSheetOpen, setIsConnectSheetOpen,
    }}>
      {children}
    </WalletContext.Provider>
  )
}
