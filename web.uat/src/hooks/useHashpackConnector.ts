import { useWallet } from "@/contexts/WalletContext";

/**
 * Simple hook wrapper around WalletContext for components that prefer hook-style API
 * This provides the same interface as the standalone useHashpackConnector but leverages 
 * the more robust WalletContext implementation with session polling, extension detection,
 * and comprehensive error handling.
 */
export function useHashpackConnector() {
  const { wallet, connect, disconnect, isLoading } = useWallet();

  return {
    wallet,
    isLoading,
    connectWallet: connect,
    disconnectWallet: disconnect,
  };
}