// Usage: `ts-node test.ts`
import { AccountId, Client, ContractExecuteTransaction, ContractFunctionParameters, ContractId, PrivateKey } from '@hashgraph/sdk'
import { keccak256 } from 'ethers'
import assert from 'assert'
import { buildSignatureMap } from '../lib/utils.ts'
// import { proto } from '@hashgraph/proto'

const contractId = '0.0.7510184' // Test.sol
const operatorId = AccountId.fromString('0.0.7090546')
const evmAddress = '440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6'
const privateKeyHex = '1620f5b23ed7467f6730bcc27b1b2c396f4ae92aec70f420bdd886ae26fed81d'
const privateKey = PrivateKey.fromStringECDSA(privateKeyHex)
const publicKey = privateKey.publicKey
// const publicKeyHex = publicKey.toStringRaw()
const client = Client.forTestnet().setOperator(operatorId, privateKey)

/*
00000000000000000000000000000000000000000000000000000000000f42400189c0a87e807e808000000000000003019af83a8a7974ecaea255682ea385ba
Signer.tsx?t=1765102829579:292 packedKeccakHex: cb09968b7bbfdf738d9eb128ab7cf9aac3cc855287c4578410bbaaf373fb41cc
Signer.tsx?t=1765102829579:294 msgToSign (base64) (len=44): ywmWi3u/33ONnrEoq3z5qsPMhVKHxFeEELuq83P7Qcw=
Signer.tsx?t=1765102829579:295 packedKeccakHex (len=32): cb09968b7bbfdf738d9eb128ab7cf9aac3cc855287c4578410bbaaf373fb41cc
Signer.tsx?t=1765102829579:297 sigHex (len=64): 0e5f87d020adc513906fa60ed55418a255cea31753af835fcc951f4e82eafbb22534d8ad60deb47e177a929f95ffe1f5ff4cec9c75112d54a38552f63128b062
Signer.tsx?t=1765102829579:297 {"txId":"019af83a-8a79-74ec-aea2-55682ea385ba","net":"testnet","marketId":"0189c0a8-7e80-7e80-8000-000000000003","generatedAt":"2025-12-07T09:52:57.465Z","accountId":"0.0.7090546","marketLimit":"limit","priceUsd":0.012,"qty":83.33333333333333,"sig":"Dl+H0CCtxROQb6YO1VQYolXOoxdTr4NfzJUfToLq+7IlNNitYN60fhd6kp+V/+H1/0zsnHURLVSjhVL2MSiwYg=="}
*/
const verify_rawSig_hashpack_utf8 = () => {
  console.log('--- verify_rawSig_hashpack_utf8 ---')
  const payloadHex = '00000000000000000000000000000000000000000000000000000000000f42400189c0a87e807e808000000000000003019af83a8a7974ecaea255682ea385ba'
  const sigHex = '0e5f87d020adc513906fa60ed55418a255cea31753af835fcc951f4e82eafbb22534d8ad60deb47e177a929f95ffe1f5ff4cec9c75112d54a38552f63128b062'

  const keccakHex = keccak256(Buffer.from(payloadHex, 'hex')).slice(2)
  // const keccakUtf8 = Buffer.from(keccak.slice(2), 'hex').toString()
  const keccak = Buffer.from(keccakHex, 'hex')
  const keccakPrefixedStr = prefixMessageToSign(keccak.toString())
  console.log(`keccakPrefixedStr (hex): ${Buffer.from(keccakPrefixedStr, 'utf-8').toString('hex')}`)
  
  const isVerifiedRaw = publicKey.verify(Buffer.from(keccakPrefixedStr, 'utf-8'), Buffer.from(sigHex, 'hex'))
  console.log(`keccakPrefixedBytes (hex): ${Buffer.from(Buffer.from(keccakPrefixedStr, 'utf-8')).toString('hex')}`)
  console.log('---> isVerifiedRaw (should be true):', isVerifiedRaw)
  assert(isVerifiedRaw, 'Raw signature verification (verify_rawSig_hashpack_utf8) failed')
}

