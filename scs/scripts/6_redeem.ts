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
  const [contractId, marketId_uuid7] = process.argv.slice(2)
  if (!contractId || !marketId_uuid7) {
    console.error(`Usage: ts-node redeem.ts <contractId> <marketId_uuid7>\t\t(note: current operator account id = ${operatorAccountId})`)
    process.exit(1)
  }
  const marketIdBigInt = uuid7_to_uint128(marketId_uuid7)

  console.log(`Calling "redeem(${marketId_uuid7})" on contract ${contractId} (${ContractId.fromString(contractId).toEvmAddress()})`)
  
  try {
    const params = new ContractFunctionParameters()
      .addUint128(marketIdBigInt.toString())
    const query = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(contractId))
      .setGas(1_000_000)
      .setFunction(
        'redeem',
        params
      )

    const result = await query.execute(client)
    const record = await result.getRecord(client)
    const receipt = await result.getReceipt(client)
    console.log(`amountUSDC recieved = ${record.contractFunctionResult!.getUint256(0).toString()} (check your hashpack wallet)` )
    console.log('Done. Receipt status: ', receipt.status.toString())
  } catch (err) {
    console.error('Contract call failed:', err)
    console.error('Perhaps the market is not yet resolved? Cannot redeem until market is resolved.')
    process.exit(1)
  }
}

;(async () => {
  await main()
  process.exit(0)
})()
