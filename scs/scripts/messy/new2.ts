import { proto } from '@hashgraph/proto'
import { PublicKey } from '@hashgraph/sdk'
import { ethers, verifyMessage } from 'ethers'
import { sig2rsv } from '../lib/utils.ts'

///// const serializedPayload = '{"marketId_uuid":"019a7e77-39e2-72a3-9bea-a63bdfa79d20","priceUsd_abs_scaled":"500000","txId_uuid":"019aab9a-e734-700a-87de-b383095ac8c6"}'
const serializedPayload = 'Hello Future'
// const serializedPayload = '{"marketId_uuid":"019a7e77-39e2-72a3-9bea-a63bdfa79d20","priceUsd_abs":0.5,"txId_uuid":"019aab9a-e734-700a-87de-b383095ac8c6"}'
// const serializedPayload = '{"collateralUsd_abs_scaled":"11000","marketId_uuid":"019a7e77-39e2-72a3-9bea-a63bdfa79d20","txId_uuid":"019ac07d-f1c9-7104-8eca-855874d95ee6"}'
const keccakHex = ethers.keccak256(Buffer.from(serializedPayload, 'utf8')).slice(2)
console.log(`keccakHex (len=${Buffer.from(keccakHex, 'hex').length}): ${keccakHex}`)

const publicKeyHex = '03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787'
const publicKey = PublicKey.fromString(publicKeyHex)
console.log(`publicKey (hex) (len=${Buffer.from(publicKeyHex, 'hex').length}): ${publicKey.toString()}`)

// const signatureHex = '86e8c350707f1920f50a21addee53ece4a259e3493bb2f21b7a5e372464191ae0c2096d2383400255fb5676b8ac9e74e69f50135e8ba07fdcfcb2cd244dc3ca0'
///// const signatureHex = '1d0139adf96f824bf23f463733dd43ba9d196183e1d735e61e6f5060b42baddb0623fa95eb6e99b94fb1450cbbd51787e919377fef347763380d3cac5bf0bf2e'
const signatureHex = 'cba4e1fe36ca8d1249298b877c55032025e3c3b6417e8850e8234b2d2e263e3d49fa61159c9d1dd544cc769ad68afdf08a11d23694a651b97c1bf3d097b66eb8'
// const signatureHex = '09ee43060c3c99001f08d2c56b7886ca36aab352306611ba8db2a1a13837a67775433abbe5829ecebb927a45cda340bb1cbe9ade78b183e0deaf7fbf1be68325'
const signature = Uint8Array.from(Buffer.from(signatureHex, 'hex'))

console.log(`signature (hex) (len=${signature.length}): ${Buffer.from(signature).toString('hex')}`)

/**
 * @param publicKey 
 * @param keccakHex 
 * @param signature 
 * See: https://github.com/hashgraph/hedera-wallet-connect/blob/4bcf4849176225a861a2f9ab501b1ac2f525db95/src/lib/dapp/DAppSigner.ts#L169
 */
const verify = (publicKey: PublicKey, keccakHex: string, signature: Uint8Array) => {
  // const prefixedMessage = Buffer.from(prefixMessageToSign(keccakHex))
  // const signature = privateKey.sign(prefixedMessage)
  // Perturb the signature by flipping the first bit
  // signature[0] ^= 0x01
  const signatureMap = proto.SignatureMap.create({
    sigPair: [
      {
        pubKeyPrefix: publicKey.toBytes(),
        // ed25519: signature
        ECDSASecp256k1: signature
      }
    ]
  })
  const sigMapBase64 = Buffer.from(proto.SignatureMap.encode(signatureMap).finish()).toString('base64')

  // const [r, s, v] = sig2rsv(Buffer.from(signature).toString('hex'))
  // console.log(Buffer.from(signature).toString('hex'))
  // console.log(`${Buffer.from(r).toString('hex')} ${Buffer.from(s).toString('hex')} ${v}`)
  // console.log(verifyMessage('0x' + keccakHex, { r: '0x' + Buffer.from(r).toString('hex'), s: '0x' + Buffer.from(s).toString('hex'), v: v }))
  
  const isValid = verifyMessageSignature(keccakHex, sigMapBase64, publicKey)
  console.log(`isValid: ${isValid}`)
  
}

const verifyMessageSignature = (message: string, base64SignatureMap: string, publicKey: PublicKey): boolean => {
  const encoded = Buffer.from(base64SignatureMap, 'base64')
  const signatureMap: proto.SignatureMap = proto.SignatureMap.decode(encoded)
  const signature = signatureMap.sigPair[0].ed25519 || signatureMap.sigPair[0].ECDSASecp256k1

  if (!signature) throw new Error('Signature not found in signature map')

  console.log(`***\n\n${prefixMessageToSign(message)}\n\n***\n`)

  return publicKey.verify(Buffer.from(prefixMessageToSign(message)), signature)
}

const prefixMessageToSign = (message: string) => {
  return '\x19Hedera Signed Message:\n' + message.length + message
}


verify(publicKey, keccakHex, signature)

const invalidKeccakHex = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
verify(publicKey, invalidKeccakHex, signature)

const invalidSignature = Uint8Array.from(signature.map((byte, i) => i === signature.length - 1 ? byte ^ 0x01 : byte))
verify(publicKey, keccakHex, invalidSignature)
