import './shim-buffer'
import { proto } from '@hashgraph/proto'
// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter } from 'react-router'
import AppProvider from './AppProvider'
import App from './App'

console.log(proto) // TODO - remove eventually. Will use `proto` in Signer.tsx. Added here to to avoid tree-shaking of @hashgraph/proto

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <BrowserRouter basename="/"> {/* also see vite.config.ts */}
      <AppProvider>
        <App />
        
      </AppProvider>
    </BrowserRouter>
  // </StrictMode>
)
