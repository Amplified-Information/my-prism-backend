import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, X, Trophy } from 'lucide-react'
import Wallet from './Wallet'
import logo from '../src/assets/prism-logo-full.png'

import { usePortfolio } from '../lib/usePortfolio'
import { showRewards } from '../env'

// Hedera logo SVG component
const HederaIcon = () => (
  <svg width="12" height="12" viewBox="0 0 40 40" fill="currentColor">
    <path d="M20 0C8.954 0 0 8.954 0 20s8.954 20 20 20 20-8.954 20-20S31.046 0 20 0zm9.2 28.8h-3.6v-5.2h-11v5.2H11V11.2h3.6v5.2h11v-5.2h3.6v17.6zm-3.6-8.4v-3.6h-11v3.6h11z"/>
  </svg>
)

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { resolvedPositions, isConnected, refresh } = usePortfolio()
  const totalRedeemable = useMemo(
    () => resolvedPositions.reduce((s, p) => s + (p.redeemableUsd > 0 ? p.redeemableUsd : 0), 0),
    [resolvedPositions],
  )
  const hasWinnings = isConnected && totalRedeemable > 0

  // Fetch portfolio when wallet connects, then poll every 60s so the trophy
  // appears/disappears as winnings become redeemable.
  useEffect(() => {
    if (!isConnected) return
    refresh()
    const id = setInterval(() => {
      if (!document.hidden) refresh()
    }, 60_000)
    return () => clearInterval(id)
  }, [isConnected, refresh])

  useEffect(() => {
    if (!menuOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      const menu = document.querySelector('.mobile-menu')
      const button = document.querySelector('.hamburger-btn')
      if (
        menu &&
        button &&
        !menu.contains(e.target as Node) &&
        !button.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const navItems = [
    { label: 'Explore Markets', path: '/explore' },
    ...(showRewards ? [{ label: 'Rewards', path: '/rewards' }] : []),
  ]

  const mobileMenuItems = [
    { label: 'Explore Markets', path: '/explore', enabled: true },
    ...(showRewards ? [{ label: 'Rewards', path: '/rewards', enabled: true }] : []),
  ]

  const secondaryMenuItems = [
    { label: 'Portfolio', path: '/portfolio', enabled: true, external: false },
    { label: 'Docs', path: 'https://prism-market-labs.gitbook.io/prism-market-labs-docs/', enabled: true, external: true },
  ]

  return (
    <div className="relative">
      <header 
        className="header px-3 sm:px-4 md:px-8 lg:px-16 xl:px-24" 
        style={{ 
          borderColor: 'hsl(240 5% 26%)'
        }}
      >
        {/* Left: Logo + Badge */}
        <Link 
          to="/"
          className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0" 
        >
          <img
            src={logo}
            alt="Prism Market"
            className="h-7 sm:h-8 lg:h-10 object-contain"
          />
          <div className="hedera-badge hidden lg:inline-flex">
            <span>Powered by</span>
            <HederaIcon />
            <span>Hedera</span>
          </div>
        </Link>

        {/* Center: Desktop Nav */}
        <nav className="desktop-nav">
          {navItems.map((item) => (
            <Link 
              key={item.path}
              to={item.path}
              className="nav-link" 
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right: Hamburger + Wallet */}
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 shrink-0">
          <div className="relative">
            <button 
              className="hamburger-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
              ) : (
                <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
              )}
            </button>

            {menuOpen && (
              <nav className="mobile-menu">
                <div className="py-3">
                  {mobileMenuItems.map((item) => (
                    <Link 
                      key={item.path + item.label}
                      to={item.path}
                      className={`mobile-nav-link ${!item.enabled ? 'opacity-40 pointer-events-none' : ''}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>

                <div className="py-2 border-t border-border">
                  {secondaryMenuItems.map((item) => (
                    item.external ? (
                      <a 
                        key={item.path + item.label}
                        className={`mobile-nav-link ${!item.enabled ? 'opacity-40 pointer-events-none' : ''}`}
                        href={item.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMenuOpen(false)}
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link 
                        key={item.path + item.label}
                        to={item.path}
                        className={`mobile-nav-link ${!item.enabled ? 'opacity-40 pointer-events-none' : ''}`}
                        onClick={() => setMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    )
                  ))}
                </div>

              </nav>
            )}
          </div>

          <Wallet />
          {hasWinnings && (
            <button
              type="button"
              onClick={() => navigate('/portfolio')}
              title={`You have $${totalRedeemable.toFixed(2)} in winnings to redeem`}
              aria-label="Redeem winnings"
              className="relative inline-flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg hover:scale-105 transition-transform"
              style={{ animation: 'header-trophy-pulse 2s ease-in-out infinite' }}
            >
              <Trophy className="h-4 w-4 text-white drop-shadow" />
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                ${totalRedeemable < 100 ? totalRedeemable.toFixed(0) : '99+'}
              </span>
              <style>{`@keyframes header-trophy-pulse {
                0%,100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.5); }
                50% { box-shadow: 0 0 0 6px hsl(var(--primary) / 0); }
              }`}</style>
            </button>
          )}
        </div>
      </header>
    </div>
  )
}

export default Header