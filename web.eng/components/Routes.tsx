import { Route, Routes as Routing } from 'react-router'
import Home from './Home'
import Market from './Market'
import Admin from './Admin'
import Explore from './Explore'
import CreateMarket from './CreateMarket'
import Portfolio from './Portfolio'
import Login from './Login'

const Routes = () => {
  return (
    <div className="px-4 md:px-8 lg:px-24">
      <Routing>
        <Route path='/*' element={<Home />} />
        <Route path='/market/:marketId' element={<Market />} />
        <Route path='/create' element={<CreateMarket />} />
        <Route path='/explore' element={<Explore />} />
        <Route path='/admin' element={<Admin />} />
        <Route path='/portfolio' element={<Portfolio />} />
        <Route path='/login' element={<Login />} />
      </Routing>
    </div>
  )
}

export default Routes