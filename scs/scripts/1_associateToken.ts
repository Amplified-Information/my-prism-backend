/**
ts-node 1_associateToken.ts
*/
import { ContractExecuteTransaction, ContractFunctionParameters, ContractId, TokenId } from '@hashgraph/sdk'
import { initHederaClient } from './lib/hedera.ts'

const [ client, networkSelected, _] = initHederaClient()

const main = async () => {
  try {
    // pre-checks

    const contractId = process.env[`${networkSelected.toString().toUpperCase()}_SMART_CONTRACT_ID`]
    if (!contractId) {
      console.error(`Error: ${networkSelected.toString().toUpperCase()}_SMART_CONTRACT_ID environment variable is not set.`)
      process.exit(1)
    }
    const tokenId = process.env[`${networkSelected.toString().toUpperCase()}_USDC_ADDRESS`]
    if (!tokenId) {
      console.error(`Error: ${networkSelected.toString().toUpperCase()}_USDC_ADDRESS environment variable is not set.`)
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









    // OK - proceed
    // Create and execute the ContractExecuteTransaction
    const params = new ContractFunctionParameters()
      .addAddress(ContractId.fromString(process.env[`${networkSelected.toString().toUpperCase()}_USDC_ADDRESS`]!).toEvmAddress())
    const tx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(contractId))
      .setGas(800_000)
      .setFunction('associateToken', params)
      .execute(client)

    const receipt = await tx.getReceipt(client)
    console.log('Contract association:', receipt.status.toString())
  } catch (e) {
    console.error('Error associating token:', e)
    console.error('Perhaps the token is already associated?')
    process.exit(1)
  }
}

;(async () => {
  await main()
  process.exit(0)
})()