/*
00000000000000000000000000000000000000000000000000000000000f42400189c0a87e807e808000000000000003019af83a8a7974ecaea255682ea385ba
Signer.tsx:225 packedKeccakHex: cb09968b7bbfdf738d9eb128ab7cf9aac3cc855287c4578410bbaaf373fb41cc
Signer.tsx:235 msgToSign (base64) (len=44): ywmWi3u/33ONnrEoq3z5qsPMhVKHxFeEELuq83P7Qcw=
Signer.tsx:236 packedKeccakHex (len=32): cb09968b7bbfdf738d9eb128ab7cf9aac3cc855287c4578410bbaaf373fb41cc
Signer.tsx:238 sigHex (len=64): 3e57400eac06b5de22413b5720f014e26b6392f1d0c286a4868086b8629241e42322ad35206229f8032344cf3987c619dd0cd5abd975ee002b1515f098907753
Signer.tsx:36 {"txId":"019af83a-8a79-74ec-aea2-55682ea385ba","net":"testnet","marketId":"0189c0a8-7e80-7e80-8000-000000000003","generatedAt":"2025-12-07T09:52:57.465Z","accountId":"0.0.7090546","marketLimit":"limit","priceUsd":0.012,"qty":83.33333333333333,"sig":"PldADqwGtd4iQTtXIPAU4mtjkvHQwoakhoCGuGKSQeQjIq01IGIp+AMjRM85h8YZ3QzVq9l17gArFRXwmJB3Uw=="}
*/
const verify_rawSig_hashpack_base64 = () => {
  console.log('--- verify_rawSig_hashpack_base64 ---')
  const payloadHex = '00000000000000000000000000000000000000000000000000000000000f42400189c0a87e807e808000000000000003019af83a8a7974ecaea255682ea385ba'
  const sigHex = '3e57400eac06b5de22413b5720f014e26b6392f1d0c286a4868086b8629241e42322ad35206229f8032344cf3987c619dd0cd5abd975ee002b1515f098907753'

  const keccakHex = keccak256(Buffer.from(payloadHex, 'hex')).slice(2)
  const keccak = Buffer.from(keccakHex, 'hex')
  const keccak64 = keccak.toString('base64') // an extra step...
  const keccakPrefixedStr = prefixMessageToSign(keccak64)
  console.log(`keccakPrefixedStr (hex): ${Buffer.from(keccakPrefixedStr, 'utf-8').toString('hex')}`)
  
  const isVerifiedRaw = publicKey.verify(Buffer.from(keccakPrefixedStr, 'utf-8'), Buffer.from(sigHex, 'hex'))
  // console.log(`keccakPrefixedBytes (hex): ${Buffer.from(Buffer.from(keccakPrefixedStr, 'utf-8')).toString('hex')}`)
  console.log('---> isVerifiedRaw (should be true):;', isVerifiedRaw)
  assert(isVerifiedRaw, 'Raw signature verification (verify_rawSig_hashpack_utf8) failed')
}

