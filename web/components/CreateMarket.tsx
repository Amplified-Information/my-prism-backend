import { useState, useEffect } from 'react'
import { v7 as uuidv7 } from 'uuid'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient, authHeaders } from '../grpcClient'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { useUIContext } from '../src/contexts/UIContext'
import { bigIntScaledDecimalsToFloat, delay } from '../lib/utils'
import { getSpenderAllowanceUsd } from '../lib/hedera'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { Button } from '../src/components/ui/button'
import { Info, Check, X, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Calendar } from '../src/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../src/components/ui/popover'
import { cn } from '../lib/utils'

const CreateMarket = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { signerZero, spenderAllowanceUsd, setSpenderAllowanceUsd } = useWalletContext()
  const { marketCreationFeeScaledUsdc, usdcNdecimals, networkSelected, usdcTokenIds, smartContractIds, tokenIds } = useNetworkContext()
  const { setShowAllowanceSidebar } = useUIContext()
  const [statement, setStatement] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageError, setImageError] = useState(false)
  const [closesAt, setClosesAt] = useState<Date | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-refresh allowance on mount and when wallet/network changes
  useEffect(() => {
    const refreshAllowanceOnMount = async () => {
      const networkKey = networkSelected.toString().toLowerCase()
      const smartContractId = smartContractIds[networkKey]
      
      if (signerZero && networkSelected && smartContractId) {
        try {
          console.log('[CreateMarket] Refreshing allowance on mount...')
          const allowance = await getSpenderAllowanceUsd(
            networkSelected,
            usdcTokenIds,
            usdcNdecimals,
            smartContractId,
            signerZero.getAccountId().toString()
          )
          console.log('[CreateMarket] On-mount allowance:', allowance)
          setSpenderAllowanceUsd(allowance)
        } catch (err) {
          console.error('[CreateMarket] Failed to refresh allowance:', err)
        }
      }
    }
    refreshAllowanceOnMount()
  }, [signerZero, networkSelected, smartContractIds])

  // Validation is now computed directly from state (no useEffect needed)

  const requiredAmount = marketCreationFeeScaledUsdc > 0 ? marketCreationFeeScaledUsdc / (10 ** usdcNdecimals) : 0.10

  // Checklist validation states
  const isWalletConnected = !!signerZero
  const hasAllowance = spenderAllowanceUsd >= requiredAmount
  const isStatementValid = statement.length >= 5 && statement.length <= 500
  const isDescriptionValid = description.length <= 2000
  const isImageUrlValid = imageUrl.length === 0 || (imageUrl.length <= 2048 && /^https?:\/\/.+/.test(imageUrl))
  const canSubmit = isWalletConnected && hasAllowance && isStatementValid && isDescriptionValid && isImageUrlValid

  const ChecklistItem = ({ passed, label, description, action }: { passed: boolean; label: string; description?: string; action?: React.ReactNode }) => (
    <div className="flex items-start gap-3">
      <div className={`shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${passed ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}`}>
        {passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium ${passed ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</p>
          {action}
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4">
      {/* Main Form */}
      <div className="p-6 bg-card rounded-lg shadow-md border border-border">
          {/* Requirements Checklist */}
          <div className="p-4 mb-6 bg-muted/50 border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-5 w-5 text-primary" />
              <p className="text-sm font-semibold text-foreground">Market Creation Checklist</p>
            </div>
            <div className="space-y-3">
              <ChecklistItem 
                passed={isWalletConnected} 
                label="Wallet connected" 
              />
              <ChecklistItem 
                passed={hasAllowance} 
                label={`USDC allowance ≥ $${requiredAmount.toFixed(2)}`}
                description="Market creation fee will be deducted from your allowance"
                action={!hasAllowance && isWalletConnected ? (
                  <button 
                    onClick={() => setShowAllowanceSidebar(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    Add allowance
                  </button>
                ) : undefined}
              />
              <ChecklistItem 
                passed={isStatementValid} 
                label="Valid market statement (5-500 characters)"
                description="Must be publicly verifiable"
              />
              <ChecklistItem 
                passed={isDescriptionValid} 
                label="Valid description (optional, max 2000 chars)"
                description="Additional context about the market"
              />
              <ChecklistItem 
                passed={isImageUrlValid} 
                label="Valid image URL (optional)"
                description="Must start with http:// or https://"
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            As soon as you submit this form, your market will be created and made available for trading without any censorship.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="statement">Market Statement</label>
              <textarea
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground resize-none"
                id="statement"
                name="statement"
                placeholder="The price of HBAR will exceed USD $1 by the end of 2026"
                required
                minLength={5}
                maxLength={500}
                rows={4}
                value={statement}
                onChange={(e) => {
                  if (e.target.value.length > 500) return
                  setStatement(e.target.value)
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">{statement.length}/500 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="description">Description (optional)</label>
              <textarea
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground resize-none"
                id="description"
                name="description"
                placeholder="Provide additional context, resolution criteria, or background information about this market..."
                maxLength={2000}
                rows={3}
                value={description}
                onChange={(e) => {
                  if (e.target.value.length > 2000) return
                  setDescription(e.target.value)
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">{description.length}/2000 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="image_url">Image URL (optional)</label>
              <input 
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground" 
                type="text" 
                id="image_url" 
                name="image_url"
                placeholder="https://example.com/market-image.jpg"
                value={imageUrl} 
                onChange={(e) => {
                  setImageUrl(e.target.value)
                  setImageError(false)
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Closes At (optional)</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !closesAt && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {closesAt ? format(closesAt, 'PPP') : <span>Pick a closing date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={closesAt}
                    onSelect={setClosesAt}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground mt-1">
                When should this market close for trading?
              </p>
            </div>

            {imageUrl && !imageError && (
              <div>
                <label className="block text-sm font-medium mb-1">Image preview</label>
                <img 
                  src={imageUrl} 
                  alt="Image preview" 
                  className="rounded-lg border border-border max-h-48 object-contain"
                  onError={() => setImageError(true)}
                />
              </div>
            )}
            {imageUrl && imageError && (
              <p className="text-xs text-muted-foreground">
                Unable to preview image. It may still work when submitted.
              </p>
            )}

            <button 
              className="btn-primary w-full mt-6"
              type="submit"
              disabled={!canSubmit || isSubmitting}
              onClick={async () => {
                const networkKey = networkSelected.toString().toLowerCase()
                const usdcTokenId = usdcTokenIds[networkKey]
                const smartContractId = smartContractIds[networkKey]
                const prsTokenId = tokenIds[networkKey]
                const accountId = signerZero?.getAccountId().toString()
                
                // Diagnostic logging - expose all token/contract parameters
                console.log('[CreateMarket] Token Configuration Debug:', {
                  network: networkSelected.toString(),
                  networkKey,
                  frontendUsdcTokenId: usdcTokenId,
                  frontendSmartContractId: smartContractId,
                  frontendTokenId: prsTokenId,
                  accountId,
                  spenderAllowanceUsd,
                  requiredAmount,
                  marketCreationFeeScaledUsdc,
                  usdcNdecimals
                })

                try {
                  setIsSubmitting(true)
                  
                  // Pre-flight: Verify on-chain allowance before submitting
                  console.log(`[CreateMarket] Pre-flight: Checking allowance for USDC ${usdcTokenId} on contract ${smartContractId}`)
                  const onChainAllowance = await getSpenderAllowanceUsd(
                    networkSelected,
                    usdcTokenIds,
                    usdcNdecimals,
                    smartContractId,
                    accountId!
                  )
                  console.log(`[CreateMarket] Pre-flight: On-chain allowance = $${onChainAllowance}`)
                  
                  if (onChainAllowance < requiredAmount) {
                    toast.error(
                      `Insufficient on-chain allowance: $${onChainAllowance.toFixed(2)}. Required: $${requiredAmount.toFixed(2)}. Please add more allowance.`,
                      { duration: 10000 }
                    )
                    setSpenderAllowanceUsd(onChainAllowance) // Sync UI with actual on-chain value
                    setIsSubmitting(false)
                    return
                  }
                  
                  // Backend deprecated CreateMarket (image by URL) in favour of
                  // CreateMarketv2 (image uploaded as bytes). Best-effort fetch the
                  // pasted URL into a chunk; the backend accepts an empty chunk.
                  let imgChunk = new Uint8Array()
                  let imgFileName = ''
                  let imgMimeType = ''
                  if (imageUrl) {
                    try {
                      const res = await fetch(imageUrl)
                      const buf = await res.arrayBuffer()
                      imgChunk = new Uint8Array(buf)
                      imgMimeType = res.headers.get('content-type') || 'image/png'
                      imgFileName = (imageUrl.split('/').pop() || 'market-image').slice(0, 255)
                    } catch (imgErr) {
                      console.warn('[CreateMarket] Could not fetch image URL, creating market without image:', imgErr)
                    }
                  }

                  const result = await apiClient.createMarketv2({
                    marketId: uuidv7(),
                    net: networkKey, // Use dynamic network instead of hardcoded 'testnet'
                    statement,
                    closesAt: closesAt ? closesAt.toISOString() : undefined,
                    description: description || '',
                    rules: '', // backend commit 7bb88fd7: rules field added; no UI yet, send empty
                    categoryIds: [], // admin-only; category management lives in the separate admin project

                    
                    imgChunk,
                    imgFileName,
                    imgMimeType
                  },
                  authHeaders())

                  const response = result.response
                  console.log('CreateMarketResponse', response)

                  // CreateMarketResponse includes the remaining allowance in the smart contract response
                  setSpenderAllowanceUsd(bigIntScaledDecimalsToFloat(response.remainingAllowance, usdcNdecimals))

                  // Invalidate markets cache so Explore page fetches fresh data
                  await queryClient.invalidateQueries({ queryKey: ['markets'] })

                  toast.success('Market created successfully!')
                  
                  await delay(1000)
                  navigate(`/market/${response.marketResponse.marketId}`)
                  
                } catch (error: unknown) {
                  console.error('Error creating market:', error)
                  const rpcError = error as { message?: string; code?: string }
                  const errorMessage = rpcError?.message || 'Unknown error occurred'
                  
                  // Provide specific guidance for CONTRACT_REVERT errors
                  if (errorMessage.includes('CONTRACT_REVERT_EXECUTED')) {
                    toast.error(
                      'Contract reverted. This usually means a token ID mismatch or insufficient allowance. ' +
                      'Check console for token config details.',
                      { duration: 12000 }
                    )
                    // Refresh actual allowance from chain
                    try {
                      const freshAllowance = await getSpenderAllowanceUsd(
                        networkSelected,
                        usdcTokenIds,
                        usdcNdecimals,
                        smartContractId,
                        accountId!
                      )
                      console.log('[CreateMarket] Post-error allowance refresh:', freshAllowance)
                      setSpenderAllowanceUsd(freshAllowance)
                    } catch (refreshErr) {
                      console.error('[CreateMarket] Failed to refresh allowance after error:', refreshErr)
                    }
                  } else {
                    toast.error(`Market creation failed: ${errorMessage}`, { duration: 10000 })
                  }
                } finally {
                  setIsSubmitting(false)
                }
              }}
            >
              {isSubmitting ? (
                <>
                  Creating Market...
                  <span className="ml-2 inline-block w-4 h-4 border-2 rounded-full border-white border-t-transparent animate-spin"></span>
                </>
              ) : (
                'Create Market'
              )}
            </button>
          </div>
      </div>
    </div>
  )
}

export default CreateMarket
