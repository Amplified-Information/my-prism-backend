import { PrivateKey } from '@hashgraph/sdk'
import { randomBytes } from 'crypto'
import { keccak256 } from 'ethers'

const USDC_DECIMALS = 6

function normalizeKeyType(keyTypeRaw: string): { parser: 'ecdsa' | 'ed25519'; proto: number } {
  const normalized = keyTypeRaw.trim().toLowerCase()
  if (normalized === 'ecdsa' || normalized === 'ecdsa_secp256k1' || normalized === '2') {
    return { parser: 'ecdsa', proto: 2 }
  }
  if (normalized === 'ed' || normalized === 'ed25519' || normalized === '1') {
    return { parser: 'ed25519', proto: 1 }
  }
  throw new Error(`unsupported key type: ${keyTypeRaw}`)
}

function floatToScaledBigInt(value: number, decimals: number): bigint {
  // Match backend scaling behavior (Go fmt.Sprintf("%f")): fixed-point rounding
  // to `decimals` before converting to integer units.
  const normalized = value.toFixed(decimals)
  const [integerPart, fractionalPart = ''] = normalized.split('.')
  return BigInt(`${integerPart}${fractionalPart.padEnd(decimals, '0').slice(0, decimals)}`)
}

function uuidToBigInt(uuid: string): bigint {
  return BigInt(`0x${uuid.replace(/-/g, '')}`)
}

function generateUuidV7(): string {
  const bytes = Buffer.alloc(16)
  const timestamp = BigInt(Date.now())
  const random = randomBytes(10)

  for (let i = 5; i >= 0; i -= 1) {
    bytes[i] = Number((timestamp >> BigInt((5 - i) * 8)) & 0xffn)
  }

  bytes[6] = 0x70 | (random[0] & 0x0f)
  bytes[7] = random[1]
  bytes[8] = 0x80 | (random[2] & 0x3f)
  random.copy(bytes, 9, 3, 10)

  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function prefixMessageToSign(messageBase64: string): string {
  return `\x19Hedera Signed Message:\n44${messageBase64}`
}

function assemblePayloadHexForSigning(priceUsd: number, qty: number, evmAddress: string, marketId: string, txId: string, primarySecondary: string): string {
  const buySell = priceUsd < 0 ? 'f1' : 'f0'
  const collateral = floatToScaledBigInt(Math.abs(priceUsd * qty), USDC_DECIMALS).toString(16).padStart(64, '0')
  const evm = evmAddress.replace(/^0x/, '').toLowerCase().padStart(40, '0')
  const market = uuidToBigInt(marketId).toString(16).padStart(32, '0')
  const tx = uuidToBigInt(txId).toString(16).padStart(32, '0')
  const suffix = primarySecondary === 's' ? 'f1' : 'f0'
  return `${buySell}${collateral}${evm}${market}${tx}${suffix}`
}

async function getEvmAddress(net: string, accountId: string): Promise<string> {
  const response = await fetch(`https://${net}.mirrornode.hedera.com/api/v1/accounts/${accountId}`)
  if (!response.ok) {
    throw new Error(`mirror node lookup failed for ${accountId}: ${response.status}`)
  }
  const data = await response.json() as { evm_address?: string }
  if (!data.evm_address) {
    throw new Error(`mirror node returned no evm_address for ${accountId}`)
  }
  return data.evm_address.replace(/^0x/, '').toLowerCase()
}

async function main(): Promise<void> {
  const [privateKeyRaw, keyTypeRaw, accountId, marketId, net, priceUsdRaw, qtyRaw, primarySecondary] = process.argv.slice(2)
  if (!privateKeyRaw || !keyTypeRaw || !accountId || !marketId || !net || !priceUsdRaw || !qtyRaw || !primarySecondary) {
    console.error('Usage: ts-node e2e_create_prediction_intent.ts <privateKey> <keyType> <accountId> <marketId> <net> <priceUsd> <qty> <primarySecondary>')
    process.exit(1)
  }

  const { parser, proto } = normalizeKeyType(keyTypeRaw)
  const privateKey = parser === 'ecdsa'
    ? PrivateKey.fromStringECDSA(privateKeyRaw)
    : PrivateKey.fromStringED25519(privateKeyRaw)

  const priceUsd = Number(priceUsdRaw)
  const qty = Number(qtyRaw)
  const txId = generateUuidV7()
  const generatedAt = new Date().toISOString()
  const evmAddress = await getEvmAddress(net, accountId)
  const payloadHex = assemblePayloadHexForSigning(priceUsd, qty, evmAddress, marketId, txId, primarySecondary)
  const keccakHex = keccak256(Buffer.from(payloadHex, 'hex')).slice(2)
  const keccakBase64 = Buffer.from(keccakHex, 'hex').toString('base64')
  const prefixedMessage = prefixMessageToSign(keccakBase64)
  const signature = privateKey.sign(Buffer.from(prefixedMessage))
  const publicKey = Buffer.from(privateKey.publicKey.toBytesRaw()).toString('hex')

  const request = {
    txId,
    net,
    marketId,
    generatedAt,
    accountId,
    priceUsd,
    qty,
    sig: Buffer.from(signature).toString('base64'),
    publicKey,
    evmAddress,
    keyType: proto,
    primarySecondary
  }

  process.stdout.write(JSON.stringify(request))
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
})