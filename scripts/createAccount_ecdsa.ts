// export HEDERA_OPERATOR_KEY=.... # no 0x prefix...
// ts-node createAccount_ecdsa.ts
import { Client, PrivateKey, AccountCreateTransaction, Hbar } from '@hashgraph/sdk'
type Net = 'previewnet' | 'testnet' | 'mainnet'


const net: Net = 'previewnet'
const HEDERA_OPERATOR_ID='0.0.8062' // portal.hedera.com operator ID




const pubKeyPrefixECDSA = '302d300706052b8104000a0322000'
const privKeyPrefixECDSA = '3030020100300706052b8104000a04220420'

async function main() {
  // Load operator credentials
  const operatorId = HEDERA_OPERATOR_ID
  const operatorKey = PrivateKey.fromStringECDSA(
    process.env.HEDERA_OPERATOR_KEY!
  )

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
  client.setOperator(operatorId, operatorKey)
  
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
