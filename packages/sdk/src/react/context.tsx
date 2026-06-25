/**
 * ArcanaProvider - React Context for Arcana SDK
 * 
 * Provides a centralized way to manage Arcana client state across React apps.
 * Wraps your app in ArcanaProvider to enable all Arcana hooks.
 * 
 * @example
 * ```tsx
 * import { ArcanaProvider } from '@arcanahq/sdk';
 * import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
 * import { WagmiProvider } from 'wagmi';
 * 
 * const queryClient = new QueryClient();
 * 
 * function App() {
 *   return (
 *     <WagmiProvider config={wagmiConfig}>
 *       <QueryClientProvider client={queryClient}>
 *         <ArcanaProvider apiUrl="http://localhost:3003">
 *           <MyApp />
 *         </ArcanaProvider>
 *       </QueryClientProvider>
 *     </WagmiProvider>
 *   );
 * }
 * ```
 */

import React, { createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { ArcanaClient, ArcanaClientConfig } from '../client.js';
import { ChainModule } from '../chain/index.js';
import type { DeploymentConfig } from '../config/types.js';

// =============================================================================
// Types
// =============================================================================

export interface ArcanaContextValue {
  /** The ArcanaClient instance */
  client: ArcanaClient;
  
  /** Chain module for on-chain interactions */
  chain: ChainModule | null;
  
  // Authentication state
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Current user ID */
  userId: string | null;
  /** Current device ID (device auth only) */
  deviceId: string | null;
  /** Whether authentication is in progress */
  isAuthenticating: boolean;
  /** Authentication error message */
  authError: string | null;
  /** Whether the client is initializing */
  isInitializing: boolean;
  
  // Configuration
  /** Deployment configuration from server */
  deploymentConfig: DeploymentConfig | null;
  /** Whether deployment config is loading */
  isLoadingConfig: boolean;
  /** API URL */
  apiUrl: string;
  
  // Actions
  /** Authenticate with device auth */
  authenticate: (
    walletClient: any,
    address: `0x${string}`,
    deviceName?: string
  ) => Promise<void>;
  /** Sign out and clear auth state */
  signOut: () => Promise<void>;
  /** Refresh deployment configuration */
  refreshConfig: () => Promise<DeploymentConfig>;
  /** Get current access token */
  getAccessToken: () => string | null;
  /** Ensure access token is valid */
  ensureAccessToken: () => Promise<boolean>;
}

export interface ArcanaProviderProps extends ArcanaClientConfig {
  children: React.ReactNode;
  /** Auto-initialize on mount (default: true) */
  autoInit?: boolean;
  /** Default RPC URL for chain interactions */
  rpcUrl?: string;
}

// =============================================================================
// Context
// =============================================================================

const ArcanaContext = createContext<ArcanaContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

/**
 * ArcanaProvider - Wrap your app to enable Arcana hooks.
 * 
 * Must be used inside:
 * - WagmiProvider (for wallet integration)
 * - QueryClientProvider (for TanStack Query)
 */
export function ArcanaProvider({
  children,
  autoInit = true,
  rpcUrl = 'http://localhost:8545',
  ...clientConfig
}: ArcanaProviderProps): React.ReactElement {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(autoInit);

  // Config state
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Create client (memoized by apiUrl)
  const apiUrl = clientConfig.apiUrl || 'http://localhost:3003';
  const clientRef = useRef<ArcanaClient | null>(null);
  
  const client = useMemo(() => {
    if (!clientRef.current) {
      clientRef.current = new ArcanaClient({ ...clientConfig, apiUrl });
    }
    return clientRef.current;
  }, [apiUrl]);

  // Chain module
  const chain = useMemo(() => {
    if (!deploymentConfig) return null;
    return new ChainModule({
      chainId: deploymentConfig.chainId,
      rpcUrl: deploymentConfig.rpcUrl || rpcUrl,
    });
  }, [deploymentConfig, rpcUrl]);

  // Initialize client
  useEffect(() => {
    if (!autoInit) {
      setIsInitializing(false);
      return;
    }

    async function init() {
      try {
        await client.init();

        // Check existing auth
        if (client.isAuthenticated()) {
          setIsAuthenticated(true);
          if (client.deviceAuth) {
            setUserId(client.deviceAuth.getUserId());
            setDeviceId(client.deviceAuth.getDeviceId());
          }
        }

        // Load deployment config
        // Clear cache first to ensure we get fresh data
        client.config.clearCache();
        try {
          const config = await client.config.getDeploymentConfig(rpcUrl, false); // Force fresh fetch
          setDeploymentConfig(config);
        } catch (e: any) {
          const errorMessage = e?.message || String(e);
          const isNoBankConfig =
            /no bank configuration|bank capability (is not )?enabled|bank config/i.test(
              errorMessage
            );
          if (isNoBankConfig) {
            if (typeof console.debug === 'function') {
              console.debug(
                '[ArcanaProvider] Deployment config unavailable (bank not enabled):',
                errorMessage
              );
            }
          } else {
            console.warn('[ArcanaProvider] Failed to load deployment config:', {
              message: errorMessage,
              rpcUrl,
              apiUrl: clientConfig.apiUrl || 'http://localhost:3003',
            });
          }
          // Don't set deploymentConfig - let components handle the null state
        }
      } catch (error) {
        console.error('[ArcanaProvider] Failed to initialize:', error);
      } finally {
        setIsInitializing(false);
      }
    }

    init();
  }, [client, autoInit, rpcUrl]);

  // Authenticate
  const authenticate = useCallback(
    async (
      walletClient: any,
      address: `0x${string}`,
      deviceName?: string
    ) => {
      setAuthError(null);
      setIsAuthenticating(true);

      try {
        // Check if already authenticated
        if (client.isAuthenticated()) {
          const refreshed = await client.ensureAuthenticated();
          if (refreshed) {
            setIsAuthenticated(true);
            if (client.deviceAuth) {
              setUserId(client.deviceAuth.getUserId());
              setDeviceId(client.deviceAuth.getDeviceId());
            }
            return;
          }
        }

        // Device auth flow (required in browser/React contexts)
        if (!client.deviceAuth) {
          throw new Error('Device authentication is required but not available. This may indicate a configuration issue.');
        }

        const domainInfo = await client.auth.getDomainInfo();
        const verifyingContract = domainInfo.verifyingContract || domainInfo.verifying_contract;
        const chainId = domainInfo.chainId ?? deploymentConfig?.chainId ?? 31337;

        if (!verifyingContract) {
          throw new Error('No verifying contract available');
        }

        await client.deviceAuth.registerDevice(
          walletClient,
          address,
          chainId,
          verifyingContract as `0x${string}`,
          deviceName || getBrowserDeviceName()
        );

        setIsAuthenticated(true);
        setUserId(client.deviceAuth.getUserId());
        setDeviceId(client.deviceAuth.getDeviceId());
      } catch (error: any) {
        console.error('[ArcanaProvider] Authentication error:', error);
        setIsAuthenticated(false);
        
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          setAuthError('Server not running. Please start the Arcana server.');
        } else {
          setAuthError(error.message || 'Authentication failed');
        }
        throw error;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [client, deploymentConfig]
  );

  // Sign out
  const signOut = useCallback(async () => {
    console.log('[ArcanaProvider] signOut: Starting...');
    try {
      await client.signOut();
      console.log('[ArcanaProvider] signOut: client.signOut() completed');
    } catch (error) {
      console.error('[ArcanaProvider] signOut: client.signOut() error:', error);
      // Continue to clear state even if server call fails
    }
    setIsAuthenticated(false);
    setUserId(null);
    setDeviceId(null);
    setAuthError(null);
    console.log('[ArcanaProvider] signOut: React state cleared');
  }, [client]);

  // Refresh config
  const refreshConfig = useCallback(async (chainId?: number) => {
    setIsLoadingConfig(true);
    try {
      client.config.clearCache();
      // Try to get wallet chain ID if not provided
      let walletChainId = chainId;
      if (!walletChainId && typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          const chainIdHex = await (window as any).ethereum.request({ method: 'eth_chainId' });
          walletChainId = parseInt(chainIdHex, 16);
        } catch (e) {
          console.warn('[ArcanaProvider] refreshConfig: Failed to get wallet chain ID:', e);
        }
      }
      const config = await client.config.getDeploymentConfig(rpcUrl, false, walletChainId);
      if (isNaN(config.chainId)) {
        console.error('[ArcanaProvider] refreshConfig: Config has invalid chainId:', config);
      }
      setDeploymentConfig(config);
      return config;
    } catch (error) {
      console.error('[ArcanaProvider] refreshConfig: Error:', error);
      throw error;
    } finally {
      setIsLoadingConfig(false);
    }
  }, [client, rpcUrl]);

  // Get access token
  const getAccessToken = useCallback(() => {
    if (client.deviceAuth) {
      return client.deviceAuth.getAccessToken();
    }
    return null;
  }, [client]);

  // Ensure access token
  const ensureAccessToken = useCallback(async () => {
    return client.ensureAuthenticated();
  }, [client]);

  // Periodic token refresh - refresh access token before it expires
  useEffect(() => {
    if (!isAuthenticated || !client.deviceAuth) {
      return;
    }

    const deviceAuth = client.deviceAuth; // Capture for closure

    // Immediate check on mount - refresh if token is already expired
    const checkAndRefresh = async () => {
      if (!deviceAuth) {
        console.warn('[ArcanaProvider] deviceAuth is null in checkAndRefresh');
        return;
      }
      try {
        const expiresAt = deviceAuth.getAccessTokenExpiry();
        const isValid = deviceAuth.isAccessTokenValid();
        
        // Refresh if token is invalid OR if it expires within the next 2 minutes
        const shouldRefresh = !isValid || (expiresAt && expiresAt < Date.now() + 120000);
        
        if (shouldRefresh) {
          const refreshed = await deviceAuth.ensureAccessToken();
          if (refreshed) {
            const newExpiresAt = deviceAuth.getAccessTokenExpiry();
            console.log('[ArcanaProvider] Token refreshed successfully', {
              newExpiresAt: newExpiresAt ? new Date(newExpiresAt).toISOString() : null,
            });
          } else {
            console.warn('[ArcanaProvider] Token refresh returned false');
          }
        }
      } catch (error) {
        // Log errors but don't spam console
        console.warn('[ArcanaProvider] Token refresh failed:', error);
      }
    };
    
    // Check immediately
    checkAndRefresh();

    // Check token validity periodically and refresh if needed
    // TEMPORARY: Check every 5 seconds for debugging
    const refreshInterval = setInterval(checkAndRefresh, 5_000); // Check every 5 seconds

    return () => {
      console.log('[ArcanaProvider] Cleaning up token refresh interval');
      clearInterval(refreshInterval);
    };
  }, [isAuthenticated, client]);

  // Context value
  const value = useMemo<ArcanaContextValue>(() => ({
    client,
    chain,
    isAuthenticated,
    userId,
    deviceId,
    isAuthenticating,
    authError,
    isInitializing,
    deploymentConfig,
    isLoadingConfig,
    apiUrl,
    authenticate,
    signOut,
    refreshConfig,
    getAccessToken,
    ensureAccessToken,
  }), [
    client,
    chain,
    isAuthenticated,
    userId,
    deviceId,
    isAuthenticating,
    authError,
    isInitializing,
    deploymentConfig,
    isLoadingConfig,
    apiUrl,
    authenticate,
    signOut,
    refreshConfig,
    getAccessToken,
    ensureAccessToken,
  ]);

  return (
    <ArcanaContext.Provider value={value}>
      {children}
    </ArcanaContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * useArcana - Access Arcana context from any component.
 * 
 * Must be used within an ArcanaProvider.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { client, isAuthenticated, authenticate, signOut } = useArcana();
 *   
 *   // Use client to access modules
 *   const loadBalances = async () => {
 *     const balances = await client.bank.getBalances();
 *     console.log(balances);
 *   };
 *   
 *   return (
 *     <div>
 *       {isAuthenticated ? (
 *         <button onClick={signOut}>Sign Out</button>
 *       ) : (
 *         <button onClick={() => authenticate(walletClient, address)}>
 *           Sign In
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useArcana(): ArcanaContextValue {
  const context = useContext(ArcanaContext);
  if (!context) {
    throw new Error('useArcana must be used within an ArcanaProvider');
  }
  return context;
}

/**
 * useArcanaClient - Get just the ArcanaClient instance.
 * 
 * Useful when you only need the client and not the full context.
 */
export function useArcanaClientFromContext(): ArcanaClient {
  const { client } = useArcana();
  return client;
}

// =============================================================================
// Helpers
// =============================================================================

function getBrowserDeviceName(): string {
  if (typeof navigator === 'undefined') {
    return 'Unknown Device';
  }
  const ua = navigator.userAgent;
  const parts = ua.split(' ').slice(0, 3);
  return parts.join(' ') || 'Browser';
}
