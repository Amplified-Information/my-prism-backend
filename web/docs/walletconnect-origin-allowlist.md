# WalletConnect Origin Allowlist

Reown / WalletConnect Cloud rejects relay connections from origins that are
not on the project's **Allowed Origins** list. When this happens, every
signing request silently fails: the dApp publishes the request, but the
relay never delivers it to HashPack, and the call hangs until HashPack's
~5-minute "Request expired" timeout.

## Symptom

Browser console shows repeated:

```
Fatal socket error: WebSocket connection closed abnormally with code: 3000 (Unauthorized: origin not allowed)
Fatal socket error received, closing transport
```

…and `signMessage` / `executeTransaction` calls never produce a HashPack
modal.

## Fix

1. Open https://cloud.reown.com (formerly cloud.walletconnect.com).
2. Select the Prism Market project (matches `walletConnectProjectId` in
   `constants.ts`).
3. Go to **Project → Settings → Allowed Origins**.
4. Add every host the dApp can be served from:
   - `https://prism.market`
   - `https://*.prism.market`
   - `https://*.lovable.app` (published preview)
   - `https://*.lovableproject.com` (in-editor preview — required, otherwise
     AppKit returns `APKT002` and the Connect Wallet modal falls back to the
     bare "WalletConnect + Search Wallet" view with no Hedera wallets listed)
   - `https://*.amplified.info` (UAT / staging)
   - any custom domains
5. Save. Allowlist changes propagate within ~1 minute.

## Symptom when the in-editor preview origin is missing

Console shows:

```
[Reown Config] Failed to fetch remote project configuration. ...
The origin https://<uuid>.lovableproject.com is not in your allow list. APKT002
```

…and the Connect Wallet modal shows only the generic "WalletConnect" entry
plus an empty "Search Wallet" row (no HashPack / Kabila / Arculus / Dropp).
Adding `https://*.lovableproject.com` to the allowlist restores the full
Hedera wallet list.

## Verification

Reload the preview. The `code: 3000` errors should stop, and a fresh
HashPack signing request should produce a modal within ~2s.

## Related code

- `lib/walletDiagnostics.ts` — `assertSessionHealthy()` and `pingBeforeSign()`
  fail fast / wake the extension before issuing a signing request, so a
  broken relay surfaces as a clear "Reconnect wallet" toast instead of a
  silent 5-minute hang.
- `lib/useWallet.ts` — `visibilitychange` listener re-binds `signerZero`
  when the tab returns to the foreground.
- `constants.ts` — `walletConnectProjectId` (must match the Reown project
  whose allowlist was updated).

See also: `mem://technical/wallet-connect-configuration-v4`.
