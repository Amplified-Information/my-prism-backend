import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import Wallet from './Wallet'
import logo from '../img/prism.png'
import { useAppContext } from '../AppProvider'
import NetworkSelector from './NetworkSelector'
import Balances from './Balances'
import SelectLang from './SelectLang'

const Header = () => {
  const { networkSelected, smartContractIds, signerZero } = useAppContext()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  // Close menu on Escape key
  useEffect(() => {
    if (!menuOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  // Close menu when clicking outside the mobile menu or hamburger button
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
  
  return (
    <div className="relative">
      <Balances />
      <header className="header z-1000" style={{ borderColor: `${networkSelected.isTestnet() ? 'orange' : networkSelected.isPreviewnet() ? 'purple' : ''}` }}>
        {/* Logo on the left */}
        <div className="logo-container" onClick={() => navigate('/')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src={logo}
              alt="Prism Logo"
              className="ml-2 md:ml-8 lg:ml-24"
              style={{
              maxWidth: '100%'
              }}
              srcSet={`${logo} 1x, ${logo} 2x`}
              sizes="(max-width: 640px) 32.4px, 36px"
            />
            <style>
                {`
                .logo-container img {
                  width: 3.25rem;
                  height: 3.25rem;
                  object-fit: contain;
                }
                @media (max-width: 640px) {
                  .logo-container img {
                  width: 2.025rem;
                  height: 2.025rem;
                  }
                }
                `}
            </style>
            <h1 style={{ margin: 0 }}>
              <span className="prism-title">
              &nbsp;Prism
              <span style={{ color: 'var(--color-text-muted)', marginLeft: '0.1rem' }}>Market</span>
              </span>
              <style>
              {`
                .prism-title {
                font-size: 2rem;
                }
                @media (max-width: 640px) {
                .prism-title {
                  font-size: 1.8rem;
                }
                }
              `}
              </style>
            </h1>
            </div>
          <div style={{ marginTop: '-6px', textAlign: 'center', width: '100%', fontSize: '0.6rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: typeof signerZero === 'undefined' ? 'orange' : 'green',
                    marginRight: 6,
                    boxShadow: typeof signerZero === 'undefined' ? '0 0 6px 2px orange' : '0 0 6px 2px #0f0'
                }}
                ></span>
              <span title={`${typeof signerZero === 'undefined' ? '': 'Connected to'} prism.market smart contract on ${networkSelected.toString()}`}>&nbsp;{ smartContractIds[networkSelected.toString().toLowerCase()] }</span>
            </span>
          </div>
        </div>

        {/* Links + Wallet - desktop */}
        <nav className="desktop-nav mr-8">
          <a className="nav-link" onClick={() => { navigate('/portfolio')} }>Portfolio</a>
          <a className="nav-link" onClick={() => { navigate('/explore')} }>Explore</a>
          <a className="nav-link" onClick={() => { navigate('/create')} }>Create</a>
          <SelectLang />
          <Wallet />
        </nav>

        {/* Hamburger button - mobile */}
        <button 
          className="hamburger-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          style={{ color: '#222', zIndex: 1100 }} // Make sure the icon is dark and above the menu
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width={32} height={32}>
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Mobile menu */}
        {menuOpen && (
          <nav
            className="mobile-menu"
            style={{
              zIndex: 1001,
              position: 'absolute',
              top: 0,
              marginTop: '10px',
              left: 0,
              width: '100%',
              background: 'var(--color-bg-header)', // Use your original header bg variable or color
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ margin: '0 auto' }}>
                <Wallet />
              </div>
            </div>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <SelectLang />
            </div>
            <a className="mobile-nav-link" onClick={() => { setMenuOpen(false); navigate('/explore')} }>Explore</a>
            <a className="mobile-nav-link" onClick={() => { setMenuOpen(false); navigate('/create')} }>Create</a>
            <a className="mobile-nav-link" onClick={() => { setMenuOpen(false); navigate('/portfolio')} }>Portfolio</a>
          </nav>
        )}
      </header>

      <div>
        <NetworkSelector />
        {/* <Balances /> */}
      </div>
    </div>
  )
}

export default Header
