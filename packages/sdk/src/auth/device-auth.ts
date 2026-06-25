/**
 * Device-Bound Authentication Module
 * 
 * Provides the main interface for device-bound authentication:
 * - Device registration with wallet signature (rare - first visit)
 * - Token refresh with rotating tokens (automatic)
 * - Access token management (short-lived)
 * - Request signing for mutations (DPoP-style)
 */

import type { Address, TypedDataDomain } from 'viem';
import type { WalletClient, Account } from 'viem';
import { AxiosInstance } from 'axios';
import { extractData, ApiResponse } from '../types/common.js';
import type { ArcanaWalletAdapter } from './wallet-adapter.js';
import { isArcanaWalletAdapter } from './wallet-adapter.js';
import type {
  DeviceAuthConfig,
  DeviceKeyStorage,
  TokenStorage,
  DeviceRegistrationRequest,
  DeviceRegistrationResponse,
  TokenRefreshResponse,
  DeviceInfo,
  NonceResponse,
  StoredTokens,
} from './device-types.js';
import { NonceManager, createSigningInterceptor } from './request-signing.js';

// Domain constants - must match server expectations
const DOMAIN_NAME = 'Arcana';
const DOMAIN_VERSION = '1';

/**
 * Generate a random nonce for device registration.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Device-bound authentication module.
 * 
 * This module handles the complete device auth flow:
 * 1. Device registration (wallet signature required)
 * 2. Token refresh (automatic, no wallet interaction)
 * 3. Request signing (transparent to the caller)
 */
export class DeviceAuthModule {
  private nonceManager: NonceManager;
  private refreshPromise: Promise<boolean> | null = null;
  private refreshPromiseStartTime: number = 0;
  private config: Required<DeviceAuthConfig>;

  constructor(
    private api: AxiosInstance,
    private keyStorage: DeviceKeyStorage,
    private tokenStorage: TokenStorage,
    config: DeviceAuthConfig = {}
  ) {
    // Default configuration
    this.config = {
      enabled: config.enabled ?? true,
      refreshBuffer: config.refreshBuffer ?? 30000, // 30 seconds before expiry
      envelopeExpiry: config.envelopeExpiry ?? 60000, // 1 minute
      defaultScopeId: config.defaultScopeId ?? '__global__',
    };

    // Create nonce manager
    this.nonceManager = new NonceManager(async (scopeId) => {
      const response = await this.api.get<ApiResponse<NonceResponse>>(
        `/auth/nonce/${encodeURIComponent(scopeId)}`
      );
      return extractData(response).nonce;
    });

    // Install signing interceptor
    if (this.config.enabled) {
      this.api.interceptors.request.use(
        createSigningInterceptor({
          keyStorage: this.keyStorage,
          getTokens: () => this.tokenStorage.getSync(),
          nonceManager: this.nonceManager,
          isEnabled: () => this.config.enabled,
        })
      );
    }
  }

  // ==========================================================================
  // Device Registration
  // ==========================================================================

