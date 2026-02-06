import * as ethers from 'ethers'
import { arrayify } from '../sig/utils.ts'
import { ContractCallQuery, ContractFunctionParameters, ContractId } from '@hashgraph/sdk'
import { networkSelected, operatorAccountId, operatorKeyType } from '../constants.ts'
import { initHederaClient } from '../lib/hedera.ts'

// CLI args: contractId, tokenId
const [contractId] = process.argv.slice(2)
if (!contractId) {
  console.error('Usage: ts-node sig.ts <contractId>')
  process.exit(1)
}

const privateKeyHex = '1620f5b23ed7467f6730bcc27b1b2c396f4ae92aec70f420bdd886ae26fed81d' // secret!
// const publicKey = '03b6e6702057a1b8be59b567314abecf4c2c3a7492ceb289ca0422b18edbac0787'
const msgStr = 'Hello Hedera'
// const msgStr = '\x19Hedera Signed Message:\n32' + ethers.keccak256(ethers.toUtf8Bytes(x)).slice(2)
// const msgStr = '{"marketId_uuid":"019a7e77-39e2-72a3-9bea-a63bdfa79d20","priceUsd_abs_scaled":"500000","txId_uuid":"019aab9a-e734-700a-87de-b383095ac8c6"}'
// const msgStr = '{"collateralUsd_abs_scaled":"11000","marketId_uuid":"019a7e77-39e2-72a3-9bea-a63bdfa79d20","txId_uuid":"019ac07d-f1c9-7104-8eca-855874d95ee6"}'
// const msg = ethers.toUtf8Bytes(msgStr)
// console.log(`---> ${ethers.toUtf8Bytes(msgStr)}`)
// console.log(`---> ${Uint8Array.from(Buffer.from(msgStr, 'utf8'))}`)
const msgHash = ethers.keccak256(ethers.toUtf8Bytes(msgStr)).slice(2) // 0x... (32 bytes)
// const msgHash = keccak
console.log(`msgHash (hex) (len=${Buffer.from(msgHash, 'hex').length}): ${msgHash}`)
const prefixStr = '\x19Hedera Signed Message:\n32'
const prefix = Buffer.from(prefixStr, 'utf8')
const prefixedHash = ethers.keccak256(ethers.concat([prefix, arrayify('0x' + msgHash)])).slice(2)
console.log(`prefixedHash (hex): ${prefixedHash}`)

/////
// off-chain sig generation:
/////
const offChain = async (): Promise<[Uint8Array, Uint8Array, number]> => {
  console.log('Performing off-chain signature generation and verification...')

  // Example: privateKey is "0x..."  (the ECDSA_SECP256K1 raw hex private key)
  const wallet = new ethers.Wallet(privateKeyHex)
  console.log(`wallet address: ${wallet.address}`)

  // sign the prefixedHash:
  const sig = await wallet.signingKey.sign('0x' + prefixedHash)
  console.log(`sig.serialized: ${sig.serialized}`)
  
  // sig has { r, s, v } fields:
  const rHex = sig.r.startsWith('0x') ? sig.r.slice(2) : sig.r
  const sHex = sig.s.startsWith('0x') ? sig.s.slice(2) : sig.s
  const vHex = sig.v.toString(16)
  console.log('r (hex):', rHex)
  console.log('s (hex):', sHex)
  console.log(`v (hex=, ${vHex}), (decimal=${Buffer.from(vHex, 'hex').readUInt8(0)})`) // 27 or 28

  // or get compact signature as 65-byte hex:
  const serializedSig = ethers.Signature.from(sig).serialized
  console.log(`serializedSig (hex) (len=${Buffer.from(serializedSig.slice(2), 'hex').length}):`, serializedSig.slice(2))
  // process.exit(0)
  // verify the sig:
  const recoveredAddress = ethers.recoverAddress(
    '0x' + prefixedHash,
    {
      r: sig.r,
      s: sig.s,
      v: sig.v
    }
  )
  console.log('recovered address:', recoveredAddress)
  console.log('original address: ', wallet.address)
  console.log('signature valid?', recoveredAddress === wallet.address)

  return [Buffer.from(rHex, 'hex'), Buffer.from(sHex, 'hex'), sig.v]
}

/////
// on-chain sig verificaiton:
/////
const [ client, _ ] = initHederaClient(
  networkSelected,
  operatorAccountId,
  operatorKeyType
)
const onChainVerify = async (r: Uint8Array, s: Uint8Array, v: number) => {
  console.log('Performing an equivalent on-chain sig check...')
  console.log(`*** contractId: ${contractId}`)
  console.log(`*** accountId: ${operatorAccountId}`)

  try {
    const params = new ContractFunctionParameters()
      .addBytes32(r)
      .addBytes32(s)
      .addUint8(v)
      .addBytes32(Buffer.from(prefixedHash, 'hex'))
      
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

;(async () => {
  const [r, s, v] = await offChain()
  await onChainVerify(r, s, v)
  r[r.length - 1] ^= 1 // flipping the last bit of r
  await onChainVerify(r, s, v)
  // r[r.length - 1] ^= 1 // flipping back the last bit of r
  // await onChainVerify(r, s, v)
  // s[s.length - 1] ^= 1 // flipping the last bit of s
  // await onChainVerify(r, s, v)
  // s[s.length - 1] ^= 1 // flipping back the last bit of s
  // await onChainVerify(r, s, v)
  process.exit(0)
})()
