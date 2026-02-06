//  export HEDERA_OPERATOR_KEY=.... # no 0x prefix...
// ts-node transferHBAR_previewNet.ts
import {
  Client,
  TransferTransaction,
  PrivateKey,
  Hbar
} from '@hashgraph/sdk'

const HEDERA_OPERATOR_ID='0.0.8063'
const HEDERA_RECEIVER_ID='0.0.31019'
const amountHbar = 999

async function main() {
  // Load env vars
  const operatorId = HEDERA_OPERATOR_ID
  const operatorKey = PrivateKey.fromStringED25519(
    process.env.HEDERA_OPERATOR_KEY!
  )
  const receiverId = HEDERA_RECEIVER_ID

  // Create Previewnet client
  const client = Client.forPreviewnet()
  client.setOperator(operatorId, operatorKey)

  // Create transfer transaction
  const tx = await new TransferTransaction()
    .addHbarTransfer(operatorId, new Hbar(0 - amountHbar)) // sender
    .addHbarTransfer(receiverId, new Hbar(amountHbar))  // receiver
    .execute(client)

  // Get receipt
  const receipt = await tx.getReceipt(client)

  console.log('Transfer status:', receipt.status.toString())

  client.close()
}

main().catch(console.error)
