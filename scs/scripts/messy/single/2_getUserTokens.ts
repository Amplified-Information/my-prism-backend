import {
  ContractCallQuery,
  ContractFunctionParameters,
  ContractId,
} from '@hashgraph/sdk'
import { initHederaClient } from './lib/hedera.ts'
import { networkSelected, operatorAccountId, operatorKeyType } from './constants.ts'
import { getEvmAddress } from './lib/utils.ts';

const [ client, _ ] = initHederaClient(
  networkSelected,
  operatorAccountId,
  operatorKeyType
)

const main = async () => {
  // CLI args: contractId, userAccountEvmAddress
  const [contractId, accountId] = process.argv.slice(2)
  if (!contractId || !accountId) {
    console.error(`Usage: ts-node getUserTokens.ts <contractId> <accountId>\t\t(note: current operator account id = ${operatorAccountId})`)
    process.exit(1)
  }

  console.log(`Calling getUserTokens on contract ${contractId} (${ContractId.fromString(contractId).toEvmAddress()})`)

  const accountIdEvm = await getEvmAddress(client, accountId)
  console.log(`evm address for ${accountId}: ${accountIdEvm}`)

  try {
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromString(contractId))
      .setGas(100_000)
      .setFunction(
        'getUserTokens',
        new ContractFunctionParameters().addAddress(accountIdEvm)
      )

    const result = await query.execute(client)

    // getUint256 returns BigNumber-like object; convert to string
    const yes = result.getUint256(0).toString()
    const no = result.getUint256(1).toString()

    console.log(`getUserTokens(${accountId}/${accountIdEvm}) => yes=${yes}, no=${no}`)
  } catch (err) {
    console.error('Contract call failed:', err)
    process.exit(1)
  }
}

;(async () => {
  await main()
  process.exit(0)
})()
