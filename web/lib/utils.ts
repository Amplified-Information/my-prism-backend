import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { keccak256 } from 'ethers'
import { BookSnapshot } from '../gen/clob'
import { toLegacyBook, toLegacyOrder, type LegacyBook, type LegacyOrder } from './prismV2'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract best bid and ask prices from order book snapshot.
 * Best bid = highest positive price (YES side)
 * Best ask = smallest absolute value of negative prices (NO side)
 */
/**
 * Extract best bid and ask prices from order book snapshot.
 * Best bid = highest positive price (YES side)
 * Best ask = smallest absolute value of negative prices (NO side)
 * yesProbability = midpoint of YES prices (uses 1 - noPrice for implied YES from NO)
 */
export function getBestPricesFromBook(rawBook: BookSnapshot | LegacyBook): {
  bestBid: number;
  bestAsk: number;
  bestYesBid: number;
  bestNoBid: number;
  bestYesAsk: number;
  bestNoAsk: number;
  yesProbability: number;
  hasYesBids: boolean;
  hasNoBids: boolean;
} {
  const book = toLegacyBook(rawBook)
  const bids = book.bids
  const asks = book.asks

  const hasYesBids = bids.length > 0
  const hasNoBids = asks.length > 0

  // Wire is YES-FRAME: |priceUsd| is YES-equivalent cost.
  //   YES bids: positive p → natural YES price = p
  //   NO  bids (stored as "asks" with negative p): natural NO price = 1 − |p|
  const bestYesBid = hasYesBids ? Math.max(...bids.map(o => o.priceUsd)) : null
  // Best NO bid = highest natural NO price = 1 − lowest |p| on the ask side.
  const bestNoBid = hasNoBids ? 1 - Math.min(...asks.map(o => Math.abs(o.priceUsd))) : null

  // Binary identity: YES_ask = 1 − bestNoBid, NO_ask = 1 − bestYesBid.
  const bestYesAsk = bestNoBid !== null ? 1 - bestNoBid : null
  const bestNoAsk = bestYesBid !== null ? 1 - bestYesBid : null

  // yesProbability — midpoint when both sides exist, else fall back.
  let yesProbability: number
  if (hasYesBids && hasNoBids) {
    yesProbability = (bestYesBid! + bestYesAsk!) / 2
  } else if (hasYesBids) {
    yesProbability = bestYesBid!
  } else if (hasNoBids) {
    yesProbability = bestYesAsk!
  } else {
    yesProbability = 0.50
  }

  // Legacy bestBid/bestAsk preserved for non-trading callers (GraphPrice, usePortfolio):
  //   bestBid = best YES bid; bestAsk = best YES ask = 1 − bestNoBid (same as bestYesAsk).
  const legacyBestAsk = bestYesAsk

  return {
    bestBid: bestYesBid ?? 0.50,
    bestAsk: legacyBestAsk ?? 0.50,
    bestYesBid: bestYesBid ?? 0.50,
    bestNoBid: bestNoBid ?? 0.50,
    bestYesAsk: bestYesAsk ?? 0.50,
    bestNoAsk: bestNoAsk ?? 0.50,
    yesProbability,
    hasYesBids,
    hasNoBids,
  }
}

/**
 * Same shape as getBestPricesFromBook but also folds in the user's open
 * prediction intents (de-duped by txId). Use this whenever the UI needs to
 * agree with what GraphOrderbook displays — the order book merges intents on
 * top of the wire book locally, so the Trade Panel must do the same or the
 * two views will show different best prices.
 */
export function getBestPricesFromBookWithIntents(
  book: BookSnapshot | LegacyBook,
  intents: Array<Parameters<typeof toLegacyOrder>[0]> = []
): ReturnType<typeof getBestPricesFromBook> {
  const legacy = toLegacyBook(book)
  const known = new Set<string>([...legacy.bids, ...legacy.asks].map(o => o.txId))
  const extraBids: LegacyOrder[] = []
  const extraAsks: LegacyOrder[] = []
  for (const raw of intents) {
    const i = toLegacyOrder(raw)
    if (known.has(i.txId) || i.qty <= 0) continue
    if (i.priceUsd >= 0) extraBids.push(i)
    else extraAsks.push(i)
  }
  return getBestPricesFromBook({
    bids: [...legacy.bids, ...extraBids],
    asks: [...legacy.asks, ...extraAsks],
  })
}
const uint8ToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0)
  }
  return btoa(binary)
}

// WalletConnect signing APIs may return signatures as base64 strings (when encoding: 'base64')
// or as raw bytes (Uint8Array). We standardize to base64 for the API payload.
const normalizeSignatureBase64 = (sig: unknown): string => {
  if (typeof sig === 'string') return sig
  if (sig instanceof Uint8Array) return Buffer.from(sig).toString('base64')
  // Fallback for other buffer-like objects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Buffer.from(sig as any).toString('base64')
}

const floatToBigIntScaledDecimals = (value: number, nDecimals: number): bigint => {
  const factor = 10 ** nDecimals
  return BigInt(Math.round(value * factor))
}

