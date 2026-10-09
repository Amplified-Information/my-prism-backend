import { useCallback, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useWalletContext } from '../src/contexts/WalletContext'
import { useNetworkContext } from '../src/contexts/NetworkContext'
import { redeemWinnings } from './hedera'
import { uuidToBigInt } from './utils'
import { markMarketRedeemed } from './redeemSuppression'

class RedeemCancelledError extends Error {
  constructor() { super('Redemption cancelled') }
}

interface RedeemArgs {
  marketUuid: string      // UUIDv7 from MarketResponse.marketId
  expectedPayoutUsd: number // pre-known payout (winning shares × $1) for the success toast
  // Per-market smart-contract id (from MarketResponse.smartContractId). The
  // market the user is redeeming against may have been deployed to a different
  // Prism contract than the network's current default — e.g. after a backend
  // redeploy. Using the network default would call redeem() on a contract that
  // never minted these shares and revert. Always prefer the market-bound id;
  // fall back to the network default only when the market doesn't carry one.
  marketContractId?: string
}

/**
 * useRedeem — invokes Prism.sol redeem(uint128 marketId) on-chain.
 *
 * Redemption is on-chain only. There is no backend RPC for this; msg.sender
 * is enforced by the contract, and the backend's sc_events ingestion will
 * clear the position record once the WinningsRedeemed event is observed.
 *
 * The smart-contract uint128 marketId is derived deterministically from the
 * market UUIDv7 via uuidToBigInt() — the same scheme already used for signed
 * order payloads (see lib/utils.ts -> assemblePayloadHexForSigning).
 */
export const useRedeem = () => {
  const { signerZero } = useWalletContext()
  const { networkSelected, smartContractIds } = useNetworkContext()
  const [isRedeeming, setIsRedeeming] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)

  const cancelRedeem = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current()
      cancelRef.current = null
    }
  }, [])

  const redeem = useCallback(async ({ marketUuid, expectedPayoutUsd, marketContractId }: RedeemArgs) => {
    if (!signerZero) {
      toast.error('Connect your wallet to redeem')
      return { success: false }
    }

    const networkKey = networkSelected.toString().toLowerCase()
    // Prefer the contract id bound to this specific market (from
    // MarketResponse.smartContractId). Only fall back to the network default
    // when the market doesn't carry one (legacy data).
    const contractId = (marketContractId && marketContractId.trim())
      || smartContractIds[networkKey]
    if (!contractId) {
      toast.error('Prism contract not configured for this market')
      return { success: false }
    }
    console.log('[useRedeem] Using contract:', contractId, '(marketBound=', !!marketContractId, ')')

    setIsRedeeming(true)
    const loadingId = toast.loading('Redeeming winnings…')

    // Cancellation: we can't abort the wallet RPC, but we can abandon the
    // result and reset UI state so the user is unblocked.
    let cancelled = false
    const cancelPromise = new Promise<never>((_, reject) => {
      cancelRef.current = () => {
        cancelled = true
        reject(new RedeemCancelledError())
      }
    })

    try {
      const marketIdU128 = uuidToBigInt(marketUuid)
      const result = await Promise.race([
        redeemWinnings(signerZero, contractId, marketIdU128),
        cancelPromise,
      ])

      toast.dismiss(loadingId)
      toast.success(
        `Redeemed $${expectedPayoutUsd.toFixed(2)} USDC`,
        { duration: 5000 }
      )
      // Suppress this market from "Redeemable Winnings" immediately, since the
      // backend won't reflect the redemption until the WinningsRedeemed NATS
      // event is processed (and even then, PositionInfo doesn't yet carry
      // redeemed_at — see .lovable/plan.md Phase 1+2).
      markMarketRedeemed(marketUuid)
      console.log('[useRedeem] Success — txId:', result.txId)
      return { success: true, txId: result.txId }
    } catch (err) {
      toast.dismiss(loadingId)
      if (cancelled || err instanceof RedeemCancelledError) {
        toast('Redemption cancelled', { icon: '✋' })
        console.log('[useRedeem] Cancelled by user')
        return { success: false, cancelled: true }
      }
      // Multi-tab safety: another Prism tab owns the wallet session.
      if (err instanceof Error && err.name === 'NotLeaderTabError') {
        toast('Wallet is active in another Prism tab. Click "Use wallet here" to take over.', { icon: '🪟' })
        console.warn('[useRedeem] blocked — non-leader tab')
        return { success: false }
      }
      const msg = err instanceof Error ? err.message : 'Redemption failed'
      console.error('[useRedeem] Failed:', err)

      // Map common contract reverts to friendlier messages
      if (msg.includes('Not resolved yet')) {
        toast.error('This market has not been resolved yet')
      } else if (msg.includes('No winning tokens')) {
        toast.error('You have no winning shares to redeem on this market')
      } else if (msg.includes('rejected') || msg.includes('cancelled') || msg.includes('denied')) {
        toast.error('Redemption was rejected in your wallet')
      } else if (/collateral accounting mismatch/i.test(msg)) {
        // Prism 0.0.9385460 safety invariant: real token balance must be ≥ internal accounting.
        toast.error('Redemption temporarily unavailable — market collateral is being reconciled. Please retry shortly.')
      } else if (/collateral transfer failed|transfer failed/i.test(msg)) {
        // Renamed in Prism 0.0.9385460 from "Transfer failed" → "Collateral transfer failed".
        toast.error('On-chain transfer failed during redeem. Please retry.')
      } else {
        toast.error(`Redemption failed: ${msg}`)
      }
      return { success: false }
    } finally {
      cancelRef.current = null
      setIsRedeeming(false)
    }
  }, [signerZero, networkSelected, smartContractIds])

  return { redeem, cancelRedeem, isRedeeming }
}
