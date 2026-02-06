import { AccountId, AccountInfoQuery, Client, EvmAddress } from '@hashgraph/sdk'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { proto } from '@hashgraph/proto'
import { PublicKey } from '@hashgraph/sdk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

type HederaKeyType = 'ECDSA' | 'ED25519'

const uuid7_to_uint128 = (uuid7: string): bigint => {
  const hexStr = uuid7.replace(/-/g, '') // Remove hyphens
  if (hexStr.length !== 32) {
    throw new Error('Invalid UUIDv7 format')
  }
  return BigInt('0x' + hexStr)
}

function uint128_to_uuid7(someBigInt: bigint): string {
  // Ensure the random number is 128 bits
  const hexStr = someBigInt.toString(16).padStart(32, '0')

  // Extract fields
  const timestamp = hexStr.slice(0, 12) // First 48 bits (12 hex chars)
  const version = '7' // UUIDv7 version
  const sequence = hexStr.slice(13, 16) // Next 12 bits (3 hex chars)
  const randomData = hexStr.slice(16) // Remaining 64 bits

  // Construct UUIDv7
  return `${timestamp.slice(0,8)}-${timestamp.slice(8)}-${version}${sequence}-${randomData.slice(0, 4)}-${randomData.slice(4)}`
}

function buildSignatureMap(publicKey: PublicKey, signature: Uint8Array, keyType: HederaKeyType): Uint8Array {
  
  switch (keyType) {
    case 'ECDSA':
      { 
        const sigPair = proto.SignaturePair.create({
          pubKeyPrefix: publicKey.toBytesRaw(),
          ECDSASecp256k1: signature  // ECDSA
        })

        const sigMap = proto.SignatureMap.create({
          sigPair: [sigPair]
        })
        const bytes = proto.SignatureMap.encode(sigMap).finish()
        return bytes
      }
    case 'ED25519': 
      { 
        const sigPair = proto.SignaturePair.create({
          pubKeyPrefix: publicKey.toBytesRaw(),
          ed25519: signature // ed25519
        })

        const sigMap = proto.SignatureMap.create({
          sigPair: [sigPair]
        })
        const bytes = proto.SignatureMap.encode(sigMap).finish()
        return bytes 
      }
    default:
      throw new Error(`Unsupported key type: ${keyType}`)
  }
  
}

const prefixMessageToSign = (messageUtf8: string) => {
  // console.log(messageUtf8.length)
  return '\x19Hedera Signed Message:\n' + messageUtf8.length + messageUtf8
}

const getPubKey = async (client: Client, accountId: string | AccountId, withPreamble: boolean = false) => {
  const info = await new AccountInfoQuery()
    .setAccountId(accountId)
    .execute(client)
  console.log('raw key:', info.key.toString())

  if (withPreamble) {
    return info.key.toString()
  } else {
    return '0x' + info.key.toString().slice(-66) // last 66 characters
  }
}

const getEvmAddress = async (hederaNetwork: string, accountId: string | AccountId) => {
  const result = await fetch(`https://${hederaNetwork}.mirrornode.hedera.com/api/v1/accounts/${accountId}`)
  const data = await result.json()
  return data.evm_address
}

const payloadHex2components = (payloadHex: string): [boolean, bigint, EvmAddress, bigint, bigint] => {
  const buySell = payloadHex.substring(0, 2).toLowerCase() === 'f1' ? true : false
  const collateralUsdAbsScaled = BigInt('0x' + payloadHex.substring(2, 66))
  const evmAddr = EvmAddress.fromString('0x' + payloadHex.substring(66, 106))
  const marketId = BigInt('0x' + payloadHex.substring(106, 138))
  const txId = BigInt('0x' + payloadHex.substring(138, 170))

  return [buySell, collateralUsdAbsScaled, evmAddr, marketId, txId]
}

const assemblePayloadHexForSigning = (priceUsd: number, qty: number, evmAddress: string, marketId: string, txId: string, usdcDecimals: number): string => {
  const packedHex = [
    priceUsd < 0 ? 'f1': 'f0', // 1 => sell, 0 => buy (uint8 = 8 bits = 2 hex chars)
    floatToBigIntScaledDecimals(Math.abs(priceUsd * qty), usdcDecimals).toString(16).padStart(64, '0'),
    evmAddress.replace(/^0x/, '').toLowerCase().padStart(40, '0'), // note: an evm address is exactly 20 bytes = 40 hex chars
    uuidToBigInt(marketId).toString(16).padStart(32, '0'),
    uuidToBigInt(txId).toString(16).padStart(32, '0')
  ].join('')
  return packedHex
}

const floatToBigIntScaledDecimals = (value: number, nDecimals: number): bigint => {
  const [integerPart, fractionalPart = ''] = value.toString().split('.')
  const scaledValue = '' + integerPart + '' + fractionalPart.padEnd(nDecimals, '0').slice(0, nDecimals)
  return BigInt(scaledValue)
}

const uuidToBigInt = (uuid7_str: string): bigint => {
  const hexStr = uuid7_str.replace(/-/g, '')
  return BigInt(`0x${hexStr}`)
}

export {
  uuid7_to_uint128,
  uint128_to_uuid7,
  buildSignatureMap,
  prefixMessageToSign,
  __dirname,
  getPubKey,
  getEvmAddress,
  payloadHex2components,
  assemblePayloadHexForSigning
}
