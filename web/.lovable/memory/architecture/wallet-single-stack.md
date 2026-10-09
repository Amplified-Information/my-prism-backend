---
name: Wallet single stack
description: Single DAppConnector (@hashgraph/hedera-wallet-connect) stack for all wallet connections; HashConnect removed
type: architecture
---

Prism uses ONE wallet connector: `DAppConnector` from
`@hashgraph/hedera-wallet-connect` v2. HashConnect has been removed
(package uninstalled, all code paths deleted).

Two entry points, both routed through the same connector:
- `connectExtension(id)` → `DAppConnector.connectExtension(extensionId)`
  for detected Hedera-native extensions (HashPack, Kabila, SaucerSwap).
- `connectWalletConnect(preferred?)` → `DAppConnector.openModal()` for
  the WalletConnect relay path (used inside iframes and for the generic
  tile). Kabila gets a Kabila-only filtered modal.

Detection uses the modern `hedera-extension-query` protocol only.
Legacy `hashconnect-query-extension` broadcasts have been removed.

This mirrors SaucerSwap's current architecture (single WalletConnect
Modal v2, no HashConnect bundle).

Do not reintroduce the `hashconnect` package or dual-stack signer
selection. See `docs/wallet-tech-as-built.md`.
