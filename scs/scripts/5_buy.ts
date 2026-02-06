/**
Signing OrderIntent...
Signer.tsx:229 packedHex: 0000000000000000000000000000000000000000000000000000000000000f4240440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b47ae68cd7586abcd2a72aa54e746
Signer.tsx:231 packedKeccakHex (len=32): 4e565e3f7c1da8c0d139e196c36dff70db9548d559ab1db349616dc8c91ea3d5
Signer.tsx:232 verify at: https://emn178.github.io/online-tools/keccak_256.html
Signer.tsx:251 msgToSign (base64) (len=44): TlZeP3wdqMDROeGWw23/cNuVSNVZqx2zSWFtyMkeo9U=
Signer.tsx:254 sig (hex) (len=64): 93ff91d8c5dcd9599fe114c53c0bf9507aae9b8e51b405c504b43b091d4b367c7cfaec86d4d45a19bd0a421a88bc46b7f8d95da65797444edfb276d13ad43166
Signer.tsx:255 sig (base64): k/+R2MXc2Vmf4RTFPAv5UHqum45RtAXFBLQ7CR1LNnx8+uyG1NRaGb0KQhqIvEa3+NldpleXRE7fsnbROtQxZg==
Signer.tsx:32 {"txId":"019b47ae-68cd-7586-abcd-2a72aa54e746","net":"testnet","marketId":"0189c0a8-7e80-7e80-8000-000000000003","generatedAt":"2025-12-22T20:09:31.085Z","accountId":"0.0.7090546","marketLimit":"limit","priceUsd":0.5,"qty":2,"sig":"k/+R2MXc2Vmf4RTFPAv5UHqum45RtAXFBLQ7CR1LNnx8+uyG1NRaGb0KQhqIvEa3+NldpleXRE7fsnbROtQxZg==","publicKey":"03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787","evmAddress":"440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6","keyType":2}
# export SMART_CONTRACT_ID=0.0.7508949

export PUBLIC_KEY=03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787
# N.B. PAYLOAD is constructed using the marketId and txId below (collateral USD is 0.0137 converted to a hex 256-bit uint):
# export MARKET_ID=0189c0a87e807e808000000000000003
# export TX_ID=019af9dc4e5f751880afb44d6938149c
export PAYLOAD=0000000000000000000000000000000000000000000000000000000000000f4240440a1d7af93b92920bce50b4c0d2a8e6dcfebfd60189c0a87e807e808000000000000003019b47ae68cd7586abcd2a72aa54e746
export SIG_RAW=93ff91d8c5dcd9599fe114c53c0bf9507aae9b8e51b405c504b43b091d4b367c7cfaec86d4d45a19bd0a421a88bc46b7f8d95da65797444edfb276d13ad43166

ts-node buy.ts $SMART_CONTRACT_ID $PAYLOAD $SIG_RAW $PUBLIC_KEY
*/

import {
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  PublicKey
} from '@hashgraph/sdk'
import { initHederaClient } from './lib/hedera.ts'
import { buildSignatureMap } from './lib/utils.ts'
import { payloadHex2components } from './lib/utils.ts'
import { keccak256 } from 'ethers'
import { prefixMessageToSign } from './lib/utils.ts'

const [ client, networkSelected, _ ] = initHederaClient()

