import { Navigate, Route, Routes as Routing } from 'react-router-dom'
import Home from './Home'
import Market from './Market'

import Explore from './Explore'
import CreateMarket from './CreateMarket'
import Portfolio from './Portfolio'
import Terms from './Terms'
import Privacy from './Privacy'
import Contact from './Contact'
import Login from './Login'
import { RewardsPage } from '../src/pages/RewardsPage'
import { RewardsDiagnosticsPage } from '../src/pages/RewardsDiagnosticsPage'
import { showRewards } from '../env'

const Routes = () => {
  return (
    <div className="relative z-10 px-4 md:px-8 lg:px-24">
      <Routing>
        <Route path='/' element={<Home />} />
        <Route path='/market/:marketId' element={<Market />} />
        <Route path='/create' element={<CreateMarket />} />
        <Route path='/explore' element={<Explore />} />
        <Route path='/markets' element={<Explore />} />
        <Route path='/portfolio' element={<Portfolio />} />
        {showRewards && <Route path='/rewards' element={<RewardsPage />} />}
        {showRewards && <Route path='/diagnostics/rewards' element={<RewardsDiagnosticsPage />} />}

        <Route path='/terms' element={<Terms />} />
        <Route path='/privacy' element={<Privacy />} />
        <Route path='/contact' element={<Contact />} />
        <Route path='/login' element={<Login />} />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routing>
    </div>
  )
}

export default Routes