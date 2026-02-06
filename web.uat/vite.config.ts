import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true,
    port: 8080,
    headers: {
      // Allow Lovable preview iframe + WalletConnect related embeds
      "Content-Security-Policy":
        "frame-ancestors 'self' https://*.lovable.app https://*.lovableproject.com https://*.walletconnect.com https://*.walletconnect.org",
    },
  },
  appType: 'spa',
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    include: ["buffer", "process", "@walletconnect/web3wallet"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress warnings about unresolved WalletConnect imports
        if (warning.code === 'UNRESOLVED_IMPORT' && 
            warning.exporter?.includes('walletconnect')) {
          return;
        }
        warn(warning);
      },
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));