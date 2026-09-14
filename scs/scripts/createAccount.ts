// source ../loadEnv.sh local
// npx tsx createAccount.ts
import { Client, PrivateKey, AccountCreateTransaction, Hbar } from '@hashgraph/sdk'
type Net = 'previewnet' | 'testnet' | 'mainnet'

const selectedNetwork = process.env.HEDERA_NETWORK_SELECTED
if (selectedNetwork !== 'previewnet' && selectedNetwork !== 'testnet' && selectedNetwork !== 'mainnet') {
  throw new Error(`Unsupported HEDERA_NETWORK_SELECTED: ${selectedNetwork ?? '(not set)'}`)
}
console.log('HEDERA_NETWORK_SELECTED:', selectedNetwork)

const net: Net = selectedNetwork
const networkPrefix = net.toUpperCase()
const operatorId = process.env[`${networkPrefix}_HEDERA_OPERATOR_ID`]
const operatorKeyType = process.env[`${networkPrefix}_HEDERA_OPERATOR_KEY_TYPE`]
const operatorKeyValue = process.env[`${networkPrefix}_HEDERA_OPERATOR_KEY`]

if (!operatorId) {
  throw new Error(`${networkPrefix}_HEDERA_OPERATOR_ID not set in environment variables`)
}
if (!operatorKeyType || !operatorKeyValue) {
  throw new Error(`${networkPrefix}_HEDERA_OPERATOR_KEY_TYPE and ${networkPrefix}_HEDERA_OPERATOR_KEY must be set in environment variables`)
}
const validatedOperatorId: string = operatorId
const validatedOperatorKeyValue: string = operatorKeyValue

const pubKeyPrefixECDSA = '302d300706052b8104000a0322000'
const privKeyPrefixECDSA = '3030020100300706052b8104000a04220420'

async function main() {
  // Load operator credentials
  const operatorKey = operatorKeyType === 'ecdsa'
    ? PrivateKey.fromStringECDSA(validatedOperatorKeyValue)
    : operatorKeyType === 'ed25519'
      ? PrivateKey.fromStringED25519(validatedOperatorKeyValue)
      : (() => { throw new Error(`Unknown ${networkPrefix}_HEDERA_OPERATOR_KEY_TYPE: ${operatorKeyType}`) })()

  // Create the client
  let client: Client
  if (net === 'previewnet') {
      client = Client.forPreviewnet()
  } else if (net === 'testnet') {
      client = Client.forTestnet()
  } else if (net === 'mainnet') {
      client = Client.forMainnet()
  } else {
      throw new Error(`Unsupported net: ${net}`)
  }
  client.setOperator(validatedOperatorId, operatorKey)
  
  // Generate keypair for the new account
  const newAccountKey = PrivateKey.generateECDSA()

  // Create the account
  const tx = await new AccountCreateTransaction()
    .setKeyWithoutAlias(newAccountKey.publicKey)
    .setInitialBalance(new Hbar(1)) // optional funding
    .execute(client)

  // Get receipt
  const receipt = await tx.getReceipt(client)
  const newAccountId = receipt.accountId!

  console.log('New account ID (ecdsa):', newAccountId.toString())
  console.log('Public key:', pubKeyPrefixECDSA + ' ' + newAccountKey.publicKey.toString().replace(pubKeyPrefixECDSA, ''))
  console.log('Private key:', privKeyPrefixECDSA + ' ' + newAccountKey.toString().replace(privKeyPrefixECDSA, ''))

  client.close()
}

main().catch(console.error)