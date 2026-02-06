import { keccak256, hexlify } from 'ethers'
import elliptic from 'elliptic'

const EC = new elliptic.ec('secp256k1')

// --------------------
// 1. Keys
// --------------------

// Your private key
const privHex = '1620f5b23ed7467f6730bcc27b1b2c396f4ae92aec70f420bdd886ae26fed81d'

// Your compressed public key (33 bytes)
const compressedPubHex = '03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787'

// --------------------
// 2. Construct keypair
// --------------------
const key = EC.keyFromPrivate(privHex, 'hex')

// Decompress compressed pubkey → uncompressed (X,Y)
const pubPoint = EC.keyFromPublic(compressedPubHex, 'hex').getPublic()
const x = pubPoint.getX().toArray('be', 32)
const y = pubPoint.getY().toArray('be', 32)

// X||Y (64 byte uncompressed form)
const XY = new Uint8Array([...x, ...y])

console.log('===== PUBLIC KEY =====')
console.log('Compressed (33 bytes):', compressedPubHex)
console.log('X:', Buffer.from(x).toString('hex'))
console.log('Y:', Buffer.from(y).toString('hex'))
console.log('X||Y (64 bytes):', Buffer.from(XY).toString('hex'))

// --------------------
// 3. Sign a message
// --------------------
const message = Buffer.from('Hello Hedera', 'utf8')
const messageHash = arrayify(keccak256(message))

console.log('\n===== MESSAGE =====')
console.log('Message:       \'Hello Hedera\'')
console.log('Message hash:', hexlify(messageHash))

// Sign raw hash (ECDSA) → r, s, recovery param
const signature = key.sign(messageHash, { canonical: true })

const r = signature.r.toArray('be', 32)
const s = signature.s.toArray('be', 32)
const recid = signature.recoveryParam // 0 or 1
const v = 27 + recid! // convert to 27/28 as Solidity expects

console.log('\n===== SIGNATURE =====')
console.log('r:', Buffer.from(r).toString('hex'))
console.log('s:', Buffer.from(s).toString('hex'))
console.log('v:', v)
console.log('r||s||v:', Buffer.from([...r, ...s, v]).toString('hex'))

// Helper function to convert hex string to Uint8Array
function arrayify(data: string): Uint8Array {
  if (typeof data !== 'string' || !data.startsWith('0x')) {
    throw new Error('Invalid hex string')
  }
  const hex = data.slice(2)
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}