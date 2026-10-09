import { AccountAllowanceApproveTransaction, AccountId, ContractExecuteTransaction, ContractFunctionParameters, LedgerId, Transaction } from '@hiero-ledger/sdk'
import { resolveFreshSigner, type DAppSigner } from './appkit'
import { UserAccountInfo } from '../types'
import { getMirrorNodeUrl } from '../constants'
import { instrumentWalletCall } from './walletDiagnostics'
import { withWalletLock } from './walletMutex'
import { instrumentWcCall } from './wcInstrument'


// Prism.sol selectors (computed via keccak256(text)[0..4]).
// Cross-checked against the deployed bytecode on testnet contract 0.0.8839112.
const SELECTOR_OUTCOMES_UINT128 = 'bcffca1d' // outcomes(uint128) → 0=unresolved/false, non-zero=resolved-truthy
const SELECTOR_REDEEM_UINT128 = '354df84f'   // redeem(uint128)
const SELECTOR_RESOLVE_MARKET = '489f41e8'   // resolveMarket(uint128,bool)
void SELECTOR_REDEEM_UINT128
void SELECTOR_RESOLVE_MARKET

// Maximum uint256 value for "unlimited" allowance
export const MAX_UINT256 = 2n ** 256n - 1n

// Practically unlimited allowance: 1 trillion USDC
// Must fit in int64 when scaled by decimals (max ~9.2e18). 1e12 * 1e6 = 1e18 ✓
export const UNLIMITED_ALLOWANCE_USD = 1_000_000_000_000


const getSpenderAllowanceUsd = async (networkSelected: LedgerId, usdcTokenIds: Record<string, string>, usdcNdecimals: number, smartContractId: string, accountId: string): Promise<number> => {
  try {
    const mirrornode = `${getMirrorNodeUrl(networkSelected.toString())}/api/v1/accounts/${accountId}/allowances/tokens?spender.id=eq:${smartContractId}&token.id=eq:${usdcTokenIds[networkSelected.toString().toLowerCase()]}`
    const response = await fetch(mirrornode)
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    const data = await response.json()
    return data.allowances[0]?.amount / (10 ** usdcNdecimals) || 0
  } catch (error) {
    console.error('Error fetching allowance:', error)
    throw error
  }
}

/**
 * Returns ALL non-zero USDC fungible-token allowances the account has granted
 * (across every spender), not just the current Prism contract. Used to detect
 * stale allowances on a previous contract id after a backend redeploy.
 */
export interface UsdcSpenderAllowance {
  spenderId: string   // e.g. '0.0.8839112'
  amountUsd: number
}

