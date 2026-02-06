/*
ts-node 2_newMarket.ts 0189c0a8-7e80-7e80-8000-000000000001 "Will the price of BTC exceed $50,000 by the end of the year?"

ts-node 2_newMarket.ts 0189c0a8-7e80-7e80-8000-000000000002 "Will the next US election result in a Democratic president?"

ts-node 2_newMarket.ts 0189c0a8-7e80-7e80-8000-000000000003 "Will Ethereum switch to Proof of Stake by the end of the year?"
*/

import { ContractExecuteTransaction, ContractFunctionParameters, ContractId } from '@hashgraph/sdk'
import { initHederaClient } from './lib/hedera.ts'
import { uuid7_to_uint128 } from './lib/utils.ts'

const [ client, networkSelected ] = initHederaClient()

const main = async () => {
  try {
    // pre-checks:
    // CLI args
    const [marketId_uuid7, statement] = process.argv.slice(2)
    if (!marketId_uuid7 || !statement) {
      console.error(`
        MARKET_ID=$(printf '%08x-%04x-7%03x-%x%03x-%012x\n' \
        $(( $(date +%s%3N) >> 16 )) \
        $(( $(date +%s%3N) & 0xFFFF )) \
        $(( $(date +%s%3N) & 0x0FFF )) \
        $(( 8 + RANDOM % 4 )) \
        $(( RANDOM & 0x0FFF )) \
        $(( RANDOM<<24 | RANDOM<<12 | RANDOM )) )

        export MARKET_ID=0189c0a8-7e80-7e80-8000-000000000003
        export STATEMENT="Bitcoin will be over $100,000 end 2026"
      `)
      console.error('Usage: ts-node newMarket.ts <marketId_uuid7> <statement>')
      console.error('Usage example: ts-node 2_newMarket.ts $MARKET_ID $STATEMENT')
      console.error('--> Retrieve $MARKET_ID and the statement from the database or the frontend...')
      process.exit(1)
    }

    const marketIdBigInt = uuid7_to_uint128(marketId_uuid7)

    try {
      client.operatorAccountId!.toEvmAddress()
    } catch (err) {
      console.error('Invalid userAccountId:', client.operatorAccountId, err)
      process.exit(1)
    }

    const contractId = process.env[`${networkSelected.toString().toUpperCase()}_SMART_CONTRACT_ID`]
    if (!contractId) {
      console.error(`Error: ${networkSelected.toString().toUpperCase()}_SMART_CONTRACT_ID environment variable is not set.`)
      process.exit(1)
    }




    // OK - proceed
    console.log(`Smart contract:\t${contractId} (${ContractId.fromString(contractId).toEvmAddress()})`)
    console.log(`Creating a new market with marketId:\t${marketId_uuid7} (${marketIdBigInt.toString()})`)
    
    // Create and execute the ContractExecuteTransaction
    const params = new ContractFunctionParameters()
      .addUint128(marketIdBigInt.toString())
      .addString(statement)
    const tx = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(contractId))
      .setGas(500_000)
      .setFunction('createNewMarket', params)
      .execute(client)

    const receipt = await tx.getReceipt(client)
    console.log('createNewMarket: ', receipt.status.toString())
  } catch (e) {
    console.error('Error creating new market:', e)
    console.error('Error creating new market. Perhaps the market already exists?')
    console.error('Perhaps you need to set an allowance for the smart contract?')
    process.exit(1)
  }
}

;(async () => {
  await main()
  process.exit(0)
})()
