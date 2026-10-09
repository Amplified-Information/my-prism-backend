import { createContext, useContext, useState } from 'react'

interface UIContextType {
  isToggled: boolean[]
  setIsToggled: React.Dispatch<React.SetStateAction<boolean[]>>
  showPopupAllowance: boolean
  setShowPopupAllowance: React.Dispatch<React.SetStateAction<boolean>>
  showPopupTradePanel: boolean
  setShowPopupTradePanel: React.Dispatch<React.SetStateAction<boolean>>
  showAllowanceSidebar: boolean
  setShowAllowanceSidebar: React.Dispatch<React.SetStateAction<boolean>>
  allowanceSidebarContractId: string
  setAllowanceSidebarContractId: React.Dispatch<React.SetStateAction<string>>
}

const UIContext = createContext<UIContextType | undefined>(undefined)

export const useUIContext = () => {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUIContext must be used within UIProvider')
  return ctx
}

export const UIProvider = ({ children }: { children: React.ReactNode }) => {
  const [isToggled, setIsToggled] = useState<boolean[]>(Array(4).fill(false))
  const [showPopupAllowance, setShowPopupAllowance] = useState(false)
  const [showPopupTradePanel, setShowPopupTradePanel] = useState(false)
  const [showAllowanceSidebar, setShowAllowanceSidebar] = useState(false)
  const [allowanceSidebarContractId, setAllowanceSidebarContractId] = useState<string>('')

  return (
    <UIContext.Provider value={{
      isToggled, setIsToggled,
      showPopupAllowance, setShowPopupAllowance,
      showPopupTradePanel, setShowPopupTradePanel,
      showAllowanceSidebar, setShowAllowanceSidebar,
      allowanceSidebarContractId, setAllowanceSidebarContractId,
    }}>
      {children}
    </UIContext.Provider>
  )
}
