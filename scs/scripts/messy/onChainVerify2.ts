import { AccountId, ContractCallQuery, ContractFunctionParameters, ContractId } from '@hashgraph/sdk'
import { networkSelected, operatorAccountId, operatorKeyType } from '../constants.ts'
import { initHederaClient } from '../lib/hedera.ts'
import { keccak256 } from 'ethers'

const contractId = '0.0.7368614'

const publicKeyHex = '03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787'
const evmAddress = '440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6'

const payload = 'Hello Future'
const sigHashpackHex = 'cba4e1fe36ca8d1249298b877c55032025e3c3b6417e8850e8234b2d2e263e3d49fa61159c9d1dd544cc769ad68afdf08a11d23694a651b97c1bf3d097b66eb8'

const keccakHex = keccak256(Buffer.from(payload, 'utf8')).slice(2)
const keccak = Buffer.from(keccakHex, 'hex').toString('utf8')


const [ client, _ ] = initHederaClient(
  networkSelected,
  operatorAccountId,
  operatorKeyType
)

const hello = async (): Promise<void> => {
  const result = await new ContractCallQuery()
    .setContractId(contractId)
    .setGas(100_000)
    .setFunction('hello')
    .execute(client)

  // Decode the result as a string
  const message = Buffer.from(result.bytes).toString('utf-8')
  console.log('Contract returned:', message)
}

const onChainVerify = async (messageHashHex: string, sigHex: string): Promise<void> => {
  const messageHash = Buffer.from(messageHashHex, 'hex')
  const sig = Buffer.from(sigHex, 'hex')

  console.log(evmAddress)
  console.log(messageHash)
  console.log(sig)

  // address account, bytes memory messageHash, bytes memory signature
  const params = new ContractFunctionParameters()
    .addAddress(evmAddress)
    .addBytes(messageHash)
    .addBytes(sig)
    
  try {
    const query = new ContractCallQuery() // read-only
      .setContractId(contractId)
      .setGas(1_000_000)
      .setFunction('isAuthorizedPublic', params)

    // const cost = await query.getCost(client)
    // console.log(`cost: ${cost}`)

    const response = await query
      // .setQueryPayment(cost)
      .execute(client)

    // const response = await query.execute(client)
    const isValid = response.getBool(0)
    const responseCode = response.getInt64(1)
    console.log(`isValid: ${isValid}, responseCode: ${responseCode}`)
  } catch (err) {
    console.error('Contract call failed:', err)
  }
}

(async () => {
  await hello()
  const result = await onChainVerify(keccakHex, sigHashpackHex)
  console.log(result)
  console.log(`contractId: ${contractId}, accountId: ${operatorAccountId}`)
  process.exit(0)
})()