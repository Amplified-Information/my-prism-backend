/**
 * Branded wallet logos for the Connect Wallet sheet.
 *
 * Logos are sourced from the official WalletConnect Cloud Explorer
 * (same artwork wallets display inside the WC modal) and hosted on
 * Lovable's CDN so the rows render instantly without third-party
 * requests. A letter-tile fallback covers the unlikely case of the
 * CDN image failing to load.
 */
import { useState } from 'react'
import type { WalletId } from '../lib/walletDetect'
import hashpackLogo from '../src/assets/wallets/hashpack.png'
import kabilaLogo from '../src/assets/wallets/kabila.png'
import saucerswapLogo from '../src/assets/wallets/saucerswap.png'
import walletconnectLogo from '../src/assets/wallets/walletconnect.png'
import metamaskLogo from '../src/assets/wallets/metamask.png'

const shapeFor: Record<WalletId, string> = {
  hashpack: 'rounded-xl',
  kabila: 'rounded-full',
  saucerswap: 'rounded-full',
  walletconnect: 'rounded-full',
  metamask: 'rounded-xl',
}

const logoUrl: Record<WalletId, string> = {
  hashpack: hashpackLogo,
  kabila: kabilaLogo,
  saucerswap: saucerswapLogo,
  walletconnect: walletconnectLogo,
  metamask: metamaskLogo,
}

const brand: Record<WalletId, { bg: string; letter: string }> = {
  hashpack: { bg: '#8259EF', letter: 'H' },
  kabila: { bg: '#0EA5E9', letter: 'K' },
  saucerswap: { bg: '#1E40AF', letter: 'S' },
  walletconnect: { bg: '#3B99FC', letter: 'W' },
  metamask: { bg: '#F6851B', letter: 'M' },
}


export const WalletLogo = ({
  id,
  size = 36,
  rounded,
}: {
  id: WalletId
  size?: number
  rounded?: string
}) => {
  const shape = rounded ?? shapeFor[id]
  const [errored, setErrored] = useState(false)

  if (!errored) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden ${shape}`}
        style={{ width: size, height: size, background: 'transparent' }}
        aria-hidden
      >
        <img
          src={logoUrl[id]}
          alt=""
          width={size}
          height={size}
          onError={() => setErrored(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </span>
    )
  }

  const b = brand[id]
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden ${shape} font-semibold`}
      style={{
        width: size,
        height: size,
        background: b.bg,
        color: '#fff',
        fontSize: Math.round(size * 0.45),
        lineHeight: 1,
      }}
      aria-hidden
    >
      {b.letter}
    </span>
  )
}