  /**
   * Register a new device with wallet signature.
   * 
   * This should only be called when:
   * - First visit (no device key exists)
   * - Refresh token expired
   * - Device was revoked
   * 
   * @param walletClient - Viem wallet client for signing
   * @param address - User's wallet address
   * @param chainId - Chain ID for EIP-712
   * @param verifyingContract - Verifying contract for EIP-712
   * @param deviceName - Optional device name for user reference
   */
  async registerDevice(
    walletClient: WalletClient | Account | ArcanaWalletAdapter,
    address: Address,
    chainId: number,
    verifyingContract: Address,
    deviceName?: string
  ): Promise<DeviceRegistrationResponse> {
    const normalizedAddress = address.toLowerCase();
    await this.activateWallet(address);
    const storedTokens = await this.tokenStorage.get();
    const storedWalletAddress = storedTokens.walletAddress?.toLowerCase() ?? null;
    const trackedKeyOwner =
      typeof this.keyStorage.getKeyOwner === 'function'
        ? await this.keyStorage.getKeyOwner()
        : null;

    // Generate device key if not exists
    let publicKeyHex = await this.keyStorage.getPublicKey();
    const effectiveKeyOwner = trackedKeyOwner ?? storedWalletAddress;
    if (publicKeyHex && effectiveKeyOwner && effectiveKeyOwner !== normalizedAddress) {
      await this.keyStorage.clear();
      publicKeyHex = null;
    }

    if (publicKeyHex && !effectiveKeyOwner) {
      await this.keyStorage.clear();
      publicKeyHex = null;
    }

    if (!publicKeyHex) {
      publicKeyHex = await this.keyStorage.generateKey(normalizedAddress);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = generateNonce();

    // Create EIP-712 typed data for device registration
    const domain: TypedDataDomain = {
      name: DOMAIN_NAME,
      version: DOMAIN_VERSION,
      chainId,
      verifyingContract,
    };

    const types = {
      DeviceRegistration: [
        { name: 'userAddress', type: 'address' },
        { name: 'devicePubkey', type: 'string' },
        { name: 'timestamp', type: 'uint256' },
        { name: 'nonce', type: 'string' },
      ],
    } as const;

    const message = {
      userAddress: address,
      devicePubkey: publicKeyHex,
      timestamp: BigInt(timestamp),
      nonce,
    };

    // Sign with wallet
    let signature: `0x${string}`;
    
    const isWalletClient = (obj: WalletClient | Account | ArcanaWalletAdapter): obj is WalletClient => {
      return 'signTypedData' in obj && typeof (obj as any).signTypedData === 'function';
    };

    if (isArcanaWalletAdapter(walletClient)) {
      const adapterAddress = (await walletClient.getAddress()).toLowerCase();
      if (adapterAddress !== normalizedAddress) {
        throw new Error(`Wallet adapter address ${adapterAddress} does not match requested address ${normalizedAddress}`);
      }

      signature = await walletClient.signTypedData({
        account: address,
        domain,
        types,
        primaryType: 'DeviceRegistration',
        message,
      });
    } else if (isWalletClient(walletClient)) {
      signature = await walletClient.signTypedData({
        account: address,
        domain,
        types,
        primaryType: 'DeviceRegistration',
        message,
      });
    } else {
      const account = walletClient as Account;
      if (!account.signTypedData) {
        throw new Error('Account does not support signTypedData');
      }
      signature = await account.signTypedData({
        domain,
        types,
        primaryType: 'DeviceRegistration',
        message,
      });
    }

    // Register with server
    const request: DeviceRegistrationRequest = {
      user_address: address,
      device_pubkey: publicKeyHex,
      device_name: deviceName,
      wallet_signature: signature,
      timestamp,
      nonce,
      chain_id: chainId,  // Send chain_id used for signing
    };

    const response = await this.api.post<ApiResponse<DeviceRegistrationResponse>>(
      '/auth/devices/register',
      request
    );
    const result = extractData(response);

    // Store initial tokens (now includes access token from server)
    // Also store the wallet address for API calls that need it
    await this.tokenStorage.store({
      deviceId: result.device_id,
      userId: result.user_id,
      walletAddress: normalizedAddress,
      refreshToken: result.refresh_token,
      accessToken: result.access_token,
      accessTokenId: result.access_token_id,
      accessExpiresAt: result.access_expires_at,
    });

    console.log('[DeviceAuth] Device registered successfully with initial access token', {
      deviceId: result.device_id,
      userId: result.user_id,
      walletAddress: normalizedAddress,
      accessExpiresAt: new Date(result.access_expires_at).toISOString(),
    });

    return result;
  }

  // ==========================================================================
  // Token Management
  // ==========================================================================

  /**
   * Refresh tokens (rotate refresh token, get new access token).
   * 
   * This is called automatically when access token expires.
   * The old refresh token is invalidated (rotation).
   */
  async refreshTokens(): Promise<boolean> {
    // Deduplicate concurrent refresh requests
    if (this.refreshPromise) {
      // Check for stale promise (hung for more than 30 seconds)
      const staleThreshold = 30000;
      const elapsed = Date.now() - this.refreshPromiseStartTime;
      
      if (elapsed > staleThreshold) {
        this.refreshPromise = null;
      } else {
        return this.refreshPromise;
      }
    }

    this.refreshPromiseStartTime = Date.now();
    this.refreshPromise = this.doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<boolean> {
    try {
      const tokens = await this.tokenStorage.get();
      if (!tokens.refreshToken) {
        return false;
      }
      
      console.log('[DeviceAuth] Calling /auth/token/refresh endpoint...');
      
      // Add timeout to the refresh request to prevent hanging
      const refreshRequest = this.api.post<ApiResponse<TokenRefreshResponse>>(
        '/auth/token/refresh',
        { refresh_token: tokens.refreshToken }
      );
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Refresh request timeout')), 15000)
      );
      
      const response = await Promise.race([refreshRequest, timeoutPromise]);
      const result = extractData(response);

      console.log('[DeviceAuth] Token refresh successful', {
        deviceId: result.device_id,
        userId: result.user_id,
        accessExpiresAt: new Date(result.access_expires_at).toISOString(),
        hasNewRefreshToken: !!result.refresh_token,
      });

      // Store new tokens (only update refresh token if a new one was provided)
      const tokensToStore: Partial<import('./device-types.js').StoredTokens> = {
        deviceId: result.device_id,
        userId: result.user_id,
        walletAddress: tokens.walletAddress,
        accessToken: result.access_token,
        accessTokenId: result.access_token_id,
        accessExpiresAt: result.access_expires_at,
      };
      
      if (result.refresh_token) {
        tokensToStore.refreshToken = result.refresh_token;
      }
      
      await this.tokenStorage.store(tokensToStore);

      // Verify the token was stored correctly
      const storedTokens = this.tokenStorage.getSync();
      if (!storedTokens?.accessToken || storedTokens.accessToken !== result.access_token) {
        return false;
      }

      // Clear nonce cache (server may have reset nonces)
      this.nonceManager.clearDevice(result.device_id);

      return true;
    } catch (error: any) {
      const errorStatus = error?.response?.status || error?.status;
      
      // If token is revoked or expired, clear auth silently
      if (errorStatus === 401 || errorStatus === 403) {
        await this.clearAuth();
      }
      return false;
    }
  }

  // Track failed auth attempts to prevent spam logging
  private lastFailedAuthLog: number = 0;
  private failedAuthCount: number = 0;
  
  /**
   * Ensure we have a valid access token.
   * Refreshes automatically if expired or about to expire.
   * 
   * This method is designed to be called frequently (before API requests)
   * so it minimizes logging to prevent console spam.
   */
  async ensureAccessToken(): Promise<boolean> {
    if (!this.config.enabled) {
      return true;
    }

    const tokens = this.tokenStorage.getSync();
    const isValid = this.isAccessTokenValid();
    
    if (isValid) {
      // Reset failed auth count on success
      this.failedAuthCount = 0;
      return true;
    }

    // Early return if no refresh token - user needs to authenticate
    if (!tokens?.refreshToken) {
      return false;
    }

    // Clear corrupted access token before refresh (keep refresh token)
    if (tokens?.accessToken) {
      const base64urlRegex = /^[A-Za-z0-9_-]+$/;
      if (!base64urlRegex.test(tokens.accessToken) || !tokens?.accessExpiresAt) {
        await this.tokenStorage.store({
          accessToken: null,
          accessTokenId: null,
          accessExpiresAt: null,
        });
      }
    }

    const result = await this.refreshTokens();
    
    if (result) {
      const newTokens = this.tokenStorage.getSync();
      return !!(newTokens?.accessToken && this.isAccessTokenValid());
    }
    return false;
  }

  /**
   * Check if access token is valid (not expired and properly formatted).
   */
  isAccessTokenValid(): boolean {
    const tokens = this.tokenStorage.getSync();
    if (!tokens?.accessToken || !tokens?.accessExpiresAt) {
      return false;
    }
    
    // Basic validation: check if token looks like valid base64url
    const base64urlRegex = /^[A-Za-z0-9_-]+$/;
    if (!base64urlRegex.test(tokens.accessToken)) {
      return false;
    }
    
    // Consider expired if within refresh buffer of expiry
    return tokens.accessExpiresAt > Date.now() + this.config.refreshBuffer;
  }

  /**
   * Check if we have a refresh token.
   */
  hasRefreshToken(): boolean {
    const tokens = this.tokenStorage.getSync();
    return !!tokens?.refreshToken;
  }

  /**
   * Get the current access token.
   */
  getAccessToken(): string | null {
    return this.tokenStorage.getSync()?.accessToken ?? null;
  }

  /**
   * Get current user ID.
   */
  getUserId(): string | null {
    return this.tokenStorage.getSync()?.userId ?? null;
  }

  /**
   * Get current device ID.
   */
  getDeviceId(): string | null {
    return this.tokenStorage.getSync()?.deviceId ?? null;
  }

  /**
   * Get current wallet address.
   */
  getWalletAddress(): string | null {
    return this.tokenStorage.getSync()?.walletAddress ?? null;
  }

  /**
   * Get access token expiry timestamp (milliseconds since epoch).
   * Returns null if no token or expiry info available.
   */
  getAccessTokenExpiry(): number | null {
    const tokens = this.tokenStorage.getSync();
    return tokens?.accessExpiresAt ?? null;
  }

  // ==========================================================================
  // Device Management
  // ==========================================================================

  /**
   * List all devices for the current user.
   */
  async listDevices(): Promise<DeviceInfo[]> {
    await this.ensureAccessToken();
    const response = await this.api.get<ApiResponse<DeviceInfo[]>>('/auth/devices');
    return extractData(response);
  }

  /**
   * Revoke a device.
   */
  async revokeDevice(deviceId: string, reason?: string): Promise<void> {
    await this.ensureAccessToken();
    await this.api.post(`/auth/devices/${deviceId}/revoke`, { reason });
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Initialize the device auth module.
   * Call this on app startup to restore auth state.
   */
  async init(): Promise<void> {
    await this.tokenStorage.init();
    const walletAddress = this.tokenStorage.getSync()?.walletAddress ?? null;
    if (walletAddress && typeof this.keyStorage.activateOwner === 'function') {
      await this.keyStorage.activateOwner(walletAddress);
    }
  }

  /**
   * Select the active wallet for device-key and token storage.
   *
   * Browser storage keeps one Arcana device session per wallet address so users
   * can switch wallets without destroying previous registrations.
   */
  async activateWallet(address: Address | string | null): Promise<void> {
    const normalizedAddress = address?.toLowerCase() ?? null;
    if (typeof this.keyStorage.activateOwner === 'function') {
      await this.keyStorage.activateOwner(normalizedAddress);
    }
    if (typeof this.tokenStorage.activateWallet === 'function') {
      await this.tokenStorage.activateWallet(normalizedAddress);
    }
  }

  /**
   * Check if user is authenticated.
   */
  isAuthenticated(): boolean {
    return this.hasRefreshToken();
  }

  /**
   * Clear all auth data (logout).
   */
  async clearAuth(): Promise<void> {
    console.log('[DeviceAuth] clearAuth: Starting...');
    
    // Revoke token on server (best effort, non-blocking). Some deployments may not expose
    // /auth/token/revoke (404) or token may already be invalid — ignore all errors.
    // Fire and forget with a short timeout to avoid blocking disconnect.
    const tokens = this.tokenStorage.getSync();
    if (tokens?.accessToken) {
      console.log('[DeviceAuth] clearAuth: Revoking token on server (fire-and-forget)...');
      const accessToken = tokens.accessToken;
      // Don't await - fire and forget with short timeout
      Promise.race([
        this.api.post('/auth/token/revoke', undefined, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      ]).catch(() => {
        // 404 = route not present; 401/403 = token already invalid; timeout = slow server
        // All expected, sign out locally regardless.
      });
    }

    // Clear local storage immediately (don't wait for server)
    console.log('[DeviceAuth] clearAuth: Clearing key storage...');
    await this.keyStorage.clear();
    console.log('[DeviceAuth] clearAuth: Clearing token storage...');
    await this.tokenStorage.clear();
    this.nonceManager.clearAll();
    console.log('[DeviceAuth] clearAuth: Complete');
  }

  /**
   * Sign out (alias for clearAuth).
   */
  async signOut(): Promise<void> {
    console.log('[DeviceAuth] signOut: Calling clearAuth...');
    await this.clearAuth();
    console.log('[DeviceAuth] signOut: Complete');
  }
}
