import { useNetworkContext } from '../src/contexts/NetworkContext'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { LedgerId } from '@hiero-ledger/sdk'


const NetworkSelector = () => {
  const { networkSelected, setNetworkSelected, availableNetworks } = useNetworkContext()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Ensure we always have at least the current network in the list, and deduplicate
  // Previewnet is excluded — the Hedera WalletConnect SDK has no Previewnet
  // chain definition, so no wallet can sign on it. Also defensively fall back
  // to Testnet if previewnet somehow becomes the selected network.
  useEffect(() => {
    if (networkSelected.isPreviewnet()) {
      setNetworkSelected(LedgerId.TESTNET)
    }
  }, [networkSelected, setNetworkSelected])

  const filtered = availableNetworks.filter((n) => !n.isPreviewnet())
  const networksToShow = filtered.length > 0
    ? [...new Map(filtered.map(n => [n.toString(), n])).values()]
    : [networkSelected]


  const getNetworkColor = (network: typeof networkSelected) => {
    if (network.isTestnet()) return 'hsl(30 100% 50%)' // orange
    if (network.isPreviewnet()) return 'hsl(270 100% 60%)' // purple
    return 'hsl(var(--primary))' // gold for mainnet
  }

  const getNetworkName = (network: typeof networkSelected) => {
    return network.toString()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 hover:bg-[hsl(var(--muted))]"
        style={{ 
          border: `1px solid ${getNetworkColor(networkSelected)}`,
          color: getNetworkColor(networkSelected)
        }}
      >
        <span 
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: getNetworkColor(networkSelected) }}
        />
        {getNetworkName(networkSelected)}
        <ChevronDown 
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-40 rounded-md shadow-lg z-50 overflow-hidden"
          style={{ 
            backgroundColor: 'hsl(240 10% 10%)',
            border: '1px solid hsl(var(--border))'
          }}
        >
          {networksToShow.map((network) => {
            const isSelected = network._ledgerId.toString() === networkSelected._ledgerId?.toString()
            return (
              <button
                key={network._ledgerId.toString()}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors duration-150 ${
                  isSelected 
                    ? 'bg-[hsl(var(--primary)/0.15)]' 
                    : 'hover:bg-[hsl(var(--muted))]'
                }`}
                style={{ 
                  color: isSelected ? getNetworkColor(network) : 'hsl(var(--foreground))'
                }}
                onClick={() => {
                  setNetworkSelected(network)
                  setIsOpen(false)
                }}
              >
                <span 
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getNetworkColor(network) }}
                />
                <span className="font-medium">{getNetworkName(network)}</span>
                {isSelected && (
                  <span className="ml-auto text-[10px] opacity-60">Active</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default NetworkSelector
