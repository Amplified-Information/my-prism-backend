import {
  Client,
  PrivateKey,
  ContractId,
  ContractFunctionParameters,
  AccountId,
  ContractExecuteTransaction,
  PublicKey,
  SignerSignature
} from '@hashgraph/sdk'
import { keccak256 } from 'ethers'
import { buildSignatureMap } from '../lib/utils.ts'

// --------------------------------------------------------------------------
// CONFIG
// --------------------------------------------------------------------------
const contractId = '0.0.7510184' // Test.sol

const operatorId = AccountId.fromString('0.0.7090546')
const evmAddress = '440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6'
const privateKeyHex = '1620f5b23ed7467f6730bcc27b1b2c396f4ae92aec70f420bdd886ae26fed81d'
const privateKey = PrivateKey.fromStringECDSA(privateKeyHex)
const publicKey = privateKey.publicKey
// const publicKeyHex = publicKey.toStringRaw()
const client = Client.forTestnet().setOperator(operatorId, privateKey)


// const hexString = '82f2421684ffafb2fba374c79fa3c718fe8cb4a082f5d4aa056c6565fc487e1b'

// // Convert hex string to a Buffer
// const buffer = Buffer.from(hexString, 'hex')

// // Interpret the buffer as a UTF-8 string
// const utf8String = buffer.toString('utf8')

// console.log(utf8String)
// console.log(Buffer.from(utf8String).toString('hex'))
// process.exit(0)



// const payloadUtf8 = 'Hello Future'
const payloadHex = '000000000000000000000000000000000000000000000000000000000001ffb80189c0a87e807e808000000000000002019aef10408b70578850c8975f012489'
// N.B. treat the hex string as a Utf8 string - don't want the hex conversion to remove leading zeros!!!
const payloadUtf8 = payloadHex // Yes, this is intentional     // Buffer.from(payloadHex, 'hex').toString('utf8')
console.log(Buffer.from(payloadUtf8).toString('hex'))
// const payloadBytes = Buffer.from(payloadUtf8)
// const payloadPrefixedUtf8 = prefixMessageToSign(payloadUtf8)
// const payloadPrefixedBytes = Buffer.from(payloadPrefixedUtf8, 'utf8')
const keccakHex = keccak256(Buffer.from(payloadUtf8)).slice(2)
console.log(`keccakHex: ${keccakHex}`)
const keccakUtf8 = Buffer.from(keccakHex, 'hex').toString()
console.log(`keccakUtf8 (hex): ${Buffer.from(keccakUtf8).toString('hex')}`)
console.log(`keccakUtf8: ${keccakUtf8}`)
const keccakPrefixedUtf8 = prefixMessageToSign(keccakUtf8)
console.log(`keccakPrefixedUtf8: ${keccakPrefixedUtf8}`)
const keccakPrefixedBytes = Buffer.from(keccakPrefixedUtf8, 'utf8')

const sigBytes = privateKey.sign(keccakPrefixedBytes)
const sigHex = Buffer.from(sigBytes).toString('hex')
console.log(`sigHex (should match with hashpack!) (len=${sigBytes.length}): ${sigHex}`)

// raw signature verify (protobuf SignatureMap way is further down)
const isVerifiedRaw = publicKey.verify(keccakPrefixedBytes, sigBytes)
console.log(`---> isVerifiedRaw (should be true): ***${isVerifiedRaw}***`)


// --------------------------------------------------------------------------
// CORRESPONDING FRONT_END SIGNATURE VERIFICATION
// --------------------------------------------------------------------------
// <button onClick={async () => {
//   const payloadUtf8 = 'Hello Future'
//   const keccakHex = keccak256(Buffer.from(payloadUtf8)).slice(2)
//   console.log(keccakHex)
//   const signature = (await signerZero!.sign([Buffer.from(keccakHex, 'hex')]))[0].signature
//   console.log(`signature (len=${signature.length}): ${Buffer.from(signature).toString('hex')}`)
// }}>
//   Test3
// </button>

