/**
 * Claim matured $PRSM rewards (backend `ClaimPrism`).
 *
 * The backend pays out the account's *unredeemed* reward total from the project
 * hot wallet, so `prism_unredeemed` (not `prism_redeemable`) is the amount a
 * claim actually moves — see lib/claimPrism.ts and docs/backend-sync.md.
 */
import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { getUserAccountInfo } from './hedera'
import { submitClaimPrism, mapClaimError } from './claimPrism'
import { debugWarn } from './debugLog'

export const useClaimPrism = () => {
  const { signerZero, userAccountInfo } = useWalletContext()
  const { networkSelected } = useNetworkContext()
  const queryClient = useQueryClient()

  const [isClaiming, setIsClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accountId = signerZero?.getAccountId()?.toString()
  const net = networkSelected.toString().toLowerCase()

  const claim = useCallback(async (): Promise<boolean> => {
    if (!signerZero || !accountId) {
      toast.error('Connect your wallet to claim $PRSM')
      return false
    }
    if (isClaiming) return false

    setIsClaiming(true)
    setError(null)
    try {
      // The mirror-node key lookup on connect is non-fatal; resolve on demand.
      let accountInfo = userAccountInfo
      if (!accountInfo) {
        debugWarn('[useClaimPrism] userAccountInfo missing; fetching on-demand')
        accountInfo = await getUserAccountInfo(networkSelected, accountId)
      }

      const message = await submitClaimPrism({
        accountId,
        net,
        signer: signerZero as never,
        userKey: accountInfo,
      })

      toast.success(message === 'Claim submitted' ? '$PRSM claim submitted' : message)
      await queryClient.invalidateQueries({ queryKey: ['prism'] })
      return true
    } catch (err) {
      const friendly = mapClaimError(String((err as Error)?.message || ''))
      setError(friendly)
      toast.error(friendly)
      return false
    } finally {
      setIsClaiming(false)
    }
  }, [signerZero, accountId, isClaiming, userAccountInfo, networkSelected, net, queryClient])

  return { claim, isClaiming, error, isConnected: !!accountId, accountId, net }
}
