import { Signature, verifyMessage } from 'ethers'
import { sig2rsv } from '../lib/utils.ts'
import { PublicKey } from '@hashgraph/sdk'
import { proto } from '@hashgraph/proto'
// import { sig2rsv } from '../lib/utils.ts'
import { keccak256 } from 'ethers'

type Numeric = number | bigint
type BigNumberish = string | Numeric
type SignatureLike = Signature | string | {
    r: string;
    s: string;
    v: BigNumberish;
    yParity?: 0 | 1;
    yParityAndS?: string;
} | {
    r: string;
    yParityAndS: string;
    yParity?: 0 | 1;
    s?: string;
    v?: number;
} | {
    r: string;
    s: string;
    yParity: 0 | 1;
    v?: BigNumberish;
    yParityAndS?: string;
};

const verify2 = (payload: string, publicKeyHex: string, sigHashpackHex: string): boolean => {
  console.log(`payload: ${payload}`)
  const publicKey = PublicKey.fromString(publicKeyHex)
  const sig = Uint8Array.from(Buffer.from(sigHashpackHex, 'hex'))

  const signatureMap = proto.SignatureMap.create({
    sigPair: [
      {
        pubKeyPrefix: publicKey.toBytes(),
        // ed25519: signature
        ECDSASecp256k1: sig
      }
    ]
  })
  // const sigMapBase64 = Buffer.from(proto.SignatureMap.encode(signatureMap).finish()).toString('base64')
    
  // const encoded = Buffer.from(base64SignatureMap, 'base64')
  // const encoded = proto.SignatureMap.encode(signatureMap).finish()
  // const signatureMap: proto.SignatureMap = proto.SignatureMap.decode(encoded)
  const signature = signatureMap.sigPair[0].ed25519 || signatureMap.sigPair[0].ECDSASecp256k1

  if (!signature) throw new Error('Signature not found in signature map')

  console.log(`***\n\n${prefixMessageToSign(payload)}\n\n***\n`)

  return publicKey.verify(Buffer.from(prefixMessageToSign(payload)), signature)
}

const prefixMessageToSign = (message: string) => {
  return '\x19Hedera Signed Message:\n' + message.length + message
}

// const verify = (payload: string, publicKeyHex: string, sigHashpackHex: string) => {

//   // const publicKey = PublicKey.fromString(publicKeyHex)
//   // const result = publicKey.verify(Buffer.from(payload), Uint8Array.from(Buffer.from(sigHashpackHex, 'hex')))
//   // console.log(result)
  
//   const [r, s, v] = sig2rsv(sigHashpackHex)
//   const signatureLike: SignatureLike = {
//     r: BigInt('0x' + Buffer.from(r).toString('hex')).toString(),
//     s: BigInt('0x' + Buffer.from(s).toString('hex')).toString(),
//     v: v
//   }
//   const calculatedAdd = verifyMessage(payload, signatureLike)
//   publicKeyHex = publicKeyHex.toLowerCase()
//   console.log(calculatedAdd)
//   if (calculatedAdd.toLowerCase() === publicKeyHex) {
//     return true
//   }
//   return false
// }

const payload = 'Hello Future'
const publicKeyHex = '03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787'
const sigHashpackHex = 'cba4e1fe36ca8d1249298b877c55032025e3c3b6417e8850e8234b2d2e263e3d49fa61159c9d1dd544cc769ad68afdf08a11d23694a651b97c1bf3d097b66eb8'

const keccakHex = keccak256(Buffer.from(payload, 'utf8')).slice(2)
const keccak = Buffer.from(keccakHex, 'hex').toString('utf8')

const result = verify2(keccak, publicKeyHex.toLowerCase(), sigHashpackHex.toLowerCase())

console.log(`result: ${result}`)

// import { PublicKey, SignerSignature } from '@hashgraph/sdk'
// // import { proto } from '@hashgraph/proto'
// import {EngineTypes} from '@walletconnect/types' 
// import { JsonRpcResult } from '@walletconnect/jsonrpc-types'

// const testPrivateKeyECDSA = 'CmUKIQJ4J53yGuPNMGEGJ7HkI+u3QFxUuAOa9VLEtFj7Y6qNMzJAp3vxT7kRPE9HFFm/bbArGYDQ+psNWZC70rdW2bE1L85u79GOlQSTlaog5lmE6TiaX6r8Bk70dU7ZIwcHgnAkCw=='


// const msg = 'Hello Future'
// const id = 1
// const topic = 'test-topic'
// const keccak = ''

// type SignMessageResult = JsonRpcResult<{ signatureMap: string }>
// interface SignMessageResponse extends EngineTypes.RespondParams {
//   response: SignMessageResult
// }

// const prefixMessageToSign= (message: string) => {
//   return '\x19Hedera Signed Message:\n' + message.length + message
// }

// const base64StringToSignatureMap = (base64string: string): proto.SignatureMap => {
//   const encoded = Buffer.from(base64string, 'base64')
//   return proto.SignatureMap.decode(encoded)
// }

// const stringToSignerMessage = (message: string): Uint8Array[] => {
//   return [Buffer.from(prefixMessageToSign(message))]
// }

// const signerSignaturesToSignatureMap = (signerSignatures: SignerSignature[]): proto.SignatureMap => {
//   const signatureMap = proto.SignatureMap.create({
//     sigPair: signerSignatures.map((s) => s.publicKey._toProtobufSignature(s.signature)),
//   })

//   return signatureMap
// }

// const signatureMapToBase64String = (signatureMap: proto.SignatureMap): string => {
//   const encoded = proto.SignatureMap.encode(signatureMap).finish()
//   return Uint8ArrayToBase64String(encoded)
// }

// const Uint8ArrayToBase64String = (binary: Uint8Array): string => {
//   return Buffer.from(binary).toString('base64')
// }

// const hedera_signMessage = async ( id: number, topic: string, body: string, signer: HederaWallet): Promise<void> => {
//     // signer takes an array of Uint8Arrays though spec allows for 1 message to be signed
//     const signerSignatures = await signer.sign(stringToSignerMessage(body))

//     const _signatureMap = proto.SignatureMap.create(
//       signerSignaturesToSignatureMap(signerSignatures),
//     )

//     const signatureMap = signatureMapToBase64String(_signatureMap)

//     const response: SignMessageResponse = {
//       topic,
//       response: {
//         jsonrpc: '2.0',
//         id,
//         result: {
//           signatureMap
//         }
//       }
//     }
//     return await this.respondSessionRequest(response)
//   }

// /**
//  * This implementation expects a plain text string, which is prefixed and then signed by a wallet.
//  * Because the spec calls for 1 message to be signed and 1 signer, this function expects a single
//  * signature and used the first item in the sigPair array.
//  *
//  * @param message -  A plain text string
//  * @param base64SignatureMap -  A base64 encoded proto.SignatureMap object
//  * @param publicKey -  A PublicKey object use to verify the signature
//  * @returns boolean - whether or not the first signature in the sigPair is valid for the message and public key
//  */
// export function verifyMessageSignature(
//   message: string,
//   base64SignatureMap: string,
//   publicKey: PublicKey
// ): boolean {
//   const signatureMap = base64StringToSignatureMap(base64SignatureMap)
//   const signature = signatureMap.sigPair[0].ed25519 || signatureMap.sigPair[0].ECDSASecp256k1

//   if (!signature) throw new Error('Signature not found in signature map')

//   return publicKey.verify(Buffer.from(prefixMessageToSign(message)), signature)
// }