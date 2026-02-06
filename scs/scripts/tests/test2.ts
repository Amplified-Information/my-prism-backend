// Usage: `ts-node test2.ts`
import { AccountId, Client, ContractExecuteTransaction, ContractFunctionParameters, ContractId, PrivateKey, PublicKey } from '@hashgraph/sdk'
import assert from 'assert'
import { keccak256 } from 'ethers'
import { buildSignatureMap, prefixMessageToSign } from '../lib/utils.ts' 
import { payloadHex2components } from '../lib/utils.ts'

const contractId = '0.0.7510184' // Test.sol
const operatorId = AccountId.fromString('0.0.7090546')
const evmAddress = '440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6'
const privateKeyHex = '1620f5b23ed7467f6730bcc27b1b2c396f4ae92aec70f420bdd886ae26fed81d'
const privateKey = PrivateKey.fromStringECDSA(privateKeyHex)
const publicKey = privateKey.publicKey
// const publicKeyHex = publicKey.toStringRaw()
const client = Client.forTestnet().setOperator(operatorId, privateKey)

// Signing OrderIntent...
// Signer.tsx:229 packedHex: f0000000000000000000000000000000000000000000000000000000000007a120440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b4b015932719d967783057decdc30
// Signer.tsx:231 packedKeccakHex (len=32): 46b154bad060a79a5d7df1e25aeb9d6804f390301c60f4dd2b33e7f822bc92cc
// Signer.tsx:232 verify at: https://emn178.github.io/online-tools/keccak_256.html
// Signer.tsx:251 msgToSign (base64) (len=44): RrFUutBgp5pdffHiWuudaATzkDAcYPTdKzPn+CK8ksw=
// Signer.tsx:254 sig (hex) (len=64): 0321dba4e2f5fd9b4338a0ca8eb07a0ac210e22beb476a8d1a2f7a08b036464000a31311dfb25d81168d6a8cce501074e692224c8a4c1342ddbc473f6d8b5c84
// Signer.tsx:255 sig (base64): AyHbpOL1/ZtDOKDKjrB6CsIQ4ivrR2qNGi96CLA2RkAAoxMR37JdgRaNaozOUBB05pIiTIpME0LdvEc/bYtchA==
// Signer.tsx:32 {"txId":"019b4b01-5932-719d-9677-83057decdc30","net":"testnet","marketId":"0189c0a8-7e80-7e80-8000-000000000003","generatedAt":"2025-12-23T11:38:58.226Z","accountId":"0.0.7090546","marketLimit":"limit","priceUsd":0.5,"qty":1,"sig":"AyHbpOL1/ZtDOKDKjrB6CsIQ4ivrR2qNGi96CLA2RkAAoxMR37JdgRaNaozOUBB05pIiTIpME0LdvEc/bYtchA==","publicKey":"03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787","evmAddress":"440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6","keyType":2}
const verify_rawSig_hashpack_base64 = () => {
  console.log('--- verify_rawSig_hashpack_base64 ---')
  const payloadHex = 'f0000000000000000000000000000000000000000000000000000000000007a120440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b4b015932719d967783057decdc30'
  const sigHex = '0321dba4e2f5fd9b4338a0ca8eb07a0ac210e22beb476a8d1a2f7a08b036464000a31311dfb25d81168d6a8cce501074e692224c8a4c1342ddbc473f6d8b5c84'

  const keccakHex = keccak256(Buffer.from(payloadHex, 'hex')).slice(2)
  const keccak = Buffer.from(keccakHex, 'hex')
  const keccak64 = keccak.toString('base64') // an extra step...
  const keccakPrefixedStr = prefixMessageToSign(keccak64)
  console.log(`keccakPrefixedStr (hex): ${Buffer.from(keccakPrefixedStr/*, 'utf-8'*/).toString('hex')}`)
  
  const isVerifiedRaw = publicKey.verify(Buffer.from(keccakPrefixedStr, 'utf-8'), Buffer.from(sigHex, 'hex'))
  // console.log(`keccakPrefixedBytes (hex): ${Buffer.from(Buffer.from(keccakPrefixedStr, 'utf-8')).toString('hex')}`)
  console.log('---> isVerifiedRaw (should be true):', isVerifiedRaw)
  assert(isVerifiedRaw, 'Raw signature verification (verify_rawSig_hashpack_utf8) failed')
}

