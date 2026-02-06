import {
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
} from '@hashgraph/sdk'
import { initHederaClient } from './lib/hedera.ts'
import { netConf, networkSelected, operatorAccountId, operatorKeyType } from './constants.ts'

const [ client, _ ] = initHederaClient(
  networkSelected,
  operatorAccountId,
  operatorKeyType
)

const main = async () => {
  // CLI args: contractId, amount
  const [contractId, collateralUSDC, nPositionTokens] = process.argv.slice(2)
  if (!contractId || !collateralUSDC || !nPositionTokens) {
    console.error(`Usage: ts-node buy.ts <contractId> <collateralUSDC> <nPositionTokens>`)
    process.exit(1)
  }
  const yesAccount = client.operatorPublicKey!.toEvmAddress() // TODO - make yesAccount and noAccount different accounts...
  const noAccount = client.operatorPublicKey!.toEvmAddress()

  try {
    client.operatorAccountId!.toEvmAddress()
  } catch (err) {
    console.error('Invalid userAccountId:', client.operatorAccountId, err)
    process.exit(1)
  }

  console.log(`netConf[${networkSelected}].usdcContractId: ${netConf[networkSelected].usdcContractId}`)
  console.log(`contractId: ${contractId} - ${ContractId.fromString(contractId).toEvmAddress()}`)

  try {
    const collateralUSDCx100 = parseFloat(collateralUSDC) * 100 // rounding up to 2 decimal places acceptable
    const collateralUSDCbig = BigInt(collateralUSDCx100) * BigInt(10 ** netConf[networkSelected].usdcDecimals) / BigInt(100)
    const nPositionTokensBig = BigInt(nPositionTokens)
    console.log(`Buying ${nPositionTokensBig} position tokens (both buy and sell side) with ${collateralUSDCbig} (USDC base units) as collateral (x2)...`)
    
    // 1. Approve the PredictionMarket contract to spend user's USDC collateral tokens (x2)
    const approveTx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(netConf[networkSelected].usdcContractId).toEvmAddress())
      .setGas(10_000_000)
      .setFunction('approve',
        new ContractFunctionParameters()
          .addAddress(ContractId.fromString(contractId).toEvmAddress())
          .addUint256((collateralUSDCbig * BigInt(2)).toString())) /** Note: x2 since buy side and sell side are from the same account...**/
      .execute(client)
    
    const approveReceipt = await approveTx.getReceipt(client)
    console.log('approve status:', approveReceipt.status.toString())

  
    // 2) verify allowance (optional)
    const allowanceQuery = await new ContractCallQuery()
      .setContractId(ContractId.fromString(netConf[networkSelected].usdcContractId).toEvmAddress())
      .setGas(100_000)
      .setFunction('allowance',
        new ContractFunctionParameters()
          .addAddress(client.operatorPublicKey!.toEvmAddress())
          .addAddress(ContractId.fromString(contractId).toEvmAddress()))
      .execute(client)

    const allowance = allowanceQuery.getUint256(0).toString()
    console.log(`allowance now [${netConf[networkSelected].usdcDecimals} decimals]: ${allowance}`)

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


     // 4) buy outcome tokens on behalf of another account which has an allowance set (buyPositionTokensOnBehalf)
    console.log(`*** client.operatorAccountId!.toEvmAddress(): ${client.operatorAccountId!.toEvmAddress()}`);
    const params = new ContractFunctionParameters()
      .addAddress(yesAccount)
      .addAddress(noAccount)
      .addUint256(collateralUSDCbig.toString()) // collateralUSDC
      .addUint256(nPositionTokensBig.toString()) // nPositionTokens
    const buyTx4 = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(2_000_000) // approx 1 million per USDC transfer (two USDC transfers in the atomic function)
      .setFunction(
        'buyPositionTokensOnBehalfAtomic',
        params
      )
      .execute(client)

    const buyReceipt4 = await buyTx4.getReceipt(client);
    console.log('buyPositionTokensOnBehalf status:', buyReceipt4.status.toString());
 
 
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