const getAllUsdcSpenderAllowances = async (
  networkSelected: LedgerId,
  usdcTokenIds: Record<string, string>,
  usdcNdecimals: number,
  accountId: string
): Promise<UsdcSpenderAllowance[]> => {
  try {
    const usdcTokenId = usdcTokenIds[networkSelected.toString().toLowerCase()]
    if (!usdcTokenId) return []
    // Mirror node rejects `token.id` filter unless `spender.id` is also given,
    // so fetch all token allowances for the account and filter to USDC client-side.
    const base = getMirrorNodeUrl(networkSelected.toString())
    let next: string | null = `/api/v1/accounts/${accountId}/allowances/tokens?limit=100`
    const collected: Array<{ spender: string; amount: number; token_id: string }> = []
    let pages = 0
    while (next && pages < 5) {
      pages++
      const response = await fetch(`${base}${next}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`Mirror node ${response.status}`)
      const data = await response.json()
      const rows: Array<{ spender: string; amount: number; token_id: string }> = data.allowances || []
      collected.push(...rows)
      next = data.links?.next || null
    }
    return collected
      .filter(r => r.token_id === usdcTokenId && (r.amount || 0) > 0 && !!r.spender)
      .map(r => ({
        spenderId: r.spender,
        amountUsd: (r.amount || 0) / (10 ** usdcNdecimals),
      }))
  } catch (error) {
    console.error('Error fetching all USDC allowances:', error)
    return []
  }
}

const getUserAccountInfo = async (networkSelected: LedgerId, accountId: string) => {
  try {
    const mirrornode = `${getMirrorNodeUrl(networkSelected.toString())}/api/v1/accounts/${accountId}`
    const response = await fetch(mirrornode)
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    const data = await response.json()
    return data as UserAccountInfo
  } catch (error) {
    console.error('Error fetching account info from mirrornode:', error)
    throw error
  }
}

/**
 * Convert SDK transaction id "0.0.X@SECS.NANOS" → mirror node format
 * "0.0.X-SECS-NANOS" used in /api/v1/transactions/{id}.
 */
const formatTxIdForMirror = (sdkTxId: string): string => {
  // "0.0.6781806@1778087090.024597606" → "0.0.6781806-1778087090-024597606"
  // Note: String.replace with a string only replaces the FIRST match, so we
  // must parse explicitly — keep shard/realm dots, dash the @, dash the
  // seconds/nanoseconds separator.
  const [account, stamp] = sdkTxId.split('@')
  if (!stamp) return sdkTxId
  const [secs, nanos = '0'] = stamp.split('.')
  return `${account}-${secs}-${nanos}`
}

/**
 * Poll the mirror node for the on-chain result of a submitted transaction.
 * Avoids the broken browser→Hedera-node gRPC receipt path. The first few polls
 * will typically 404 due to mirror lag (~2-6s); we keep polling until we see a
 * terminal result or hit the timeout.
 *
 * Returns true on SUCCESS, false on any other terminal result.
 * Throws if the mirror node never returns the tx within `timeoutMs`.
 */
const waitForMirrorTxResult = async (
  network: LedgerId,
  sdkTxId: string,
  opts: { timeoutMs?: number; intervalMs?: number; cancelSignal?: AbortSignal } = {}
): Promise<boolean> => {
  const timeoutMs = opts.timeoutMs ?? 45000
  const intervalMs = opts.intervalMs ?? 2000
  const cancelSignal = opts.cancelSignal
  const mirrorTxId = formatTxIdForMirror(sdkTxId)
  const base = getMirrorNodeUrl(network.toString())
  const url = `${base}/api/v1/transactions/${mirrorTxId}`
  const start = Date.now()
  let lastErr: unknown = null
  let lastTxs: Array<{ result?: string }> | null = null
  let loggedFirst404 = false
  let lastLogAt = 0

  console.log('[waitForMirrorTxResult] polling', url)

  const isCancelled = () => cancelSignal?.aborted === true
  const cancellableSleep = (ms: number) => new Promise<void>((resolve) => {
    if (isCancelled()) return resolve()
    const t = setTimeout(() => {
      cancelSignal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => { clearTimeout(t); resolve() }
    cancelSignal?.addEventListener('abort', onAbort, { once: true })
  })

  while (Date.now() - start < timeoutMs) {
    if (isCancelled()) {
      console.log('[waitForMirrorTxResult] cancelled', mirrorTxId, 'reason=', (cancelSignal as AbortSignal & { reason?: unknown })?.reason)
      throw new Error('mirror poll cancelled')
    }
    try {
      const response = await fetch(url, { cache: 'no-store', signal: cancelSignal })
      if (response.status === 404) {
        if (!loggedFirst404) {
          console.log('[waitForMirrorTxResult] first 404 (mirror lag)', mirrorTxId)
          loggedFirst404 = true
        }
        if (Date.now() - lastLogAt > 10000) {
          console.log('[waitForMirrorTxResult] still 404 after', Math.round((Date.now() - start) / 1000), 's', mirrorTxId)
          lastLogAt = Date.now()
        }
      } else if (!response.ok) {
        lastErr = new Error(`Mirror node ${response.status}`)
        console.warn('[waitForMirrorTxResult]', response.status, mirrorTxId)
      } else {
        const data = await response.json()
        const txs: Array<{ result?: string }> = data.transactions || []
        lastTxs = txs
        // Look for ANY terminal non-success first — a child CONTRACT_REVERT_EXECUTED
        // must not be masked by a parent SUCCESS consensus row.
        const failure = txs.find(t => t.result && t.result !== 'SUCCESS')
        if (failure?.result) {
          console.log(`[waitForMirrorTxResult] ${mirrorTxId} → FAILED: ${failure.result}`, txs)
          throw new Error(`Transaction failed on-chain: ${failure.result}`)
        }
        const successRow = txs.find(t => t.result === 'SUCCESS')
        if (successRow) {
          console.log(`[waitForMirrorTxResult] ${mirrorTxId} → SUCCESS`)
          return true
        }
      }
    } catch (err) {
      // Re-throw terminal on-chain failures immediately.
      if (err instanceof Error && err.message.startsWith('Transaction failed on-chain:')) {
        throw err
      }
      if (isCancelled()) {
        throw new Error('mirror poll cancelled')
      }
      lastErr = err
      // Network blip — keep polling until timeout
    }
    await cancellableSleep(intervalMs)
  }

  console.error('[waitForMirrorTxResult] timeout', mirrorTxId, 'lastTxs=', lastTxs, 'lastErr=', lastErr)
  throw new Error('Transaction is still pending on the network. It may complete shortly — please refresh in a few seconds.')
}


/**
 * Race the browser→Hedera-node gRPC receipt against mirror-node polling.
 * Resolves true on the first SUCCESS confirmation; throws an aggregated
 * error only if BOTH paths fail or time out. The browser usually cannot
 * reach Hedera nodes, but when it can the gRPC path is faster (~3-5s)
 * than mirror lag (~2-6s).
 */
const confirmTx = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signer: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txResponse: any,
  network: LedgerId
): Promise<boolean> => {
  const sdkTxId = txResponse.transactionId.toString()
  console.log('[confirmTx] sdkTxId=', sdkTxId, 'mirrorId=', formatTxIdForMirror(sdkTxId))


  const grpc: Promise<boolean> = (async () => {
    try {
      const receipt = await txResponse.getReceiptWithSigner(signer)
      const status = receipt?.status?.toString?.()
      if (status === 'SUCCESS') return true
      throw new Error(`gRPC receipt status: ${status ?? 'unknown'}`)
    } catch (err) {
      console.warn('[confirmTx] gRPC receipt path failed', err)
      throw err
    }
  })()

  const mirror = waitForMirrorTxResult(network, sdkTxId, { timeoutMs: 45000, intervalMs: 2000 })

  try {
    return await Promise.any([grpc, mirror])
  } catch (err) {
    // AggregateError — flatten to the most informative message.
    if (err && typeof err === 'object' && 'errors' in err) {
      const errors = (err as AggregateError).errors as unknown[]
      const onChain = errors.find(
        e => e instanceof Error && e.message.startsWith('Transaction failed on-chain:')
      ) as Error | undefined
      if (onChain) throw onChain
      const pending = errors.find(
        e => e instanceof Error && e.message.includes('still pending')
      ) as Error | undefined
      if (pending) throw pending
      const first = errors.find(e => e instanceof Error) as Error | undefined
      throw first ?? new Error('Transaction confirmation failed')
    }
    throw err
  }
}

// Timeout helper for wallet operations
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const timer = setTimeout(() => {
      import('./walletDiagnostics').then(({ snapshotSessions }) => {
        console.error(`[wc] ${operation} TIMEOUT after ${Date.now() - startedAt}ms`, {
          visibility: typeof document !== 'undefined' ? document.visibilityState : 'n/a',
          sessions: snapshotSessions(),
        })
      }).catch(() => { /* ignore */ })

      // We do NOT call `abortActiveWalletCall` here: forcibly rejecting the
      // awaiter races the wallet response and, when the ack was about to
      // arrive, corrupts session state. The mutex releases naturally when
      // the underlying `executeWithSigner` promise settles.
      reject(new Error(`${operation} timed out after ${timeoutMs / 1000}s - please check your wallet and retry`))
    }, timeoutMs)

    promise
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

// WalletConnect's DAppSigner.populateTransaction currently sets only the
// transactionId. Hedera SDK freeze() also needs at least one nodeAccountId;
// without one, freezeWithSigner throws "nodeAccountId must be set". HashConnect
// has getClient() and already populates nodes itself, so only seed nodes for
// WalletConnect-style signers. Do NOT call populateTransaction directly here —
// doing so before freezeWithSigner can lock SDK internals on some signer paths.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seedWalletConnectNodeAccountId = (tx: Transaction, signer: any): void => {
  if (typeof signer?.getClient === 'function' || typeof signer?.getNetwork !== 'function') return

  const existingNodes = tx.nodeAccountIds
  if (existingNodes && existingNodes.length > 0) return

  const network = signer.getNetwork() as Record<string, string | AccountId>
  const node = Object.values(network)[0]
  if (!node) {
    throw new Error('Wallet signing setup failed: no Hedera node account IDs are available for this network.')
  }

  tx.setNodeAccountIds([AccountId.fromString(node.toString())])
}

const grantAllowanceUsd = async (
  signerZero: DAppSigner, 
  usdcTokenIds: Record<string, string>, 
  usdcNdecimals: number, 
  contractId: string, 
  amountUsd: number,
  useMaxAllowance: boolean = false
): Promise<boolean> => {
  const networkKey = signerZero.getLedgerId().toString().toLowerCase()
  const usdcTokenId = usdcTokenIds[networkKey]
  
  console.log('[grantAllowanceUsd] Starting approval transaction')
  console.log('[grantAllowanceUsd] Network:', networkKey)
  console.log('[grantAllowanceUsd] USDC Token ID:', usdcTokenId)
  console.log('[grantAllowanceUsd] Contract ID:', contractId)
  console.log('[grantAllowanceUsd] Amount USD:', amountUsd)
  console.log('[grantAllowanceUsd] Use Max Allowance:', useMaxAllowance)
  
  // Validate inputs
  if (!usdcTokenId) {
    const configured = Object.keys(usdcTokenIds).join(', ') || 'none'
    throw new Error(`No USDC token ID configured for network "${networkKey}" (configured: ${configured}). Try refreshing the page.`)
  }

  if (!contractId) {
    throw new Error('Contract ID is required')
  }
  
  // Verify signer is still connected
  try {
    const accountId = signerZero.getAccountId()
    console.log('[grantAllowanceUsd] Signer account:', accountId.toString())
  } catch (error) {
    console.error('[grantAllowanceUsd] Signer validation failed:', error)
    throw new Error('Wallet session appears disconnected. Please reconnect your wallet.')
  }
  
  // Calculate approval amount - use UNLIMITED_ALLOWANCE_USD for max, otherwise convert USD to token units.
  // Clamp to int64 max: the Hedera SDK encodes the amount as int64, and at
  // 8+ USDC decimals UNLIMITED_ALLOWANCE_USD × 10^decimals overflows.
  const MAX_INT64 = 9_223_372_036_854_775_807n
  const rawApproval = useMaxAllowance
    ? BigInt(UNLIMITED_ALLOWANCE_USD) * BigInt(10 ** usdcNdecimals)
    : BigInt(Math.round(amountUsd * (10 ** usdcNdecimals)))
  const approvalAmount = rawApproval > MAX_INT64 ? MAX_INT64 : rawApproval
  
  console.log('[grantAllowanceUsd] Approval amount (scaled):', approvalAmount.toString())
  
  // Build a native Hedera token-allowance transaction instead of an ERC-20
  // ContractExecute approve. HashPack presents native allowance approvals
  // reliably (including large "Max" amounts), while generic token-contract
  // executes can hang before the wallet prompt is rendered.
  const isRevoke = approvalAmount === 0n

  let approveTx: AccountAllowanceApproveTransaction
  try {
    approveTx = new AccountAllowanceApproveTransaction()
      .approveTokenAllowance(
        usdcTokenId,
        signerZero.getAccountId().toString(),
        contractId,
        approvalAmount,
      )
    console.log('[grantAllowanceUsd] Native token allowance transaction constructed OK')
  } catch (buildErr) {
    console.error('[grantAllowanceUsd] Failed to construct allowance tx', {
      approvalAmount: approvalAmount.toString(),
      useMaxAllowance,
      err: buildErr instanceof Error ? { name: buildErr.name, message: buildErr.message } : buildErr,
    })
    throw new Error(`Failed to build allowance transaction: ${buildErr instanceof Error ? buildErr.message : 'unknown error'}`)
  }

  console.log('[grantAllowanceUsd] Operation:', isRevoke ? 'REVOKE' : useMaxAllowance ? 'GRANT-MAX' : 'GRANT')
  
  console.log('[grantAllowanceUsd] Executing transaction with wallet (5m timeout)...')


  try {
    // MANDATORY: freeze against the signer before executeWithSigner.
    // HashConnect populates transactionId/nodeAccountIds inside
    // freezeWithSigner. WalletConnect's DAppSigner only populates
    // transactionId, so seed one nodeAccountId before freezing. Do NOT call
    // signer.populateTransaction() directly: double-populating can lock SDK
    // internals and trigger "list is locked". See docs/signing-parity.md.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signerAny = resolveFreshSigner(signerZero) as any
    seedWalletConnectNodeAccountId(approveTx, signerAny)
    await approveTx.freezeWithSigner(signerAny)

    const sdkTxId = approveTx.transactionId!.toString()
    const network = signerZero.getLedgerId()

    // Serialize wallet-facing calls so a second signing prompt cannot be
    // fired while HashPack is still showing the first — WalletConnect handles
    // one request at a time and silently drops the rest. Wait for the
    // wallet's response, then confirm on-chain via receipt/mirror. The
    // mirror-race preflight this used to run was removed (it caused
    // duplicate settlement paths and interfered with slow HashPack reviews);
    // matches SaucerSwap's minimal shape.
    const txResp = await withWalletLock('grantAllowanceUsd', () =>
      instrumentWalletCall(
        'grantAllowanceUsd.executeWithSigner',
        () => instrumentWcCall(
          `grantAllowanceUsd ${isRevoke ? 'REVOKE' : useMaxAllowance ? 'GRANT-MAX' : 'GRANT'} sdkTxId=${sdkTxId}`,
          () => withTimeout(
            approveTx.executeWithSigner(signerAny),
            300000,
            'Wallet transaction signing'
          )
        ),
        { meta: { contractId, usdcTokenId, approvalAmount: approvalAmount.toString(), useMaxAllowance } }
      )
    )

    console.log('[grantAllowanceUsd] wallet returned transaction response — confirming on-chain')
    const ok = await confirmTx(signerZero, txResp, network)
    if (ok) {
      console.log('[grantAllowanceUsd] Transaction confirmed SUCCESS')
      return true
    }
    console.error('[grantAllowanceUsd] Transaction did not succeed on-chain')
    return false


  } catch (error) {
    console.error('[grantAllowanceUsd] Transaction error:', error)
    
    // Provide more helpful error messages
    if (error instanceof Error) {
      const code = (error as Error & { code?: string }).code
      if (code === 'WALLET_NOT_CONNECTED' || code === 'WALLET_SESSION_EXPIRED') {
        throw new Error('Wallet session is not active. Please reconnect your wallet and try again.')
      }
      if (error.message.includes('freezeWith') || error.message.includes('transactionId must be set')) {
        throw new Error('Wallet signing setup failed. Please refresh the page and reconnect your wallet.')
      }
      if (error.message.includes('timed out')) {
        throw new Error('Wallet did not respond in time. Please check if your wallet app is open and try again.')
      }
      if (
        error.message.includes('USER_REJECT') ||
        error.message.includes('rejected') ||
        error.message.includes('cancelled') ||
        error.message.includes('canceled') ||
        error.message.includes('denied')
      ) {
        throw new Error('Transaction was rejected by wallet')
      }
    }
    throw error
  }
}

const getTokenBalance = async (networkSelected: LedgerId, tokenId: string, accountId: string): Promise<number> => {
  try {
    // Mirror node rejects unknown query parameters, so we can't add cache-busters like `&_t=`.
    // Instead rely on fetch cache controls.
    const url = `${getMirrorNodeUrl(networkSelected.toString())}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`
    console.log('url', url)
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    const data = await response.json()

    if (data.tokens.length === 0) {
      console.warn(`No balance found for token ${tokenId} on account ${accountId}`)
      return 0
    }
    console.log('[getTokenBalance] Raw balance for', tokenId, ':', data.tokens[0].balance)
    return data.tokens[0].balance || 0
  } catch (error) {
    console.error('Error fetching token balance:', error)
    throw error
  }
}

/**
 * Calls Prism.redeem(uint128 marketId) on the on-chain prediction market contract.
 * The smart-contract marketId is derived deterministically from the UUIDv7 marketId
 * via uuidToBigInt() (same encoding the backend uses for signed-payload assembly).
 *
 * @param signerZero connected DAppSigner (msg.sender becomes the redeemer)
 * @param contractId Hedera contract id of the deployed Prism contract (e.g. '0.0.12345')
 * @param marketIdU128 the per-market uint128 id (as bigint) — derived from market UUID
 * @returns scaled USDC amount redeemed (1:1 with winning shares, in token units)
 */
const redeemWinnings = async (
  signerZero: DAppSigner,
  contractId: string,
  marketIdU128: bigint
): Promise<{ amountScaled: bigint; txId: string }> => {
  if (!signerZero) throw new Error('Wallet not connected')
  if (!contractId) throw new Error('Prism contract id missing for selected network')

  // Sanity: uint128 max
  const UINT128_MAX = (1n << 128n) - 1n
  if (marketIdU128 < 0n || marketIdU128 > UINT128_MAX) {
    throw new Error('Invalid uint128 marketId')
  }

  console.log('[redeemWinnings] contract:', contractId, 'marketIdU128:', marketIdU128.toString())

  const tx = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(400_000)
    .setFunction(
      'redeem',
      // Contract signature is redeem(uint128) — must use addUint128 so the SDK
      // computes the correct function selector. Pass a string (SDK accepts
      // string | number | Long | BigNumber); avoid passing a BigNumber instance
      // because the SDK's internal isBigNumber check fails across copies of
      // bignumber.js. eslint-disable-next-line @typescript-eslint/no-explicit-any
      new ContractFunctionParameters().addUint128(marketIdU128.toString() as any)
    )

  // MANDATORY: freeze against the signer before executeWithSigner.
  // HashConnect populates transactionId/nodeAccountIds inside
  // freezeWithSigner. WalletConnect's DAppSigner only populates transactionId,
  // so seed one nodeAccountId before freezing. Do NOT call
  // signer.populateTransaction() directly: double-populating can lock SDK
  // internals and trigger "list is locked". See docs/signing-parity.md.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signerAny = resolveFreshSigner(signerZero) as any
  seedWalletConnectNodeAccountId(tx, signerAny)
  await tx.freezeWithSigner(signerAny)

  const network = signerZero.getLedgerId()

  // Sign + execute (5m timeout — matches grantAllowanceUsd; HashPack reviews
  // can legitimately take minutes). Serialized so it cannot race a concurrent
  // allowance/order signing prompt. The mirror-race preflight this used to
  // run was removed — see grantAllowanceUsd for rationale.
  const txResp = await withWalletLock('redeemWinnings', () =>
    instrumentWalletCall(
      'redeemWinnings.executeWithSigner',
      () => withTimeout(
        tx.executeWithSigner(signerAny),
        300000,
        'Redeem signing'
      ),
      { meta: { contractId, marketIdU128: marketIdU128.toString() } }
    )
  )

  console.log('[redeemWinnings] wallet returned transaction response — confirming via receipt/mirror')
  const ok = await confirmTx(signerZero, txResp, network)
  console.log('[redeemWinnings] confirm ok=', ok)
  if (!ok) throw new Error('Redeem failed on-chain')
  const confirmedTxId = txResp.transactionId.toString()

  // Hedera receipt does not return the contract function return value directly;
  // the caller already knows the expected payout from the position's winning side qty.
  return {
    amountScaled: 0n, // not surfaced by receipt — caller uses pre-known payout
    txId: confirmedTxId
  }

}

export {
  getSpenderAllowanceUsd,
  getAllUsdcSpenderAllowances,
  grantAllowanceUsd,
  getUserAccountInfo,
  getTokenBalance,
  redeemWinnings
}
