import * as ethers from "ethers";

// Example: privateKey is "0x..."  (the ECDSA_SECP256K1 raw hex private key)
const privateKey = "1620f5b23ed7467f6730bcc27b1b2c396f4ae92aec70f420bdd886ae26fed81d"; // keep secret
const wallet = new ethers.Wallet(privateKey);
console.log(`wallet address: ${wallet.address}`);

// 1) message (any bytes). Could be a JSON string or raw bytes.
const message = "Hello Hedera";

// 2) canonical: keccak256(message) -> 32 bytes
const msgBytes = ethers.toUtf8Bytes(message);
const msgHash = ethers.keccak256(msgBytes); // 0x... (32 bytes)

// 3) prefixed digest (Ethereum style for a 32-byte hash)
const prefix = ethers.toUtf8Bytes("\x19Hedera Signed Message:\n32");
const prefixedHash = ethers.keccak256(ethers.concat([prefix, arrayify(msgHash)]));
console.log(`prefixedHash (hex): ${prefixedHash}`);

// 4) sign the prefixed digest (note: signDigest expects the digest, not the original message)
const sig = await wallet.signingKey.sign(prefixedHash);
// sig has { r, s, v } fields
console.log("r:", sig.r);
console.log("s:", sig.s);
console.log("v:", sig.v); // usually 27 or 28

// or get compact signature as 65-byte hex:
const compact = ethers.Signature.from(sig).serialized;
console.log("signature (hex 65 bytes):", compact);


// verify the sig:
const recoveredAddress = ethers.recoverAddress(
  prefixedHash,
  {
    r: sig.r,
    s: sig.s,
    v: sig.v
  }
);
console.log("recovered address:", recoveredAddress);
console.log("original address: ", wallet.address);
console.log("signature valid?", recoveredAddress === wallet.address);

// Helper function to convert hex string to Uint8Array
function arrayify(data: string): Uint8Array {
  if (typeof data !== "string" || !data.startsWith("0x")) {
    throw new Error("Invalid hex string");
  }
  const hex = data.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}