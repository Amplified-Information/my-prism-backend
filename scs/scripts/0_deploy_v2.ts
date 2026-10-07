/**
 * Deploy PrismV2 and its ERC-1967 proxy, with initialization performed atomically
 * in the proxy constructor.
 *
 * Required environment variables (prefix with TESTNET_, PREVIEWNET_, or MAINNET_):
 *   USDC_ADDRESS, PRISM_V2_OWNER_ID, PRISM_V2_OPERATOR_ID,
 *   PRISM_V2_ORACLE_ID, PRISM_V2_DAO_ID, PRISM_V2_RAKE_BPS
 *
 * Mainnet additionally requires:
 *   CONFIRM_MAINNET_DEPLOY=PRISM_V2_MAINNET
 *
 * Compile first from scs/scripts:
 *   ./0_compile.sh PrismV2
 *   ./0_compile.sh Proxy
 *   npx tsx 0_deploy_v2.ts
 */
import {
  AccountId,
  Client,
  ContractCallQuery,
  ContractCreateFlow,
  ContractExecuteTransaction,
  ContractId,
  ContractInfoQuery,
  Hbar,
  TokenId,
} from '@hashgraph/sdk'
import { ethers } from 'ethers'
import * as fs from 'fs'
import { initHederaClient } from './lib/hedera.ts'
import { __dirname } from './lib/utils.ts'

const DEPLOY_GAS = 15_000_000
const QUERY_GAS = 100_000
const ASSOCIATION_GAS = 800_000
const DEPLOY_MAX_TX_FEE_HBAR = 50
const MAX_RAKE_BPS = 1_000

const [client, networkSelected] = initHederaClient()
const networkPrefix = networkSelected.toUpperCase()

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value || value === 'TBD' || value.includes('<')) {
    throw new Error(`${name} must be set to a real deployment value`)
  }
  return value
}

function accountAddress(name: string): string {
  return `0x${AccountId.fromString(required(name)).toEvmAddress()}`
}

function artifact(name: string): string {
  const path = `${__dirname}/../../contracts/out/${name}.bin`
  if (!fs.existsSync(path)) {
    throw new Error(`Missing ${path}; compile the V2 contracts before deploying`)
  }
  const bytecode = fs.readFileSync(path, 'utf8').trim()
  if (!/^[0-9a-fA-F]+$/.test(bytecode)) {
    throw new Error(`Invalid bytecode in ${path}`)
  }
  return bytecode
}

async function deploy(client_: Client, bytecode: string, constructorData = '0x'): Promise<ContractId> {
  const response = await new ContractCreateFlow()
    .setGas(DEPLOY_GAS)
    .setBytecode(bytecode + constructorData.slice(2))
    .execute(client_)
  const receipt = await response.getReceipt(client_)
  if (!receipt.contractId) throw new Error('Deployment completed without a contract ID')
  return receipt.contractId
}

async function queryAddress(proxyId: ContractId, functionName: string): Promise<string> {
  const result = await new ContractCallQuery()
    .setContractId(proxyId)
    .setGas(QUERY_GAS)
    .setFunction(functionName)
    .execute(client)
  return ethers.getAddress(`0x${result.getAddress(0)}`)
}

async function queryUint(proxyId: ContractId, functionName: string): Promise<string> {
  const result = await new ContractCallQuery()
    .setContractId(proxyId)
    .setGas(QUERY_GAS)
    .setFunction(functionName)
    .execute(client)
  return result.getUint256(0).toString()
}

async function associateAndVerifyCollateral(proxyId: ContractId, collateralId: TokenId): Promise<void> {
  const response = await new ContractExecuteTransaction()
    .setContractId(proxyId)
    .setGas(ASSOCIATION_GAS)
    .setFunction('associateCollateralToken')
    .execute(client)
  const receipt = await response.getReceipt(client)
  if (receipt.status.toString() !== 'SUCCESS') {
    throw new Error(`Collateral association failed with status ${receipt.status.toString()}`)
  }

  const contractInfo = await new ContractInfoQuery()
    .setContractId(proxyId)
    .execute(client)
  if (!contractInfo.tokenRelationships.get(collateralId)) {
    throw new Error(`Post-deploy verification found no ${collateralId.toString()} relationship on proxy ${proxyId.toString()}`)
  }
}

