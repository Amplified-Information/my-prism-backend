import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
} from '@hashgraph/sdk'
import { initHederaClient } from './lib/hedera.ts'
import { networkSelected, operatorAccountId, operatorKeyType } from './constants.ts'

const [ client, _ ] = initHederaClient(
  networkSelected,
  operatorAccountId,
  operatorKeyType
)

const main = async () => {
  // CLI args: contractId, userAccountEvmAddress
  const [contractId, noYesStr] = process.argv.slice(2)
  if (!contractId || !noYesStr) {
    console.error('Usage: ts-node 4_resolveMarket.ts <contractId> <noYes>')
    process.exit(1)
  }

  const noYes = noYesStr.toLowerCase().trim() === 'true' || noYesStr === '1'

  console.log(`Calling resolveMarket (noYes=${noYes}) on contract ${contractId} (${ContractId.fromString(contractId).toEvmAddress()})`)
  
  try {
    const params = new ContractFunctionParameters() // .addAddress(accountIdEvm)
    params.addBool(noYes)
    const query = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(contractId))
      .setGas(100_000)
      .setFunction(
        'resolveMarket',
        params
      )

    const result = await query.execute(client)
    const receipt = await result.getReceipt(client)
    console.log('Done. Receipt status: ', receipt.status.toString())
  } catch (err) {
    console.error('Contract call failed:', err)
    console.error('Perhaps the market is already resolved?')
    process.exit(1)
  }
}

;(async () => {
  await main()
  process.exit(0)
})()