const bigIntScaledDecimalsToFloat = (value: bigint, nDecimals: number): number => {
  const valueStr = value.toString().padStart(nDecimals + 1, '0')
  const integerPart = valueStr.slice(0, -nDecimals)
  const fractionalPart = valueStr.slice(-nDecimals)
  return parseFloat(`${integerPart}.${fractionalPart}`)
}

const uuidToBigInt = (uuid7_str: string): bigint => {
  const hexStr = uuid7_str.replace(/-/g, '')
  return BigInt(`0x${hexStr}`)
}

const isValidUUIDv7 = (uuid: string): boolean => {
  const uuidv7Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidv7Regex.test(uuid)
}

/**
 * Builds the Hedera-prefixed message that the backend verifies.
 * See: api/server/lib/sign.go - PrefixMessageToSign and keccak64
 * 
 * Backend flow:
 * 1. keccak256(payload) → 32 bytes
 * 2. base64(keccak) → 44-char string (keccak64)
 * 3. prefix: "\x19Hedera Signed Message:\n44" + keccak64
 * 4. verify signature over UTF-8 bytes of prefixed string
 */
const hederaMessageToSignFromPayloadHex = (packedHex: string): { 
  keccakHex: string
  keccakB64: string
  prefixedMessage: string 
} => {
  // CRITICAL: Backend uses Hex2utf8(payloadHex) which hex-decodes into raw bytes and then
  // converts to a Go string; hashing []byte(string) yields the same original bytes.
  // So we MUST hash the decoded hex bytes (not the ASCII hex characters).
  // Wrap in Uint8Array — ethers v6 does an `instanceof Uint8Array` check,
  // and in some environments (jsdom test env) Buffer isn't the same
  // Uint8Array constructor. Prod runs pass a real Uint8Array too.
  const payloadBytes = new Uint8Array(Buffer.from(packedHex, 'hex'))
  const keccakHex = keccak256(payloadBytes) as string // includes 0x prefix
  const keccakBytes = Buffer.from(keccakHex.slice(2), 'hex') // remove 0x, convert to bytes
  const keccakB64 = keccakBytes.toString('base64') // should be 44 chars
  
  // The exact prefix the backend uses
  const prefixedMessage = '\x19Hedera Signed Message:\n44' + keccakB64
  
  console.log('[hederaMessageToSignFromPayloadHex]', {
    packedHexLen: packedHex.length,
    payloadBytesLen: payloadBytes.length,
    keccakHex,
    keccakB64,
    prefixedMessageLen: prefixedMessage.length
  })
  
  return { keccakHex, keccakB64, prefixedMessage }
}

const keyTypeToInt = (keyType: string): number => {
  /* 1 = ed25519, 2 = ecdsa_secp256k1 */
  // see: api.proto
  switch (keyType) {
    case 'ED25519': return 1
    case 'ECDSA_SECP256K1': return 2
    default: throw new Error(`Unsupported key type: ${keyType}`)
  }
}

const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const formatNumberShort = (num: number): string => {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(2) + 'B'
  } else if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + 'M'
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(2) + 'K'
  } else {
    return num.toFixed(2)
  }
}

/**
 * Get the appropriate tick size based on the current price level.
 * - Standard range ($0.05 - $0.95): $0.01 tick
 * - Edge ranges (<$0.05 or >$0.95): $0.001 tick
 */
const getTickSize = (price: number): number => {
  if (price < 0.05 || price > 0.95) {
    return 0.001 // 0.1 cent tick for edge prices
  }
  return 0.01 // 1 cent tick for standard range
}

/**
 * Round a price to the nearest valid tick.
 * Standard range ($0.05 - $0.95) snaps to whole cents; edge ranges (<$0.05
 * or >$0.95) snap to 0.1¢. Uses an epsilon to avoid floating-point issues
 * (e.g. 0.575 * 100 = 57.4999… which would otherwise round down to 57).
 */
const roundToTick = (price: number): number => {
  const tick = getTickSize(price)
  const inv = Math.round(1 / tick)
  const snapped = Math.round(price * inv + 1e-9) / inv
  // Re-check tick at the snapped price in case we crossed the edge boundary
  const finalTick = getTickSize(snapped)
  const finalInv = Math.round(1 / finalTick)
  return Number((Math.round(snapped * finalInv + 1e-9) / finalInv).toFixed(3))
}


/**
 * Get decimal places for display based on tick size
 */
const getPriceDecimals = (price: number): number => {
  return price < 0.05 || price > 0.95 ? 3 : 2
}

export {
  uint8ToBase64,
  normalizeSignatureBase64,
  floatToBigIntScaledDecimals,
  bigIntScaledDecimalsToFloat,
  uuidToBigInt,
  isValidUUIDv7,
  hederaMessageToSignFromPayloadHex,
  keyTypeToInt,
  delay,
  formatNumberShort,
  getTickSize,
  roundToTick,
  getPriceDecimals
}
