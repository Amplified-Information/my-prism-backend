# Wallet Connection — As-Built

**Stack:** single connector — `@hashgraph/hedera-wallet-connect` v2 `DAppConnector`.

Prism uses one WalletConnect-based connector for every wallet, matching SaucerSwap's current architecture. HashConnect has been removed.

## Two paths, one connector

| User picks | Extension detected? | Path taken |
|------------|---------------------|-----------|
| HashPack / Kabila / SaucerSwap | Yes, top-level window | `DAppConnector.connectExtension(extensionId)` — direct extension popup, no modal. |
| HashPack / Kabila / SaucerSwap | No, or inside iframe | `DAppConnector.openModal()` (Kabila gets a Kabila-only filtered modal). |
| WalletConnect tile | n/a | `DAppConnector.openModal()` — generic wallet grid. |

Detection is driven by the modern `hedera-extension-query` /
`hedera-extension-response` protocol (`lib/walletDetect.ts`). Legacy
HashConnect broadcast probes have been removed.

## Files

- `lib/appkit.ts` — singleton `DAppConnector`, `buildSigner`,
  `setActiveNetwork`, `pingWalletConnectSession`.
- `lib/connectWallet.ts` — `connectExtension(id)` and
  `connectWalletConnect(preferred?)`.
- `lib/walletDetect.ts` — modern extension discovery.
- `lib/useWallet.ts` — React hook: bind, disconnect, network switch.
- `components/ConnectWalletSheet.tsx` — Prism Connect Wallet popover.

## Signer

Every path returns a `DAppSigner` (alias of
`@hashgraph/hedera-wallet-connect`'s `DAppSigner`). The rest of the
app is agnostic to whether the pairing came via the extension or the
relay.

The signer is cached in `WalletContext.signerZero`, but `DAppConnector`
rebuilds its signer list on session update/extend — which happens right
after a signature. Every wallet-facing call therefore re-resolves through
`resolveFreshSigner()` (`lib/appkit.ts`) immediately before use, so a
request is never published on a topic the wallet no longer listens on.

## Wallet call serialization

All wallet-facing calls run through `withWalletLock` (`lib/walletMutex.ts`),
a single Web Locks–backed FIFO shared across tabs of the origin.

The hold is **bounded** — this matters because a WalletConnect request
promise is not guaranteed to settle (relay drop, request expiry, popup
dismissed without a response), and the timeout paths deliberately do not
force-abort the wallet call:

- hard ceiling `HOLD_CEILING_MS` (310s, just above the callers' 300s
  timeouts) always releases the lock;
- `abortActiveWalletCall(reason, { releaseLock: false })` holds the lock for
  at most `CANCEL_GRACE_MS` (10s) so a cancel can't stack a competing prompt,
  then releases regardless;
- `forceResetWalletLock()` releases immediately — used on disconnect and from
  the debug panel's "reset lock" button.

A call queued behind another for more than 2s raises a toast, and one queued
for more than 1.5s records a `note` diagnostic naming the holder. Before this,
a wedged lock silently swallowed every subsequent request — the "HashPack only
responds to the first signature" symptom.


## Why this shape

Live inspection of `https://testnet.saucerswap.finance/trade`
(WalletConnect Modal v2, projectId `ac0443616163eed95ec4c3c5b54c1b4a`,
sdkType `wcm` v2.7.0, single `walletconnect.*.js` chunk, no
HashConnect bundle) confirmed that a single WalletConnect stack with
curated wallets is the current best practice for Hedera dApps.
