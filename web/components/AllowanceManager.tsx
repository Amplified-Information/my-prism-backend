import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { useUIContext } from '../src/contexts/UIContext'
import { getSpenderAllowanceUsd, grantAllowanceUsd, getTokenBalance, UNLIMITED_ALLOWANCE_USD } from '../lib/hedera'
import { abortActiveWalletCall, activeWalletLabel } from '../lib/walletMutex'
import { apiClient } from '../grpcClient'
import { fetchAllPaged } from '../lib/fetchAllPaged'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../src/components/ui/card'
import { Button } from '../src/components/ui/button'
import { Input } from '../src/components/ui/input'
import { Label } from '../src/components/ui/label'
import { Badge } from '../src/components/ui/badge'
import { Checkbox } from '../src/components/ui/checkbox'
import { RefreshCw, CheckCircle2, Wallet, Shield, Info, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface AllowanceManagerProps {
  requiredAmount?: number
  onAllowanceGranted?: () => void
}

// Threshold to consider allowance as "unlimited"
const MAX_ALLOWANCE_THRESHOLD = UNLIMITED_ALLOWANCE_USD * 0.99

const AllowanceManager = ({ requiredAmount = 0.10, onAllowanceGranted }: AllowanceManagerProps) => {
  const { signerZero, spenderAllowanceUsd, setSpenderAllowanceUsd } = useWalletContext()
  const { networkSelected, smartContractIds, usdcTokenIds, usdcNdecimals } = useNetworkContext()
  const { showAllowanceSidebar, allowanceSidebarContractId } = useUIContext()
  const wasOpenRef = useRef(false)

  const [usdcBalance, setUsdcBalance] = useState<number>(0)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isGranting, setIsGranting] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [newAllowanceAmount, setNewAllowanceAmount] = useState<string>('10.00')
  const [useMaxAllowance, setUseMaxAllowance] = useState(false)

  // Fetch all markets to derive distinct historical contract IDs for the
  // current network. The most recently created market's contract is the default.
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
  })

  const networkKey = networkSelected.toString().toLowerCase()
  const defaultContractId = smartContractIds[networkKey] || ''

  const contractOptions = useMemo(() => {
    const seen = new Map<string, string>() // contractId -> latest createdAt
    for (const m of allMarkets ?? []) {
      if (!m.smartContractId) continue
      if ((m.net || '').toLowerCase() !== networkKey) continue
      const prev = seen.get(m.smartContractId)
      if (!prev || (m.createdAt && m.createdAt > prev)) {
        seen.set(m.smartContractId, m.createdAt || '')
      }
    }
    // Always include the network default (in case no markets reference it yet).
    if (defaultContractId && !seen.has(defaultContractId)) {
      seen.set(defaultContractId, '')
    }
    // Include externally-requested contract id (e.g. from TradePanel "Manage")
    if (allowanceSidebarContractId && !seen.has(allowanceSidebarContractId)) {
      seen.set(allowanceSidebarContractId, '')
    }
    // Ordering: the backend-configured contract for this network always comes
    // first — it is authoritative and stays correct once the ERC-1967 proxy
    // (backend commit 5724668) is live, where the proxy keeps a *lower* entity
    // ID than the implementations deployed behind it. Remaining contracts are
    // sorted newest-first by entity number so historical approvals stay findable.
    const numeric = (id: string) => {
      const parts = id.split('.')
      const n = Number(parts[parts.length - 1])
      return Number.isFinite(n) ? n : -1
    }
    const rest = Array.from(seen.keys())
      .filter((id) => id !== defaultContractId)
      .sort((a, b) => numeric(b) - numeric(a))
    return defaultContractId && seen.has(defaultContractId) ? [defaultContractId, ...rest] : rest
  }, [allMarkets, networkKey, defaultContractId, allowanceSidebarContractId])

  // User-selectable contract. Defaults to the sidebar-requested contract
  // (from TradePanel "Manage") when set, otherwise the backend-configured
  // contract (falling back to the highest entity id when none is published).
  const [selectedContractId, setSelectedContractId] = useState<string>('')
  const smartContractId =
    (selectedContractId && contractOptions.includes(selectedContractId) && selectedContractId) ||
    (allowanceSidebarContractId && contractOptions.includes(allowanceSidebarContractId) && allowanceSidebarContractId) ||
    contractOptions[0] ||
    defaultContractId


  // When an external caller (TradePanel "Manage") requests a specific
  // contract, honour it. Re-sync each time the sidebar opens so re-clicking
  // "Manage" for contract A after the user previously switched to B in the
  // dropdown resets the picker back to A.
  useEffect(() => {
    if (!showAllowanceSidebar) return
    if (allowanceSidebarContractId && contractOptions.includes(allowanceSidebarContractId)) {
      setSelectedContractId(allowanceSidebarContractId)
    }
  }, [showAllowanceSidebar, allowanceSidebarContractId, contractOptions])


  const hasSufficientAllowance = spenderAllowanceUsd >= requiredAmount
  const isMaxAllowance = spenderAllowanceUsd >= MAX_ALLOWANCE_THRESHOLD

  const refreshAllowance = async () => {
    if (!signerZero || !smartContractId) return
    
    setIsRefreshing(true)
    try {
      const accountId = signerZero.getAccountId().toString()
      const usdcTokenId = usdcTokenIds[networkSelected.toString().toLowerCase()]
      
      // Fetch allowance and balance in parallel
      const [allowance, rawBalance] = await Promise.all([
        getSpenderAllowanceUsd(
          networkSelected, 
          usdcTokenIds, 
          usdcNdecimals, 
          smartContractId, 
          accountId
        ),
        usdcTokenId ? getTokenBalance(networkSelected, usdcTokenId, accountId) : Promise.resolve(0),
      ])
      
      setSpenderAllowanceUsd(allowance)
      setUsdcBalance(rawBalance / (10 ** usdcNdecimals))
    } catch (error) {
      console.error('Error refreshing allowance:', error)
      toast.error('Failed to refresh allowance')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleGrantAllowance = async () => {
    console.log('[AllowanceManager] handleGrantAllowance called')
    console.log('[AllowanceManager] signerZero:', !!signerZero)
    console.log('[AllowanceManager] smartContractId:', smartContractId)
    console.log('[AllowanceManager] networkSelected:', networkSelected?.toString())
    console.log('[AllowanceManager] useMaxAllowance:', useMaxAllowance)
    
    if (!signerZero) {
      console.error('[AllowanceManager] No signerZero - wallet not connected')
      toast.error('Please connect your wallet first')
      return
    }
    
    if (!smartContractId) {
      console.error('[AllowanceManager] No smartContractId configured')
      toast.error('Smart contract not configured for this network')
      return
    }
    
    if (!useMaxAllowance) {
      const amount = parseFloat(newAllowanceAmount)
      console.log('[AllowanceManager] Parsed amount:', amount)
      
      if (isNaN(amount) || amount <= 0) {
        console.error('[AllowanceManager] Invalid amount:', newAllowanceAmount)
        toast.error('Please enter a valid amount')
        return
      }
    }

    if (!usdcTokenIds[networkKey]) {
      toast.error('Network config still loading. Please retry in a moment.')
      return
    }

    // If a previous allowance request is still open in HashPack, do not fire a
    // second WalletConnect request on the same session topic. The underlying
    // executeWithSigner promise is not cancellable, so releasing the mutex here
    // recreates the stuck "second prompt never appears" failure.
    const stuck = activeWalletLabel()
    if (stuck) {
      console.warn('[AllowanceManager] wallet call still pending before grant:', stuck)
      toast('Finish or reject the pending HashPack request before trying again.')
      return
    }

    setIsGranting(true)


    // Show a persistent toast for wallet interaction
    let toastId = toast.loading('Please confirm the transaction in your wallet...', {
      duration: Infinity
    })
    let swapTimer: ReturnType<typeof setTimeout> | undefined

    try {
      const amount = parseFloat(newAllowanceAmount) || 0
      // Grant the total new allowance (current + new) or max
      const totalAllowance = useMaxAllowance ? 0 : spenderAllowanceUsd + amount
      console.log('[AllowanceManager] Current allowance:', spenderAllowanceUsd)
      console.log('[AllowanceManager] Requesting total allowance:', useMaxAllowance ? 'UNLIMITED' : totalAllowance)

      // Wrap grantAllowanceUsd so we can swap the toast as soon as the wallet
      // signs (executeWithSigner resolves) — before the mirror-node poll.
      const grantPromise = grantAllowanceUsd(
        signerZero,
        usdcTokenIds,
        usdcNdecimals,
        smartContractId,
        totalAllowance,
        useMaxAllowance
      )

      // After ~3s assume the wallet has signed and switch the message.
      swapTimer = setTimeout(() => {
        toast.dismiss(toastId)
        toastId = toast.loading('Transaction submitted, confirming on-chain…', { duration: Infinity })
      }, 3000)

      const success = await grantPromise
      clearTimeout(swapTimer)
      swapTimer = undefined

      console.log('[AllowanceManager] grantAllowanceUsd result:', success)
      toast.dismiss(toastId)

      if (success) {
        // Reconcile UI from on-chain truth instead of trusting the requested amount.
        try {
          const accountId = signerZero.getAccountId().toString()
          const onChain = await getSpenderAllowanceUsd(
            networkSelected,
            usdcTokenIds,
            usdcNdecimals,
            smartContractId,
            accountId,
          )
          setSpenderAllowanceUsd(onChain)
          if (useMaxAllowance) {
            toast.success('Max allowance granted successfully')
          } else {
            toast.success(`Allowance of $${onChain.toFixed(2)} USDC active`)
          }
        } catch (e) {
          console.error('[AllowanceManager] Reconcile after grant failed:', e)
          // Fallback to requested amount so UI isn't stuck at 0
          setSpenderAllowanceUsd(useMaxAllowance ? UNLIMITED_ALLOWANCE_USD : totalAllowance)
          toast.success('Allowance granted')
        }
        onAllowanceGranted?.()
      } else {
        console.error('[AllowanceManager] Transaction rejected or failed')
        toast.error('Transaction failed - please try again')
      }
    } catch (error) {
      console.error('[AllowanceManager] Error granting allowance:', error)
      if (swapTimer) {
        clearTimeout(swapTimer)
        swapTimer = undefined
      }
      toast.dismiss(toastId)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (
        errorMessage.includes('Wallet call aborted') ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('Transaction was rejected by wallet')
      ) {
        toast('Allowance grant cancelled')
      } else {
        toast.error(errorMessage)
      }
    } finally {
      if (swapTimer) {
        clearTimeout(swapTimer)
        toast.dismiss(toastId)
      }
      setIsGranting(false)
    }
  }

  const handleCancelGrant = () => {
    console.log('[AllowanceManager] User cancelled grant')
    // UI-only cancel: reject the visible awaiter but keep the mutex held until
    // HashPack's original executeWithSigner promise settles. Starting another
    // allowance request while that response channel is live causes WalletConnect
    // to drop the fresh prompt.
    // The catch block in handleGrantAllowance already shows the cancellation
    // message, so we only dismiss the loading toast here to avoid a duplicate.
    abortActiveWalletCall('User cancelled allowance grant', { releaseLock: false })
    setIsGranting(false)
    toast.dismiss()
  }


  const handleRevokeAllowance = async () => {
    console.log('[AllowanceManager] handleRevokeAllowance called')
    console.log('[AllowanceManager] signerZero:', !!signerZero)
    console.log('[AllowanceManager] smartContractId:', smartContractId)
    console.log('[AllowanceManager] networkKey:', networkKey)

    if (!signerZero) {
      toast.error('Please connect your wallet first')
      return
    }
    if (!smartContractId) {
      toast.error('Smart contract not configured for this network')
      return
    }
    if (!usdcTokenIds[networkKey]) {
      toast.error('Network config still loading. Please retry in a moment.')
      return
    }

    setIsRevoking(true)
    let toastId = toast.loading('Please confirm the revoke in your wallet…', { duration: Infinity })
    let swapTimer: ReturnType<typeof setTimeout> | undefined

    try {
      const revokePromise = grantAllowanceUsd(
        signerZero,
        usdcTokenIds,
        usdcNdecimals,
        smartContractId,
        0
      )

      swapTimer = setTimeout(() => {
        toast.dismiss(toastId)
        toastId = toast.loading('Transaction submitted, confirming on-chain…', { duration: Infinity })
      }, 3000)

      const success = await revokePromise
      clearTimeout(swapTimer)
      swapTimer = undefined
      toast.dismiss(toastId)

      if (success) {
        // Reconcile from on-chain
        try {
          const accountId = signerZero.getAccountId().toString()
          const onChain = await getSpenderAllowanceUsd(
            networkSelected,
            usdcTokenIds,
            usdcNdecimals,
            smartContractId,
            accountId,
          )
          setSpenderAllowanceUsd(onChain)
        } catch {
          setSpenderAllowanceUsd(0)
        }
        toast.success('Allowance revoked successfully')
      } else {
        toast.error('Revoke transaction failed - please try again')
      }
    } catch (error) {
      console.error('[AllowanceManager] Error revoking allowance:', error)
      if (swapTimer) clearTimeout(swapTimer)
      toast.dismiss(toastId)
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (
        msg.includes('Wallet call aborted') ||
        msg.includes('cancelled') ||
        msg.includes('Transaction was rejected by wallet')
      ) {
        toast('Allowance revoke cancelled')
      } else {
        toast.error(msg)
      }
    } finally {
      setIsRevoking(false)
    }
  }

  const handleCancelRevoke = () => {
    console.log('[AllowanceManager] User cancelled revoke')
    // UI-only cancel — see handleCancelGrant for rationale.
    // The catch block in handleRevokeAllowance already shows the cancellation
    // message, so we only dismiss the loading toast here to avoid a duplicate.
    abortActiveWalletCall('User cancelled allowance revoke', { releaseLock: false })
    setIsRevoking(false)
    toast.dismiss()
  }


  useEffect(() => {
    if (signerZero && smartContractId) {
      refreshAllowance()
    }
  }, [signerZero, networkSelected, smartContractId])

  // Re-run the stale-allowance scan every time the sidebar opens (closed→open).
  useEffect(() => {
    if (showAllowanceSidebar && !wasOpenRef.current) {
      if (signerZero && smartContractId) {
        refreshAllowance()
      }
    }
    wasOpenRef.current = showAllowanceSidebar
  }, [showAllowanceSidebar, signerZero, smartContractId])

  if (!signerZero) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Connect your wallet to manage allowances</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card/50 backdrop-blur">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              USDC Spending Allowance
            </CardTitle>
            <CardDescription className="mt-1">
              Authorize the smart contract to use your USDC for trading
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={refreshAllowance}
            disabled={isRefreshing || isGranting || isRevoking}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Explanation */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex gap-2">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              An <strong>allowance</strong> is permission you give to the smart contract to spend USDC on your behalf. 
              This doesn't transfer your funds — it just sets a limit on what the contract can use when you trade or create markets.
            </p>
          </div>
        </div>

        {/* Contract selector */}
        {contractOptions.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="contract-select">Contract</Label>
            <select
              id="contract-select"
              value={smartContractId}
              onChange={(e) => setSelectedContractId(e.target.value)}
              disabled={isGranting || isRevoking}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {contractOptions.map((id, i) => (
                <option key={id} value={id}>
                  {id}
                  {id === allowanceSidebarContractId ? ' (this market)' : i === 0 ? ' (latest)' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Allowances are per-contract. Select an older contract to view or revoke a previous grant.
            </p>
          </div>
        )}


        {/* Current Allowance Status */}
        <div className="p-4 rounded-lg bg-background/50 border border-border">
          {/* Available Balance */}
          <div className="mb-4 pb-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Available Balance</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">${usdcBalance.toFixed(3)}</span>
              <span className="text-sm text-muted-foreground">USDC</span>
            </div>
          </div>
          
          {/* Spending Allowance */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Spending Allowance</span>
            {isMaxAllowance ? (
              <Badge className="bg-primary/20 text-primary border-primary">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Max
              </Badge>
            ) : hasSufficientAllowance && (
              <Badge className="bg-up/20 text-up border-up">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Sufficient
              </Badge>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            {isMaxAllowance ? (
              <>
                <span className="text-3xl font-bold">∞ Max</span>
                <span className="text-sm text-muted-foreground">USDC</span>
              </>
            ) : (
              <>
                <span className="text-3xl font-bold">${spenderAllowanceUsd.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground">USDC</span>
              </>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            <p className="text-xs text-muted-foreground flex justify-between">
              <span>Token ID:</span>
              <span className="font-mono text-foreground">{usdcTokenIds[networkSelected.toString().toLowerCase()] || 'N/A'}</span>
            </p>
            <div className="text-xs text-muted-foreground flex justify-between items-center gap-2">
              <span>Contract:</span>
              <span className="font-mono text-foreground">{smartContractId || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Grant Allowance Form - hidden when unlimited is already active */}
        {isMaxAllowance ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <p className="text-sm text-foreground">
                  <strong>∞ Max</strong> USDC spending allowance is active. No further approvals needed.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleRevokeAllowance}
              disabled={isRevoking}
              className="w-full text-destructive hover:text-destructive"
            >
              {isRevoking ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                'Revoke Allowance'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="allowance-amount">Add Allowance Amount (USDC)</Label>
              <div className="flex gap-2">
                <Input
                  id="allowance-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newAllowanceAmount}
                  onChange={(e) => setNewAllowanceAmount(e.target.value)}
                  placeholder="10.00"
                  className="flex-1"
                  disabled={useMaxAllowance || isGranting || isRevoking}
                />
                <div className="flex gap-1">
                  {[1, 10, 100].map((preset) => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      onClick={() => setNewAllowanceAmount(preset.toString())}
                      className="px-2"
                      disabled={useMaxAllowance || isGranting || isRevoking}
                    >
                      ${preset}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Max Allowance Checkbox */}
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox 
                id="max-allowance"
                checked={useMaxAllowance}
                onCheckedChange={(checked) => setUseMaxAllowance(checked === true)}
                disabled={isGranting || isRevoking}
              />
              <Label 
                htmlFor="max-allowance" 
                className="text-sm font-medium cursor-pointer"
              >
                Grant max allowance
              </Label>
            </div>

            {useMaxAllowance && (
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30">
                <p className="text-xs text-amber-400">
                  This grants a max USDC allowance to the contract. 
                  You won't need to approve again. You can revoke it at any time.
                </p>
              </div>
            )}

            {/* Preview */}
            {(parseFloat(newAllowanceAmount) > 0 || useMaxAllowance) && (
              <div className="p-3 rounded-lg bg-muted/30 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current allowance:</span>
                  <span>{`$${spenderAllowanceUsd.toFixed(2)}`}</span>
                </div>
                {!useMaxAllowance && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Adding:</span>
                  <span>+${parseFloat(newAllowanceAmount || '0').toFixed(2)}</span>
                </div>
                )}
                <div className="flex justify-between font-medium border-t border-border pt-1">
                  <span>New allowance:</span>
                  <span>{useMaxAllowance ? '∞ Max' : `$${(spenderAllowanceUsd + parseFloat(newAllowanceAmount || '0')).toFixed(2)}`}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={isGranting ? handleCancelGrant : handleGrantAllowance}
                disabled={isRevoking || (!isGranting && !parseFloat(newAllowanceAmount) && !useMaxAllowance)}
                variant={isGranting ? 'outline' : 'default'}
                className={`flex-1 ${isGranting ? 'text-destructive hover:text-destructive border-destructive hover:border-destructive' : ''}`}
              >
                {isGranting ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Cancel Grant
                  </>
                ) : useMaxAllowance ? (
                  'Grant Max Allowance'
                ) : (
                  'Grant Allowance'
                )}
              </Button>
              
              {spenderAllowanceUsd > 0 && (
                <Button
                  variant="outline"
                  onClick={isRevoking ? handleCancelRevoke : handleRevokeAllowance}
                  disabled={isGranting}
                  className="text-destructive hover:text-destructive"
                >
                  {isRevoking ? (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </>
                  ) : (
                    'Revoke'
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  )
}

export default AllowanceManager
