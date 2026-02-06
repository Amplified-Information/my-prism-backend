import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useActivityMonitor } from "@/hooks/useActivityMonitor";
import { InactivityWarningDialog } from "@/components/Wallet/InactivityWarningDialog";
import { 
  DAppConnector,
  HederaSessionEvent,
  HederaJsonRpcMethod,
  HederaChainId,
} from "@hashgraph/hedera-wallet-connect";
import { LedgerId } from "@hashgraph/sdk";
import { toast } from "@/hooks/use-toast";
import { useDebugger } from "@/hooks/useDebugger";
import { supabase } from "@/integrations/supabase/client";
import { generateWalletAvatar, getExistingWalletAvatar, updateWalletAvatar } from "@/lib/avatarGenerator";
import { hederaConfig, isMainnet } from "@/config/hedera";

// Helper function to extract account ID from session
function getAccountIdFromSession(session: any): string | null {
  if (!session) return null;
  const accounts = session.namespaces?.hedera?.accounts ?? [];
  return accounts[0]?.split(":")[2] ?? null;
}

// Mirror Node API interface
interface MirrorAccountResponse {
  key?: Record<string, unknown>;
}

// Fetch public key (handles different key structures)
async function fetchPublicKey(accountId: string): Promise<string | null> {
  try {
    const url = `${hederaConfig.mirrorNodeUrl}/accounts/${accountId}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data: MirrorAccountResponse = await response.json();

    // Different formats: { key: { key } }, { key: { thresholdKey: {...} } }, etc.
    if (typeof data.key?.key === "string") return data.key.key;
    if (typeof data.key === "string") return data.key;
    return null;
  } catch (error) {
    console.error("Failed to fetch public key from Mirror Node:", error);
    return null;
  }
}

interface WalletState {
  isConnected: boolean;
  accountId: string | null;
  publicKey: string | null;
}

interface WalletContextType {
  wallet: WalletState;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isLoading: boolean;
  walletConnector: DAppConnector | null;
  extendSession: () => void;
  sessionTimeRemaining: number | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const debug = useDebugger('WalletProvider');
  
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    accountId: null,
    publicKey: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [walletConnector, setWalletConnector] = useState<DAppConnector | null>(null);
  
  // Inactivity timeout state
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number | null>(null);
  
  // Timeout configuration (20 minutes = 1200000ms, warning at 2 minutes = 120000ms)
  const SESSION_TIMEOUT = 20 * 60 * 1000; // 20 minutes
  const WARNING_THRESHOLD = 2 * 60 * 1000; // 2 minutes warning

  // Use ref to access current wallet state without causing re-renders
  const walletRef = useRef(wallet);
  const connectorRef = useRef<DAppConnector | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  walletRef.current = wallet;

  // Handle session timeout
  const handleSessionTimeout = useCallback(async () => {
    debug.log('Session timed out due to inactivity');
    setShowWarningDialog(false);
    
    toast({
      title: "Session Expired",
      description: "Your wallet has been disconnected due to 20 minutes of inactivity.",
      variant: "destructive",
    });
    
    await disconnect();
  }, [debug]);

  // Handle inactivity warning
  const handleInactivityWarning = useCallback(() => {
    if (wallet.isConnected) {
      debug.log('Showing inactivity warning dialog');
      setShowWarningDialog(true);
    }
  }, [wallet.isConnected, debug]);

  // Handle user activity
  const handleUserActivity = useCallback(() => {
    if (wallet.isConnected) {
      debug.log('User activity detected, session extended');
    }
  }, [wallet.isConnected, debug]);

  // Extend session manually
  const extendSession = useCallback(() => {
    debug.log('Session extended manually by user');
    setShowWarningDialog(false);
    setSessionStartTime(Date.now());
    
    toast({
      title: "Session Extended",
      description: "Your wallet session has been extended for another 20 minutes.",
    });
  }, [debug]);

  // Update session time remaining
  useEffect(() => {
    if (!wallet.isConnected || !sessionStartTime) {
      setSessionTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - sessionStartTime;
      const remaining = Math.max(0, SESSION_TIMEOUT - elapsed);
      setSessionTimeRemaining(remaining);
    };

    // Update immediately
    updateTimer();
    
    // Update every minute
    const interval = setInterval(updateTimer, 60000);
    
    return () => clearInterval(interval);
  }, [wallet.isConnected, sessionStartTime, SESSION_TIMEOUT]);

  // Activity monitor hook
  useActivityMonitor({
    onActivity: handleUserActivity,
    timeout: SESSION_TIMEOUT,
    warningThreshold: WARNING_THRESHOLD,
    onWarning: handleInactivityWarning,
    onTimeout: handleSessionTimeout,
    enabled: wallet.isConnected,
  });

  // Function to generate avatar for new wallet users
  const generateAvatarForWallet = useCallback(async (accountId: string) => {
    try {
      debug.log('Checking if avatar generation needed for wallet', { accountId });
      
      // Check if wallet already has an avatar
      const existingAvatar = await getExistingWalletAvatar(accountId);
      if (existingAvatar) {
        debug.log('Wallet already has avatar, skipping generation');
        return;
      }
      
      // Generate avatar for this wallet
      debug.log('Generating new avatar for wallet', accountId);
      const avatarUrl = await generateWalletAvatar(accountId);
      
      if (avatarUrl) {
        const success = await updateWalletAvatar(accountId, avatarUrl);
        if (success) {
          debug.log('Avatar generated and updated successfully');
          toast({
            title: "Welcome!",
            description: "A unique avatar has been generated for your wallet.",
          });
        }
      }
    } catch (error) {
      debug.error('Failed to generate avatar for wallet', error);
    }
  }, [debug]);

  // Function to save wallet to database after connection
  const saveConnectedWallet = useCallback(async (accountId: string, publicKey: string | null) => {
    try {
      debug.log('Saving connected wallet to database', { accountId });
      
      // Check if wallet already exists in database
      const { data: existingWallet } = await supabase
        .from('hedera_wallets')
        .select('id')
        .eq('account_id', accountId)
        .maybeSingle();
      
      if (existingWallet) {
        debug.log('Wallet already exists, updating connection time');
        
        // Update the existing wallet's connection time
        await supabase
          .from('hedera_wallets')
          .update({ 
            last_connected_at: new Date().toISOString(),
            public_key: publicKey 
          })
          .eq('account_id', accountId);
        
        debug.log('Updated existing wallet connection');
        return;
      }
      
      // Create new wallet entry
      const { error: insertError } = await supabase
        .from('hedera_wallets')
        .insert({
          account_id: accountId,
          public_key: publicKey,
          wallet_name: `Wallet ${accountId}`,
          is_primary: true,
          last_connected_at: new Date().toISOString(),
        });
      
      if (insertError) {
        debug.error('Failed to create wallet entry', insertError);
        return;
      }
      
      debug.log('Created new wallet entry');
      
      // Generate avatar for new wallet
      generateAvatarForWallet(accountId);
      
      toast({
        title: "Wallet Connected",
        description: `Connected ${accountId}`,
      });
      
    } catch (error) {
      debug.error('Failed to save wallet to database', error);
    }
  }, [debug, generateAvatarForWallet]);

  // Stable event handler functions - stored in refs to avoid recreating
  const sessionUpdateHandler = useRef((event: any) => {
    debug.log('Session updated', event);
    try {
      const session = connectorRef.current?.walletConnectClient?.session?.getAll()[0];
      const newAccountId = getAccountIdFromSession(session);
      const currentAccountId = walletRef.current.accountId;
      
      if (newAccountId !== currentAccountId) {
        debug.log('Account changed', { from: currentAccountId, to: newAccountId });
        setWallet(prev => ({ 
          ...prev, 
          accountId: newAccountId,
          isConnected: !!newAccountId 
        }));
        
        if (newAccountId) {
          toast({
            title: "Account Changed",
            description: `Switched to ${newAccountId}`,
          });
        }
      }
    } catch (error) {
      debug.error('Failed to handle session update', error);
    }
  });

  const sessionDeleteHandler = useRef(() => {
    debug.log('Session deleted - disconnecting wallet');
    setWallet({
      isConnected: false,
      accountId: null,
      publicKey: null,
    });
  });

  // Attach event listeners safely
  const handleSessionEvents = useCallback((connector: DAppConnector) => {
    connectorRef.current = connector;
    const client = connector.walletConnectClient;
    if (!client) return;

    // Remove existing listeners
    client.off("session_update", sessionUpdateHandler.current);
    client.off("session_delete", sessionDeleteHandler.current);
    
    // Add event listeners - only use supported events
    client.on("session_update", sessionUpdateHandler.current);
    client.on("session_delete", sessionDeleteHandler.current);
    
    debug.log('Session event listeners attached');
  }, [debug]);

  // Enhanced session cleanup
  const cleanupOrphanedSessions = useCallback(async () => {
    const connector = connectorRef.current;
    if (!connector?.walletConnectClient?.session) return;

    try {
      const sessions = connector.walletConnectClient.session.getAll();
      debug.log(`Found ${sessions.length} existing sessions, cleaning up...`);
      
      for (const session of sessions) {
        try {
          await connector.walletConnectClient.session.delete(session.topic, {
            code: 6000,
            message: "Cleaning up for fresh connection",
          });
        } catch (error) {
          debug.error('Failed to delete session', error);
        }
      }
    } catch (error) {
      debug.error('Failed to cleanup sessions', error);
    }
  }, [debug]);

  // Cleanup function to remove event listeners
  const cleanupEventListeners = useCallback(() => {
    const connector = connectorRef.current;
    if (connector?.walletConnectClient) {
      debug.log('Removing event listeners');
      connector.walletConnectClient.off('session_update', sessionUpdateHandler.current);
      connector.walletConnectClient.off('session_delete', sessionDeleteHandler.current);
    }
  }, [debug]);

  // Global error handler for WalletConnect DataCloneError
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.name === 'DataCloneError' && event.error?.message?.includes('URL object could not be cloned')) {
        debug.log('Suppressed WalletConnect DataCloneError - this is a known WalletConnect issue');
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [debug]);

  // Initialize DAppConnector only once on mount
  useEffect(() => {
    const init = async () => {
      try {
        debug.log('Initializing wallet connector');
        
        // Wrap fetch to handle URL cloning issues
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
          try {
            return await originalFetch.apply(this, args);
          } catch (error: any) {
            if (error.name === 'DataCloneError') {
              debug.log('Handled DataCloneError in fetch');
              return new Response('{}', { status: 200, statusText: 'OK' });
            }
            throw error;
          }
        };
        
        const metadata = {
          name: "Prism Market",
          description: "Prediction Markets on Hedera",
          url: window.location.origin,
          icons: [""],
        };

        const targetLedger = isMainnet() ? LedgerId.MAINNET : LedgerId.TESTNET;
        const targetChainId = isMainnet() ? HederaChainId.Mainnet : HederaChainId.Testnet;

        const connector = new DAppConnector(
          metadata,
          targetLedger,
          import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
          Object.values(HederaJsonRpcMethod),
          [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
          [targetChainId]
        );

        // Initialize with enhanced error handling and serialization fixes
        await connector.init({ 
          logger: "error"
        });
        
        // Restore original fetch
        window.fetch = originalFetch;
        
        handleSessionEvents(connector);
        setWalletConnector(connector);
        
        // Proper session restoration using connector session
        const sessions = connector.walletConnectClient?.session?.getAll() || [];
        if (sessions.length > 0) {
          debug.log('Found existing session, attempting to restore');
          try {
            const session = sessions[0];
            const accountId = getAccountIdFromSession(session);
            
            if (accountId) {
              // Auto-fetch public key for restored session
              const publicKey = await fetchPublicKey(accountId);
              
              setWallet({
                isConnected: true,
                accountId,
                publicKey,
              });
              
              // Save restored wallet to database
              await saveConnectedWallet(accountId, publicKey);
              
              debug.log('Session restored successfully', { accountId, publicKey: !!publicKey });
              toast({
                title: "Wallet Reconnected",
                description: `Connected to ${accountId}`,
              });
            }
          } catch (error) {
            debug.error('Failed to restore session', error);
          }
        }
        
        debug.log('Wallet connector initialized successfully');
      } catch (error) {
        debug.error("Failed to initialize DAppConnector", error);
        toast({
          title: "Initialization Failed",
          description: "Failed to initialize wallet connector. Please refresh the page.",
          variant: "destructive",
        });
      }
    };

    init();
    
    // Cleanup function - only remove event listeners (preserve session persistence)
    return () => {
      debug.log('Cleaning up wallet connector');
      
      // Only remove event listeners, don't delete sessions for persistence
      cleanupEventListeners();
      
      // Clear refs
      connectorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    if (!walletConnector) {
      debug.error('Wallet connector not initialized');
      toast({
        title: "Connection Error",
        description: "Wallet connector not ready. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    debug.log('Initiating wallet connection');
    
    try {
      // Clean up any orphaned sessions first
      await cleanupOrphanedSessions();

      // Enhanced user feedback for HashPack flow
      toast({
        title: "Opening wallet selection...",
        description: "Choose your preferred wallet. HashPack will open in a new tab.",
      });
      
      // Open the modal and wait for user interaction
      const modalPromise = walletConnector.openModal();
      
      // Monitor modal closure more reliably
      const modalObserver = new Promise<void>((resolve) => {
        const checkModal = () => {
          const modal = document.querySelector("[data-testid='wcm-modal'], .wcm-modal, [id*='walletconnect']");
          if (!modal) {
            resolve();
            return;
          }
          requestAnimationFrame(checkModal);
        };
        // Start checking after a small delay
        setTimeout(checkModal, 100);
      });

      // Wait for modal interaction
      await Promise.race([modalPromise, modalObserver]);
      
      // Update user feedback - HashPack specific
      toast({
        title: "Connecting to HashPack...",
        description: "Please approve the connection in your HashPack extension or the opened tab.",
      });

      // Enhanced polling with exponential backoff
      let session = null;
      let attempt = 0;
      const maxAttempts = 60; // 60 attempts over ~60 seconds
      
      while (attempt < maxAttempts && !session) {
        // Exponential backoff: start with 500ms, max 3s
        const delay = Math.min(500 * Math.pow(1.1, attempt), 3000);
        await new Promise(r => setTimeout(r, delay));
        
        session = walletConnector.walletConnectClient?.session?.getAll()[0];
        
        if (session) {
          debug.log(`Session found on attempt ${attempt + 1}`, session);
          break;
        }
        
        // Provide progress feedback every 10 attempts (roughly every 10-15 seconds)
        if (attempt % 10 === 9) {
          const remainingTime = Math.ceil((maxAttempts - attempt) / 2);
          toast({
            title: "Still connecting...",
            description: `Please complete the approval in HashPack. Timeout in ~${remainingTime}s`,
          });
        }
        
        attempt++;
      }

      if (!session) {
        throw new Error("Connection timeout - please try again and ensure you approve the connection in HashPack");
      }

      const accountId = getAccountIdFromSession(session);
      if (!accountId) {
        throw new Error(`No ${hederaConfig.displayName} accounts found in your wallet`);
      }

      debug.log('Connection successful, fetching public key', { accountId });
      
      // Final connection steps
      const walletType = (window as any).hashpack ? "HashPack" : "WalletConnect";
      const publicKey = await fetchPublicKey(accountId);

      setWallet({ isConnected: true, accountId, publicKey });
      setSessionStartTime(Date.now()); // Start session timer
      
      // Save wallet to database
      await saveConnectedWallet(accountId, publicKey);
      
      toast({ 
        title: "Wallet Connected Successfully!", 
        description: `Connected to ${accountId} via ${walletType}` 
      });
      
    } catch (error: any) {
      debug.error("Wallet connect failed", error);
      
      let errorMessage = "Failed to connect wallet.";
      if (error.message?.includes("timeout")) {
        errorMessage = "Connection timed out. Please ensure you approve the connection in HashPack and try again.";
      } else if (error.message?.includes("No") && error.message?.includes("accounts")) {
        errorMessage = `No accounts found. Please ensure your wallet is configured for ${hederaConfig.displayName}.`;
      } else if (error.message?.includes("User rejected")) {
        errorMessage = "Connection cancelled. Please approve the connection in your wallet to continue.";
      }
      
      toast({ 
        title: "Connection Failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
      
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    try {
      if (walletConnector?.walletConnectClient?.session) {
        const sessions = walletConnector.walletConnectClient.session.getAll();
        for (const session of sessions) {
          await walletConnector.walletConnectClient.session.delete(session.topic, {
            code: 6000,
            message: "User disconnected",
          });
        }
      }
      
      // Clear session state
      setWallet({ isConnected: false, accountId: null, publicKey: null });
      setSessionStartTime(null);
      setSessionTimeRemaining(null);
      setShowWarningDialog(false);
      
      toast({ title: "Wallet Disconnected", description: "Your wallet has been disconnected" });
    } catch (error) {
      debug.error("Error disconnecting", error);
      toast({ title: "Disconnect Error", description: "Could not fully disconnect.", variant: "destructive" });
    }
  };

  const contextValue = useMemo(
    () => ({ 
      wallet, 
      connect, 
      disconnect, 
      isLoading, 
      walletConnector,
      extendSession,
      sessionTimeRemaining,
    }),
    [wallet, connect, disconnect, isLoading, walletConnector, extendSession, sessionTimeRemaining]
  );

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
      <InactivityWarningDialog
        open={showWarningDialog}
        onExtendSession={extendSession}
        onDisconnect={handleSessionTimeout}
        warningDuration={WARNING_THRESHOLD}
      />
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
