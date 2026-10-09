import './lib/walletConnectFixes'
import { proto } from '@hiero-ledger/proto'
// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import { BrowserRouter } from 'react-router-dom'
import AppProvider from './AppProvider'
import App from './App'

console.log(proto) // Prevents tree-shaking of @hiero-ledger/proto

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <BrowserRouter basename="/"> {/* SPA routing — see also vite.config.ts */}
      <AppProvider>
        <App />

      </AppProvider>
    </BrowserRouter>
  // </StrictMode>
)
