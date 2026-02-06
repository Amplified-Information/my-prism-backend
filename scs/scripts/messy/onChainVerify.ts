import { ContractCallQuery, ContractFunctionParameters, ContractId } from '@hashgraph/sdk'
import { networkSelected, operatorAccountId, operatorKeyType } from '../constants.ts'
import { initHederaClient } from '../lib/hedera.ts'
import { ethers, keccak256 } from 'ethers'
// import { keccak256 } from '@noble/secp256k1'

// CLI args: contractId, tokenId
// const [contractId, publicKeyHex, payload, sigHex] = process.argv.slice(2)
// if (!contractId || !publicKeyHex || !payload || !sigHex) {
//   console.error('Usage: ts-node onChainVerify.ts <contractId> <publicKeyHex> <payload> <sigHex>')
//   process.exit(1)
// }
const privateKeyHex = '1620f5b23ed7467f6730bcc27b1b2c396f4ae92aec70f420bdd886ae26fed81d'

const contractId = '0.0.7330728' // process.env.SMART_CONTRACT_ID!
const publicKeyHex = '302d300706052b8104000a03220003b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787'
// const publicKeyHex = '03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787'
const payload = 'Hello Hedera'
const sigHex = ''

console.log(`publicKeyHex: ${publicKeyHex}`)
console.log(`payload: ${payload}`)
console.log(`sigHex: ${sigHex}`)

const [ client, _ ] = initHederaClient(
  networkSelected,
  operatorAccountId,
  operatorKeyType
)

const wallet = new ethers.Wallet(privateKeyHex)
console.log(`EVM address from private key: ${wallet.address.toLowerCase()}`)
console.log('---')

const verify = async () => {
  const textFormats: ('hex' | 'utf8')[] = ['hex', 'utf8']
  const payloadLens = [32, 64]

  // for (const textFormat of textFormats) {
  //   for (const payloadLen of payloadLens) {
  const payloadHashedHex = keccak256(ethers.toUtf8Bytes(payload)).slice(2)
  console.log(`payloadHashedHex (len=${payloadHashedHex.length}): ${payloadHashedHex}`)
  const payloadHashed = Buffer.from(payloadHashedHex, 'hex')
  console.log(`payloadHashed (len=${payloadHashed.length}): ${payloadHashed}`)

  const payloadHashedPrefixedHex = addPrefix(payloadHashed).slice(2)
  const payloadHashedPrefixed = Buffer.from(payloadHashedPrefixedHex, 'hex')
  // console.log(`payloadHashedPrefixedHex (len=${payloadHashedPrefixedHex.length}): ${payloadHashedPrefixedHex}`)
  // console.log(`payloadHashedPrefixed (len=${payloadHashedPrefixed.length}): ${payloadHashedPrefixed}`)
  const payloadHashedPrefixedHashedHex = ethers.keccak256(payloadHashedPrefixed).slice(2)
  console.log(`payloadHashedPrefixedHashedHex (len=${payloadHashedPrefixedHashedHex.length}): ${payloadHashedPrefixedHashedHex}`)
  const payloadHashedPrefixedHashed = Buffer.from(payloadHashedPrefixedHashedHex, 'hex')
  

  await calcSig(Buffer.from(payload))
  await calcSig(payloadHashed)
  await calcSig(payloadHashedPrefixed)
  await calcSig(payloadHashedPrefixedHashed)

  
  //   }
  // }
  
  

  // const rHex = sigHex.slice(0, 64)
  // const sHex = sigHex.slice(64, 128)
  // const v = 27
  // console.log('r (hex):', rHex)
  // console.log('s (hex):', sHex)
  // console.log(`v: ${v}`) // 27 or 28

  // const r = Uint8Array.from(Buffer.from(rHex, 'hex'))
  // const s = Uint8Array.from(Buffer.from(sHex, 'hex'))

  // await onChainVerify(r, s, v, payloadHashedPrefixedHashedHex)
}

const addPrefix = (input: Uint8Array): string => {
  return ethers.concat([
    ethers.toUtf8Bytes('\x19Hedera Signed Message:\n'),
    ethers.toUtf8Bytes(`${input.length}`),
    input
  ])
}

const calcSig = async (payload: Uint8Array) => {
  const sigHex = (await wallet.signMessage(payload)).slice(2)
  const sig = Buffer.from(sigHex, 'hex')
  // console.log(`sig (len=${sig.length}): ${sig}`)
  console.log(`sigHex (len=${sigHex.length}): ${sigHex}`)
}

const onChainVerify = async (r: Uint8Array, s: Uint8Array, v: number, hashHex: string) => {
  try {
    const params = new ContractFunctionParameters()
      .addBytes32(r)
      .addBytes32(s)
      .addUint8(v)
      .addBytes32(Uint8Array.from(Buffer.from(hashHex, 'hex')))
      
    const query = new ContractCallQuery() // read-only
      .setContractId(ContractId.fromString(contractId))
      .setGas(100_000)
      .setFunction('verify', params)

      // const cost = await query.getCost(client)
      const result = await query
        // .setQueryPayment(cost)
        .execute(client)
      console.log(`on-chain result.getAddress(0): ${result.getAddress(0)}`)
      console.log(`--> verify the returned address above mathes the evm address for ${operatorAccountId}!`)
      // console.log('signature valid?', wallet.address.toLowerCase() === '0x' + result.getAddress(0))
  } catch (err) {
    console.error('Contract call failed:', err)
  }
}

// const sign = async ( data: Uint8Array ): Promise<SignerSignature[]> => {
//   try {
//     const messageToSign = Buffer.from(data).toString('utf-8')

//     const { signatureMap } = await this.request<SignTransactionResult['result']>({
//       method: HederaJsonRpcMethod.SignMessage,
//       params: {
//         signerAccountId: this._signerAccountId,
//         message: messageToSign
//       }
//     })

//     const sigmap = base64StringToSignatureMap(signatureMap)
//     const signerSignature = new SignerSignature({
//       accountId: AccountId.fromString(accountId),
//       publicKey: PublicKey.fromBytes(sigmap.sigPair[0].pubKeyPrefix as Uint8Array),
//       signature:
//         (sigmap.sigPair[0].ed25519 as Uint8Array) ||
//         (sigmap.sigPair[0].ECDSASecp256k1 as Uint8Array),
//     })

//     console.log('Data signed successfully')
//     return [signerSignature]
//   } catch (error) {
//     console.log('Error signing data:', error)
//     throw error
//   }
// }

(async () => {
  await verify()
  process.exit(0)
})()