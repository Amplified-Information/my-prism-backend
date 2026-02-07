/**
# To configure the correct Hedera network, edit:
.config
.secrets

# Now do:
source ../loadEnv.sh local

# Deploy with:
cd scripts
ts-node 0_deploy.ts Prism
*/
import { Client, ContractCreateFlow, ContractId } from '@hashgraph/sdk'
import { ethers } from 'ethers'
import * as fs from 'fs'
import { initHederaClient } from './lib/hedera.ts'
import { __dirname } from './lib/utils.ts'



const [contractName] = process.argv.slice(2)
if (!contractName) {
  console.error('Usage: ts-node deploy.ts <contractName>')
  console.error('Example: ts-node deploy.ts Prism')
  process.exit(1)
}

const [ client, networkSelected, _] = initHederaClient()

const smartContractBinaryFn = __dirname + `/../../contracts/out/${contractName}.bin`

const getConstructorParams = () => {
  console.log(`*** ${networkSelected} selected for deployment ***`)
  const usdcAddress = process.env[`${networkSelected.toString().toUpperCase()}_USDC_ADDRESS`]
  if (!usdcAddress) {
    throw new Error(`Environment variable ${networkSelected.toString().toUpperCase()}_USDC_ADDRESS not set`)
  }
  console.log(`USDC contract ID: ${usdcAddress}`)
  const collateralToken = ContractId.fromString(usdcAddress).toEvmAddress() // USD Coin (USDC) on Hedera
  // const statement = 'HBAR will be above USD $1.00 on 2025-12-31?'
  // const resolutionTime = 0

  const abiCoder = new ethers.AbiCoder()
  return abiCoder.encode(
      ['address'/*, 'string'*/],
      [collateralToken/*, statement*/]
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
    console.log(`Deploying smart contract ${smartContractBinaryFn.split('/').pop()} on "${networkSelected.toString}"...`)
    
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
    console.log(`--> export ${networkSelected.toString().toUpperCase()}_SMART_CONTRACT_ID=${contractId}`)
    console.log(`--> Don't forget to the smart contract ID for:
- scs (.config) + reload env vars
- api (.config.*) + reload env vars + restart
`)
    console.log('--> Don\'t forget to associate USDC!')
    console.log('--> Don\'t forget to create at least one new market!')
    console.log('--> Finally, you will need to set an allowance for the contract to spend USDC on behalf your account!')

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

  console.log(`accountId=${client.operatorAccountId!.toString()}`)

  process.exit(0)
})()