const main = async () => {
  // CLI args: contractId, amount
  const [payloadHex, sigRawHex, publicKeyHex] = process.argv.slice(2)
  if (!payloadHex || !sigRawHex || !publicKeyHex) {
    console.error('Usage: ts-node buy.ts <payloadHex> <sigRawHex> <publicKeyHex>')
    console.error('Example usage: ts-node buy.ts $PAYLOAD_HEX $SIG_RAW_HEX $PUBLIC_KEY')
    process.exit(1)
  }
  
  const [buySell, collateralUsdAbsScaled, evmAddr, marketId, txId] = payloadHex2components(payloadHex)
  console.log(`buySell: ${buySell}, collateralUsdAbsScaled: ${collateralUsdAbsScaled}, evmAddr: ${evmAddr.toString()}, marketId: ${marketId.toString(16)}, txId: ${txId.toString(16)}`)
  console.log('\n\n')

  const operatorPublicKey = PublicKey.fromString(publicKeyHex)
  const account = client.operatorPublicKey!.toEvmAddress() 
  console.log(`account: ${operatorPublicKey.toString()}`)

  const contractId = process.env[`${networkSelected.toString().toUpperCase()}_SMART_CONTRACT_ID`]
  if (!contractId) {
    console.error(`Error: ${networkSelected.toString().toUpperCase()}_SMART_CONTRACT_ID environment variable is not set.`)
    process.exit(1)
  }
  
  // TODO - retrieve ECDSA or ED25519 from userAccountInfo on mirror node
  const sigObj = Buffer.from(buildSignatureMap(operatorPublicKey, Buffer.from(sigRawHex, 'hex'), 'ECDSA'))
  
  // known keccak and sig - see ./api/server/lib/demo/sigDemo.go
  // const knownKeccakHex = '19486564657261205369676e6564204d6573736167653a0a33310befbfbd5e49efbfbd302060712065efbfbd17efbfbd335fefbfbdefbfbdefbfbdefbfbdefbfbdefbfbddba9efbfbdefbfbdefbfbd6345efbfbd7a32'
  // const knownSigHex = '0a650a2103b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac07873240d0d54810f170b385e9dae222a2f4e42c32b334f43f1d344a1bee93238cee2a2819c6b2c2bc7933054e47772d28bcbae7e98ab56419125bbd301f0884a5340296'

  
  // known payloads and signatures for 0.0.7090546
  // see: sigDemo.go
  // const payload1Hex = '0000000000000000000000000000000000000000000000000000000000004e200189c0a87e807e808000000000000002019aeeb456ec75b4829cb41fdfd67610'
	// const sig1Hex =     '58029b63c4145c35bfcf300c3cd2b307facc18f52b53957f7f10a5816b3b64801e8687cadb06cd07648098fe1c85c7dec252068a249d57c1ff315d6bdba8989a'
	// const payload2Hex = '0000000000000000000000000000000000000000000000000000000000003a980189c0a87e807e808000000000000002019aeeb456ec75b4829cb41fdfd67610'
	// const sig2Hex =     '8a10968171368e9ea94978431068dcbbaacfec1d70ea5956bc349cb6f0cdbb4145a6cec3325b9b8285b51b14b513b4933471c2cd3039ce5a211c0de46319d830'
  // const keccak1Hex = keccak256(Buffer.from(payload1Hex)).slice(2)
  // const keccak2Hex = keccak256(Buffer.from(payload2Hex)).slice(2)
  // const keccak1Utf8 = Buffer.from(keccak1Hex, 'hex').toString()
  // const keccak2Utf8 = Buffer.from(keccak2Hex, 'hex').toString()
  // const keccak1PrefixedUtf8 = prefixMessageToSign(keccak1Utf8)
  // const keccak2PrefixedUtf8 = prefixMessageToSign(keccak2Utf8)

  // // assembled prefixed keccaks:
  // const keccakPrefixedYes = Buffer.from(keccak1PrefixedUtf8, 'utf8')
  // const keccakPrefixedNo = Buffer.from(keccak2PrefixedUtf8, 'utf8')

  // // assembled signatures:
  // const sigYes =  Buffer.from(sig1Hex, 'hex')
  // const sigNo =   Buffer.from(sig2Hex, 'hex')

  // const payloadKnownHex = '0000000000000000000000000000000000000000000000000000000000004e200189c0a87e807e808000000000000002019aeeb456ec75b4829cb41fdfd67610'
	// const sigKnownHex =     '58029b63c4145c35bfcf300c3cd2b307facc18f52b53957f7f10a5816b3b64801e8687cadb06cd07648098fe1c85c7dec252068a249d57c1ff315d6bdba8989a'
	
  // // known params
  // const knownParams: Record<string, KnownParam> = {
  //   '0189c0a8-7e80-7e80-8000-000000000001': {
  //     txId: '2229c0a8-7e80-7e80-8000-000000000091',
  //     sig: '<TO BE CALCULATED>'
  //   },
  //   '0189c0a8-7e80-7e80-8000-000000000002': {
  //     txId: '2229c0a8-7e80-7e80-8000-000000000092',
  //     sig: '<TO BE CALCULATED>'
  //   },
  //   '0189c0a8-7e80-7e80-8000-000000000003': {
  //     txId: '2229c0a8-7e80-7e80-8000-000000000093',
  //     sig: '<TO BE CALCULATED>'
  //   }
  // }

  // for (const marketId in knownParams) {
  //   const knownParam = knownParams[marketId]
  //   console.log(marketId)
  //   console.log(knownParam.txId)
  //   // const packed = ethers.solidityPacked(['uint256', 'uint128', 'uint128'],[collateralUSDCbig, uuid7_to_uint128(marketId), uuid7_to_uint128(knownParam.txId)])
  //   console.log(uuid7_to_uint128(marketId).toString())
  //   console.log(collateralUSDCbig.toString())
  //   // console.log(Buffer.from(packed).toString('hex'))
  // }

  // process.exit(0)

  try {
    client.operatorAccountId!.toEvmAddress()
  } catch (err) {
    console.error('Invalid userAccountId:', client.operatorAccountId, err)
    process.exit(1)
  }

  console.log(`contractId: ${contractId} - ${ContractId.fromString(contractId).toEvmAddress()}`)





  const usdcContractId = process.env[`${networkSelected.toString().toUpperCase()}_USDC_ADDRESS`]
  if (!usdcContractId) {
    console.error(`Error: ${networkSelected.toString().toUpperCase()}_USDC_ADDRESS environment variable is not set.`)
    process.exit(1)
  }
  console.log(`Using USDC contractId (${networkSelected.toString()}): ${usdcContractId} - ${ContractId.fromString(usdcContractId).toEvmAddress()}`)




  try {
    // const nPositionTokensBig = BigInt(nPositionTokens)
    console.log(`Buying ${collateralUsdAbsScaled} position tokens (both buy and sell side) with ${collateralUsdAbsScaled} (USDC base units) as collateral (x2)...`)
    
    // 1. Approve the PredictionMarket contract to spend user's USDC collateral tokens (x2)
    const approveTx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(usdcContractId).toEvmAddress())
      .setGas(10_000_000)
      .setFunction('approve', // approve inherited from ERC20 
        new ContractFunctionParameters()
          .addAddress(ContractId.fromString(contractId).toEvmAddress())
          .addUint256((collateralUsdAbsScaled * BigInt(2)).toString())) /** Note: x2 since buy side and sell side are from the same account...**/
      .execute(client)
    
    const approveReceipt = await approveTx.getReceipt(client)
    console.log('approve status:', approveReceipt.status.toString())

  
    // 2) verify allowance (optional)
    const allowanceQuery = await new ContractCallQuery()
      .setContractId(ContractId.fromString(usdcContractId).toEvmAddress())
      .setGas(100_000)
      .setFunction('allowance', // allowance inherited from ERC20
        new ContractFunctionParameters()
          .addAddress(client.operatorPublicKey!.toEvmAddress())
          .addAddress(ContractId.fromString(contractId).toEvmAddress()))
      .execute(client)

    const allowance = allowanceQuery.getUint256(0).toString()
    console.log(`allowance now [including decimals]: ${allowance}`)

    // 3) buy outcome tokens (msg.sender must be token holder)
    // const buyTx = await new ContractExecuteTransaction()
    //   .setContractId(contractId)
    //   .setGas(1_000_000)
    //   .setFunction('buyPositionTokens',
    //     new ContractFunctionParameters()
    //       .addUint256(amountUnits.toString()))
    //   .execute(client)

    // const buyReceipt = await buyTx.getReceipt(client);
    // console.log('buyPositionTokens status:', buyReceipt.status.toString());


    
    /////
    // off-chain assembly:
    /////
    console.log('off-chain assembly FYI:')
    const keccakHex = keccak256(Buffer.from(payloadHex, 'hex')).slice(2)
    const keccak = Buffer.from(keccakHex, 'hex')
    const keccak64 = keccak.toString('base64') // an extra step...
    const keccakPrefixedStr = prefixMessageToSign(keccak64)
    console.log(`offChain assemled prefixed keccak:\t${Buffer.from(keccakPrefixedStr, 'utf-8').toString('hex')}`)
    console.log(`sigObj:\t${sigObj.toString('hex')}`)

     // 4) buy outcome tokens on behalf of another account which has an allowance set (buyPositionTokensOnBehalf)
    // console.log(`*** client.operatorAccountId!.toEvmAddress(): ${client.operatorAccountId!.toEvmAddress()}`)
    const params = new ContractFunctionParameters()
        // uint128 marketId,
        // address signerYes,
        // address signerNo,
        // uint256 collateralUsdAbsScaledYes
        // uint256 collateralUsdAbsScaledNo,
        // uint128 txIdYes,
        // uint128 txIdNo,
        // bytes calldata sigObjYes,
        // bytes calldata sigObjNo
      .addUint128(marketId.toString()) // marketId
      .addAddress(account) // signerYes
      .addAddress(account) // signerNo // TODO - have a yes/no distinction
      .addUint256(collateralUsdAbsScaled.toString()) // collateralUsdAbsScaledYes
      .addUint256(collateralUsdAbsScaled.toString()) // collateralUsdAbsScaledNo // TODO - have a yes/no distinction
      .addUint128(txId.toString()) // txIdYes
      .addUint128(txId.toString())  // txIdNo // TODO - have a yes/no distinction
      .addBytes(sigObj) // sigObjYes
      .addBytes(sigObj) // sigObjNo // TODO - have a yes/no distinction
    const buyTx4 = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(2_000_000) // approx 1 million per USDC transfer (two USDC transfers in the atomic function)
      .setFunction(
        'buyPositionTokensOnBehalfAtomic',
        params
      )
      .execute(client)

    const buyReceipt4 = await buyTx4.getReceipt(client)
    console.log(`buyPositionTokensOnBehalf(marketId=${marketId},...) status:`, buyReceipt4.status.toString())
 
 
  //   // getUint256 returns BigNumber-like object; convert to string
  //   const yes = result.getUint256(0).toString()
  //   const no = result.getUint256(1).toString()

  //   console.log(`getUserTokens(${userAccount}) => yes=${yes}, no=${no}`)


    
  } catch (err) {
    console.error('Contract call failed:', err)
    process.exit(1)
  }
}

(async () => {
  await main()
  process.exit(0)
})()
