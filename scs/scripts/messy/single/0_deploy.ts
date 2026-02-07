import { Client, ContractCreateFlow, ContractId } from '@hashgraph/sdk'
import { ethers } from 'ethers'
import * as fs from 'fs'
import { initHederaClient } from './lib/hedera.ts'
import { __dirname } from './lib/utils.ts'
import { netConf, networkSelected, operatorAccountId, operatorKeyType } from './constants.ts'

const [ client, _ ] = initHederaClient(
  networkSelected,
  operatorAccountId,
  operatorKeyType
)

const smartContractBinaryFn = __dirname + '/../../contracts/out/PredictionMarket.bin'

const getConstructorParams = () => {
  const collateralToken = ContractId.fromString(netConf[networkSelected].usdcContractId).toEvmAddress() // USD Coin (USDC) on Hedera
  const statement = 'HBAR will be above USD $1.00 on 2025-12-31?'
  // const resolutionTime = 0

  const abiCoder = new ethers.AbiCoder()
  return abiCoder.encode(
      ['address', 'string'],
      [collateralToken, statement]
  )

  // const name = 'MyToken'
  // const symbol = 'MTK'
  // const initialSupply = 1_000_000 // 1 million tokens
  // const decimals = 8
  // const reservedFor = '0x0000000000000000000000000000000000477f50' // 0.0.0.0.4685648

  // const abiCoder = new ethers.AbiCoder()
  // return abiCoder.encode(
  //     ['string', 'string', 'uint256', 'uint8', 'address'],
  //     [name, symbol, initialSupply, decimals, reservedFor]
  // )
}

const readContractBytecode = (path: string): string => {
  return fs.readFileSync(path, 'utf8')
}

async function deployContract(client: Client) {
  try {
    /////
    // Step 1: Deploy the smart contract
    /////
    console.log('Deploying smart contract...')
    // Encode the constructor parameters
    const constructorParams = getConstructorParams()

    // Read the compiled contract bytecode (replace with actual path to the bytecode file)
    const contractBytecode = readContractBytecode(smartContractBinaryFn) // bytecode of the compiled contract

    // Combine bytecode and constructor parameters
    const bytecodeWithParams = contractBytecode + constructorParams.slice(2) // Remove "0x" from params

    // Create the contract creation flow transaction
    const contractCreateTx = new ContractCreateFlow()
        .setGas(15_000_000)
        .setBytecode(bytecodeWithParams)
        // .setAdminKey(client.operatorPublicKey!) // N.B. NO!! naive way to associate external tokens!

    // Sign and execute the transaction
    const contractResponse = await contractCreateTx.execute(client)
    const contractReceipt = await contractResponse.getReceipt(client)

    // Get the contract ID
    const contractId = contractReceipt.contractId

    console.log(`Contract deployed with ID: ${contractId}`)
    console.log(`export SMART_CONTRACT_ID=${contractId}`)

    /////
    // This is not acceptable as it requires an admin key on the contract!
    // Solution: call associateToken() in Solidity...
    // Step 2: N.B. associate USDC token with the new contract (so it can hold USDC)
    /////
  //   console.log('*** Step 2...')
  //   const tx = await new TokenAssociateTransaction()
  //     .setAccountId(AccountId.fromString('0.0.7090671'))   // the account to associate (can be a contract id)
  //     .setTokenIds(['0.0.5449']) // the token to associate
  //     .freezeWith(client)
  //   // console.log(operatorPrivateKey.toStringRaw())
  //   // Sign with the key that controls the contract account (often the deployer/operator key)
  //   const signed = await tx.sign(operatorPrivateKey)
  //   const resp = await signed.execute(client)
  //   const receipt = await resp.getReceipt(client)
  //   console.log(`Token associate [${netConf[networkSelected].usdcContractId}] status: ${receipt.status.toString()}`)
  } catch (err) {
    console.error('Contract deployment failed:', err)
    process.exit(1)
  }
}

(async () => {
  await deployContract(client)

  console.log(`accountId=${operatorAccountId}`)

  process.exit(0)
})()
