# Prism V2 order protocol

This is the client contract for placing, signing, cancelling and displaying orders against PrismV2. It is written for the web and admin apps. The API and CLOB in this repository implement it, and nothing else is accepted: the V1 floating-point order format (`priceUsd`, `qty`, `primarySecondary`, `generatedAt`) has been removed.

## Units

| Quantity | Unit | Example |
|---|---|---|
| Price | Integer YES probability on a `1_000_000` scale | `625000` = 0.625 |
| Shares | Collateral token's smallest unit (USDC: 6 decimals) | `10_000_000` = 10 shares |
| Collateral | Collateral token's smallest unit | `6_250_000` = 6.25 USDC |

One share pays exactly one collateral unit per unit held if its side wins (1 share = $1 for USDC). Never derive any of these values with floating-point arithmetic. Use `BigInt` in JavaScript.

## Order kinds

Every order is one of four kinds. The book is quoted in **YES price**, so a NO order's limit is expressed as a YES price too.

| Kind | `side` | `action` | Book side | `limitYesPrice` means | From a NO price `q` |
|---|---|---|---|---|---|
| Buy YES | 0 | 0 | bid | highest YES price you will pay | |
| Sell NO | 1 | 1 | bid | highest YES price, i.e. lowest NO price you accept | `1_000_000 - q` |
| Sell YES | 0 | 1 | ask | lowest YES price you accept | |
| Buy NO | 1 | 0 | ask | lowest YES price, i.e. highest NO price you pay | `1_000_000 - q` |

Any bid can trade with any ask. A bid and an ask trade when the bid's limit is at or above the ask's limit, at the resting order's limit price.

Each fill splits collateral exactly as the contract does: the YES leg pays `floor(shares × price / 1_000_000)` and the NO leg pays the rest. A fill where either leg would pay zero is impossible, so very small orders at extreme prices may never fill.

## The authorization

The user signs this struct, matching `PrismV2.Authorization`:

| Field | Type | Value |
|---|---|---|
| `version` | uint8 | always `2` |
| `chainId` | uint256 | `MacroMetadata.chainIds[net]`: mainnet `295`, testnet `296`, previewnet `297` |
| `verifyingContract` | address | `MacroMetadata.prismV2ProxyAddresses[net]`: the PrismV2 **proxy** EVM address, never the implementation's |
| `signer` | address | the user's EVM address. It must resolve to their Hedera account on the mirror node |
| `marketId` | uint128 | the market UUIDv7, read as a 128-bit integer (`0x` + the UUID without dashes) |
| `txId` | uint128 | a fresh UUIDv7, read the same way. One authorization per txId, forever |
| `side` | uint8 | `0` YES, `1` NO |
| `action` | uint8 | `0` BUY, `1` SELL |
| `limitYesPrice` | uint256 | see the table above, `0..1_000_000` |
| `qtyShares` | uint256 | shares, > 0 |
| `collateralCap` | uint256 | the most a BUY may spend in total. Ignored by the contract for SELL; send `0` |
| `deadline` | uint64 | unix seconds. Must be at least 60 s ahead when submitted. Orders are dropped from the book 30 s before it |

### Choosing `collateralCap` for a BUY

The limit price already bounds what each fill costs; the cap only has to absorb the contract's integer rounding:

- **Buy YES**: `ceil(qtyShares × limitYesPrice / 1_000_000)`. Each fill pays a rounded-down amount at a price no higher than the limit, so the total never exceeds this.
- **Buy NO**: `ceil(qtyShares × (1_000_000 - limitYesPrice) / 1_000_000) + slack`. The NO leg rounds up on every fill, so a partially filled order can pay one extra unit per fill. A slack of `100` units (0.0001 USDC) covers 100 partial fills.

If the cap is too tight the CLOB shrinks fills to fit it rather than letting settlement fail. The order is never overcharged, but a small remainder may stay unfilled.

### Signing

Hash the struct, then have the wallet sign the **base64 of the 32-byte hash**. Hedera wallets prefix the message with `"\x19Hedera Signed Message:\n" + length` themselves; for a base64 hash the length is always 44. This is the same framing V1 orders used, with a different hash.

```ts
import { AbiCoder, keccak256, toUtf8Bytes, encodeBase64 } from 'ethers'

const TYPE = 'PrismAuthorization(uint8 version,uint256 chainId,address verifyingContract,address signer,uint128 marketId,uint128 txId,uint8 side,uint8 action,uint256 limitYesPrice,uint256 qtyShares,uint256 collateralCap,uint64 deadline)'
const uuidToUint128 = (uuid: string) => BigInt('0x' + uuid.replace(/-/g, ''))

const structHash = keccak256(AbiCoder.defaultAbiCoder().encode(
  ['bytes32', 'uint8', 'uint256', 'address', 'address', 'uint128', 'uint128', 'uint8', 'uint8', 'uint256', 'uint256', 'uint256', 'uint64'],
  [keccak256(toUtf8Bytes(TYPE)), 2, chainId, '0x' + verifyingContract, '0x' + evmAddress,
   uuidToUint128(marketId), uuidToUint128(txId), side, action, limitYesPrice, qtyShares, collateralCap, deadline],
))
const message = encodeBase64(structHash) // 44 characters
// sign `message` with the Hedera wallet; send the raw signature bytes, base64 encoded, as `sig`
```

