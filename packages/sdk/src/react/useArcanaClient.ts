/**
 * React hook for ArcanaClient
 * 
 * Provides a complete React integration with:
 * - Client creation and initialization
 * - Authentication state management
 * - Auto token refresh
 * - Device auth integration
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArcanaClient, ArcanaClientConfig } from '../client.js';
import { ChainModule } from '../chain/index.js';
import type { ChainConfig } from '../chain/types.js';
import type { DeploymentConfig } from '../config/types.js';

export interface UseArcanaClientOptions extends ArcanaClientConfig {
  /** Auto-initialize on mount (default: true) */
  autoInit?: boolean;
  /** Default RPC URL for chain interactions */
  rpcUrl?: string;
}

export interface UseArcanaClientResult {
  /** The ArcanaClient instance */
  client: ArcanaClient;
  /** Chain module for on-chain interactions (available after deployment config loaded) */
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
  
  // Deployment configuration
  /** Deployment configuration from server */
  deploymentConfig: DeploymentConfig | null;
  /** Whether deployment config is loading */
  isLoadingConfig: boolean;
  
  // Actions
  /** 
   * Authenticate with device auth.
   * Requires a wallet client from wagmi or viem.
   */
  authenticate: (
    walletClient: any,
    address: `0x${string}`,
    deviceName?: string
  ) => Promise<void>;
  /** Sign out and clear auth state */
  signOut: () => Promise<void>;
  /** Refresh deployment configuration from server */
  refreshConfig: () => Promise<DeploymentConfig>;
  /** Get the current access token */
  getAccessToken: () => string | null;
  /** Ensure access token is valid (refresh if needed) */
  ensureAccessToken: () => Promise<boolean>;
}

/**
 * React hook for using ArcanaClient.
 * 
 * This hook manages:
 * - Client creation and lifecycle
 * - Authentication state
 * - Deployment configuration loading
 * - Chain module for on-chain interactions
 * 
 * @example
 * ```tsx
 * function App() {
 *   const { client, isAuthenticated, authenticate, signOut } = useArcanaClient({
 *     apiUrl: 'http://localhost:3003',
 *   });
 *   
 *   const { address } = useAccount();
 *   const { data: walletClient } = useWalletClient();
 *   
 *   const handleLogin = async () => {
 *     if (walletClient && address) {
 *       await authenticate(walletClient, address);
 *     }
 *   };
 *   
 *   return (
 *     <div>
 *       {isAuthenticated ? (
 *         <button onClick={signOut}>Sign Out</button>
 *       ) : (
 *         <button onClick={handleLogin}>Sign In</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useArcanaClient(
  options: UseArcanaClientOptions = {}
): UseArcanaClientResult {
  const { autoInit = true, rpcUrl = 'http://localhost:8545', ...clientConfig } = options;

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

  // Create client (memoized)
  const client = useMemo(() => new ArcanaClient(clientConfig), []);

  // Chain module (created when deployment config is available)
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
        try {
          const config = await client.config.getDeploymentConfig(rpcUrl);
          setDeploymentConfig(config);
        } catch (e) {
          console.warn('Failed to load deployment config:', e);
        }
      } catch (error) {
        console.error('Failed to initialize ArcanaClient:', error);
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

        // Get domain info
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
        console.error('Authentication error:', error);
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
    await client.signOut();
    setIsAuthenticated(false);
    setUserId(null);
    setDeviceId(null);
    setAuthError(null);
  }, [client]);

  // Refresh config
  const refreshConfig = useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      client.config.clearCache();
      const config = await client.config.getDeploymentConfig(rpcUrl);
      setDeploymentConfig(config);
      return config;
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

  return {
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
    authenticate,
    signOut,
    refreshConfig,
    getAccessToken,
    ensureAccessToken,
  };
}

/**
 * Get a device name from the browser user agent.
 */
function getBrowserDeviceName(): string {
  if (typeof navigator === 'undefined') {
    return 'Unknown Device';
  }
  const ua = navigator.userAgent;
  const parts = ua.split(' ').slice(0, 3);
  return parts.join(' ') || 'Browser';
}

