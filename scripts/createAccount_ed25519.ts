// export HEDERA_OPERATOR_KEY=.... # no 0x prefix...
// ts-node createAccount_ed25519.ts
import { Client, PrivateKey, AccountCreateTransaction, Hbar } from '@hashgraph/sdk'
type Net = 'previewnet' | 'testnet' | 'mainnet'


const net: Net = 'previewnet'
const HEDERA_OPERATOR_ID='0.0.8063' // portal.hedera.com operator ID





const pubKeyPrefixED25519 = '302a300506032b6570032100'
const privKeyPrefixED25519 = '302e020100300506032b657004220420'

async function main() {
  // Load operator credentials
  const operatorId = HEDERA_OPERATOR_ID
  const operatorKey = PrivateKey.fromStringED25519(
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
  const newAccountKey = PrivateKey.generateED25519()

  // Create the account
  const tx = await new AccountCreateTransaction()
    .setKeyWithoutAlias(newAccountKey.publicKey)
    .setInitialBalance(new Hbar(1)) // optional funding
    .execute(client)

  // Get receipt
  const receipt = await tx.getReceipt(client)
  const newAccountId = receipt.accountId!

  console.log('New account ID (ed25519):', newAccountId.toString())
  console.log('Public key:', pubKeyPrefixED25519 + ' ' + newAccountKey.publicKey.toString().split(pubKeyPrefixED25519)[1])
  console.log('Private key:', privKeyPrefixED25519 + ' ' + newAccountKey.toString().split(privKeyPrefixED25519)[1])

  client.close()
}

main().catch(console.error)
