import { ethers, keccak256 } from 'ethers'
import { arrayify } from './utils.ts'

const desiredSig = '67d91b5a2b14cee393cc8295788f38ee1f7510b671fc21bd02d44690d7a0580b5cdf9f10d73e11edf96f7526bf599efbc6e5ce3ab6027fea51ba6c1f31bffac6'

const privateKeyHex = '1620f5b23ed7467f6730bcc27b1b2c396f4ae92aec70f420bdd886ae26fed81d'

const msgStr = 'Hello Hedera'
const msgStrHex = Buffer.from(msgStr, 'utf8').toString('hex')
console.log(`payload (utf8) (len=${Buffer.from(msgStr, 'utf8').length}): ${msgStr}`)
console.log(`payload (hex) (len=${Buffer.from(msgStrHex, 'hex').length}): ${msgStrHex}`)

const msgHash = keccak256(ethers.toUtf8Bytes(msgStr)).slice(2) // 0x... (32 bytes)
console.log(`msgHash (hex) (len=${Buffer.from(msgHash, 'hex').length}): ${msgHash}`)
const msgHash2 = keccak256(ethers.toUtf8Bytes(msgStrHex)).slice(2) // 0x... (32 bytes)
console.log(`msgHash2 (hex) (len=${Buffer.from(msgHash2, 'hex').length}): ${msgHash2}`)

const msgHash3 = '\x19Hedera Signed Message:\n' + '32' + msgHash
console.log(`msgHash3 (utf8) (len=${Buffer.from(msgHash3, 'utf8').length}): ${msgHash3}`)

const msgHash4 = keccak256(ethers.toUtf8Bytes(msgHash)).slice(2)
console.log(`msgHash4 (hex) (len=${Buffer.from(msgHash4, 'hex').length}): ${msgHash4}`)



const wallet = new ethers.Wallet(privateKeyHex)
console.log(`wallet address: ${wallet.address}`)



const sig = await wallet.signingKey.sign(Buffer.from(msgHash, 'hex'))
const sig2 = await wallet.signingKey.sign(Buffer.from(msgHash2, 'hex'))
const sig4 = await wallet.signingKey.sign(Buffer.from(msgHash4, 'hex'))

console.log(`sig: (hex) (len=${Buffer.from(sig.serialized.slice(2), 'hex').length}): ${sig.serialized.slice(2)}`)
console.log(`sig2: (hex) (len=${Buffer.from(sig2.serialized.slice(2), 'hex').length}): ${sig2.serialized.slice(2)}`)
console.log(`sig4: (hex) (len=${Buffer.from(sig4.serialized.slice(2), 'hex').length}): ${sig4.serialized.slice(2)}`)

console.log(`desired: ${desiredSig}`)




const prefixStr = '\x19Hedera Signed Message:\n32'
const prefix = Buffer.from(prefixStr, 'utf8')

const prefixedHash = ethers.keccak256(ethers.concat([prefix, arrayify('0x' + msgHash)])).slice(2)
console.log(`prefixedHash (hex): ${prefixedHash}`)