import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
 
// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    react({}),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // The reown adapter re-exported from @hashgraph/hedera-wallet-connect
      // imports @reown/appkit*, but we never invoke that adapter. Alias
      // these to an empty module so Rollup can resolve them without
      // pulling AppKit into the bundle.
      '@reown/appkit/networks': path.resolve(__dirname, './lib/stubs/empty-module.ts'),
      '@reown/appkit': path.resolve(__dirname, './lib/stubs/empty-module.ts'),
      '@reown/appkit-common': path.resolve(__dirname, './lib/stubs/empty-module.ts'),
      '@reown/appkit-utils': path.resolve(__dirname, './lib/stubs/empty-module.ts'),
      '@reown/appkit-controllers': path.resolve(__dirname, './lib/stubs/empty-module.ts'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react-router', 'react-router-dom']
  },

  optimizeDeps: {
    include: ['@radix-ui/react-checkbox', 'react', 'react-dom', 'react/jsx-runtime', 'react-dom/client']
  },
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {}
  },
  server: {
    host: '::',
    port: 5173, // this port MUST map to the port in proxy/envoy.tmpl.yaml
    allowedHosts: ['testnet.prism.local']
  }
}))
