import { useState, useCallback, useEffect, useRef } from 'react'
import { useWalletContext } from '../../src/contexts/WalletContext'
import { useNetworkContext } from '../../src/contexts/NetworkContext'
import { useMarketContext } from '../../src/contexts/MarketContext'
import { apiClient } from '../../grpcClient'
import { PrismPredictionIntentRequest, CancelOrderRequest } from '../../gen/api'
import { defaultPredictionIntentRequest } from '../../constants'
import { keyTypeToInt, normalizeSignatureBase64 } from '../utils'
import { authorizationSigningMessage, authorizationStructHash, computeCollateralCap, toLimitYesPrice, toBaseUnits, fromBaseUnits, ACTION_BUY, ACTION_SELL, SIDE_YES, SIDE_NO, DEFAULT_DEADLINE_SECONDS, DEFAULT_CHAIN_IDS } from '../prismV2'
import { submitSignedCancel } from '../cancelOrder'
import { getUserAccountInfo } from '../hedera'
import { abortActiveWalletCall } from '../walletMutex'
import { resolveFreshSigner } from '../appkit'
import { signWithWallet } from '../signWithWallet'
import { debugLog, debugWarn, debugError } from '../debugLog'
import { recordPendingSell } from '../pendingSells'
import { PublicKey } from '@hiero-ledger/sdk'
import { v7 as uuidv7 } from 'uuid'

import toast from 'react-hot-toast'
import { getSpenderAllowanceUsd } from '../hedera'
import type { TradingFormState, TradingDerivedValues } from './types'

interface LifecycleOptions {
  marketId: string
  orderType: 'market' | 'limit'
  action: 'buy' | 'sell'
  positionYes?: number
  positionNo?: number
  hasYesBids?: boolean
  hasNoBids?: boolean
}

type WalletSignatureResult = Array<{ signature?: string | Uint8Array }>

/**
 * Map raw backend rejection strings (from CreatePredictionIntent validation,
 * tightened in backend commit ddd74e1) to user-friendly toasts.
 *
 * `context` distinguishes the create/submit path from the cancel path so an
 * "invalid signature" from `CreatePredictionIntent` doesn't get the
 * cancel-specific message (misleading — see issue where a stale/expired
 * WalletConnect signature reused on submit was reported as "Cancel signature
 * was rejected").
 */
function mapServerError(raw: string, context: 'submit' | 'cancel' = 'submit'): string {
  if (/nats:\s*connection closed|failed to publish to nats/i.test(raw)) {
    return 'Order service temporarily unavailable. Please retry in a moment.'
  }
  if (/exceeds available liquidity|exceeds.*orderbook/i.test(raw)) {
    return 'Order size exceeds available liquidity in the order book. Try a smaller quantity or use a limit order.'
  }
  if (/spender allowance is|insufficient allowance/i.test(raw)) {
    return 'USDC allowance is too low for this order. Increase your allowance and retry.'
  }
  if (/chainid|verifyingcontract|proxy/i.test(raw) && /mismatch|does not match|invalid/i.test(raw)) {
    return 'The trading contract changed. Please refresh the app and sign again.'
  }
  if (/deadline|authorization has expired/i.test(raw)) {
    return 'This signed order has expired. Please sign it again.'
  }
  if (/txid.*(already|used)/i.test(raw)) {
    return 'This order was already submitted. Please sign a new one.'
  }
  if (/insufficient.*(usdc|balance)|balance.*collateralcap/i.test(raw)) {
    return 'Your USDC balance is too low for this order.'
  }
  if (/timestamp is too old|timestamp is too far in the future/i.test(raw)) {
    return 'Order signature expired before submission. Please re-sign and try again.'
  }
  if (/reserved secondary (yes|no) position tokens|needs .* total .* reserved secondary/i.test(raw)) {
    return 'You already have open sell orders reserving these shares. Cancel one or reduce the size.'
  }
  if (/position token balance|insufficient position tokens|insufficient.*shares/i.test(raw)) {
    return 'Insufficient shares to sell. Refresh your portfolio and try again.'
  }
  if (/primarysecondary|invalid.*classification/i.test(raw)) {
    return 'Invalid order classification — please refresh the app and retry.'
  }
  if (/smart\s*contract.*not.*found|missing smart contract/i.test(raw)) {
    return 'This market is misconfigured (no smart contract). Please contact support.'
  }
  if (/collateral\/qty mismatch/i.test(raw)) {
    return 'Order was rejected on-chain (price/quantity mismatch). Please refresh the book and retry.'
  }
  if (/invalid signature|key.*mismatch|public key mismatch/i.test(raw)) {
    // Same backend string is emitted for both create and cancel. On the create
    // path it commonly means the WalletConnect signing request expired
    // mid-flight and the signature the wallet returned does not verify
    // against the packed payload.
    if (context === 'cancel') {
      return 'Cancel verification failed. Please refresh and retry once; if it keeps failing, the signing protocol is out of sync.'
    }
    return 'Your signed order was rejected by the server (signature did not verify). Please re-sign and submit again.'
  }
  if (/is already cancelled at/i.test(raw)) {
    return 'This order has already been cancelled.'
  }
  if (/does not own prediction intent/i.test(raw)) {
    return 'You can only cancel your own orders.'
  }
  if (/marketid .* does not match prediction intent/i.test(raw)) {
    return 'This order belongs to a different market.'
  }
  if (/no prediction intent found for txid/i.test(raw)) {
    return 'This order no longer exists.'
  }
  if (/not[\s_-]?found|NOT_FOUND|code\s*=\s*5/i.test(raw)) {
    return 'This order was already matched or cancelled.'
  }
  return raw || 'Failed to place order'
}

