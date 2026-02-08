import { PredictionIntentRequest } from '../gen/api'
import { BookSnapshot } from '../gen/clob'

const uint8ToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0)
  }
  return btoa(binary)
}

// const uint8ToHex = (bytes: Uint8Array): string => {
//   return Array.from(bytes)
//     .map((byte) => byte.toString(16).padStart(2, '0'))
//     .join('');
// }

// const genUUIDv7 = (): string => {
//   return uuidv7()
// }

const getMidPrice = (book: BookSnapshot): number | undefined => {
  if (book.bids.length === 0 || book.asks.length === 0) return undefined
  // console.log(book.asks[0].priceUsd, ' ', book.bids[0].priceUsd)
  const askPrice = book.asks[0]?.priceUsd
  const bidPrice = book.bids[0]?.priceUsd
  if (askPrice === undefined || bidPrice === undefined) return undefined
  return 0 - ((askPrice - bidPrice) / 2)
}

const getSpreadPercent = (book: BookSnapshot): number | undefined => {
  if (book.bids.length === 0 || book.asks.length === 0) return undefined
  // console.log(book.asks[0].priceUsd, ' ', book.bids[0].priceUsd)
  const askPrice = book.asks[0]?.priceUsd
  const bidPrice = book.bids[0]?.priceUsd
  if (askPrice === undefined || bidPrice === undefined) return undefined
  return ((0 - askPrice - bidPrice) / bidPrice) * 100
}

const floatToBigIntScaledDecimals = (value: number, nDecimals: number): bigint => {
  // const [integerPart, fractionalPart = ''] = value.toString().split('.')
  // const scaledValue = '' + integerPart + '' + fractionalPart.padEnd(nDecimals, '0').slice(0, nDecimals)
  // return BigInt(scaledValue)

  const factor = 10 ** nDecimals
  // N.B. Math.round preserves rounding:
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
 * Assembles a payload hex string for signing from the PredictionIntentRequest object
 * See: prism/README.md for format definition details
 * Also see: ./api/server/lib/sign.go
 * @param predictionIntentRequest PredictionIntentRequest object from front-end
 * @param usdcDecimals number of decimals for USDC
 * @returns a long string conforming to the format
 */
const assemblePayloadHexForSigning = (predictionIntentRequest: PredictionIntentRequest, usdcDecimals: number): string => {
  const collateralUsdAbsScaled = floatToBigIntScaledDecimals(Math.abs(predictionIntentRequest.priceUsd * predictionIntentRequest.qty), usdcDecimals).toString(16).padStart(64, '0')
  console.log('collateralUsdAbsScaled: ', collateralUsdAbsScaled)

  const packedHex = [
    predictionIntentRequest.priceUsd < 0 ? 'f1': 'f0', // 1 => sell, 0 => buy (uint8 = 8 bits = 2 hex chars)
    collateralUsdAbsScaled,
    predictionIntentRequest.evmAddress.replace(/^0x/, '').toLowerCase().padStart(40, '0'), // note: an evm address is exactly 20 bytes = 40 hex chars
    uuidToBigInt(predictionIntentRequest.marketId).toString(16).padStart(32, '0'),
    uuidToBigInt(predictionIntentRequest.txId).toString(16).padStart(32, '0')
  ].join('')
  return packedHex
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

export {
  uint8ToBase64,
  // uint8ToHex,
  getMidPrice,
  getSpreadPercent,
  floatToBigIntScaledDecimals,
  bigIntScaledDecimalsToFloat,
  uuidToBigInt,
  isValidUUIDv7,
  assemblePayloadHexForSigning,
  keyTypeToInt,
  delay,
  formatNumberShort
}
