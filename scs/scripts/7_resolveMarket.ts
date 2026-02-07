import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
} from '@hashgraph/sdk'
import { initHederaClient } from './lib/hedera.ts'
import { networkSelected, operatorAccountId, operatorKeyType } from './constants.ts'
import { uuid7_to_uint128 } from './utils.ts';

const [ client, _ ] = initHederaClient(
  networkSelected,
  operatorAccountId,
  operatorKeyType
)

const main = async () => {
  // CLI args: contractId, userAccountEvmAddress
  const [contractId, marketId_uuid7, noYesStr] = process.argv.slice(2)
  if (!contractId || !marketId_uuid7 || !noYesStr) {
    console.error('Usage: ts-node resolveMarket.ts <contractId> <marketId_uuid7> <noYes>')
    process.exit(1)
  }
  const marketIdBigInt = uuid7_to_uint128(marketId_uuid7)
  const noYes = noYesStr.toLowerCase().trim() === 'true' || noYesStr === '1'

  console.log(`Calling resolveMarket (marketId=${marketId_uuid7}, noYes=${noYes}) on contract ${contractId} (${ContractId.fromString(contractId).toEvmAddress()})`)
  
  try {
    const params = new ContractFunctionParameters()
      .addUint128(marketIdBigInt.toString())
      .addBool(noYes)
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
