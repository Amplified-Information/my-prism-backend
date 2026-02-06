import { ContractExecuteTransaction, ContractFunctionParameters, ContractId, TokenAssociateTransaction, TokenId } from '@hashgraph/sdk';
import { netConf, networkSelected, operatorAccountId, operatorKeyType } from './constants.ts'
import { initHederaClient } from './lib/hedera.ts'

const [ client ] = initHederaClient(
  networkSelected,
  operatorAccountId,
  operatorKeyType
)

const main = async () => {
  try {
    // CLI args: contractId, tokenId
    const [contractId, tokenId] = process.argv.slice(2)
    if (!contractId || !tokenId) {
      console.error('Usage: ts-node associateToken.ts <contractId> <tokenId>\t\t(note: USDC token address (testnet): 0.0.429274)')
      process.exit(1)
    }

    try {
      client.operatorAccountId!.toEvmAddress()
    } catch (err) {
      console.error('Invalid userAccountId:', client.operatorAccountId, err)
      process.exit(1)
    }

    console.log(`Smart contract:\t${contractId} (${ContractId.fromString(contractId).toEvmAddress()})`)
    console.log(`Associating token:\t${tokenId} (${TokenId.fromString(tokenId).toEvmAddress()}) with the smart contract ${contractId}...`)

    // Create and execute the ContractExecuteTransaction
    const tx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(contractId))
      .setGas(800_000)
      .setFunction("associateToken", new ContractFunctionParameters().addAddress(ContractId.fromString(netConf[networkSelected].usdcContractId).toEvmAddress()))
      .execute(client)

    const receipt = await tx.getReceipt(client)
    console.log("Contract association:", receipt.status.toString())
  } catch (e) {
    console.error('Error associating token:', e)
    console.error('Perhaps the token is already associated?')
    process.exit(1)
  }
}

// const main = async () => {
//   console.log('Associating token with the smart contract...')

//   try {
//     // CLI args: contractId, tokenId
//     const [contractId, tokenId] = process.argv.slice(2)
//     if (!contractId || !tokenId) {
//       console.error('Usage: ts-node associateToken.ts <contractId> <tokenId>')
//       process.exit(1)
//     }

//     try {
//       client.operatorAccountId!.toEvmAddress()
//     } catch (err) {
//       console.error('Invalid userAccountId:', client.operatorAccountId, err)
//       process.exit(1)
//     }

//     // Prepare call data manually with ABI encoding
//     const iface = new ethers.Interface([
//       "function associateToken(address account, address token) external returns (int64)"
//     ]);
//     const data = iface.encodeFunctionData("associateToken", ['0x' + ContractId.fromString(contractId).toEvmAddress(), '0x' + TokenId.fromString(tokenId).toEvmAddress()]);

//     console.log(`SMART_CONTRACT_ID:\t ${ContractId.fromString(contractId).toEvmAddress()} (${contractId})`)
//     console.log(`TOKEN_ID:\t\t ${TokenId.fromString(tokenId).toEvmAddress()} (${tokenId})`)
//     // Execute the call
//     const tx = await new ContractExecuteTransaction()
//       .setContractId(netConf[networkSelected].htsPrecompileContractId) // HTS precompile contract ID
//       .setFunctionParameters(toBeArray(data))
//       .setGas(800_000)
//       .execute(client)

//     const receipt = await tx.getReceipt(client)
//     console.log("Response code:", receipt.status.toString())
//   } catch (e) {
//     console.error('Error associating token:', e)
//     process.exit(1)
//   }
// }

;(async () => {
  await main()
  process.exit(0)
})()