interface OrderLifecycleResult {
  signOrder: () => Promise<void>
  submitOrder: () => Promise<void>
  cancelOrder: () => void
  cancelSigning: () => void
  cancelPendingOrder: (txId: string) => Promise<void>
  resetOrder: () => void
  isSigned: boolean
  isProcessing: boolean
  processingStep: 'idle' | 'signing' | 'submitting'
}


export function useOrderLifecycle(
  form: TradingFormState,
  derived: TradingDerivedValues,
  options: LifecycleOptions
): OrderLifecycleResult {
  const { marketId, orderType, action, positionYes = 0, positionNo = 0, hasYesBids = true, hasNoBids = true } = options
  const { outcome, amountUsd, limitPrice, setLimitPrice } = form
  const { shares, yesAskPrice, noAskPrice } = derived

  const {
    signerZero,
    userAccountInfo,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    spenderAllowanceUsd,
    setSpenderAllowanceUsd
  } = useWalletContext()
  const {
    networkSelected,
    usdcNdecimals,
    usdcTokenIds,
    smartContractIds,
    sigSchemeDateRanges,
    prismV2ProxyAddresses,
    chainIds,
  } = useNetworkContext()
  const { market } = useMarketContext()

  // The frontend currently produces v1 payloads (appends primarySecondary).
  // If the backend ever publishes a different active scheme, surface a clear
  // warning so users see it before silently rejected orders.
  const FRONTEND_SIG_VERSION = 2

  const [, setPredictionIntentRequest] = useState<PrismPredictionIntentRequest>(
    { ...defaultPredictionIntentRequest(), marketId }
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState<'idle' | 'signing' | 'submitting'>('idle')
  const [pendingIntent, setPendingIntent] = useState<PrismPredictionIntentRequest | null>(null)
  const [signatureB64, setSignatureB64] = useState<string | null>(null)
  const [signedKeccakB64, setSignedKeccakB64] = useState<string | null>(null)
  const [, setCurrentTxId] = useState<string | null>(null)
  const signAbortRef = useRef<{ cancelled: boolean; diagnosticsAbort: AbortController } | null>(null)


  // Reset when form changes
  useEffect(() => {
    setPredictionIntentRequest(prev => ({ ...prev, sig: '' }))
  }, [outcome, amountUsd, limitPrice])

  function generatePredictionIntent(
    params: {
      txId: string
      bidUsd: number
      askUsd: number
      outcome: 'yes' | 'no'
      shares: number
      limitPrice: number
      orderType: 'market' | 'limit'
      action: 'buy' | 'sell'
      userAccountInfo: NonNullable<typeof userAccountInfo>
    }
  ): PrismPredictionIntentRequest {
    if (!signerZero) {
      return { ...defaultPredictionIntentRequest(), marketId }
    }

    const accountInfo = params.userAccountInfo
    const keyTypeStr = accountInfo.key._type
    const publicKeyRaw = accountInfo.key.key
    let publicKey = publicKeyRaw
    let publicKeyNormalized = false

    try {
      if (keyTypeStr === 'ED25519') {
        if (publicKey.length > 64) {
          publicKey = publicKey.slice(-64)
          publicKeyNormalized = true
        }
      }
      if (keyTypeStr === 'ECDSA_SECP256K1') {
        const looksLikeCompressed = publicKey.length === 66 && (publicKey.startsWith('02') || publicKey.startsWith('03'))
        if (!looksLikeCompressed && publicKey.length > 66) {
          const pk = PublicKey.fromString(publicKey)
          publicKey = pk.toStringRaw()
          publicKeyNormalized = true
        }
      }
    } catch (e) {
      debugWarn('[useOrderLifecycle] Failed to normalize publicKey; using mirror-node key as-is', e)
      publicKey = publicKeyRaw
      publicKeyNormalized = false
    }

    if (keyTypeStr === 'ED25519' && publicKey.length !== 64) {
      debugError('[useOrderLifecycle] Invalid ED25519 key length:', { expected: 64, actual: publicKey.length, key: publicKey })
      throw new Error(`Invalid ED25519 public key length: ${publicKey.length} (expected 64)`)
    }
    if (keyTypeStr === 'ECDSA_SECP256K1' && ![66, 130].includes(publicKey.length)) {
      debugError('[useOrderLifecycle] Invalid ECDSA_SECP256K1 key length:', { expected: '66 or 130', actual: publicKey.length, key: publicKey })
      throw new Error(`Invalid ECDSA_SECP256K1 public key length: ${publicKey.length}`)
    }

    const actualPrice = params.orderType === 'market'
      ? (params.action === 'buy'
          ? (params.outcome === 'yes' ? Math.abs(params.askUsd) : (1 - params.bidUsd))
          : (params.outcome === 'yes' ? params.bidUsd : (1 - Math.abs(params.askUsd))))
      : params.limitPrice

    // PrismV2: integer YES-frame limit. Snap the natural price to 0.1¢ first.
    const p = Math.round(Math.abs(actualPrice) * 1000) / 1000
    const net = networkSelected.toString().toLowerCase()
    const side = params.outcome === 'yes' ? SIDE_YES : SIDE_NO
    const actionCode = params.action === 'sell' ? ACTION_SELL : ACTION_BUY
    const limitYesPrice = toLimitYesPrice(params.outcome, p)
    const qtyShares = toBaseUnits(params.shares, usdcNdecimals)
    const collateralCap = computeCollateralCap(side, actionCode, qtyShares, limitYesPrice)
    const verifyingContract = (prismV2ProxyAddresses[net] || '').replace(/^0x/i, '').toLowerCase()
    if (!/^[0-9a-f]{40}$/.test(verifyingContract)) {
      throw new Error('Trading contract address is not available for this network yet. Please refresh and try again.')
    }
    const chainId = chainIds[net] ?? DEFAULT_CHAIN_IDS[net] ?? 296n
    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS)

    debugLog('[useOrderLifecycle] Order details (V2):', {
      outcome: params.outcome, action: params.action, naturalPrice: p,
      limitYesPrice: limitYesPrice.toString(), qtyShares: qtyShares.toString(),
      collateralCap: collateralCap.toString(), chainId: chainId.toString(), verifyingContract,
      keyType: keyTypeStr, publicKeyNormalized, positionYes, positionNo,
    })

    return {
      ...defaultPredictionIntentRequest(),
      accountId: signerZero.getAccountId().toString(),
      evmAddress: accountInfo.evm_address.replace(/^0x/, '').toLowerCase(),
      keyType: keyTypeToInt(keyTypeStr),
      marketId,
      net,
      publicKey,
      sig: '',
      txId: params.txId,
      chainId,
      verifyingContract,
      side,
      action: actionCode,
      limitYesPrice,
      qtyShares,
      collateralCap,
      deadline,
    }
  }

  const toAuth = (i: PrismPredictionIntentRequest) => ({
    chainId: i.chainId, verifyingContract: i.verifyingContract, signer: i.evmAddress,
    marketId: i.marketId, txId: i.txId, side: i.side, action: i.action,
    limitYesPrice: i.limitYesPrice, qtyShares: i.qtyShares, collateralCap: i.collateralCap, deadline: i.deadline,
  })

  const signOrder = useCallback(async () => {
    if (!marketId) {
      console.error('[useOrderLifecycle] signOrder: marketId is empty')
      toast.error('Market ID is missing. Please refresh the page.')
      return
    }
    if (!signerZero) {
      toast.error('Please connect your wallet first')
      return
    }

    const effectivePrice = outcome === 'yes' ? limitPrice : (1 - limitPrice)
    if (effectivePrice <= 0 || amountUsd <= 0) {
      toast.error('Invalid order parameters')
      return
    }

    // Market-order liquidity preflight — mirrors backend ddd74e1 rejection
    // ("order quantity exceeds available liquidity"). For a market BUY we
    // sweep the opposite side: buying YES needs NO bids (asks array);
    // buying NO needs YES bids. Block early so the user doesn't sign.
    if (orderType === 'market') {
      const needsYesBids = (action === 'buy' && outcome === 'no') || (action === 'sell' && outcome === 'yes')
      const needsNoBids = (action === 'buy' && outcome === 'yes') || (action === 'sell' && outcome === 'no')
      if ((needsYesBids && !hasYesBids) || (needsNoBids && !hasNoBids)) {
        toast.error('Not enough liquidity in the order book for this size. Try a limit order instead.')
        return
      }
    }

    // Position-token balance preflight for secondary sells — mirrors backend
    // ddd74e1 ("insufficient position token balance"). Block before signing.
    if (action === 'sell') {
      const have = outcome === 'yes' ? positionYes : positionNo
      if (shares > have + 1e-9) {
        toast.error(`Insufficient ${outcome.toUpperCase()} shares to sell (have ${have.toFixed(3)}).`)
        return
      }
    }

    setIsProcessing(true)
    setProcessingStep('signing')

    const abortToken = { cancelled: false, diagnosticsAbort: new AbortController() }

    signAbortRef.current = abortToken

    try {
      let accountInfo = userAccountInfo
      if (!accountInfo) {
        debugWarn('[useOrderLifecycle] userAccountInfo missing before order signing; fetching on-demand')
        try {
          accountInfo = await getUserAccountInfo(networkSelected, signerZero.getAccountId().toString())
        } catch (e) {
          debugError('[useOrderLifecycle] mirror-node userAccountInfo fetch failed before signing:', e)
          toast.error('Could not load account key from mirror node. Please try again.')
          return
        }
      }

      const txId = uuidv7()
      setCurrentTxId(txId)
      debugLog('[useOrderLifecycle] Generated txId:', txId)

      const intent = generatePredictionIntent({
        txId,
        bidUsd: 1 - noAskPrice,
        askUsd: yesAskPrice,
        outcome,
        shares,
        limitPrice,
        orderType,
        action,
        userAccountInfo: accountInfo
      })

      debugLog('[useOrderLifecycle] Generated intent:', {
        marketId: intent.marketId, accountId: intent.accountId, txId: intent.txId
      })

      if (!intent.marketId) {
        toast.error('Failed to prepare order - Market ID missing')
        setIsProcessing(false)
        setProcessingStep('idle')
        return
      }

      // Scheme-drift guard — see backend lib/sign.go AssemblePayloadHexForSigning.
      // Index in sigSchemeDateRanges = scheme version. We always emit v1.
      if (sigSchemeDateRanges && sigSchemeDateRanges.length > 0) {
        const nowSec = Math.floor(Date.now() / 1000)
        const activeVersion = sigSchemeDateRanges.findIndex(
          r => nowSec >= r.start && nowSec < r.end
        )
        if (activeVersion !== -1 && activeVersion !== FRONTEND_SIG_VERSION) {
          debugWarn(
            `[useOrderLifecycle] Sig scheme drift: backend active=v${activeVersion}, frontend=v${FRONTEND_SIG_VERSION}`,
            sigSchemeDateRanges
          )
          toast.error(
            'Signing scheme has changed — refresh the app before placing orders.',
            { duration: 10000 }
          )

          setIsProcessing(false)
          setProcessingStep('idle')
          return
        }

      }

      const keccakHex = authorizationStructHash(toAuth(intent))
      const keccakB64 = authorizationSigningMessage(toAuth(intent))

      debugLog('[useOrderLifecycle] Signing payload:', {
        action, outcome,
        limitYesPrice: intent.limitYesPrice.toString(), qtyShares: intent.qtyShares.toString(),
        positionYes, positionNo,
        keccakHex, keccakB64
      })

      // Wallet auto-prefixes bytes with "\x19Hedera Signed Message:\n<len>".
      // Backend verifies over "\x19Hedera Signed Message:\n44" + base64(keccak),
      // so we must sign the UTF-8 bytes of the 44-char base64 string — NOT
      // the raw 32-byte keccak digest (which would produce "...\n32" prefix).
      const signMessage = Buffer.from(keccakB64, 'utf8')
      const signStartMs = Date.now()
      const sigRaw = await signWithWallet(
        'order.sign',
        async () => {
          const activeSigner = resolveFreshSigner(signerZero)
          const signatures = await (activeSigner.sign([signMessage]) as unknown as Promise<WalletSignatureResult>)
          const signature = signatures[0]?.signature
          if (!signature) {
            throw new Error('Wallet returned an empty signature. Please retry.')
          }
          return signature
        },
        {
          heartbeatMs: 5000,
          cancelSignal: abortToken.diagnosticsAbort.signal,
          meta: {
            action,
            outcome,
            marketId,
            txId,
            accountId: signerZero.getAccountId().toString(),
            limitYesPrice: intent.limitYesPrice.toString(),
            qtyShares: intent.qtyShares.toString(),
            orderAction: intent.action,
            positionYes,
            positionNo,
            signMessageLen: signMessage.length,
            signMessageKind: 'utf8(base64(prismV2StructHash))',
          },
        }
      )
      debugLog('[useOrderLifecycle] wallet returned', {
        action, outcome,
        sigByteLen: sigRaw ? Buffer.from(normalizeSignatureBase64(sigRaw), 'base64').length : 0,
        elapsedMs: Date.now() - signStartMs,
      })


      const sigB64 = normalizeSignatureBase64(sigRaw)
      let walletKeyString: string | null = null
      try {
        const acctKey = (signerZero as unknown as { getAccountKey?: () => { toString: () => string } })?.getAccountKey?.()
        walletKeyString = acctKey ? acctKey.toString() : null
      } catch { /* ignore — diagnostic only */ }
      debugLog('[useOrderLifecycle] Signature obtained:', {
        sigB64,
        sigByteLength: Buffer.from(sigB64, 'base64').length,
        intentPublicKey: intent.publicKey,
        walletAccountKey: walletKeyString,
        keysMatch: walletKeyString ? walletKeyString.endsWith(intent.publicKey) || intent.publicKey.endsWith(walletKeyString.replace(/^.*?([0-9a-fA-F]{64,66})$/, '$1')) : 'unknown',
      })


      if (abortToken.cancelled) {
        debugLog('[useOrderLifecycle] Signature received but signing was cancelled — discarding')
        return
      }

      setSignedKeccakB64(keccakB64)
      setPendingIntent(intent)
      setSignatureB64(sigB64)
      toast.success('Order signed! Click Submit to place your order.')
    } catch (err) {
      if (abortToken.cancelled) return
      debugError('Signing failed:', err)
      if (err instanceof Error && err.name === 'NotLeaderTabError') {
        toast('Wallet is active in another Prism tab. Click "Use wallet here" to take over.', { icon: '🪟' })
      } else {
        toast.error(err?.message || 'Failed to sign order')
      }
    } finally {
      if (!abortToken.cancelled) {
        setIsProcessing(false)
        setProcessingStep('idle')
      }
      if (signAbortRef.current === abortToken) signAbortRef.current = null
    }

  }, [marketId, signerZero, userAccountInfo, usdcNdecimals, outcome, limitPrice, amountUsd, yesAskPrice, noAskPrice, shares, orderType, action, networkSelected, sigSchemeDateRanges, prismV2ProxyAddresses, chainIds, hasYesBids, hasNoBids, positionYes, positionNo])

  const submitOrder = useCallback(async () => {
    if (!signerZero || !pendingIntent || !signatureB64) {
      toast.error('Order not signed yet')
      return
    }

    setIsProcessing(true)
    setProcessingStep('submitting')

    try {
      const signedIntent = { ...pendingIntent, sig: signatureB64 }

      debugLog('[useOrderLifecycle] Submitting signed intent:', {
        ...signedIntent,
        publicKey: signedIntent.publicKey?.slice(0, 20) + '...',
        sig: signedIntent.sig?.slice(0, 20) + '...'
      })
      debugLog('[useOrderLifecycle] Full signature (base64):', signedIntent.sig)

      const verifyKeccakB64 = authorizationSigningMessage(toAuth(signedIntent))
      if (Number(signedIntent.deadline) - Math.floor(Date.now() / 1000) < 60) {
        toast.error('This signed order has expired. Please sign it again.')
        setPendingIntent(null)
        setSignatureB64(null)
        setIsProcessing(false)
        setProcessingStep('idle')
        return
      }
      if (verifyKeccakB64 !== signedKeccakB64) {
        debugError('[useOrderLifecycle] Payload mismatch! signed:', signedKeccakB64, 'submit:', verifyKeccakB64)
        toast.error('Order payload changed after signing. Please re-sign.')
        setIsProcessing(false)
        setProcessingStep('idle')
        return
      }
      debugLog('[useOrderLifecycle] Verification check passed:', { keccakB64: verifyKeccakB64 })

      const result = await apiClient.createPredictionIntent(signedIntent)
      debugLog('Order submitted:', result)
      toast.success('Order placed successfully!')

      // Remember secondary (sell) intents locally: the backend does not
      // decrement the position while shares are escrowed, and the order can
      // take a while to show up in the book / open intents. Without this the
      // same shares can be offered for sale repeatedly. See lib/pendingSells.ts.
      if (signedIntent.action === ACTION_SELL) {
        const yes = Number(signedIntent.limitYesPrice) / 1_000_000
        recordPendingSell({
          txId: signedIntent.txId,
          marketId: signedIntent.marketId,
          outcome: signedIntent.side === SIDE_YES ? 'yes' : 'no',
          qty: fromBaseUnits(signedIntent.qtyShares, usdcNdecimals),
          priceUsd: signedIntent.side === SIDE_YES ? yes : 1 - yes,
        })
      }


      setPendingIntent(null)
      setSignatureB64(null)

      if (signerZero) {
        // Allowances must target the PrismV2 proxy; network config publishes it as smartContractIds[net].
        const spenderContractId = smartContractIds[networkSelected.toString().toLowerCase()] || market?.smartContractId
        const newAllowance = await getSpenderAllowanceUsd(
          networkSelected, usdcTokenIds, usdcNdecimals,
          spenderContractId,
          signerZero.getAccountId().toString()
        )
        setSpenderAllowanceUsd(newAllowance)
      }

      setPredictionIntentRequest({ ...defaultPredictionIntentRequest(), marketId })
    } catch (err) {
      const rawMsg = String((err as { message?: string })?.message || '')
      // Verbose diagnostics to help pinpoint signature verification failures.
      // Logs the exact server text plus the intent + signature we actually sent.
      debugError('[submitOrder] server rejected order:', {
        rawMsg,
        errName: (err as { name?: string })?.name,
        signedIntent: pendingIntent && {
          marketId: pendingIntent.marketId,
          txId: pendingIntent.txId,
          accountId: pendingIntent.accountId,
          evmAddress: pendingIntent.evmAddress,
          side: pendingIntent.side,
          action: pendingIntent.action,
          limitYesPrice: pendingIntent.limitYesPrice.toString(),
          qtyShares: pendingIntent.qtyShares.toString(),
          collateralCap: pendingIntent.collateralCap.toString(),
          deadline: pendingIntent.deadline.toString(),
          verifyingContract: pendingIntent.verifyingContract,
          chainId: pendingIntent.chainId.toString(),
          keyType: pendingIntent.keyType,
          publicKey: pendingIntent.publicKey,
        },
        signedKeccakB64,
        sigB64: signatureB64,
        sigByteLength: signatureB64 ? Buffer.from(signatureB64, 'base64').length : null,
        walletAccountId: signerZero?.getAccountId?.().toString?.(),
        fullError: err,
      })
      const friendly = mapServerError(rawMsg, 'submit')
      toast.error(friendly, { duration: 8000 })
      // If the server rejected the signature (commonly caused by a
      // WalletConnect request expiring mid-sign so the wallet returned bytes
      // that don't verify against the packed payload), drop the stale
      // signature so the user is forced to re-sign instead of resubmitting
      // the same bad bytes on the next click.
      if (/invalid signature|key.*mismatch|public key mismatch/i.test(rawMsg)) {
        setPendingIntent(null)
        setSignatureB64(null)
        setSignedKeccakB64(null)
        setCurrentTxId(null)
      }

    } finally {
      setIsProcessing(false)
      setProcessingStep('idle')
    }
  }, [signerZero, pendingIntent, signatureB64, networkSelected, usdcTokenIds, usdcNdecimals, smartContractIds, market?.smartContractId, setSpenderAllowanceUsd, marketId])

  const cancelOrder = useCallback(() => {
    setPendingIntent(null)
    setSignatureB64(null)
    setSignedKeccakB64(null)
    setCurrentTxId(null)
  }, [])

  const cancelSigning = useCallback(() => {
    if (signAbortRef.current) {
      signAbortRef.current.cancelled = true
      signAbortRef.current.diagnosticsAbort.abort('user cancelled signing')
      signAbortRef.current = null
    }
    // Reject this UI awaiter, but keep the in-tab wallet mutex held until the
    // underlying HashPack promise actually settles. WalletConnect message
    // signatures cannot be physically cancelled; releasing the lock here lets
    // a second order prompt start while the first response channel is still
    // live, which produced duplicate `order.sign` heartbeat streams.
    abortActiveWalletCall('user cancelled signing', { releaseLock: false })
    setIsProcessing(false)
    setProcessingStep('idle')
    setCurrentTxId(null)
    toast('Signing cancelled')
  }, [])

  const cancelPendingOrder = useCallback(async (txId: string): Promise<void> => {

    if (!marketId) {
      toast.error('Market ID is missing')
      throw new Error('Market ID missing')
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(txId)) {
      debugError('[useOrderLifecycle] INVALID txId format:', txId)
      toast.error('Invalid order ID format')
      throw new Error('Invalid order ID format')
    }
    if (!signerZero) {
      toast.error('Connect your wallet to cancel an order')
      throw new Error('Wallet not connected')
    }

    // userAccountInfo comes from a mirror-node lookup that is intentionally
    // non-fatal on connect (see lib/useWallet.ts). If that lookup previously
    // failed or hasn't completed yet, the wallet still shows as connected —
    // fetch on-demand instead of forcing the user to reconnect.
    let userKey = userAccountInfo
    if (!userKey) {
      try {
        userKey = await getUserAccountInfo(networkSelected, signerZero.getAccountId().toString())
      } catch (e) {
        debugError('[useOrderLifecycle] mirror-node userAccountInfo fetch failed:', e)
        toast.error('Could not load account key from mirror node. Please try again.')
        throw new Error('userAccountInfo unavailable')
      }
    }

    try {
      await submitSignedCancel({
        marketId,
        txId,
        net: networkSelected.toString(),
        signer: resolveFreshSigner(signerZero),
        userKey,
      })
      toast.success('Order cancelled successfully')
    } catch (err) {
      debugError('[useOrderLifecycle] Cancel failed:', err)
      const friendly = mapServerError(String((err as Error)?.message || ''), 'cancel')
      toast.error(friendly)
      throw err
    }
  }, [marketId, signerZero, userAccountInfo, networkSelected])

  const resetOrder = useCallback(() => {
    setPredictionIntentRequest({ ...defaultPredictionIntentRequest(), marketId })
    form.setAmountUsd(10)
    setLimitPrice(0.50) // Will be overridden by price hook's initialLimitPrice via effect
    setCurrentTxId(null)
    cancelOrder()
  }, [marketId, cancelOrder, form, setLimitPrice])

  const isSigned = !!signatureB64 && !!pendingIntent

  return {
    signOrder,
    submitOrder,
    cancelOrder,
    cancelSigning,
    cancelPendingOrder,
    resetOrder,
    isSigned,
    isProcessing,
    processingStep,
  }
}

