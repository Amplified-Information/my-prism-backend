import { TokenCreateTransaction, TokenType, TokenSupplyType } from '@hashgraph/sdk'
import { initHederaClient } from './lib/hedera.ts'

const TOKEN_NAME = 'Prism'
const TOKEN_SYMBOL = 'PRSM'
const DECIMALS = 6
const SUPPLY = 21_000_000

const [ client, networkSelected, operatorKey ] = initHederaClient()

const launchTokens = async () => {
  const publicKey = operatorKey.publicKey
  console.log(`Operator public key: ${publicKey.toString()}. Network: ${networkSelected.toString()}`)

  const transaction = await new TokenCreateTransaction()
    .setTokenName(TOKEN_NAME)
    .setTokenSymbol(TOKEN_SYMBOL)
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(DECIMALS)
    .setInitialSupply(SUPPLY)
    .setMaxSupply(SUPPLY)
    .setTreasuryAccountId(client.getOperator()!.accountId!)
    .setSupplyType(TokenSupplyType.Finite)
    // .setKycKey(operatorKey.publicKey) // KYC flag enabled
    .setMetadata(Buffer.from(JSON.stringify({ image: 'https://prism.market/prsm.png' })))
    // .setCustomFees()
    .freezeWith(client)
    .sign(operatorKey)

    const txResponse = await transaction.execute(client)
    const receipt = await txResponse.getReceipt(client)
    console.log(`Token created: ${TOKEN_NAME} (${TOKEN_SYMBOL}) -> Token ID: ${receipt.tokenId?.toString()}`)
}

(async () => {
  console.log('Launching token...')
  await launchTokens().catch(console.error)

  console.log('done.')
  process.exit(0)
})()