/*
00000000000000000000000000000000000000000000000000000000000f42400189c0a87e807e808000000000000003019af83a8a7974ecaea255682ea385ba
Signer.tsx?t=1765102829579:292 packedKeccakHex: cb09968b7bbfdf738d9eb128ab7cf9aac3cc855287c4578410bbaaf373fb41cc
Signer.tsx?t=1765102829579:294 msgToSign (base64) (len=44): ywmWi3u/33ONnrEoq3z5qsPMhVKHxFeEELuq83P7Qcw=
Signer.tsx?t=1765102829579:295 packedKeccakHex (len=32): cb09968b7bbfdf738d9eb128ab7cf9aac3cc855287c4578410bbaaf373fb41cc
Signer.tsx?t=1765102829579:297 sigHex (len=64): 0e5f87d020adc513906fa60ed55418a255cea31753af835fcc951f4e82eafbb22534d8ad60deb47e177a929f95ffe1f5ff4cec9c75112d54a38552f63128b062
Signer.tsx?t=1765102829579:297 {"txId":"019af83a-8a79-74ec-aea2-55682ea385ba","net":"testnet","marketId":"0189c0a8-7e80-7e80-8000-000000000003","generatedAt":"2025-12-07T09:52:57.465Z","accountId":"0.0.7090546","marketLimit":"limit","priceUsd":0.012,"qty":83.33333333333333,"sig":"Dl+H0CCtxROQb6YO1VQYolXOoxdTr4NfzJUfToLq+7IlNNitYN60fhd6kp+V/+H1/0zsnHURLVSjhVL2MSiwYg=="}
*/
const verify_onChain_utf8 = async () => {
  console.log('--- verify_onChain_utf8 ---')

  const payloadHex = '00000000000000000000000000000000000000000000000000000000000f42400189c0a87e807e808000000000000003019af83a8a7974ecaea255682ea385ba'
  const sigHex = '0e5f87d020adc513906fa60ed55418a255cea31753af835fcc951f4e82eafbb22534d8ad60deb47e177a929f95ffe1f5ff4cec9c75112d54a38552f63128b062'

  const keccakHex = keccak256(Buffer.from(payloadHex, 'hex')).slice(2)
  const keccak = Buffer.from(keccakHex, 'hex')
  // keccak[0] = keccak[0] ^ 0xff // Slightly perturb the first byte
  const keccakPrefixedStr = prefixMessageToSign(keccak.toString())
  console.log(`keccakPrefixedStr (hex): ${Buffer.from(keccakPrefixedStr, 'utf-8').toString('hex')}`)
  
  const sigObj = buildSignatureMap(publicKey, Buffer.from(sigHex, 'hex'), 'ECDSA')
  console.log(`sigObj (len=${sigObj.length}): ${Buffer.from(sigObj).toString('hex')}`)
  
  const params = new ContractFunctionParameters() // Sig.sol
    // address account
    // bytes memory message
    // bytes memory signature
    .addAddress(evmAddress)
    .addBytes(Buffer.from(keccakPrefixedStr, 'utf-8')) // Buffer.from('INCORRECT'))
    .addBytes(buildSignatureMap(publicKey, sigObj, 'ECDSA'))
  
  const tx = await new ContractExecuteTransaction()
    .setContractId(ContractId.fromString(contractId))
    .setGas(1_000_000)
    .setFunction('isAuthorizedPublic', params)
    .execute(client)
  
  const record = await tx.getRecord(client)
  const result = record.contractFunctionResult
  if (result) {
    const statusCode = result.getInt64(0)
    const isAuthzd = result.getBool(1)
    console.log(`statusCode: ${statusCode}, isAuthzd: ${isAuthzd}`, isAuthzd ? '✅' : '❌')
    // console.log(`result: ${result.getResult(['int64', 'bool'])}`)
  } else {
    console.error('No contract function result found.')
  }
}

