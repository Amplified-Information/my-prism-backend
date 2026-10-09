# Wallet Signing Parity Matrix

Every wallet-signing call site in the app must work identically on both
connectors:

- **HashConnect** — primary path used inside the Lovable preview iframe
  (top-window HashPack via `hashconnect-connect-extension`).
- **WalletConnect `DAppConnector`** (`@hashgraph/hedera-wallet-connect`) —
  failover / production path used on `prism.market`, published
  `*.lovable.app`, and `*.amplified.info`. Required because HashPack's
  content script ignores iframe origins.

Both signer types share the structural union in `lib/appkit.ts`
(`export type DAppSigner = HashConnectSigner | HwcDAppSigner`).

## Canonical message-signing pattern

The wallet automatically prepends `"\x19Hedera Signed Message:\n<len>"`
before signing. The backend verifies against the same prefix. To keep both
sides aligned we ALWAYS sign the **UTF-8 bytes of the base64-encoded hash**
(44 ASCII chars), so `<len>` is always `44`:

```ts
const keccakB64 = Buffer.from(keccakHex.slice(2), 'hex').toString('base64')
const sig = (await signer.sign([Buffer.from(keccakB64, 'utf8')]))[0].signature
```

Signing raw 32-byte digest bytes produces a `\n32` prefix and will fail
backend verification. Do not do it.

## Signing surface

| Path | File | Bytes signed | Length prefix |
|---|---|---|---|
| Order submit | `lib/trading/useOrderLifecycle.ts` | `utf8(base64(keccak(payloadHex)))` | 44 |
| Order cancel | `lib/cancelOrder.ts` + `lib/signCancel.ts` | `utf8(cancelMessage)` (mode-dependent) | mode-dependent |
| Comment post | `components/Comments.tsx` | `utf8(base64(keccak(utf8("${marketId}:${accountId}:${content}"))))` | 44 |
| Login challenge | `components/Login.tsx` | `utf8(base64(keccak(challenge)))` | 44 |

See `.lovable/memory/technical/hedera-signature-encoding.md` for the
detailed rationale and the historical `Hex2utf8` backend bug.

## Transaction execution (freeze required outside iframe)

Every `Transaction` subclass MUST be frozen against the signer before
`executeWithSigner()`:

```ts
seedWalletConnectNodeAccountId(tx, signerZero as any)
await tx.freezeWithSigner(signerZero as any)
const resp = await tx.executeWithSigner(signerZero as any)
```

Why: HashConnect's signer populates both `transactionId` and `nodeAccountIds`
inside `freezeWithSigner`. WalletConnect's current `DAppSigner` only populates
`transactionId`, so the app seeds one node account id from `signer.getNetwork()`
before freezing. The later `freezeWithSigner` call still owns transaction-id
population and the actual freeze step.

Do NOT call `signer.populateTransaction(tx)` before `freezeWithSigner`.
On some signer paths, double-populating locks the transaction's internal lists;
when `freezeWithSigner` later tries to populate/freeze the same transaction it
throws:

> list is locked

Current on-chain transaction call sites in `lib/hedera.ts`:

- `grantAllowanceUsd` builds a native `AccountAllowanceApproveTransaction` for
  USDC token allowance grants/revokes. Do not replace it with an ERC-20-style
  token `ContractExecuteTransaction`; HashPack can hang before rendering the
  prompt for large generic contract-approve payloads.
- `redeemWinnings` builds a `ContractExecuteTransaction` for
  `Prism.redeem(uint128)`.

Any new transaction builder MUST seed WalletConnect node ids if needed, call
`freezeWithSigner` before executing, and must NOT call `populateTransaction`
explicitly.

## Verification checklist when touching signing code

1. Preview iframe (HashConnect): login, allowance grant + revoke, place
   order, cancel order, post comment, redeem winnings — all succeed with
   exactly one HashPack prompt each.
2. Published host (WalletConnect): repeat the same six flows.
3. Console `sigByteLen` is 64 (both ED25519 and raw ECDSA), no
   `Request expired` or `freezeWith` errors on either host.
