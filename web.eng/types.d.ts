// import { Decimal } from 'decimal.js'

type Position = {
  market_id: string
  yes: number
  no: number
}

interface UserAccountInfo {
  account: string
  evm_address: string
  key: {
    _type: 'ECDSA_SECP256K1' | 'ED25519'
    key: string
  },
  ethereum_nonce: number
}

// see corresponding api code: api/server/lib/sign.go
// unfortunately, cannot have uint128 and uint256 types in TypeScript
// using decimal.js for arbitrary precision arithmetic (including decimals, not just integers)  
// type ObjForSigning = {
//   // N.B. Math.abs(priceUsd)
//   collateralUsd_abs_scaled: string,
//   marketId_uuid: string,
//   txId_uuid: string,
// }



// Image file type declarations
declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.gif' {
  const src: string
  export default src
}

export type {
  Position,
  // ObjForSigning
  UserAccountInfo
}