// /*
// 00000000000000000000000000000000000000000000000000000000000f42400189c0a87e807e808000000000000003019af83a8a7974ecaea255682ea385ba
// "txId":"019af83a-8a79-74ec-aea2-55682ea385ba"
// "marketId":"0189c0a8-7e80-7e80-8000-000000000003"
// */
// const verify_assemblePayload_uft8HashpackSigned = async () => {
//   console.log('--- verify_assemblePayload ---')

//   const EXPECTED = '19486564657261205369676e6564204d6573736167653a0a343079776d576933752f33334f4e6e72456f71337a357173504d68564b4878466545454c7571383350375163773d'
//   // 40 - length of prefix input in Solidity function
//   const collateralUsdAbsScaled = BigInt('0x00000000000000000000000000000000000000000000000000000000000f4240')
//   const marketId = BigInt('0x0189c0a87e807e808000000000000003')
//   const txId = BigInt('0x019af83a8a7974ecaea255682ea385ba')

//   const params = new ContractFunctionParameters() // Sig.sol
//     // uint256 collateralUsd
//     // uint128 marketId
//     // uint128 txId
//     .addUint256(collateralUsdAbsScaled.toString())
//     .addUint128(marketId.toString())
//     .addUint128(txId.toString())
  
//   const tx = await new ContractExecuteTransaction()
//     .setContractId(ContractId.fromString(contractId))
//     .setGas(1_000_000)
//     .setFunction('assemblePayload', params)
//     .execute(client)
  
//   const record = await tx.getRecord(client)
//   const result = record.contractFunctionResult
//   if (result) {
//     console.log(`result: ${result.getResult(['bytes'])}`)
//     console.log('')
    
//     const [prefixedKeccak64Hex] = result.getResult(['bytes'])
//     console.log(`prefixedKeccak64 (hex): ${prefixedKeccak64Hex}`)

//     assert(prefixedKeccak64Hex.slice(2) === EXPECTED, 'assemblePayload result does not match expected value')
//     console.log('OK ✅')
//   } else {
//     console.error('No contract function result found.')
//   }
// }










// function prefixMessageToSign(messageUtf8: string) {
//   console.log(messageUtf8.length)
//   return '\x19Hedera Signed Message:\n' + messageUtf8.length + messageUtf8
// }

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




