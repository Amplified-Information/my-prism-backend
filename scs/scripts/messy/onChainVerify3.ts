/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * hedera-signature-helper.ts
 *
 * Purpose:
 *  - Build protobuf SignatureMap bytes for Hedera precompile `isAuthorized(...)`
 *  - Example: create ED25519 and ECDSA signatures, build SignatureMap, call HAS precompile wrapper
 *
 * Usage:
 *  - node (or ts-node) this file after adjusting addresses and keys for your environment.
 */

import { ethers } from 'ethers'
import nacl from 'tweetnacl'
import { Buffer } from 'buffer'
// @hashgraph/proto provides the generated protobuf types for Hedera (SignatureMap etc.)
import { SignatureMap, SignaturePair } from '@hashgraph/sdk'
// import { SignatureMap } from '@hashgraph/proto' 

// Helper types for local convenience
type SigType = 'ed25519' | 'ecdsa_secp256k1';
type SingleSig = {
  type: SigType;
  pubKeyPrefix?: Uint8Array; // optional - usually a prefix of the public key bytes used in SignaturePair.pubKeyPrefix
  signature: Uint8Array; // raw signature bytes (64 for ed25519, 64 or 65 for ecdsa)
};

/**
 * Build a Hedera SignatureMap protobuf blob from an array of signatures
 *
 * Each signature pair will be mapped to a SignaturePair with fields:
 *  - pubKeyPrefix (optional)
 *  - ed25519 (if ed25519)
 *  - ecdsaSecp256k1 (if ECDSA)
 *
 * The returned value is a Uint8Array suitable to pass as the `signatureBlob` arg to isAuthorized(...)
 */
export function buildSignatureMapBlob(sigs: SingleSig[]): Uint8Array {
  const sigPairs: any[] = sigs.map((s) => {
    const pair: any = {}

    if (s.pubKeyPrefix && s.pubKeyPrefix.length > 0) {
      pair.pubKeyPrefix = Buffer.from(s.pubKeyPrefix)
    }

    if (s.type === 'ed25519') {
      // ed25519 signatures are 64 bytes
      pair.ed25519 = Buffer.from(s.signature)
    } else if (s.type === 'ecdsa_secp256k1') {
      // Hedera SignaturePair expects ecdsaSecp256k1 as raw signature bytes (r||s).
      // Some flows expect r||s (64 bytes) — older flows sometimes pass 65-bytes with v; adjust if needed.
      // If you have a 65-byte r||s||v, you can strip v if the precompile expects 64 bytes.
      let sigBytes = s.signature
      if (sigBytes.length === 65) {
        // strip v by default to get r||s
        sigBytes = sigBytes.slice(0, 64)
      }
      pair.ecdsaSecp256k1 = Buffer.from(sigBytes)
    }

    return pair
  })

  const sigMap = SignatureMap.create({ sigPair: sigPairs as any[] })
  const buf = SignatureMap.encode(sigMap).finish()
  return Uint8Array.from(buf)
}

/**
 * Example: sign message with ED25519 (tweetnacl)
 */
export function signEd25519(message: Uint8Array, privateKeySeed: Uint8Array) {
  // privateKeySeed should be 32 bytes
  const keypair = nacl.sign.keyPair.fromSeed(privateKeySeed)
  const signature = nacl.sign.detached(message, keypair.secretKey)
  const pub = keypair.publicKey
  return { signature: Uint8Array.from(signature), pubKey: Uint8Array.from(pub) }
}

/**
 * Example: sign message with ECDSA/secp256k1 using ethers
 * Returns the 65-byte signature r||s||v (ethers default)
 */
