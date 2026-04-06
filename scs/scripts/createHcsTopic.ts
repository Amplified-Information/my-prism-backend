/**
ts-node hcsTopic.ts
*/
import { TopicCreateTransaction } from '@hashgraph/sdk'
import { initHederaClient } from './lib/hedera.ts'

const [ client, networkSelected, _] = initHederaClient()

const main = async () => {
  try {
    // pre-checks
    try {
      client.operatorAccountId!.toEvmAddress()
    } catch (err) {
      console.error('Invalid userAccountId:', client.operatorAccountId, err)
      process.exit(1)
    }

    console.log(`Creating a new HSC topic on network: ${networkSelected}...`)
   








    // OK - proceed
    // Create a new topic:
    
    const tx = await new TopicCreateTransaction()
      .setTopicMemo('prism.market HCS topic')
      .execute(client)

      const receipt = await tx.getReceipt(client)

      console.log('Topic ID:', receipt.topicId!.toString())
    // const params = new ContractFunctionParameters()
    //   .addAddress(ContractId.fromString(process.env[`${networkSelected.toString().toUpperCase()}_USDC_ADDRESS`]!).toEvmAddress())
    // const tx = await new ContractExecuteTransaction()
    //   .setContractId(ContractId.fromString(contractId))
    //   .setGas(800_000)
    //   .setFunction('associateToken', params)
    //   .execute(client)

    // const receipt = await tx.getReceipt(client)
    // console.log('Contract association:', receipt.status.toString())
  } catch (e) {
    console.error('Error creating a HCS topic:', e)
    process.exit(1)
  }
}

;(async () => {
  await main()
  process.exit(0)
})()