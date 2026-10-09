# Wallet Connect Stack — Reference Dapp Comparison

Snapshot of how three reference dapps wire their connect-wallet flow, captured
via Playwright network inspection. Used to inform Prism's own stack choices
(see `mem://technical/wallet-connect-configuration-v4`).

## Summary

| Site         | Modal stack                                  | Hedera-native? | Notes                                                  |
| ------------ | -------------------------------------------- | -------------- | ------------------------------------------------------ |
| SaucerSwap   | WalletConnect Modal v2 + `DAppConnector`     | Yes (curated)  | Hand-curated HashPack/Kabila tiles; Blade via injected |
| Bonzo        | WalletConnect Modal v2 + `DAppConnector`     | Yes            | Same stack as SaucerSwap                               |
| Hyperliquid  | Privy + Reown AppKit + WC Explorer           | No (EVM only)  | Privy provides email/social + embedded wallets         |
| **Prism**    | Reown AppKit + `HederaProvider`/`HederaAdapter` | Yes (early) | First mover on AppKit + Hedera HIP-820                 |

## Hyperliquid details (`app.hyperliquid.xyz/trade`)

- **Privy** — `auth.privy.io`, app id `clmv1d6am07asib0fs4ss7w2x`. Loads an
  `embedded-wallets` iframe; handles email / Google / Apple / passkey login
  and provisions embedded EVM wallets that sign Hyperliquid L1 actions.
- **Reown AppKit** — `api.web3modal.org/appkit/v1/config`, `sv=html-core-1.7.8`,
  projectId `a27650e04812003001477ec7409a330f`. Drives the "Connect a wallet"
  branch (WalletConnect v2 + injected EVM providers).
- **WalletConnect Explorer** — `explorer-api.walletconnect.com/v3/wallets`
  with a separate projectId `34357d3c125c2bcf2ce2bc3309d98715` powers the
  recommended-wallet list.
- Telemetry to `pulse.walletconnect.org`.

Flow: Connect button → Privy modal (email/social/passkey/"Connect a wallet")
→ on "Connect a wallet", AppKit takes over for WC/injected EVM signing.

EVM-only — no Hedera namespace, no HIP-820 — so the architecture is not
directly portable, but the **Privy-in-front-of-AppKit** pattern is the
interesting takeaway if we ever want email / social onboarding.

## SaucerSwap / Bonzo details

Both use the older but battle-tested combo:

- `@walletconnect/modal` v2 (`sdkType=wcm&sdkVersion=js-2.7.0`).
- `@hashgraph/hedera-wallet-connect`'s `DAppConnector` for HIP-820 signing.
- Curated tile list: HashPack, Kabila, Blade — with Blade detected via the
  injected extension probe (`chrome-extension://abogmi…`).
- Each owns its own WalletConnect projectId.

## Takeaways for Prism

1. We are the only one of the four on Reown AppKit + Hedera. Early-adopter
   tax (e.g. the `APKT002` origin allowlist gotcha) is expected.
2. Neither Hedera reference dapp has migrated to AppKit yet — they remain
   on WC Modal v2 + `DAppConnector`. That stack is the fallback if AppKit
   ever becomes untenable for Hedera.
3. Cheap UX win available: pin HashPack/Kabila/Blade via AppKit's
   `featuredWalletIds` to match SaucerSwap/Bonzo's curated ordering.
4. Email/social onboarding (Privy/Magic/Web3Auth) would require a custom
   Hedera signer — none of these providers support Hedera natively today.

## Related

- `docs/walletconnect-origin-allowlist.md` — `APKT002` mitigation.
- `mem://technical/wallet-connect-configuration-v4` — current Prism config.

## Decision (2026-06-24)

Staying on Reown AppKit + Hedera adapter as the connection engine, but the user-facing UI is now a custom Prism-branded right-side Sheet (`components/ConnectWalletSheet.tsx`) modeled on SaucerSwap. Tile picks call `lib/connectWallet.launchWallet(id)` which drives AppKit imperatively. AppKit's own modal is no longer the primary entry point.

