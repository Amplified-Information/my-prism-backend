// import { useAppContext } from './AppProvider'

import Routes from './components/Routes'
import Header from './components/Header'
import Footer from './components/Footer'
import { Toaster } from 'react-hot-toast'
import MacroMetadata from './components/MacroMetadata'

import './i18n/i18n'
import PopupAllowance from './components/PopupAllowance'
import DustParticles from './components/DustParticles'
import GlobalAllowanceSidebar from './components/GlobalAllowanceSidebar'
// import RedeemableWinningsNotice from './components/RedeemableWinningsNotice'
import UserPortfolio from './components/UserPortfolio'
import WalletSignDebugPanel from './components/WalletSignDebugPanel'



const App = () => {

  // const { market } = useAppContext()

  return (
    <div className="min-h-screen flex flex-col">
      <MacroMetadata />
        
      <DustParticles />
      <Header />
      <Routes />
      <Footer />


      <Toaster
        position="bottom-right"
        reverseOrder={false}
        toastOptions={{
          className: 'prism-toast',
          style: {
            maxWidth: '500px',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '12px',
            padding: '12px 14px',
            fontSize: '14px',
            fontFamily: 'inherit',
            boxShadow:
              '0 10px 30px -10px hsl(240 10% 2% / 0.6), 0 0 0 1px hsl(var(--border) / 0.4)',
            backdropFilter: 'blur(8px)',
          },
          success: {
            iconTheme: {
              primary: 'hsl(var(--primary))',
              secondary: 'hsl(var(--primary-foreground))',
            },
            style: {
              borderColor: 'hsl(var(--primary) / 0.5)',
            },
          },
          error: {
            iconTheme: {
              primary: 'hsl(var(--destructive))',
              secondary: 'hsl(var(--destructive-foreground))',
            },
            style: {
              borderColor: 'hsl(var(--destructive) / 0.6)',
            },
          },
          loading: {
            iconTheme: {
              primary: 'hsl(var(--accent))',
              secondary: 'hsl(var(--card))',
            },
          },
        }}
      />

      {/* Popups & Sidebars */}
      <PopupAllowance />
      <GlobalAllowanceSidebar />
      {/* <RedeemableWinningsNotice /> */}
      
      {/* Global data fetchers */}
      <UserPortfolio />

      {/* Dev-only wallet signing diagnostics (?debug=1 or Ctrl+Shift+W) */}
      <WalletSignDebugPanel />


      
    </div>
  )
}

export default App