export async function signEcdsaWithEthers(message: string | Uint8Array, signer: ethers.Wallet) {
  // If you pass a string message, ethers.signMessage will prefix and hash.
  // For precompile flows you often sign the raw digest (keccak256 of payload)
  // so we will produce a signature for the digest below.
  // For example, if `message` is a digest (32 bytes) we want to sign the digest (no prefix).
  // Ethers Wallet.signMessage prefixes by default; for raw digest sign use signDigest (private key signing).
  const messageBytes = typeof message === 'string' ? ethers.toUtf8Bytes(message) : message
  // compute digest (keccak256) if needed
  const digest = ethers.keccak256(messageBytes)

  // Wallet._signingKey().signDigest returns { r, s, v }
  const sig = signer._signingKey().signDigest(digest)
  // join r, s, v into 65 bytes
  const joined = ethers.joinSignature(sig) // returns 0x-prefixed hex
  const signatureBytes = ethers.getBytes(joined)
  return {
    signature: Uint8Array.from(signatureBytes), // 65 bytes r||s||v
    digest,
    r: sig.r,
    s: sig.s,
    v: sig.v
  }
}

/**
 * Example flow: create a signatureMap with one ED25519 signature and one ECDSA signature,
 * then call the Solidity precompile wrapper `isAuthorized(address alias, bytes message, bytes signatureBlob)`
 *
 * Assumes you have a deployed Solidity contract like the HasAuthExample earlier
 * where HAS precompile address is wrapped behind a contract method.
 */
export async function exampleInvoke(
  provider: ethers.Provider,
  contractAddress: string,
  contractAbi: any,
  aliasAddress: string, // 20-byte alias used in solidity as address
  message: Uint8Array
) {
  // Setup signer (example uses a local private key)
  const wallet = new ethers.Wallet('0x...YOUR_PRIVATE_KEY...', provider) // for ECDSA signing

  // ED25519 signing - typically from Hedera keys (seeded), not from Ethereum key
  // Use a 32-byte seed for ED25519 (in real use-case, you will have your Hedera key pair)
  const edSeed = Uint8Array.from(Array(32).fill(1)) // replace with real seed
  const ed = signEd25519(message, edSeed)

  // ECDSA signing from ethers wallet (r||s||v)
  const ecdsa = await signEcdsaWithEthers(message, wallet)

  // Build signature map with two signature pairs
  const sigMapBlob = buildSignatureMapBlob([
    {
      type: 'ed25519',
      signature: ed.signature,
      pubKeyPrefix: ed.pubKey.slice(0, 4) // commonly a prefix is used; adjust per account key registration
    },
    {
      type: 'ecdsa_secp256k1',
      signature: ecdsa.signature, // 65 bytes; builder will strip v to 64 bytes for SignatureMap
      pubKeyPrefix: Uint8Array.from(ethers.getBytes(ethers.computePublicKey(wallet.publicKey, false))).slice(0, 4)
    }
  ])

  // Prepare contract object (the user-supplied wrapper ABI)
  const contract = new ethers.Contract(contractAddress, contractAbi, wallet)

  // Call isAuthorized(alias, message, signatureBlob) - note: isAuthorized expects the *original* message bytes.
  // This example demonstrates how to call the wrapper exposing the precompile.
  const tx = await contract.verifyWithSignatureMap(aliasAddress, ethers.getBytes(message), sigMapBlob, {
    gasLimit: 500_000 // tune for your case
  })

  const receipt = await tx.wait()
  console.log('Call receipt:', receipt)
}

/* --------------------
   Minimal usage example (uncomment to run in node/ts-node)
   -------------------- */

(async function runExample() {
  const provider = new ethers.JsonRpcProvider('https://testnet.hedera.com') // replace
  const contractAddress = '0xYourWrapperContract'
  const contractAbi = [ /* ABI containing verifyWithSignatureMap(...) */ ]
  const aliasAddress = '0x...' // 20-byte alias / EVM alias for Hedera account
  const message = ethers.toUtf8Bytes('Hello Hedera Precompile')

  await exampleInvoke(provider, contractAddress, contractAbi, aliasAddress, message)
})()
