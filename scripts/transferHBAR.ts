// export HEDERA_OPERATOR_KEY=.... # no 0x prefix...
// ts-node transferHBAR.ts
import { Client, PrivateKey, TransferTransaction, AccountBalanceQuery, Hbar } from '@hashgraph/sdk'
type Net = 'previewnet' | 'testnet' | 'mainnet'
type KeyType = 'ed25519' | 'ecdsa'

const from = '0.0.8062' // portal.hedera.com
const to = '0.0.31052'
const amountHbar = 999

const net: Net = 'previewnet'
const HEDERA_OPERATOR_ID=from // no 0x prefix
const keyType: KeyType = 'ecdsa'

if (!process.env.HEDERA_OPERATOR_KEY) {
  console.error(`Error: HEDERA_OPERATOR_KEY for "${from}" is not set.`)
  process.exit(1)
}

async function main() {
  // Load operator credentials
  const operatorId = HEDERA_OPERATOR_ID
  let operatorKey: PrivateKey
  if (keyType === 'ecdsa') {
    operatorKey = PrivateKey.fromStringECDSA(
      process.env.HEDERA_OPERATOR_KEY!
    )
  } else if (keyType === 'ed25519') {
    operatorKey = PrivateKey.fromStringED25519(
      process.env.HEDERA_OPERATOR_KEY!
    )
  } else {
    throw new Error(`Unsupported key type: ${keyType}`)
  }

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

  // Create transfer transaction
  const transferTx = await new TransferTransaction()
    .addHbarTransfer(from, new Hbar(0 - amountHbar)) // sender
    .addHbarTransfer(to, new Hbar(amountHbar))    // receiver
    .execute(client)

  // Get transaction receipt
  const receipt = await transferTx.getReceipt(client)
  console.log('Transfer status:', receipt.status.toString())

  console.log(`Transfer of ${amountHbar} HBAR from ${from} to ${to} successful. Transaction ID: ${transferTx.transactionId.toString()}`)

  // Check balances
  const fromBalance = await new AccountBalanceQuery()
    .setAccountId(from)
    .execute(client)
  const toBalance = await new AccountBalanceQuery()
    .setAccountId(to)
    .execute(client)

  console.log(`New balance of ${from}: ${fromBalance.hbars.toString()}`)
  console.log(`New balance of ${to}: ${toBalance.hbars.toString()}`)
}


(async () => {
  try {
    await main()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
})()