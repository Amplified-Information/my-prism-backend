import { ContractCallQuery, ContractExecuteTransaction, ContractFunctionParameters, ContractId, Hbar, HbarUnit } from '@hashgraph/sdk'
import { networkSelected, operatorAccountId, operatorKeyType } from '../constants.ts'
import { initHederaClient } from '../lib/hedera.ts'
// import { keccak256 } from "ethers";
// import { sign } from "crypto";
// import { recoverPublicKey } from '@noble/secp256k1'

const [ client, _ ] = initHederaClient(
  networkSelected,
  operatorAccountId,
  operatorKeyType
)

const main = async () => {
  // CLI args: contractId, tokenId
  const [contractId] = process.argv.slice(2)
  if (!contractId) {
    console.error('Usage: ts-node sig.ts <contractId>')
    process.exit(1)
  }
  console.log(`*** contractId: ${contractId}`)
  console.log(`*** accountId: ${operatorAccountId}`)

  // TEST button:
  const evmAddHex = '440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6'
  const pubKeyHex = '03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787'

  // const keccakHex = '4e4805657b4f46707e7129b502073496e93c376aa3c988fdf19496ebe04a2b6b'
  const keccakHex = '3e85767c8cef77658ab46fc500728cb51a6683cc1b251e5c6942bbc98614526e'
  // const sigHex = '026bc2e30924914201b8a1a2997a00110df060e73705b744890549777e445cd8140844097ce6759f092209f9454b0f551b559dce40496226e2bb791caaa706471b'
  const sigHex = '86e8c350707f1920f50a21addee53ece4a259e3493bb2f21b7a5e372464191ae0c2096d2383400255fb5676b8ac9e74e69f50135e8ba07fdcfcb2cd244dc3ca0'

  // console.log(`payload (hex) (len=${Buffer.from(payloadHex, 'hex').length}): ${payloadHex}`)
  console.log(`keccakHex (hex) (len=${Buffer.from(keccakHex, 'hex').length}): ${keccakHex}`)
  console.log(`sigHex (hex) (len=${Buffer.from(sigHex, 'hex').length}): ${sigHex}`)
  
  const keccak = Buffer.from(keccakHex, 'hex')
  const sig = Buffer.from(sigHex, 'hex')

  const r = sig.subarray(0, 32)
  const s = sig.subarray(32, 64)
  const v = 27 // hardcoded for now (could be 28) // TODO
  console.log(`r (hex): ${Buffer.from(r).toString('hex')}`)
  console.log(`s (hex): ${Buffer.from(s).toString('hex')}`)
  console.log(`v (hex): ${v}`)
  // process.exit(0)
  // https://github.com/dalvizu/hedera-sdk-rust/blob/e4a3078f025519287886ca1c9287691ea53e08e8/src/key/public_key/tests.rs#L121


  // const publicKey = PublicKey.fromString("302d300706052b8104000a03220002703a9370b0443be6ae7c507b0aec81a55e94e4a863b9655360bd65358caa6588").toBytesRaw()
  // console.log(`publicKey (hex) (len=${publicKey.length}): ${Buffer.from(publicKey).toString("hex")}`)
  

  // // const messageHash = Uint8Array.from(Buffer.from("2caf5d9817daef9d9d853d0adffad7d6833589064dadbc8a7b33ed317f72b326", "hex"))
  // const messageHash = Buffer.from("c1fd562d42cca69b6391ac9300d706fb58c4ca3aa110d408e39ac8cbc24fb831", "hex")
  // console.log(`messageHash (hex) (len=${messageHash.length}): ${Buffer.from(messageHash).toString("hex")}`)
  
  // //  publicKey = _publickKey.toBytes()
  // // console.log(`messageHash (hex) (len=${publicKey.length}): ${Buffer.from(publicKey).toString("hex")}`)
  // const sigHex = "8e06e8561256631955328278c1e93fa8b40a27538298a33e48be699600317f6e05975ff1293b43e4c9c4a082797c787d4667258c52a8f2ce9ef5d546aa7aec01"
  // const signature = Uint8Array.from(Buffer.from(sigHex, "hex"))
  // // console.log(`signature (hex) (len=${signature.length}): ${Buffer.from(signature).toString("hex")}`)
  // //
  // // process.exit(1)

    //   // account, hash, sig

  //   //  const params = new ContractFunctionParameters()
  //   //   .addAddress("0x440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6")
  //   //   .addBytes(messageHash)
  //   //   .addBytes(Buffer.from("d7e866d6055676682a27c6054e657de97382177e51344bc269e196c998672c402cfe1113bb645efaf1b942ce26958f1342dabc01877967dce7e04080217901a01b", "hex"))
  //   //   .addBytes32(Buffer.from("d7e866d6055676682a27c6054e657de97382177e51344bc269e196c998672c40", "hex"))
  //   //   .addBytes32(Buffer.from("2cfe1113bb645efaf1b942ce26958f1342dabc01877967dce7e04080217901a0", "hex"))
  //   //   .addUint8(27)

  // try {
      
  //   const params = new ContractFunctionParameters()
  //     .addBytes32(Buffer.from("d7e866d6055676682a27c6054e657de97382177e51344bc269e196c998672c40", "hex")) // 'Hello Hedera'
  //     .addBytes32(Buffer.from("2cfe1113bb645efaf1b942ce26958f1342dabc01877967dce7e04080217901a0", "hex")) // 'Hello Hedera'
  //     .addUint8(27)                                                                                       // 'Hello Hedera'
  //     .addBytes32(Buffer.from("c1fd562d42cca69b6391ac9300d706fb58c4ca3aa110d408e39ac8cbc24fb831", "hex")) 
  //   // const query = new ContractExecuteTransaction()
    
  //   const query = new ContractCallQuery()
  //     .setContractId(ContractId.fromString(contractId))
  //     .setGas(4_000_000)
  //     .setFunction(
  //       'verify',
  //       params
  //     )
  //   const cost = await query.getCost(client) // calc the precise cost of the query
  //   query.setQueryPayment(cost)

  //   const result = await query.execute(client)
  //   // const record = await result.getRecord(client)
  //   // console.log(`recovered address: ${ record.contractFunctionResult?.getAddress(0)}`);
  //   // const receipt = await result.getReceipt(client)
  //   // console.log('Done. Receipt status: ', receipt.status.toString())
  //   console.log(`result.getAddress(0): ${result.getAddress(0)}`)
  // } catch (err) {
  //   console.error('Contract call failed:', err)
  // }

  // console.log('---')
  // process.exit(0)


  try {
    // const signatureBlob = Buffer.concat([
    //   Buffer.from("d7e866d6055676682a27c6054e657de97382177e51344bc269e196c998672c40", "hex"),
    //   Buffer.from("2cfe1113bb645efaf1b942ce26958f1342dabc01877967dce7e04080217901a0", "hex"),
    //   Buffer.from("1b", "hex")
    // ])
    // console.log(`signatureBlob (hex) (len=${signatureBlob.length}): ${signatureBlob.toString("hex")}`)
    // const publicKeyUncompressed = Buffer.from("b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac07877797463801696a719b35cb1d68f60675a91af5819dd710bd651debab70dcb16f", "hex")
    // const compressedPubKey = Buffer.from("03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787", "hex")
    // const messageHash = Buffer.from("84575e7983039d2ed8f0d6b420e19f811cc3e5245056a6b30d1fddd0c15c5ac1", "hex")
    // const r = Buffer.from("5f6ab0f07c9eb4e64c4ec9a64887de567912b277d3ababd58e9cefbe946d83f1", "hex")
    // const s = Buffer.from("2895d0c124c4d5f2b2ce58a01c1c82724b7cfd51cc7d82c9947c2dac3e46bb97", "hex")
    // const v = 27
    // const signatureBlob = Buffer.concat([r, s, v])
    // console.log(`signatureBlob (hex) (len=${signatureBlob.length}): ${signatureBlob.toString("hex")}`)
    // const params = new ContractFunctionParameters()
    //   .addAddress("0x" + evmAddHex)
    //   .addBytes(Buffer.from(keccakHex, "hex"))
    //   .addBytes(Buffer.from(sigHex, "hex"))
    //   // .addUint8(v)
    //   // .addBytes32(r) // r
    //   // .addBytes32(s) // s 
    // const query = new ContractExecuteTransaction()
    //   .setContractId(ContractId.fromString(contractId))
    //   .setGas(8_000_000)
    //   .setFunction(
    //     'verifyHAS',
    //     params
    //   )


    const params = new ContractFunctionParameters()
      // .addAddress('0x' + evmAddHex)
      .addBytes32(r)
      .addBytes32(s)
      .addUint8(v)
      .addBytes32(keccak)
    // const query = new ContractExecuteTransaction()
    //   .setContractId(ContractId.fromString(contractId))
    //   .setGas(8_000_000)
    //   .setFunction('verifyHash', params)
   
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromString(contractId))
      .setGas(100_000)
      .setFunction('verify', params)

    // const cost = await query.getCost(client)

    const result = await query
      // .setQueryPayment(cost)
      .execute(client)
    console.log(`result.getAddress(0): ${result.getAddress(0)}`)

    // const record = await result.getRecord(client)
    // console.log(`${JSON.stringify(record.contractFunctionResult)}`);
    // console.log(`boolean: ${record.contractFunctionResult?.getBool(0)}`);
    // const receipt = await result.getReceipt(client)
    // console.log('Done. Receipt status: ', receipt.status.toString())
  } catch (err) {
    console.error('Contract call failed:', err)
  }