const signerSignature: SignerSignature = {
  signature: sigBytes,
  publicKey: publicKey,
  accountId: operatorId
}
const isValidSig = verifySignerSignature(keccakUtf8, signerSignature, publicKey)
console.log(`---> isValidSig: ***${isValidSig}***`)

// const keccakHex = keccak256(payloadBytes).slice(2)
// console.log(`keccakHex: ${keccakHex}`)
// const keccakBytes = Buffer.from(keccakHex.slice(2), 'hex')
// console.log(keccakBytes)
// const payloadPrefixed = prefixMessageToSign(payload)
// console.log(payloadPrefixed)
// const keccakPrefixed = prefixMessageToSign(Buffer.from(keccakHex, 'hex').toString('utf-8'))
// console.log(keccakPrefixed)
// const keccakPrefixedKeccakHex = keccak256(Buffer.from(keccakPrefixed, 'utf-8')).slice(2)
// console.log(`keccakPrefixedKeccakHex: ${keccakPrefixedKeccakHex}`)
// const keccakPrefixedKeccak = Buffer.from(keccakPrefixedKeccakHex, 'hex')
// console.log(keccakPrefixedKeccak)
// const publicKeyHex = '03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787'

// const sigHex = 'f9e2e7f1f175f2a3802ffa92051c583f9ba2b4e65418d2f33c5c65ec4ada9a1d1f41d76dcd0469b247e067a068c679293631a862d54092283844964bc9aa6957'

// Message to sign:
// d1b7540d985b3225d67861ad5c3b94fd1249711722acee3ba5a3017f0428b1c0


// --------------------------------------------------------------------------
// MESSAGE + SIGNATUREMAP
// --------------------------------------------------------------------------



// console.log(`prefixedMessage: ${keccakPrefixed}`)


// const msgToSignHex = 'd1b7540d985b3225d67861ad5c3b94fd1249711722acee3ba5a3017f0428b1c0'
// const msgToSignBytes = Buffer.from(msgToSignHex, 'hex')
// const msgToSignPrefixed = prefixMessageToSign(msgToSignHex)
// console.log(`msgToSignHex: ${msgToSignHex}`)
// console.log(`msgToSignPrefixed: ${msgToSignPrefixed}`)
// const msgToSign = Buffer.from(msgToSignHex, 'hex')
// const msgToSignKeccakHex = keccak256(msgToSign).slice(2)
// const msgToSignKeccak = Buffer.from(msgToSignKeccakHex, 'hex')
// console.log(`msgToSignKeccakHex: ${msgToSignKeccakHex}`)

// let x = operatorKey.sign(payloadBytes)
// console.log(`signature: ${Buffer.from(x).toString('hex')}`)
// x = operatorKey.sign(payloadBytes)
// console.log(`signature: ${Buffer.from(x).toString('hex')}`)
// x = operatorKey.sign(keccak)
// console.log(`signature: ${Buffer.from(x).toString('hex')}`)
// x = operatorKey.sign(Buffer.from(payloadPrefixed, 'utf-8'))
// console.log(`signature: ${Buffer.from(x).toString('hex')}`)
// x = operatorKey.sign(Buffer.from(keccakPrefixedKeccakHex, 'hex'))
// console.log(`signature: ${Buffer.from(x).toString('hex')}`)


const signatureMapBytes = buildSignatureMap(publicKey, sigBytes, 'ECDSA') // TODO - retrieve key type (ECDSA or ED25519) from userAccountInfo on mirror node
// const signatureMapBytes = buildSignatureMap(privateKey, payloadBytes)


// --------------------------------------------------------------------------
// QUERY
// --------------------------------------------------------------------------
console.log(`- account (hex): ${evmAddress}`)
console.log(`- message/messageHash (hex) (len=${keccakPrefixedBytes.length}): ${Buffer.from(keccakPrefixedBytes).toString('hex')}`)
console.log(`- signature/signatureMap (hex) (len=${signatureMapBytes.length}): ${Buffer.from(signatureMapBytes).toString('hex')}`)
const params = new ContractFunctionParameters()
  .addAddress(evmAddress)
  .addBytes(keccakPrefixedBytes) // Buffer.from('INCORRECT'))
  .addBytes(signatureMapBytes)
  // .addBytes(Buffer.from(sig, 'hex'))