const verifyAssembly = async (payloadHex: string, sigHex: string) => {
  console.log('--- verifyAssembly ---')
  /////
  // on-chain assembly
  /////
  const [buySell, collateralUsdAbsScaled, evmAddr, marketId, txId] = payloadHex2components(payloadHex)

  // console.log(buySell)
  // console.log(collateralUsdAbsScaled.toString(16))
  // console.log(evmAddr.toString())
  // console.log(marketId.toString(16))
  // console.log(txId.toString(16))

  const params = new ContractFunctionParameters() // Test.sol
    .addUint8(buySell ? 0xf1 : 0xf0) // 0xf0 => buy, 0xf1 => sell
    .addUint256(collateralUsdAbsScaled.toString())
    .addAddress(evmAddr)
    .addUint128(marketId.toString())
    .addUint128(txId.toString())
  
  const tx = await new ContractExecuteTransaction()
    .setContractId(ContractId.fromString(contractId))
    .setGas(5_000_000)
    .setFunction('assemblePayload', params)
    .execute(client)
  
  const record = await tx.getRecord(client)
  const result = record.contractFunctionResult
  
  const [returnParam0] = result!.getResult(['bytes'])
  const prefixedKeccak64Hex = returnParam0.toString().slice(2)
  console.log(`on-chain 'assemblePayload' result (prefixed keccak):\t${prefixedKeccak64Hex}`)



  /////
  // off-chain assembly:
  /////
  
  const keccakHex = keccak256(Buffer.from(payloadHex, 'hex')).slice(2)
  const keccak = Buffer.from(keccakHex, 'hex')
  const keccak64 = keccak.toString('base64') // an extra step...
  const keccakPrefixedStr = prefixMessageToSign(keccak64)
  console.log(`off-chain payload assembly result (prefixed keccak):\t${Buffer.from(keccakPrefixedStr, 'utf-8').toString('hex')}`)

  /////
  // verifiy sigs are correct - off-chain assembly and on-chain assembly
  /////
  const offChainOK = publicKey.verify(Buffer.from(keccakPrefixedStr, 'utf-8'), Buffer.from(sigHex, 'hex'))
  console.log(keccakPrefixedStr)
  console.log('---> publicKey.verify (assembled off-chain):', offChainOK)
  
  const keccakPrefixedStr2 = Buffer.from(prefixedKeccak64Hex, 'hex').toString('utf-8')
  const onChainOK = publicKey.verify(Buffer.from(keccakPrefixedStr2, 'utf-8'), Buffer.from(sigHex, 'hex'))
  console.log(keccakPrefixedStr2)
  console.log('---> publicKey.verify (assembled on-chain):', onChainOK)
  
  if(onChainOK) {
    console.log('OK ✅')
  } else {
    console.error('FAILED ❌. signature verification (verifyAssembly) failed')
  }
}





interface Val {
  payloadHex: string
  sigHex: string
}
const testVals: Val[] = []

testVals.push({
  payloadHex: 'f1000000000000000000000000000000000000000000000000000000000000157c440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b5081ba47748aa22e3163fcd418db',
  sigHex:     'bbc52c589f643a3810d0743b866e0ec0010c8ac9ea8f5d0ce2f215386357258cfd286dcb944352c3c9a8d0bab2dbdaba5226db4b4257dbcadadd7bd0293c2100'
})

// Signing OrderIntent...
// Signer.tsx:229 packedHex: f1000000000000000000000000000000000000000000000000000000000007a120440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b4b015932719d967783057decdc30
// Signer.tsx:231 packedKeccakHex (len=32): 198189ad9f3904769723e94297cd6bd07c1d95ec1f7a74f267dccac76101c3c3
// Signer.tsx:232 verify at: https://emn178.github.io/online-tools/keccak_256.html
// Signer.tsx:251 msgToSign (base64) (len=44): GYGJrZ85BHaXI+lCl81r0HwdlewfenTyZ9zKx2EBw8M=
// Signer.tsx:254 sig (hex) (len=64): 1cc64b889b33d457b9cc7a57c2048edd576ada72beb625ed2916f97d63961bd53d7789cbbf03d3e73c2e0a5e699afc706d7978942176c56994fc6e77e91a50e4
// Signer.tsx:255 sig (base64): HMZLiJsz1Fe5zHpXwgSO3Vdq2nK+tiXtKRb5fWOWG9U9d4nLvwPT5zwuCl5pmvxwbXl4lCF2xWmU/G536RpQ5A==
// Signer.tsx:32 {"txId":"019b4b01-5932-719d-9677-83057decdc30","net":"testnet","marketId":"0189c0a8-7e80-7e80-8000-000000000003","generatedAt":"2025-12-23T11:38:58.226Z","accountId":"0.0.7090546","marketLimit":"limit","priceUsd":-0.3,"qty":1.6666666666666667,"sig":"HMZLiJsz1Fe5zHpXwgSO3Vdq2nK+tiXtKRb5fWOWG9U9d4nLvwPT5zwuCl5pmvxwbXl4lCF2xWmU/G536RpQ5A==","publicKey":"03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787","evmAddress":"440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6","keyType":2}
testVals.push({
  payloadHex: 'f1000000000000000000000000000000000000000000000000000000000007a120440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b4b015932719d967783057decdc30',
  sigHex:     '1cc64b889b33d457b9cc7a57c2048edd576ada72beb625ed2916f97d63961bd53d7789cbbf03d3e73c2e0a5e699afc706d7978942176c56994fc6e77e91a50e4'
})