Reference vector (testnet chain, also checked in `api/server/lib/settlement_v2_test.go`):

```text
verifyingContract 0x1111111111111111111111111111111111111111
signer            0x2222222222222222222222222222222222222222
marketId          01890f3e-7c10-7cc1-98bc-0242ac120002
txId              01890f3e-7c10-7cc1-98bc-0242ac120003
side 0, action 0, limitYesPrice 625000, qtyShares 10000000, collateralCap 6250000, deadline 2000000000, chainId 296
structHash        0x29ab294f817112bc815c5cc131ca9375e9e8bd7b935fb41bedaad2557f9f36c0
```

The contract can also produce the hash and message: `authorizationHash(a)` and `authorizationMessage(a)` are public `pure` functions on the proxy.

## Placing an order: `CreatePredictionIntent`

```json
{
  "txId": "01890f3e-7c10-7cc1-98bc-0242ac120003",
  "net": "testnet",
  "marketId": "01890f3e-7c10-7cc1-98bc-0242ac120002",
  "accountId": "0.0.7090546",
  "evmAddress": "440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6",
  "publicKey": "03b6e6...0787",
  "keyType": 2,
  "chainId": "296",
  "verifyingContract": "1111111111111111111111111111111111111111",
  "side": 0,
  "action": 0,
  "limitYesPrice": "625000",
  "qtyShares": "10000000",
  "collateralCap": "6250000",
  "deadline": "2000000000",
  "sig": "base64 signature"
}
```

Addresses are 40 hex characters without `0x`. 64-bit fields may be sent as JSON strings (protobuf JSON) or numbers.

The API accepts the order only if every check passes:

- `chainId` and `verifyingContract` match the network's PrismV2 proxy.
- The fields form a valid authorization, a BUY has a positive `collateralCap`, and the deadline is at least 60 s away.
- A bid's limit is above 0 and an ask's limit is below `1_000_000` (otherwise the order could never fill).
- `txId` has never been used.
- `publicKey` and `keyType` belong to `accountId`, and `evmAddress` resolves to `accountId` on the mirror node.
- The signature verifies over the framed hash above.
- The market is tradeable in the database and `OPEN` on chain, before its close time.
- **BUY**: the user's USDC allowance to the proxy and their USDC balance are each at least `collateralCap`.
- **SELL**: the user's on-chain YES or NO balance covers `qtyShares` plus their other open sells on that side.

### Market orders

A bid at `limitYesPrice = 1_000_000`, or an ask at `0`, is a market order. The API only accepts it if the opposite side of the book currently holds at least `qtyShares`. It executes at the resting orders' prices.

### Allowance

Before a BUY, the user approves the **proxy contract** as spender of the collateral token for at least `collateralCap`. Approving the implementation contract does nothing.

## Cancelling

`CancelPredictionIntent` is unchanged: sign the UTF-8 `txId` the same way as before. It removes the order from the book and marks it cancelled; a match that races with the cancel is refused at settlement.

For a cancellation that holds even if the operator misbehaves, the user can also call `cancelAuthorization(uint128 txId)` on the proxy from their wallet.

## Reading orders, the book and matches

Open orders (`GetUserPortfolio.openPredictionIntents`) carry the signed fields plus fill state:

| Field | Meaning |
|---|---|
| `side`, `action`, `limitYesPrice`, `qtyShares`, `collateralCap`, `deadline` | as signed |
| `sharesFilled`, `collateralFilled` | cumulative, finalized on chain |
| `generatedAt` | when the API accepted the order |

The CLOB book (`GetBook`, `StreamBook`) returns `OrderDetail` entries with `limitYesPrice`, `sharesRemaining`, `side` and `action`. Bids are sorted best (highest) first and asks best (lowest) first. `GetPrice`/`StreamPrice` still report `priceBidUsd`/`priceAskUsd` as decimals (`limitYesPrice / 1_000_000`), defaulting to 0.5 when a side is empty.

Matches (`GetPredictionIntentMatches`) add `matchId`, `fillShares`, `executionYesPrice` and `status` (`pending`, `submitted`, `finalized`, `failed`). For V2 matches `txId1` is the bid and `txId2` the ask, and `priceUsd` is the execution YES price.

## Redeeming

After the oracle resolves or voids a market, users call `redeem(uint128 marketId)` on the proxy from their wallet. A winning share pays one collateral unit, minus the market's rake. A voided market pays half a unit per YES or NO share, with no rake.

## Lifecycle of an order

```text
wallet signs ─► API validates ─► DB + outbox (one transaction) ─► NATS clob.orders ─► CLOB book
                                                                                         │ fill
API ◄── NATS clob.matches.settle (one message per fill) ◄────────────────────────────────┘
 │  rebuilds both authorizations from the database, recomputes the collateral split,
 │  derives the match ID, checks executedMatches(matchId)
 └─► PrismV2.settle(bid, sigBid, ask, sigAsk, fillShares, price, matchId) ─► receipt
        └─► matches.status = finalized, both orders' sharesFilled/collateralFilled advance
```

The match ID is `keccak256(abi.encode(keccak256("PrismMatchV2"), proxy, marketId, bidTxId, askTxId, bidSharesBefore, askSharesBefore, fillShares, price))`. It is the same on every redelivery of a fill, so a fill can never settle twice.
