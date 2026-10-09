---
name: Hedera signature encoding
description: Sign UTF-8 bytes of base64(keccak) — wallet auto-prefixes bytes, backend prefixes base64
type: technical
---
Hedera wallets (`DAppSigner.sign([bytes])`) automatically wrap input as
`"\x19Hedera Signed Message:\n<len(bytes)>" + <bytes>` before signing.

Backend (`api/server/lib/sign.go` → `PrefixMessageToSign`) verifies over
`"\x19Hedera Signed Message:\n44" + keccakB64` (the 44-char base64 of keccak256).

Order-sign (`lib/trading/useOrderLifecycle.ts`) MUST pass
`Buffer.from(keccakB64, 'utf8')` (44 bytes), NOT the raw 32-byte keccak digest.
Passing raw bytes yields prefix `"...\n32" + <raw>` and the signature never
verifies (`failed to verify signature: invalid signature`).

Cancel-sign (`lib/cancelOrder.ts` / `lib/signCancel.ts`) signs UTF-8 bytes of
`base64(keccak256(utf8(txId)))` — mode `'utf8-hyphenated'`. Backend
`CancelPredictionIntent` (`7228e725`, 2026-07-08) wraps `txId` with `Utf82hex`
before `VerifySig`, so `Hex2utf8` cleanly round-trips back to the utf8 UUID.
The old `'empty'` fallback is retained for diagnostics only — do not restore it
as the default.

Comment-sign (`components/Comments.tsx`) signs UTF-8 bytes of
`base64(keccak256(utf8(payload)))` where
`payload = "${marketId}:${accountId}:${content}"`. Backend
`ApiService.CreateComment` reconstructs the same
`fmt.Sprintf("%s:%s:%s", MarketId, AccountId, Content)` before verifying.
Signing only the raw `content` (pre-update behavior) will fail verification.
Normalize the returned signature via `normalizeSignatureBase64`.

For WalletConnect/Hedera `DAppSigner`, do not pass `{ encoding: 'base64' }`
when signing those 44 bytes. That option means "base64-encode the supplied
message before signing", changing the wallet prompt from `keccakB64` to
`base64(keccakB64)` and producing an invalid backend signature.