//   verify(
//     0x84575e7983039d2ed8f0d6b420e19f811cc3e5245056a6b30d1fddd0c15c5ac1,

//     0x5f6ab0f07c9eb4e64c4ec9a64887de567912b277d3ababd58e9cefbe946d83f1,
//     0x2895d0c124c4d5f2b2ce58a01c1c82724b7cfd51cc7d82c9947c2dac3e46bb97,
//     27,

//     "b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787"
//     "7797463801696a719b35cb1d68f60675a91af5819dd710bd651debab70dcb16f"
// )

  // try {
  //   const params = new ContractFunctionParameters()
  //     .addAddress("0x440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6")
  //     .addBytes32(messageHash)
  //     .addBytes(signature)
  //   const query = new ContractExecuteTransaction()
  //     .setContractId(ContractId.fromString(contractId))
  //     .setGas(4_000_000)
  //     .setFunction(
  //       'isAuthorizedRaw',
  //       params
  //     )

  //   const result = await query.execute(client)
  //   const receipt = await result.getReceipt(client)
  //   console.log('Done. Receipt status: ', receipt.status.toString())
  // } catch (err) {
  //   console.error('Contract call failed:', err)
  // }
}

// const deriveRSV = async (messageHash: Uint8Array, signature: Uint8Array, expectedPublicKey: Uint8Array): Promise<[Uint8Array, Uint8Array, number]> => {
//   if (signature.length !== 64) {
//     throw new Error('Invalid signature length. Expected 64 bytes.')
//   }

//   const r = signature.slice(0, 32)
//   const s = signature.slice(32, 64)

//   // Try both recovery IDs (0 and 1)
//   const recoveryIds = [0, 1]
//   for (const recoveryId of recoveryIds) {
//     const recoveredPubKey = recoverPublicKey(messageHash, new Uint8Array([...r, ...s]), { prehash: Boolean(recoveryId) })
//     if (Buffer.from(recoveredPubKey).toString('hex') === Buffer.from(expectedPublicKey).toString('hex')) {
//       const v = recoveryId + 27 // Ethereum-style v (27 or 28)
//       return [r, s, v]
//     }
//   }

//   throw new Error('Failed to derive v. Public key does not match.')
// }


;(async () => {
  await main()
  process.exit(0)
})()