const tx = await new ContractExecuteTransaction()
  .setContractId(ContractId.fromString(contractId))
  .setGas(100_000)
  .setFunction('isAuthorizedPublic', params)
  // .setFunction('isAuthorizedRawPublic', params)
  .execute(client)

// const receipt = await tx.getReceipt(client)
const record = await tx.getRecord(client)
const result = record.contractFunctionResult
if (result) {
  const responseCode = result.getInt64(0)
  const isAuthorized = result.getBool(1)

  console.log(`contractId: ${contractId}, accountId: ${operatorId.toString()}`)
  console.log(`responseCode=${responseCode}, isAuthorized=`, isAuthorized)
} else {
  console.error('No contract function result found.')
}

process.exit(0)


// console.log('approve status:', receipt.status.toString())

// const params = new ContractFunctionParameters()
//   .addAddress(evmAddress)
//   .addBytes(messageBytes)
//   .addBytes(signatureMapBytes)

// const query = new ContractCallQuery()
//   .setContractId(ContractId.fromString(contractId))
//   .setGas(8_000_000)
//   .setFunction('verifyWithSignatureMap', params)

// // Cost estimation
// const cost = await query.getCost(client)
// console.log('Query cost:', cost.toString())

// // Execute
// const result = await query.setQueryPayment(cost).execute(client)

// --------------------------------------------------------------------------
// READ RESULT
// --------------------------------------------------------------------------

// console.log(record)





// // Build SignatureMap protobuf
// function buildSignatureMap(publicKey: PublicKey, signature: Uint8Array) {
//   // const signature = privateKey.sign(message)
//   // console.log(`signature: ${Buffer.from(signature).toString('hex')}`)

//   const sigPair = proto.SignaturePair.create({
//     pubKeyPrefix: publicKey.toBytesRaw(),            // prefix = full key
//     ECDSASecp256k1: signature                        // OR ed25519 depending on key type
//   })

//   const sigMap = proto.SignatureMap.create({
//     sigPair: [sigPair]
//   })

//   const bytes = proto.SignatureMap.encode(sigMap).finish()
//   return bytes
// }

// // Build SignatureMap protobuf - build using a private key
// function buildSignatureMapOrig(privateKey: PrivateKey, message: Uint8Array) {
//   const signature = privateKey.sign(message)
//   // console.log(`signature: ${Buffer.from(signature).toString('hex')}`)

//   // console.log(`publickey: ${privateKey.publicKey.toStringRaw()}`)
//   const sigPair = proto.SignaturePair.create({
//     pubKeyPrefix: privateKey.publicKey.toBytesRaw(), // prefix = full key
//     ECDSASecp256k1: signature                        // OR ed25519 depending on key type
//   })

//   const sigMap = proto.SignatureMap.create({
//     sigPair: [sigPair]
//   })

//   const bytes = proto.SignatureMap.encode(sigMap).finish()
//   return bytes
// }


function prefixMessageToSign(messageUtf8: string) {
  console.log('---- prefixMessageToSign -----')
  console.log(`hex representation of messageUtf8: ${Buffer.from(messageUtf8).toString('hex')}`)
  console.log(messageUtf8.length)
  console.log(messageUtf8)
  // const binaryRepresentation = messageUtf8
  //   .split('')
  //   .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
  //   .join(' ')
  // console.log(`Binary representation of messageUtf8: ${binaryRepresentation}`)
  
  console.log('---- END prefixMessageToSign -----')
  // return '\x19Hedera Signed Message:\n' + messageUtf8.length + messageUtf8
  return '\x19Hedera Signed Message:\n' + messageUtf8.length + messageUtf8
}

function verifySignerSignature(messageUtf8: string, signerSignature: SignerSignature, publicKey: PublicKey): boolean {
  const signature = signerSignature.signature

  if (!signature) throw new Error('Signature not found in signature map')

  return publicKey.verify(Buffer.from(prefixMessageToSign(messageUtf8)), signature)
}