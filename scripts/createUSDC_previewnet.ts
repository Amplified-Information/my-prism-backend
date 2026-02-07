
// export HEDERA_OPERATOR_KEY=.... # no 0x prefix...
// ts-node createUSDC_previewnet.ts
import { Client, PrivateKey, TokenCreateTransaction, TokenType, TokenSupplyType, TransferTransaction, AccountBalanceQuery } from '@hashgraph/sdk'
type Net = 'previewnet' | 'testnet' | 'mainnet'
type KeyType = 'ed25519' | 'ecdsa'

const net: Net = 'previewnet'
const HEDERA_OPERATOR_ID='0.0.31052'
const keyType: KeyType = 'ecdsa'

if (!process.env.HEDERA_OPERATOR_KEY) {
  console.error('Error: HEDERA_OPERATOR_KEY environment variable is not set.')
  process.exit(1)
}

const usdcDecimals = 6
const supply = 1_000_000_000_000 // 1 million USDC with 6 decimals





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


  // Create HTS token
  const tokenTx = await new TokenCreateTransaction()
    .setTokenName('USD Coin')
    .setTokenSymbol('USDC')
    .setTreasuryAccountId(operatorId)
    .setInitialSupply(supply)
    .setDecimals(usdcDecimals)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(supply)
    .setAdminKey(operatorKey.publicKey)
    .setSupplyKey(operatorKey.publicKey)
    .execute(client)

  // Get the token creation receipt
  const tokenReceipt = await tokenTx.getReceipt(client)
  const tokenId = tokenReceipt.tokenId!

  console.log(`Token created with ID: ${tokenId}`)

  // transfer 10_000 USDC to operator account
  const transferTx = await new TransferTransaction()
    .addTokenTransfer(tokenId, operatorId, -10_000) // Deduct from treasury account
    .addTokenTransfer(tokenId, operatorId, 10_000) // Credit to operator account
    .execute(client)

  const transferReceipt = await transferTx.getReceipt(client)
  console.log(`Transfer status: ${transferReceipt.status}`)

  // print USDC hts token balance of operator account
  const operatorBalance = await new AccountBalanceQuery()
    .setAccountId(operatorId)
    .execute(client)
  console.log(`Operator account USDC balance: ${operatorBalance.tokens!._map.get(tokenId.toString()) ?? 0}`)
  
  client.close()
}

await main().catch(console.error)

process.exit(0)
