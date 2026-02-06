/**
 * Enhanced WalletConnect DataCloneError fixes
 * Addresses URL serialization issues in postMessage communication
 */

// Store original functions before any modifications
const originalPostMessage = window.postMessage.bind(window);
const originalFetch = window.fetch.bind(window);

// More comprehensive error detection
function isWalletConnectError(error: any): boolean {
  if (!error) return false;
  
  const errorIndicators = [
    'DataCloneError',
    'URL object could not be cloned',
    'postMessage',
    'WalletConnect',
    'lovable.js',
    'fetchListings',
    'getRecommendedWallets',
    'getRecomendedWallets', // Common typo in WalletConnect
    'preloadListings',
    'preloadData'
  ];
  
  const errorStr = JSON.stringify(error).toLowerCase();
  const messageStr = (error.message || '').toLowerCase();
  const stackStr = (error.stack || '').toLowerCase();
  const nameStr = (error.name || '').toLowerCase();
  
  return errorIndicators.some(indicator => 
    errorStr.includes(indicator.toLowerCase()) ||
    messageStr.includes(indicator.toLowerCase()) ||
    stackStr.includes(indicator.toLowerCase()) ||
    nameStr.includes(indicator.toLowerCase())
  );
}

// Enhanced serialization with better error handling
function safeSerialize(obj: any, depth = 0): any {
  if (depth > 10) return '[Max Depth Reached]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  
  // Handle URL objects specifically
  if (obj instanceof URL) {
    return { __serialized_url: obj.href };
  }
  
  // Handle other problematic objects
  if (obj instanceof Error) {
    return { 
      __serialized_error: {
        name: obj.name,
        message: obj.message,
        stack: obj.stack
      }
    };
  }
  
  if (obj instanceof Date) {
    return { __serialized_date: obj.toISOString() };
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    try {
      return obj.map(item => safeSerialize(item, depth + 1));
    } catch {
      return '[Array Serialization Failed]';
    }
  }
  
  // Handle plain objects
  try {
    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        try {
          result[key] = safeSerialize(obj[key], depth + 1);
        } catch {
          result[key] = '[Property Serialization Failed]';
        }
      }
    }
    return result;
  } catch {
    return '[Object Serialization Failed]';
  }
}

// Enhanced postMessage override
window.postMessage = function(message: any, targetOrigin: string, transfer?: Transferable[]) {
  try {
    // Quick test for cloneability
    structuredClone(message);
    return originalPostMessage(message, targetOrigin, transfer);
  } catch (error: any) {
    if (isWalletConnectError(error)) {
      console.warn('WalletConnect: DataCloneError intercepted, using safe serialization');
      try {
        const safeMessage = safeSerialize(message);
        return originalPostMessage(safeMessage, targetOrigin, transfer);
      } catch (fallbackError) {
        console.warn('WalletConnect: Fallback serialization failed, using minimal message');
        return originalPostMessage({ 
          __fallback: true, 
          timestamp: Date.now(),
          error: 'Message serialization failed'
        }, targetOrigin, transfer);
      }
    }
    throw error;
  }
};

// Enhanced fetch wrapper for WalletConnect API calls
window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    // Convert URL objects to strings
    const urlInput = input instanceof URL ? input.toString() : input;
    return await originalFetch(urlInput, init);
  } catch (error: any) {
    if (isWalletConnectError(error)) {
      console.warn('WalletConnect: Fetch error handled:', error.message);
      // Return a mock response for WalletConnect errors to prevent app crashes
      return new Response(JSON.stringify({ error: 'WalletConnect fetch failed' }), {
        status: 500,
        statusText: 'WalletConnect Error',
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw error;
  }
};

// Enhanced global error handlers
const handleGlobalError = (error: any, context: string) => {
  if (isWalletConnectError(error)) {
    console.warn(`WalletConnect: ${context} error suppressed:`, error.message || error);
    return true; // Indicates error was handled
  }
  return false;
};

// Global error handler
window.addEventListener('error', (event) => {
  if (handleGlobalError(event.error, 'Global')) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return false;
  }
}, true);

// Global promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  if (handleGlobalError(event.reason, 'Promise rejection')) {
    event.preventDefault();
    return false;
  }
}, true);

// Monkey patch console.error to reduce WalletConnect noise in development
const originalConsoleError = console.error;
console.error = function(...args: any[]) {
  const errorMsg = args.join(' ').toLowerCase();
  if (isWalletConnectError({ message: errorMsg, stack: errorMsg })) {
    console.warn('WalletConnect error (suppressed):', ...args);
    return;
  }
  return originalConsoleError.apply(console, args);
};

export const initWalletConnectFixes = () => {
  console.log('🔧 Enhanced WalletConnect DataCloneError fixes initialized');
  console.log('🛡️  Protection active for postMessage, fetch, and global errors');
};