// Signing OrderIntent...
// Signer.tsx:229 packedHex: f10000000000000000000000000000000000000000000000000000000000002ee0440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b4af02203750dbf1279b23f557a46
// Signer.tsx:231 packedKeccakHex (len=32): 98c1b8486040888e44c599e403bc90a4ac6d0d064e23f932cc1692c2894b7d26
// Signer.tsx:232 verify at: https://emn178.github.io/online-tools/keccak_256.html
// Signer.tsx:251 msgToSign (base64) (len=44): mMG4SGBAiI5ExZnkA7yQpKxtDQZOI/kyzBaSwolLfSY=
// Signer.tsx:254 sig (hex) (len=64): 157c3034e269d6ee17778e693cf55296298b56612540dee3e36ebd256e0cd1e71be37e8d4ee64133984fcfd399177168eea21a470b4acc08f31edcbd4d473e14
// Signer.tsx:255 sig (base64): FXwwNOJp1u4Xd45pPPVSlimLVmElQN7j4269JW4M0ecb436NTuZBM5hPz9OZF3Fo7qIaRwtKzAjzHty9TUc+FA==
// Signer.tsx:32 {"txId":"019b4af0-2203-750d-bf12-79b23f557a46","net":"testnet","marketId":"0189c0a8-7e80-7e80-8000-000000000003","generatedAt":"2025-12-23T11:20:09.987Z","accountId":"0.0.7090546","marketLimit":"limit","priceUsd":-0.5,"qty":0.024,"sig":"FXwwNOJp1u4Xd45pPPVSlimLVmElQN7j4269JW4M0ecb436NTuZBM5hPz9OZF3Fo7qIaRwtKzAjzHty9TUc+FA==","publicKey":"03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787","evmAddress":"440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6","keyType":2}
testVals.push({
    payloadHex: 'f10000000000000000000000000000000000000000000000000000000000002ee0440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b4af02203750dbf1279b23f557a46',
    sigHex:     '157c3034e269d6ee17778e693cf55296298b56612540dee3e36ebd256e0cd1e71be37e8d4ee64133984fcfd399177168eea21a470b4acc08f31edcbd4d473e14'
})

// Signing OrderIntent...
// Signer.tsx:229 packedHex: f10000000000000000000000000000000000000000000000000000000000003a98440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b4aef8191775c9e7c4d055a2365a4
// Signer.tsx:231 packedKeccakHex (len=32): 8d7e6e40167fc5fa94bf1020e491ccec11f0036f4026e6ff76a012b1c78c8e21
// Signer.tsx:232 verify at: https://emn178.github.io/online-tools/keccak_256.html
// Signer.tsx:251 msgToSign (base64) (len=44): jX5uQBZ/xfqUvxAg5JHM7BHwA29AJub/dqASsceMjiE=
// Signer.tsx:254 sig (hex) (len=64): 120b0645ab8c6b6e7b3df4ef742bfa7c21f7fc6db884e67cb6d62ae1e981a5fd5617671ca2fac57be531d32097ec082e5523c6bd775e019ed825073bddcea1b3
// Signer.tsx:255 sig (base64): EgsGRauMa257PfTvdCv6fCH3/G24hOZ8ttYq4emBpf1WF2ccovrFe+Ux0yCX7AguVSPGvXdeAZ7YJQc73c6hsw==
// Signer.tsx:32 {"txId":"019b4aef-8191-775c-9e7c-4d055a2365a4","net":"testnet","marketId":"0189c0a8-7e80-7e80-8000-000000000003","generatedAt":"2025-12-23T11:19:28.913Z","accountId":"0.0.7090546","marketLimit":"limit","priceUsd":-0.5,"qty":0.03,"sig":"EgsGRauMa257PfTvdCv6fCH3/G24hOZ8ttYq4emBpf1WF2ccovrFe+Ux0yCX7AguVSPGvXdeAZ7YJQc73c6hsw==","publicKey":"03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787","evmAddress":"440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6","keyType":2}
testVals.push({
    payloadHex: 'f10000000000000000000000000000000000000000000000000000000000003a98440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b4aef8191775c9e7c4d055a2365a4',
    sigHex:     '120b0645ab8c6b6e7b3df4ef742bfa7c21f7fc6db884e67cb6d62ae1e981a5fd5617671ca2fac57be531d32097ec082e5523c6bd775e019ed825073bddcea1b3'
})

