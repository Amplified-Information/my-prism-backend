/**
 * PrismV2 integer order protocol (backend 25fd9bd, docs/PRISM_V2_ORDER_PROTOCOL.md).
 *
 * - Prices: integer YES probability on a 1_000_000 scale.
 * - Shares / collateral: collateral token base units (USDC: 6 decimals).
 * - side: 0 YES, 1 NO. action: 0 BUY, 1 SELL.
 *
 * Also exposes a "legacy view" adapter so display code that still thinks in
 * the V1 signed-price convention (bid = +yesPrice, ask = -yesPrice, human
 * share qty, ps 'p'|'s') keeps working without touching every render path.
 */
import { AbiCoder, keccak256, toUtf8Bytes, encodeBase64 } from 'ethers'
import type { OrderDetail, BookSnapshot } from '../gen/clob'
import type { PredictionIntentResponse } from '../gen/api'

export const PRICE_SCALE = 1_000_000n
export const AUTHORIZATION_VERSION = 2
export const AUTHORIZATION_TYPE =
  'PrismAuthorization(uint8 version,uint256 chainId,address verifyingContract,address signer,uint128 marketId,uint128 txId,uint8 side,uint8 action,uint256 limitYesPrice,uint256 qtyShares,uint256 collateralCap,uint64 deadline)'
export const BUY_NO_CAP_SLACK = 100n
export const DEFAULT_DEADLINE_SECONDS = 60 * 60
export const MIN_DEADLINE_SECONDS = 60
export const DEFAULT_CHAIN_IDS: Record<string, bigint> = { mainnet: 295n, testnet: 296n, previewnet: 297n }

export const SIDE_YES = 0
export const SIDE_NO = 1
export const ACTION_BUY = 0
export const ACTION_SELL = 1

export type Outcome = 'yes' | 'no'
export type OrderAction = 'buy' | 'sell'

export interface AuthorizationV2 {
  chainId: bigint
  verifyingContract: string // 40 hex, with or without 0x
  signer: string            // 40 hex, with or without 0x
  marketId: string          // UUIDv7
  txId: string              // UUIDv7
  side: number
  action: number
  limitYesPrice: bigint
  qtyShares: bigint
  collateralCap: bigint
  deadline: bigint
}

const strip0x = (s: string) => s.replace(/^0x/i, '').toLowerCase()
export const uuidToUint128 = (uuid: string) => BigInt('0x' + uuid.replace(/-/g, ''))

/** True for orders resting on the bid side of the YES book (BUY YES, SELL NO). */
export const isBidSide = (side: number, action: number) =>
  (side === SIDE_YES && action === ACTION_BUY) || (side === SIDE_NO && action === ACTION_SELL)

/** Convert a natural outcome price (0..1, YES or NO) into the integer YES limit. */
export function toLimitYesPrice(outcome: Outcome, naturalPrice: number): bigint {
  const p = BigInt(Math.round(naturalPrice * 1_000_000))
  const clamped = p < 0n ? 0n : p > PRICE_SCALE ? PRICE_SCALE : p
  return outcome === 'yes' ? clamped : PRICE_SCALE - clamped
}

/** Human share quantity → base units (rounded to the token's precision). */
export function toBaseUnits(amount: number, decimals = 6): bigint {
  const [i, f = ''] = amount.toFixed(decimals).split('.')
  return BigInt(i + f.padEnd(decimals, '0').slice(0, decimals))
}

export function fromBaseUnits(v: bigint | number | string | undefined, decimals = 6): number {
  if (v === undefined || v === null) return 0
  return Number(BigInt(v)) / 10 ** decimals
}

export const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b

/** Spec §"Choosing collateralCap for a BUY". SELL always 0. */
export function computeCollateralCap(side: number, action: number, qtyShares: bigint, limitYesPrice: bigint): bigint {
  if (action === ACTION_SELL) return 0n
  if (side === SIDE_YES) return ceilDiv(qtyShares * limitYesPrice, PRICE_SCALE)
  return ceilDiv(qtyShares * (PRICE_SCALE - limitYesPrice), PRICE_SCALE) + BUY_NO_CAP_SLACK
}

export function authorizationStructHash(a: AuthorizationV2): string {
  return keccak256(AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'uint8', 'uint256', 'address', 'address', 'uint128', 'uint128', 'uint8', 'uint8', 'uint256', 'uint256', 'uint256', 'uint64'],
    [
      keccak256(toUtf8Bytes(AUTHORIZATION_TYPE)), AUTHORIZATION_VERSION, a.chainId,
      '0x' + strip0x(a.verifyingContract), '0x' + strip0x(a.signer),
      uuidToUint128(a.marketId), uuidToUint128(a.txId), a.side, a.action,
      a.limitYesPrice, a.qtyShares, a.collateralCap, a.deadline,
    ],
  ))
}

/** 44-char base64 of the struct hash — the string the Hedera wallet signs. */
export function authorizationSigningMessage(a: AuthorizationV2): string {
  return encodeBase64(authorizationStructHash(a))
}

// ---------------------------------------------------------------- legacy view

export interface LegacyOrder {
  txId: string
  accountId: string
  /** +yesPrice for bids, -yesPrice for asks (V1 convention). */
  priceUsd: number
  /** Remaining human shares. */
  qty: number
  /** 's' for SELL (closing), 'p' for BUY (opening). */
  ps: string
  side: number
  action: number
}

type AnyOrder = OrderDetail | PredictionIntentResponse | LegacyOrder

export function toLegacyOrder(o: AnyOrder, decimals = 6): LegacyOrder {
  if ('ps' in o && 'priceUsd' in o) return o as LegacyOrder
  const yes = Number(BigInt((o as OrderDetail).limitYesPrice ?? 0)) / 1_000_000
  const bid = isBidSide(o.side, o.action)
  let remaining: bigint
  if ('sharesRemaining' in o) remaining = BigInt(o.sharesRemaining)
  else {
    const i = o as PredictionIntentResponse
    remaining = BigInt(i.qtyShares ?? 0) - BigInt(i.sharesFilled ?? 0)
    if (remaining < 0n) remaining = 0n
  }
  return {
    txId: o.txId,
    accountId: o.accountId,
    priceUsd: bid ? yes : -yes,
    qty: fromBaseUnits(remaining, decimals),
    ps: o.action === ACTION_SELL ? 's' : 'p',
    side: o.side,
    action: o.action,
  }
}

export interface LegacyBook { bids: LegacyOrder[]; asks: LegacyOrder[] }

export function toLegacyBook(book: BookSnapshot | LegacyBook | undefined, decimals = 6): LegacyBook {
  return {
    bids: (book?.bids ?? []).map(o => toLegacyOrder(o as AnyOrder, decimals)),
    asks: (book?.asks ?? []).map(o => toLegacyOrder(o as AnyOrder, decimals)),
  }
}

/** Natural outcome + action for an order. */
export function describeOrder(side: number, action: number): { outcome: Outcome; action: OrderAction } {
  return { outcome: side === SIDE_NO ? 'no' : 'yes', action: action === ACTION_SELL ? 'sell' : 'buy' }
}
