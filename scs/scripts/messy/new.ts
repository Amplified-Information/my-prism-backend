import { PrivateKey, PublicKey } from '@hashgraph/sdk'
import { proto } from '@hashgraph/proto'


/*
Works for the following front-end:

<button className='btn' onClick={async () => {
  /////
  const msgStr = 'Hello Hedera'
  /////
  // const msgHashHex = ethers.keccak256(Buffer.from(msgStr, 'utf8')).slice(2)
  // const msgHash = Uint8Array.from(Buffer.from(msgHashHex, 'hex'))
  // const msgHash = ethers.keccak256(Buffer.from(msgStr, 'utf8')).slice(2) 
  // console.log(`msgHash (hex) (len=${msgHashHex.length}): ${msgHashHex}`)
  
  const sig = (await signerZero!.sign([Buffer.from(msgStr, 'utf8')]))[0].signature
  console.log(`Signature (hex) (len=${sig.length}): ${Buffer.from(sig).toString('hex')}`)
}}>
  Test2
</button>
*/

const verifyMessageSignature = (
  message: string,
  base64SignatureMap: string,
  publicKey: PublicKey
): boolean => {
  const encoded = Buffer.from(base64SignatureMap, 'base64')
  const signatureMap: proto.SignatureMap = proto.SignatureMap.decode(encoded)
  const signature = signatureMap.sigPair[0].ed25519 || signatureMap.sigPair[0].ECDSASecp256k1

  if (!signature) throw new Error('Signature not found in signature map')

  return publicKey.verify(Buffer.from(prefixMessageToSign(message)), signature)
}

const prefixMessageToSign = (message: string) => {
  return '\x19Hedera Signed Message:\n' + message.length + message
}


const privateKeyHex = '1620f5b23ed7467f6730bcc27b1b2c396f4ae92aec70f420bdd886ae26fed81d'
const publicKeyHex = '03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787'
const privateKey = PrivateKey.fromStringECDSA(privateKeyHex)
const publicKey = PublicKey.fromString(publicKeyHex)

/////
const message = 'Hello Hedera'
/////

const prefixedMessage = Buffer.from(prefixMessageToSign(message))
const signature = privateKey.sign(prefixedMessage)
// Perturb the signature by flipping the first bit
// signature[0] ^= 0x01
const signatureMap = proto.SignatureMap.create({
  sigPair: [
    {
      pubKeyPrefix: publicKey.toBytes(),
      ECDSASecp256k1: signature
    }
  ]
})
const sigMapBase64 = Buffer.from(proto.SignatureMap.encode(signatureMap).finish()).toString('base64')
console.log(`signature (hex) (len=${signature.length}): ${Buffer.from(signature).toString('hex')}`)

const isValid = verifyMessageSignature(message, sigMapBase64, publicKey)
console.log(`isValid: ${isValid}`)
