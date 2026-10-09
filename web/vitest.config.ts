import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'lib/**/*.{test,spec}.{ts,tsx}']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@reown/appkit/networks': path.resolve(__dirname, './lib/stubs/empty-module.ts'),
      '@reown/appkit': path.resolve(__dirname, './lib/stubs/empty-module.ts'),
      '@reown/appkit-common': path.resolve(__dirname, './lib/stubs/empty-module.ts'),
      '@reown/appkit-utils': path.resolve(__dirname, './lib/stubs/empty-module.ts'),
      '@reown/appkit-controllers': path.resolve(__dirname, './lib/stubs/empty-module.ts'),
    }
  }
})
