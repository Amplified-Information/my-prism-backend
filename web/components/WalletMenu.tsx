import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UNLIMITED_ALLOWANCE_USD } from '../lib/hedera'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Copy, ExternalLink, LogOut, RefreshCw, Coins, Briefcase } from 'lucide-react'
import { useWallet } from '../lib/useWallet'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useUIContext } from '../src/contexts/UIContext'
import { getTokenBalance, getSpenderAllowanceUsd } from '../lib/hedera'
import { apiClient } from '../grpcClient'
import { fetchAllPaged } from '../lib/fetchAllPaged'
import { getMirrorNodeUrl } from '../constants'
import toast from 'react-hot-toast'

const WalletMenu = () => {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [usdcBalance, setUsdcBalance] = useState<number>(0)
  const [prsmBalance, setPrsmBalance] = useState<number>(0)
  const [hbarBalance, setHbarBalance] = useState<number>(0)
  const [usdcAllowance, setUsdcAllowance] = useState<number>(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const { disconnect, accountId, isLoading } = useWallet()
  const { 
    networkSelected, 
    usdcTokenIds,
    usdcNdecimals,
    tokenIds,
    smartContractIds
  } = useNetworkContext()
  const { setSpenderAllowanceUsd } = useWalletContext()
  const { setShowAllowanceSidebar, allowanceSidebarContractId } = useUIContext()

  // Mirror AllowanceManager's contract-selection: use the latest market
  // contract for the current network so the displayed allowance matches
  // what the Allowance Manager reads/writes. Falls back to the network
  // default from MacroMetadata when no markets are loaded yet.
  const { data: allMarkets } = useQuery({
    queryKey: ['markets', 'all-for-allowance'],
    queryFn: async () => {
      const { rows } = await fetchAllPaged(async ({ limit, offset }) => {
        const result = await apiClient.getMarkets({ limit, offset })
        return { rows: result.response.markets ?? [], pagination: undefined }
      }, { maxPages: 20 })
      return rows
    },
    staleTime: 60_000,
    enabled: !!accountId,
  })

  const networkKey = networkSelected.toString().toLowerCase()
  const defaultContractId = smartContractIds[networkKey] || ''

  const activeContractId = useMemo(() => {
    const seen = new Map<string, string>()
    for (const m of allMarkets ?? []) {
      if (!m.smartContractId) continue
      if ((m.net || '').toLowerCase() !== networkKey) continue
      const prev = seen.get(m.smartContractId)
      if (!prev || (m.createdAt && m.createdAt > prev)) {
        seen.set(m.smartContractId, m.createdAt || '')
      }
    }
    if (defaultContractId && !seen.has(defaultContractId)) {
      seen.set(defaultContractId, '')
    }
    if (allowanceSidebarContractId && !seen.has(allowanceSidebarContractId)) {
      seen.set(allowanceSidebarContractId, '')
    }
    const sorted = Array.from(seen.entries())
      .sort((a, b) => (b[1] || '').localeCompare(a[1] || ''))
      .map(([id]) => id)
    return sorted[0] || defaultContractId
  }, [allMarkets, networkKey, defaultContractId, allowanceSidebarContractId])

  const fetchHbarBalance = async () => {
    if (!accountId) return
    try {
      const mirrornode = `${getMirrorNodeUrl(networkSelected.toString())}/api/v1/accounts/${accountId}`
      const response = await fetch(mirrornode)
      if (response.ok) {
        const data = await response.json()
        setHbarBalance(data.balance?.balance / 100_000_000 || 0)
      }
    } catch (error) {
      console.error('Error fetching HBAR balance:', error)
    }
  }

  const fetchUsdcBalance = async () => {
    if (!accountId) return
    const usdcTokenId = usdcTokenIds[networkSelected.toString().toLowerCase()]
    if (!usdcTokenId) return
    try {
      const balance = await getTokenBalance(networkSelected, usdcTokenId, accountId)
      setUsdcBalance(balance / (10 ** usdcNdecimals))
    } catch (error) {
      console.error('Error fetching USDC balance:', error)
    }
  }

  const fetchPrsmBalance = async () => {
    if (!accountId) return
    const prsmTokenId = tokenIds[networkSelected.toString().toLowerCase()]
    if (!prsmTokenId) return
    try {
      const balance = await getTokenBalance(networkSelected, prsmTokenId, accountId)
      // PRSM has 6 decimals (per mirror node metadata)
      setPrsmBalance(balance / 1_000_000)
    } catch (error) {
      console.error('Error fetching PRSM balance:', error)
    }
  }

  const fetchUsdcAllowance = async () => {
    if (!accountId) return
    const usdcTokenId = usdcTokenIds[networkSelected.toString().toLowerCase()]
    const contractId = activeContractId
    if (!usdcTokenId || !contractId) return
    try {
      const allowance = await getSpenderAllowanceUsd(
        networkSelected,
        usdcTokenIds,
        usdcNdecimals,
        contractId,
        accountId
      )
      setUsdcAllowance(allowance)
      setSpenderAllowanceUsd(allowance) // Update global state
    } catch (error) {
      console.error('Error fetching USDC allowance:', error)
    }
  }

  const refreshBalances = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        fetchHbarBalance(),
        fetchUsdcBalance(),
        fetchPrsmBalance(),
        fetchUsdcAllowance()
      ])
    } catch (error) {
      console.error('Error refreshing balances:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Fetch HBAR balance (independent of token IDs)
  useEffect(() => {
    fetchHbarBalance()
  }, [accountId, networkSelected])

  // Fetch USDC balance (requires usdcTokenIds from MacroMetadata)
  useEffect(() => {
    fetchUsdcBalance()
  }, [accountId, networkSelected, usdcTokenIds, usdcNdecimals])

  // Fetch PRSM balance (requires tokenIds from MacroMetadata)
  useEffect(() => {
    fetchPrsmBalance()
  }, [accountId, networkSelected, tokenIds])

  // Fetch USDC allowance (requires smartContractIds from MacroMetadata)
  useEffect(() => {
    fetchUsdcAllowance()
  }, [accountId, networkSelected, usdcTokenIds, usdcNdecimals, activeContractId])

  // Refresh balances when dropdown opens
  useEffect(() => {
    if (isOpen && accountId) {
      refreshBalances()
    }
  }, [isOpen])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close menu on Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const truncateAddress = (address: string) => {
    if (!address) return ''
    if (address.length <= 12) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const copyAddress = () => {
    if (accountId) {
      navigator.clipboard.writeText(accountId)
      toast.success('Address copied!')
      setIsOpen(false)
    }
  }

  const viewOnHashScan = () => {
    if (accountId) {
      const network = networkSelected.toString().toLowerCase()
      const baseUrl = network === 'mainnet' 
        ? 'https://hashscan.io/mainnet' 
        : `https://hashscan.io/${network}`
      window.open(`${baseUrl}/account/${accountId}`, '_blank')
      setIsOpen(false)
    }
  }

  const handleDisconnect = async () => {
    setIsOpen(false)
    await disconnect()
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Wallet Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg border-2 border-primary/60 bg-transparent hover:border-primary transition-colors"
        disabled={isLoading}
      >
        <span className="text-primary font-medium text-sm">
          {truncateAddress(accountId || '')}
        </span>
        <span className="text-muted-foreground text-xs hidden sm:inline">
          ({hbarBalance.toFixed(2)} HBAR)
        </span>
        <ChevronDown className={`w-4 h-4 text-primary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="wallet-menu absolute right-0 top-full mt-2 w-64 border border-border rounded-xl shadow-lg overflow-hidden z-50 animate-in">
          {/* Account Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-lg">
                  {accountId?.charAt(accountId.length - 1) || 'W'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-medium truncate">
                  Wallet
                </p>
                <p className="text-muted-foreground text-sm truncate">
                  {accountId}
                </p>
              </div>
            </div>
          </div>

          {/* Balances */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Balance
              </p>
              <button
                onClick={refreshBalances}
                disabled={isRefreshing}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-primary/10 rounded transition-colors disabled:opacity-50"
                title="Refresh balances"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-foreground font-medium">
                  {hbarBalance.toFixed(2)} HBAR
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  {usdcBalance.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} USDC
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  {prsmBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PRSM
                </span>
              </div>
            </div>
          </div>

          {/* Allowance */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Allowance
              </p>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setShowAllowanceSidebar(true)
                }}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Manage
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary" />
              <span className="text-foreground font-medium">
                {usdcAllowance >= UNLIMITED_ALLOWANCE_USD * 0.99 ? '∞ Max USDC' : `$${usdcAllowance.toFixed(2)} USDC`}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-1">
            <button
              onClick={() => {
                setIsOpen(false)
                navigate('/portfolio')
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-muted-foreground hover:text-foreground hover:bg-primary/10 rounded-lg transition-colors text-sm"
            >
              <Briefcase className="w-4 h-4" />
              <span>View Portfolio</span>
            </button>

            <button
              onClick={copyAddress}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-muted-foreground hover:text-foreground hover:bg-primary/10 rounded-lg transition-colors text-sm"
            >
              <Copy className="w-4 h-4" />
              <span>Copy Address</span>
            </button>

            <button
              onClick={viewOnHashScan}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-muted-foreground hover:text-foreground hover:bg-primary/10 rounded-lg transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span>View on HashScan</span>
            </button>
          </div>

          {/* Disconnect */}
          <div className="p-1 border-t border-border">
            <button
              onClick={handleDisconnect}
              disabled={isLoading}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>{isLoading ? 'Disconnecting...' : 'Disconnect'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default WalletMenu
