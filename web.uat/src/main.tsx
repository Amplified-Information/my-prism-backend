import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n/i18n'
import { Buffer } from 'buffer'
import process from 'process'
import { initWalletConnectFixes } from './utils/walletConnectFixes'

// Initialize enhanced WalletConnect fixes FIRST, before any other code
initWalletConnectFixes();

// Additional comprehensive error suppression for early initialization
const suppressWalletConnectError = (error: any) => {
  return error?.name === 'DataCloneError' || 
         error?.message?.includes('URL object could not be cloned') ||
         error?.message?.includes('postMessage') ||
         error?.stack?.includes('WalletConnect') ||
         error?.stack?.includes('lovable.js') ||
         error?.stack?.includes('fetchListings') ||
         error?.stack?.includes('getRecomendedWallets') ||
         error?.stack?.includes('getRecommendedWallets') ||
         error?.stack?.includes('preloadListings');
};

// Early error interception
window.addEventListener('error', (event) => {
  if (suppressWalletConnectError(event.error)) {
    console.warn('WalletConnect error suppressed (early main):', event.error?.message || 'Unknown error');
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return false;
  }
}, true);

window.addEventListener('unhandledrejection', (event) => {
  if (suppressWalletConnectError(event.reason)) {
    console.warn('WalletConnect promise rejection suppressed (early main):', event.reason?.message || 'Unknown rejection');
    event.preventDefault();
    return false;
  }
}, true);

// Setup Node.js polyfills for HashConnect compatibility
window.global = window;
window.Buffer = Buffer;
window.process = process;

console.log('🚀 Initializing app with enhanced WalletConnect protection...');

console.log('📦 Creating React root...');
createRoot(document.getElementById("root")!).render(<App />);
console.log('✅ React app rendered successfully');
