/*
Set:
export HEDERA_NETWORK_SELECTED=previewnet
export HEDERA_OPERATOR_ID=0.0.31052
export HEDERA_OPERATOR_KEY_TYPE=ecdsa

export HEDERA_OPERATOR_KEY=...

Example usage:
ts-node 4_constructPayload.ts $BUY_SELL $COLLATERAL_USD_FLOAT $EVM_ADDRESS $MARKET_ID $TX_ID
*/
import { assemblePayloadHexForSigning, prefixMessageToSign } from './lib/utils.ts'
import { keccak256 } from 'ethers'
import { initHederaClient } from './lib/hedera.ts'
// import { networkSelected, operatorAccountId, operatorKeyType } from './constants.ts'

const N_DECIMALS_USDC = 6

const main = async () => {
  // CLI args:
  const [priceUsd, qty, evmAddress, marketIdUuid7, txIdUuid7] = process.argv.slice(2)
  if (!priceUsd || !qty || !evmAddress || !marketIdUuid7 || !txIdUuid7) {
    console.error('Usage: ts-node constructPayload.ts <priceUsd> <qty> <accountEvmAddress> <marketIdUuid7> <txIdUuid7>')
    console.error('Example usage: ts-node constructPayload.ts $PRICE_USD $QTY $ACCOUNT_EVM_ADDRESS $MARKET_ID $TX_ID')
    console.error(`
export PRICE_USD=-0.5                   # price in USD [-1,1]
export QTY=0.011                        # quantity
export ACCOUNT_EVM_ADDRESS=000000000000000000000000000000000000794c # 0.0.31052 on previewnet
export MARKET_ID=0189c0a8-7e80-7e80-8000-000000000004
export TX_ID=019b70be-be62-758c-93ec-63bcb40a0e47
    `)
    process.exit(1)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [ _, __, privateKey ] = initHederaClient()

  const payloadHex = assemblePayloadHexForSigning(Number(priceUsd), Number(qty), evmAddress, marketIdUuid7, txIdUuid7, N_DECIMALS_USDC)
  console.log('Constructed payloadHex:', payloadHex)

  

  const keccakHex = keccak256(Buffer.from(payloadHex, 'hex')).slice(2)
  const keccak = Buffer.from(keccakHex, 'hex')
  console.log(`keccak (hex): ${keccakHex}`)
  const keccak64 = keccak.toString('base64') // an extra step...
  const keccakPrefixedStr = prefixMessageToSign(keccak64)
  console.log('')
  console.log(`keccakPrefixedStr (hex): ${Buffer.from(keccakPrefixedStr).toString('hex')}`)
  

  const signature = privateKey.sign(Buffer.from(keccakPrefixedStr))
  console.log('')
  console.log(`signature: ${Buffer.from(signature).toString('hex')}`)

  console.log('')
  console.log(`publicKey used: ${Buffer.from(privateKey.publicKey.toBytes()).toString('hex')}`)

  console.log('')
  console.log('hashpack equivalent sig: TBD')

  console.log('')
  console.log('sigObj: ')
}

(async () => {
  try {
    await main()
    process.exit(0)
  } catch (err) {
    console.error('Error in script execution:', err)
    process.exit(1)
  }
})()