// Signing OrderIntent...
// Signer.tsx:229 packedHex: f00000000000000000000000000000000000000000000000000000000000000000440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b4affc6b1735faebc0a7834b01ed2
// Signer.tsx:231 packedKeccakHex (len=32): d52a890136d1d87c345179b7ffbe7ba53b589a00ddbd5046a6ad00009e8695dd
// Signer.tsx:232 verify at: https://emn178.github.io/online-tools/keccak_256.html
// Signer.tsx:251 msgToSign (base64) (len=44): 1SqJATbR2Hw0UXm3/757pTtYmgDdvVBGpq0AAJ6Gld0=
// Signer.tsx:254 sig (hex) (len=64): 2a8185221abaa9c6b80434af658d74483cee610c37fc8a25bd23349047be03d9712389f554d87e4241e753c7eec25279b771cb8e83678f54666daed961964044
// Signer.tsx:255 sig (base64): KoGFIhq6qca4BDSvZY10SDzuYQw3/IolvSM0kEe+A9lxI4n1VNh+QkHnU8fuwlJ5t3HLjoNnj1Rmba7ZYZZARA==
// Signer.tsx:32 {"txId":"019b4aff-c6b1-735f-aebc-0a7834b01ed2","net":"testnet","marketId":"0189c0a8-7e80-7e80-8000-000000000003","generatedAt":"2025-12-23T11:37:15.185Z","accountId":"0.0.7090546","marketLimit":"limit","priceUsd":0,"qty":0,"sig":"KoGFIhq6qca4BDSvZY10SDzuYQw3/IolvSM0kEe+A9lxI4n1VNh+QkHnU8fuwlJ5t3HLjoNnj1Rmba7ZYZZARA==","publicKey":"03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787","evmAddress":"440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6","keyType":2}
testVals.push( {
  payloadHex: 'f00000000000000000000000000000000000000000000000000000000000000000440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b4affc6b1735faebc0a7834b01ed2',
  sigHex:     '2a8185221abaa9c6b80434af658d74483cee610c37fc8a25bd23349047be03d9712389f554d87e4241e753c7eec25279b771cb8e83678f54666daed961964044'
})