/*
00000000000000000000000000000000000000000000000000000000000f42400189c0a87e807e808000000000000003019af83a8a7974ecaea255682ea385ba
Signer.tsx:225 packedKeccakHex: cb09968b7bbfdf738d9eb128ab7cf9aac3cc855287c4578410bbaaf373fb41cc
Signer.tsx:235 msgToSign (base64) (len=44): ywmWi3u/33ONnrEoq3z5qsPMhVKHxFeEELuq83P7Qcw=
Signer.tsx:236 packedKeccakHex (len=32): cb09968b7bbfdf738d9eb128ab7cf9aac3cc855287c4578410bbaaf373fb41cc
Signer.tsx:238 sigHex (len=64): 3e57400eac06b5de22413b5720f014e26b6392f1d0c286a4868086b8629241e42322ad35206229f8032344cf3987c619dd0cd5abd975ee002b1515f098907753
Signer.tsx:36 {"txId":"019af83a-8a79-74ec-aea2-55682ea385ba","net":"testnet","marketId":"0189c0a8-7e80-7e80-8000-000000000003","generatedAt":"2025-12-07T09:52:57.465Z","accountId":"0.0.7090546","marketLimit":"limit","priceUsd":0.012,"qty":83.33333333333333,"sig":"PldADqwGtd4iQTtXIPAU4mtjkvHQwoakhoCGuGKSQeQjIq01IGIp+AMjRM85h8YZ3QzVq9l17gArFRXwmJB3Uw=="}
*/
const verify_onChain_base64 = async (
  payloadHex = '00000000000000000000000000000000000000000000000000000000000f42400189c0a87e807e808000000000000003019af83a8a7974ecaea255682ea385ba',
  sigHex = '3e57400eac06b5de22413b5720f014e26b6392f1d0c286a4868086b8629241e42322ad35206229f8032344cf3987c619dd0cd5abd975ee002b1515f098907753'
) => {
  console.log('--- verify_onChain_base64 ---')

  // const payloadHex = '00000000000000000000000000000000000000000000000000000000000f42400189c0a87e807e808000000000000003019af83a8a7974ecaea255682ea385ba'
  // const sigHex = '3e57400eac06b5de22413b5720f014e26b6392f1d0c286a4868086b8629241e42322ad35206229f8032344cf3987c619dd0cd5abd975ee002b1515f098907753'

  const keccakHex = keccak256(Buffer.from(payloadHex, 'hex')).slice(2)
  const keccak = Buffer.from(keccakHex, 'hex')
  // keccak[0] = keccak[0] ^ 0xff // Slightly perturb the first byte
  console.log(`keccak (hex): ${keccak.toString('hex')}`)
  const keccak64 = keccak.toString('base64') // N.B. an extra base64 step...
  const keccakPrefixedStr = prefixMessageToSign(keccak64)
  console.log(`keccakPrefixedStr (hex): ${Buffer.from(keccakPrefixedStr, 'utf-8').toString('hex')}`)

  const sigObj = buildSignatureMap(publicKey, Buffer.from(sigHex, 'hex'), 'ECDSA')
  console.log(`sigObj (len=${sigObj.length}): ${Buffer.from(sigObj).toString('hex')}`)
  
  const params = new ContractFunctionParameters() // Sig.sol
    // address account
    // bytes memory message
    // bytes memory signature
    .addAddress(evmAddress)
    .addBytes(Buffer.from(keccakPrefixedStr, 'utf-8')) // Buffer.from('INCORRECT'))
    .addBytes(sigObj) // TODO - retrieve key type (ECDSA or ED25519) from userAccountInfo on mirror node
  
  const tx = await new ContractExecuteTransaction()
    .setContractId(ContractId.fromString(contractId))
    .setGas(1_000_000)
    .setFunction('isAuthorizedPublic', params)
    .execute(client)
  
  const record = await tx.getRecord(client)
  const result = record.contractFunctionResult
  if (result) {
    const statusCode = result.getInt64(0)
    const isAuthzd = result.getBool(1)
    console.log(`statusCode: ${statusCode}, isAuthzd: ${isAuthzd}`, isAuthzd ? '✅' : '❌')
    // console.log(`result: ${result.getResult(['int64', 'bool'])}`)
  } else {
    console.error('No contract function result found.')
  }
}

