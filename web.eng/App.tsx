// import { useAppContext } from './AppProvider'

import Routes from './components/Routes'
import Header from './components/Header'
import Footer from './components/Footer'
import { Toaster } from 'react-hot-toast'
import MacroMetadata from './components/MacroMetadata'

import './i18n/i18n'
import PopupAllowance from './components/PopupAllowance'
import PopupTradePanel from './components/PopupTradePanel'
import DustParticles from './components/DustParticles'
import UserPortfolio from './components/UserPortfolio'

const App = () => {

  // const { market } = useAppContext()
  
  return (
    <>
      <MacroMetadata />
      <UserPortfolio />
        
      <DustParticles />
      <Header />
      <Routes />
      <Footer />

      <Toaster
        position="bottom-right"
        reverseOrder={false}
      />

      {/* Popups */}
      <PopupAllowance />
      <PopupTradePanel />
    </>
  )
}

export default App