// Signing OrderIntent...
// Signer.tsx:229 packedHex: f000000000000000000000000000000000000000000000000000000000003d0900440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b4b005b0575f1b315109662d81a3c
// Signer.tsx:231 packedKeccakHex (len=32): bd183d47e17e2d44b0c9decab9a54448ea0d4ac1b6d9994f622ef3b4bc38977a
// Signer.tsx:232 verify at: https://emn178.github.io/online-tools/keccak_256.html
// Signer.tsx:251 msgToSign (base64) (len=44): vRg9R+F+LUSwyd7KuaVESOoNSsG22ZlPYi7ztLw4l3o=
// Signer.tsx:254 sig (hex) (len=64): 0583d00dba25d87be7933a48c2834ded6bf06ba8b534b2b94938146e254c1e192fd041ee6f7f46aa25399c6d0389825776fc5dff5237b22e4a2deecfd32e6f88
// Signer.tsx:255 sig (base64): BYPQDbol2HvnkzpIwoNN7Wvwa6i1NLK5STgUbiVMHhkv0EHub39GqiU5nG0DiYJXdvxd/1I3si5KLe7P0y5viA==
// Signer.tsx:32 {"txId":"019b4b00-5b05-75f1-b315-109662d81a3c","net":"testnet","marketId":"0189c0a8-7e80-7e80-8000-000000000003","generatedAt":"2025-12-23T11:37:53.157Z","accountId":"0.0.7090546","marketLimit":"limit","priceUsd":0.511,"qty":7.8277886497064575,"sig":"BYPQDbol2HvnkzpIwoNN7Wvwa6i1NLK5STgUbiVMHhkv0EHub39GqiU5nG0DiYJXdvxd/1I3si5KLe7P0y5viA==","publicKey":"03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787","evmAddress":"440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6","keyType":2}
testVals.push( {
  payloadHex: 'f000000000000000000000000000000000000000000000000000000000003d0900440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b4b005b0575f1b315109662d81a3c',
  sigHex:     '0583d00dba25d87be7933a48c2834ded6bf06ba8b534b2b94938146e254c1e192fd041ee6f7f46aa25399c6d0389825776fc5dff5237b22e4a2deecfd32e6f88'
})




const checkSig_onChain = async (publicKey: PublicKey, payloadHex: string, sigHex: string) => {
  console.log('--- checkSig_onChain ---')

  const keccakHex = keccak256(Buffer.from(payloadHex, 'hex')).slice(2)
  const keccak = Buffer.from(keccakHex, 'hex')
  // keccak[0] = keccak[0] ^ 0xff // Slightly perturb the first byte
  const keccak64 = keccak.toString('base64') ///// N.B. an extra base64 step...
  const keccakPrefixedStr = prefixMessageToSign(keccak64)
  console.log(`keccakPrefixedStr (hex): ${Buffer.from(keccakPrefixedStr, 'utf-8').toString('hex')}`)

  const sigObj = buildSignatureMap(publicKey, Buffer.from(sigHex, 'hex'), 'ECDSA') // TODO - retrieve key type (ECDSA or ED25519) from userAccountInfo on mirror node
  console.log(`sigObj (len=${sigObj.length}): ${Buffer.from(sigObj).toString('hex')}`)

  const params = new ContractFunctionParameters() // Sig.sol
    // address account
    // bytes memory message
    // bytes memory signature
    .addAddress(evmAddress)
    .addBytes(Buffer.from(keccakPrefixedStr, 'utf-8')) // Buffer.from('INCORRECT'))
    .addBytes(sigObj)
  
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

;(async () => {
  
  await verifyAssembly(
    'f100000000000000000000000000000000000000000000000000000000000003e8440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b4a9ffd6e7096829a4958d6ed10d4',
    'f81bea7fe816c1db0378f239819d4b4bde69326cfe8b5a1b37418e84e8b06b3275aad8de1d810b5993f0694c3b4f48b2e3bad083c642721e6058c75c811ce25f'
  )

  await checkSig_onChain(publicKey, testVals[0].payloadHex, testVals[0].sigHex)
  console.log('************************************************')
  
  // process.exit(0)

  verify_rawSig_hashpack_base64()
  console.log('************************************************')

  // await verify_assemblePayload_uft8HashpackSigned()
  // console.log('************************************************')

  
  // process.exit(0)

  let payloadHex = ''
  let sigHex = ''
  for (const tv of testVals) {
    payloadHex = tv.payloadHex
    sigHex = tv.sigHex
    await verifyAssembly(payloadHex, sigHex)
    console.log('************************************************')
    process.exit(0)
  }

  process.exit(0) // needed at the end
})()