/*
00000000000000000000000000000000000000000000000000000000000f42400189c0a87e807e808000000000000003019af83a8a7974ecaea255682ea385ba
"txId":"019af83a-8a79-74ec-aea2-55682ea385ba"
"marketId":"0189c0a8-7e80-7e80-8000-000000000003"
*/
const verify_onChain_assembly = async () => {
  console.log('--- verify_onChain_assembly ---')

  const collateralUsdAbsScaled = BigInt('0x00000000000000000000000000000000000000000000000000000000000f4240')
  const marketId = BigInt('0x0189c0a87e807e808000000000000003')
  const txId = BigInt('0x019af83a8a7974ecaea255682ea385ba')

  const params = new ContractFunctionParameters() // Sig.sol
    // uint256 collateralUsd
    // uint128 marketId
    // uint128 txId
    .addUint256(collateralUsdAbsScaled.toString())
    .addUint128(marketId.toString())
    .addUint128(txId.toString())
  
  const tx = await new ContractExecuteTransaction()
    .setContractId(ContractId.fromString(contractId))
    .setGas(1_000_000)
    .setFunction('assemblyTest', params)
    .execute(client)
  
  const record = await tx.getRecord(client)
  const result = record.contractFunctionResult
  if (result) {
    console.log(`result: ${result.getResult(['bytes', 'bytes32', 'bytes', 'string', 'bytes'])}`)
    console.log('')
    
    const [assembledHex, keccakHex, prefixedKeccakHex, base64Hex, prefixedKeccak64Hex] = result.getResult(['bytes', 'bytes32', 'bytes', 'string', 'bytes'])
    console.log(`assembled (hex): ${assembledHex}`)
    console.log(`keccak (hex): ${keccakHex}`)
    console.log(`prefixedKeccak: ${prefixedKeccakHex}`)
    console.log(`base64 (hex): ${base64Hex}`)
    console.log(`prefixedKeccak64 (hex): ${prefixedKeccak64Hex}`)

  } else {
    console.error('No contract function result found.')
  }
}


(async () => {
  console.log('************************************************')
  verify_rawSig_hashpack_utf8()
  console.log('************************************************')
  verify_rawSig_hashpack_base64()
  console.log('************************************************')
  await verify_onChain_utf8()
  console.log('************************************************')
  await verify_onChain_base64()
  console.log('************************************************')
  await verify_onChain_assembly()
  console.log('************************************************')


  /*
  Signing OrderIntent...
  Signer.tsx:236 x:  0x9780a56cb3995026668e68fbe6a67e3b2ae989d42652d019cb3234cec499e131
  Signer.tsx:237 0000000000000000000000000000000000000000000000000000000000004e200189c0a87e807e808000000000000003019aff572be977ddb2218f89374938a0
  Signer.tsx:239 packedKeccakHex: 9780a56cb3995026668e68fbe6a67e3b2ae989d42652d019cb3234cec499e131
  Signer.tsx:249 msgToSign (base64) (len=44): l4ClbLOZUCZmjmj75qZ+OyrpidQmUtAZyzI0zsSZ4TE=
  Signer.tsx:250 packedKeccakHex (len=32): 9780a56cb3995026668e68fbe6a67e3b2ae989d42652d019cb3234cec499e131
  Signer.tsx:252 sigHex (len=64): d1f6afd134b6d62d957bc27175c8a218fd75470bbe24e589d812dcf010195491113a9ffa91f93d1e4099ffaad1eb9d830efd4b38193e882c529a2deeaeee837f
  Signer.tsx:37 {"txId":"019aff57-2be9-77dd-b221-8f89374938a0","net":"testnet","marketId":"0189c0a8-7e80-7e80-8000-000000000003","generatedAt":"2025-12-08T19:01:34.313Z","accountId":"0.0.7090546","marketLimit":"limit","priceUsd":-0.5,"qty":0.04,"sig":"0fav0TS21i2Ve8JxdciiGP11Rwu+JOWJ2BLc8BAZVJEROp/6kfk9HkCZ/6rR652DDv1LOBk+iCxSmi3uru6Dfw==","publicKeyHex":"03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787","evmAddress":"440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6","keyType":2}
  */
  await verify_onChain_base64(
    '0000000000000000000000000000000000000000000000000000000000004e200189c0a87e807e808000000000000003019aff572be977ddb2218f89374938a0',
    'd1f6afd134b6d62d957bc27175c8a218fd75470bbe24e589d812dcf010195491113a9ffa91f93d1e4099ffaad1eb9d830efd4b38193e882c529a2deeaeee837f'
  )

  process.exit(0)
})()







function prefixMessageToSign(messageUtf8: string) {
  console.log(messageUtf8.length)
  return '\x19Hedera Signed Message:\n' + messageUtf8.length + messageUtf8
}