async function main(): Promise<void> {
  if (networkSelected === 'mainnet' && process.env.CONFIRM_MAINNET_DEPLOY !== 'PRISM_V2_MAINNET') {
    throw new Error('Mainnet deployment requires CONFIRM_MAINNET_DEPLOY=PRISM_V2_MAINNET')
  }

  const collateralId = TokenId.fromString(required(`${networkPrefix}_USDC_ADDRESS`))
  const collateral = `0x${collateralId.toSolidityAddress()}`
  const owner = accountAddress(`${networkPrefix}_PRISM_V2_OWNER_ID`)
  const operator = accountAddress(`${networkPrefix}_PRISM_V2_OPERATOR_ID`)
  const oracle = accountAddress(`${networkPrefix}_PRISM_V2_ORACLE_ID`)
  const dao = accountAddress(`${networkPrefix}_PRISM_V2_DAO_ID`)
  const rakeRaw = required(`${networkPrefix}_PRISM_V2_RAKE_BPS`)
  if (!/^\d+$/.test(rakeRaw)) throw new Error(`${networkPrefix}_PRISM_V2_RAKE_BPS must be an integer`)
  const rakeBps = Number(rakeRaw)
  if (!Number.isSafeInteger(rakeBps) || rakeBps < 0 || rakeBps > MAX_RAKE_BPS) {
    throw new Error(`${networkPrefix}_PRISM_V2_RAKE_BPS must be between 0 and ${MAX_RAKE_BPS}`)
  }
  if (networkSelected === 'mainnet' && (owner === operator || owner === oracle)) {
    throw new Error('Mainnet owner must be separate from the operator and oracle roles')
  }
  const deployer = `0x${client.operatorAccountId!.toEvmAddress()}`
  if (ethers.getAddress(deployer) !== ethers.getAddress(owner)) {
    throw new Error(`${networkPrefix}_HEDERA_OPERATOR_ID must equal ${networkPrefix}_PRISM_V2_OWNER_ID so deployment can associate the proxy with USDC`)
  }

  client.setDefaultMaxTransactionFee(new Hbar(DEPLOY_MAX_TX_FEE_HBAR))
  console.log(`Deploying PrismV2 implementation on ${networkSelected}...`)
  const implementationId = await deploy(client, artifact('PrismV2'))
  const implementationAddress = `0x${implementationId.toEvmAddress()}`

  const prismInterface = new ethers.Interface([
    'function initialize(address collateralToken,address owner,address operator,address oracle,address dao,uint16 defaultRakeBps)',
  ])
  const initializationData = prismInterface.encodeFunctionData('initialize', [
    collateral,
    owner,
    operator,
    oracle,
    dao,
    rakeBps,
  ])
  const proxyConstructor = ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'bytes'],
    [implementationAddress, initializationData],
  )

  console.log('Deploying and atomically initializing PrismProxy...')
  const proxyId = await deploy(client, artifact('PrismProxy'), proxyConstructor)
  const proxyAddress = `0x${proxyId.toEvmAddress()}`

  console.log(`Associating PrismProxy with collateral token ${collateralId.toString()}...`)
  await associateAndVerifyCollateral(proxyId, collateralId)

  const expectedAddresses: Record<string, string> = { collateralToken: collateral, owner, operator, oracle, dao }
  for (const [getter, expected] of Object.entries(expectedAddresses)) {
    const actual = await queryAddress(proxyId, getter)
    if (actual !== ethers.getAddress(expected)) {
      throw new Error(`Post-deploy verification failed for ${getter}: expected ${expected}, got ${actual}`)
    }
  }
  const actualRake = await queryUint(proxyId, 'defaultRakeBps')
  if (actualRake !== rakeBps.toString()) {
    throw new Error(`Post-deploy verification failed for defaultRakeBps: ${actualRake}`)
  }

  console.log(JSON.stringify({
    network: networkSelected,
    implementationId: implementationId.toString(),
    implementationAddress,
    proxyId: proxyId.toString(),
    proxyAddress,
    collateral: ethers.getAddress(collateral),
    collateralId: collateralId.toString(),
    collateralAssociated: true,
    owner: ethers.getAddress(owner),
    operator: ethers.getAddress(operator),
    oracle: ethers.getAddress(oracle),
    dao: ethers.getAddress(dao),
    rakeBps,
    verified: true,
  }, null, 2))
}

main()
  .catch((error: unknown) => {
    console.error('PrismV2 deployment failed:', error)
    process.exitCode = 1
  })
  .finally(() => client.close())
