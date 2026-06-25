import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { decode } from '@msgpack/msgpack';
import { ArcanaApiError, ArcanaNetworkError } from './types/common.js';
import { AuthModule } from './auth/index.js';
import { 
  DeviceAuthModule, 
  DeviceKeyStorage, 
  TokenStorage,
  WebKeyStorage,
  WebTokenStorage,
  MemoryKeyStorage,
  MemoryTokenStorage,
  DeviceAuthConfig,
} from './auth/index.js';
import { ContractsModule } from './contracts/index.js';
import { HistoryModule } from './history/index.js';
import { TablesModule } from './tables/index.js';
import { TransactionsModule } from './transactions/index.js';
import { BillingModule } from './billing/index.js';
import { ScopesModule } from './scopes/index.js';
import { BankModule } from './bank/index.js';
import { Erc20Module } from './erc20/index.js';
import type { ChainConfig } from './chain/types.js';
import { ConfigModule } from './config/index.js';
import { EventsModule } from './events/index.js';
import { SubscriptionsModule } from './subscriptions/index.js';
import { createBillingHooks } from './hooks/billing.js';
import { createScopesHooks } from './hooks/scopes.js';
import { createAuthHooks } from './hooks/auth.js';
import { createBankHooks } from './hooks/bank.js';
import { createContractsHooks } from './hooks/contracts.js';
import { createConfigHooks } from './hooks/config.js';

function headerValue(headers: unknown, name: string): string {
  const lowerName = name.toLowerCase();
  if (!headers || typeof headers !== 'object') return '';
  const record = headers as Record<string, unknown>;
  const direct = record[name] ?? record[lowerName];
  if (typeof direct === 'string') return direct;
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === lowerName && typeof value === 'string') return value;
  }
  return '';
}

function toBytes(data: unknown): Uint8Array | null {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return null;
}

function decodeWireResponse(data: unknown, headers?: unknown): unknown {
  if (data == null) return data;
  if (typeof data === 'object' && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
    return data;
  }

  const contentType = headerValue(headers, 'content-type').toLowerCase();
  const isMsgpack =
    contentType.includes('application/msgpack') ||
    contentType.includes('application/x-msgpack');
  const isJson = contentType.includes('application/json');

  const bytes = toBytes(data);
  if (bytes) {
    if (isMsgpack) return decode(bytes, { useMap: false } as never);

    const text = new TextDecoder().decode(bytes);
    if (isJson || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    return text;
  }

  if (typeof data === 'string') {
    const text = data.trim();
    if (isJson || text.startsWith('{') || text.startsWith('[')) {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
  }

  return data;
}

export interface ArcanaClientConfig {
  apiUrl?: string;
  /** Legacy: Token getter (for session-based auth) */
  getToken?: () => string | null;
  /** Legacy: Token setter (for session-based auth) */
  setToken?: (token: string) => void;
  /** 
   * Use device-bound authentication (default: true in browser, false in Node.js)
   * Device auth provides:
   * - Reduced wallet prompts (sign once, rarely)
   * - Rotating refresh tokens with theft detection
   * - Per-request signing for mutations
   */
  useDeviceAuth?: boolean;
  /** Device key storage (default: WebKeyStorage in browser, MemoryKeyStorage in Node.js) */
  keyStorage?: DeviceKeyStorage;
  /** Token storage (default: WebTokenStorage in browser, MemoryTokenStorage in Node.js) */
  tokenStorage?: TokenStorage;
  /** Device auth configuration */
  deviceAuthConfig?: DeviceAuthConfig;
  /** Custom headers to add to all requests (useful for server-side API token auth) */
  customHeaders?: Record<string, string>;
  /** Optional EVM chain config enabling on-chain ERC20 reads (allowance, etc.). */
  chainConfig?: ChainConfig;
  /**
   * Called when a 401 is received and token refresh failed (e.g. no refresh token or refresh rejected).
   * Use this to trigger re-authentication (e.g. device registration / sign-in) in the UI.
   */
  onAuthRequired?: () => void | Promise<void>;
}

/**
 * Main Arcana client class
 * 
 * Provides access to all Arcana API modules with shared configuration.
 * 
 * Supports two authentication modes:
 * 1. **Device Auth** (default in browser): Device-bound authentication with rotating tokens
 * 2. **Session Auth** (legacy): Simple session tokens stored in localStorage
 */
export class ArcanaClient {
  private api: AxiosInstance;
  private useDeviceAuth: boolean;
  private keyStorage?: DeviceKeyStorage;
  private tokenStorage?: TokenStorage;
  private onAuthRequiredCallback?: () => void | Promise<void>;
  private hasNotifiedAuthRequired: boolean = false;
  
  /** Legacy session-based authentication */
  public readonly auth: AuthModule;
  /** Device-bound authentication (recommended) */
  public readonly deviceAuth?: DeviceAuthModule;
  /** Contract/instance interactions */
  public readonly contracts: ContractsModule;
  /**
   * Program/instance interactions.
   *
   * `contracts` is kept as a backwards-compatible alias while public Arcana
   * vocabulary moves to programs and instances.
   */
  public readonly programs: ContractsModule;
  /** User history */
  public readonly history: HistoryModule;
  /** Multiplayer tables */
  public readonly tables: TablesModule;
  /** Transaction tracking */
  public readonly transactions: TransactionsModule;
  /** Project billing management */
  public readonly billing: BillingModule;
  /** Scope/program/instance management */
  public readonly scopes: ScopesModule;
  /** On-chain bank (balances, transfers, withdrawals) */
  public readonly bank: BankModule;
  /** Optional ERC20 wrapper capability helpers (allowance/approve/deposit). */
  public readonly erc20: Erc20Module;
  /** Server configuration and metadata */
  public readonly config: ConfigModule;
  /** Real-time instance/scope subscriptions over SSE */
  public readonly subscriptions: SubscriptionsModule;
  /** Policy-aware historical event querying */
  public readonly events: EventsModule;

  constructor(config: ArcanaClientConfig = {}) {
    this.onAuthRequiredCallback = config.onAuthRequired;
    const apiUrl = config.apiUrl || 
      (typeof process !== 'undefined' && process.env.ARCANA_API_URL) ||
      'http://localhost:3003';

    // Determine if we should use device auth
    // Default: true in browser (IndexedDB available), false in Node.js
    const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
    this.useDeviceAuth = config.useDeviceAuth ?? isBrowser;

    // Create axios instance with timeout
    this.api = axios.create({
      baseURL: apiUrl,
      timeout: 30000, // 30 second timeout to prevent hanging requests
      responseType: 'arraybuffer',
      transformResponse: [decodeWireResponse],
      headers: {
        Accept: 'application/msgpack, application/x-msgpack, application/json',
        'Content-Type': 'application/json',
      },
    });

    // Set up storage
    if (this.useDeviceAuth) {
      this.keyStorage = config.keyStorage || (isBrowser ? new WebKeyStorage() : new MemoryKeyStorage());
      this.tokenStorage = config.tokenStorage || (isBrowser ? new WebTokenStorage() : new MemoryTokenStorage());
    }

    // Store token getter/setter for legacy auth
    const getToken = config.getToken || (() => {
      // For device auth, get from token storage
      if (this.useDeviceAuth && this.tokenStorage) {
        const tokens = this.tokenStorage.getSync();
        return tokens?.accessToken ?? null;
      }
      // Legacy: localStorage
      if (typeof window !== 'undefined') {
        return localStorage.getItem('auth_token');
      }
      return null;
    });

    const setToken = config.setToken || ((token: string) => {
      // For device auth, this is handled by deviceAuth module
      if (this.useDeviceAuth) {
        return;
      }
      // Legacy: localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', token);
      }
    });

    // Add auth token interceptor
    // NOTE: Token refresh is NON-BLOCKING to prevent UI delays.
    // If the token is expired, the 401 response handler will retry with a fresh token.
    this.api.interceptors.request.use(async (requestConfig) => {
      // Add custom headers first (if provided)
      if (config.customHeaders) {
        requestConfig.headers = requestConfig.headers || {};
        Object.entries(config.customHeaders).forEach(([key, value]) => {
          requestConfig.headers[key] = value;
        });
      }

      // Skip token handling for the refresh endpoint itself to avoid circular dependency
      const isRefreshRequest = requestConfig.url?.includes('/auth/token/refresh') || 
                               requestConfig.url === '/auth/token/refresh';
      
      if (!isRefreshRequest) {
        // For device auth, kick off a background refresh if token appears stale
        // This is fire-and-forget - we don't block the request waiting for it
        // The 401 response handler will retry if the token is actually expired
        if (this.deviceAuth && !this.deviceAuth.isAccessTokenValid()) {
          // Fire and forget - don't await
          this.deviceAuth.ensureAccessToken().catch(() => {
            // Silently ignore - 401 handler will take care of it
          });
        }
        
        // Attach whatever token we have (may be expired, 401 handler will retry)
        let token: string | null = null;
        try {
          token = getToken();
        } catch (e) {
          // Silently fail if token retrieval fails
        }
        
        if (token && token.length > 0) {
          requestConfig.headers.Authorization = `Bearer ${token}`;
        }
      }
      return requestConfig;
    });

    // Add error handling interceptor with automatic token refresh retry
    this.api.interceptors.response.use(
      (response) => {
        if (this.hasNotifiedAuthRequired && this.deviceAuth?.isAccessTokenValid()) {
          this.hasNotifiedAuthRequired = false;
        }
        return response;
      },
      async (error) => {
        // Skip 401 retry for the refresh endpoint itself to prevent deadlock
        // If refresh fails with 401, we can't refresh to fix it - just let the error propagate
        const url = error.config?.url || '';
        const isRefreshRequest = url.includes('/auth/token/refresh');
        
        // Handle 401 Unauthorized - force refresh token and retry once.
        // Use refreshTokens() instead of ensureAccessToken() so we don't
        // reuse a not-yet-expired but server-rejected access token.
        // Don't retry for refresh requests (would cause deadlock)
        if (error.response?.status === 401 && this.deviceAuth && !error.config._retry && !isRefreshRequest) {
          const originalRequest = error.config;
          originalRequest._retry = true; // Mark as retried to prevent infinite loops
          
          try {
            const refreshed = await this.deviceAuth.refreshTokens();
            
            if (refreshed) {
              // Get the fresh token after refresh
              let token: string | null = null;
              if (this.tokenStorage) {
                const tokens = this.tokenStorage.getSync();
                token = tokens?.accessToken ?? null;
              } else {
                token = getToken();
              }
              
              if (token) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return this.api(originalRequest);
              }
            }
            // Refresh failed (e.g. no refresh token or refresh rejected) - notify app to re-authenticate
            this.notifyAuthRequired();
          } catch (refreshError) {
            // Fall through to normal error handling
            this.notifyAuthRequired();
          }
        }
        
        // Normal error handling
        if (error.response) {
          // API returned an error response
          const { status, data } = error.response;
          const detailedMessage =
            data?.data?.reason ||
            data?.data?.error ||
            data?.data?.code ||
            data?.error ||
            data?.message ||
            (typeof data === 'string' ? data : undefined) ||
            error.message ||
            'API error';
          throw new ArcanaApiError(
            status,
            detailedMessage,
            data
          );
        } else if (error.request) {
          // Request was made but no response received
          throw new ArcanaNetworkError(
            'Network error: No response from server',
            error
          );
        } else {
          // Error setting up the request
          throw new ArcanaNetworkError(
            `Request error: ${error.message}`,
            error
          );
        }
      }
    );

    // Initialize legacy auth module
    this.auth = new AuthModule(this.api, getToken, setToken);

    // Initialize device auth module
    if (this.useDeviceAuth && this.keyStorage && this.tokenStorage) {
      this.deviceAuth = new DeviceAuthModule(
        this.api,
        this.keyStorage,
        this.tokenStorage,
        config.deviceAuthConfig
      );
    }

    // Initialize other modules
    this.contracts = new ContractsModule(this.api, this.deviceAuth);
    this.programs = this.contracts;
    this.history = new HistoryModule(this.api);
    this.tables = new TablesModule(this.api);
    this.transactions = new TransactionsModule(this.api);
    this.billing = new BillingModule(this.api);
    this.scopes = new ScopesModule(this.api);
    this.bank = new BankModule(this.api);
    this.erc20 = new Erc20Module(this.api, config.chainConfig);
    this.config = new ConfigModule(this.api);
    this.subscriptions = new SubscriptionsModule(this.api, getToken, this.deviceAuth);
    this.events = new EventsModule(this.api);
  }

  /**
   * Initialize the client.
   * Call this on app startup to restore auth state.
   */
  async init(): Promise<void> {
    if (this.deviceAuth) {
      await this.deviceAuth.init();
    }
  }

  /**
   * Check if device auth is enabled.
   */
  isDeviceAuthEnabled(): boolean {
    return this.useDeviceAuth && !!this.deviceAuth;
  }

  /**
   * Check if user is authenticated.
   * Works for both device auth and legacy session auth.
   */
  isAuthenticated(): boolean {
    if (this.deviceAuth) {
      return this.deviceAuth.isAuthenticated();
    }
    return this.auth.isAuthenticated();
  }

  /**
   * Set callback invoked when a 401 is received and token refresh failed.
   * Allows the app to trigger re-authentication (e.g. device registration) after client creation.
   */
  setOnAuthRequired(callback: (() => void | Promise<void>) | undefined): void {
    this.onAuthRequiredCallback = callback;
  }

  /**
   * Ensure we have a valid access token before making API calls.
   * Automatically refreshes if needed (device auth only).
   */
  async ensureAuthenticated(): Promise<boolean> {
    if (this.deviceAuth) {
      const authenticated = await this.deviceAuth.ensureAccessToken();
      if (authenticated) {
        this.hasNotifiedAuthRequired = false;
      }
      return authenticated;
    }
    return this.auth.isAuthenticated();
  }

  /**
   * Sign out and clear all auth data.
   */
  async signOut(): Promise<void> {
    console.log('[ArcanaClient] signOut: Starting...');
    if (this.deviceAuth) {
      console.log('[ArcanaClient] signOut: Calling deviceAuth.signOut()...');
      await this.deviceAuth.signOut();
      console.log('[ArcanaClient] signOut: deviceAuth.signOut() complete');
    } else {
      console.log('[ArcanaClient] signOut: Calling auth.signOut()...');
      await this.auth.signOut();
    }
    console.log('[ArcanaClient] signOut: Complete');
    this.hasNotifiedAuthRequired = false;
  }

  /**
   * Get the underlying axios instance (for advanced usage)
   */
  getApiInstance(): AxiosInstance {
    return this.api;
  }

  /**
   * Create React hooks for this client using TanStack Query.
   * 
   * This is a regular method (not a React hook) that returns hook functions.
   * The returned hooks must be called within React components that are
   * wrapped in a QueryClientProvider.
   * 
   * **Recommended**: Use `ArcanaProvider` and `useArcanaHooks()` instead
   * for a cleaner React integration.
   * 
   * @returns Object containing all module hooks
   */
  useHooks() {
    return {
      billing: createBillingHooks(this.billing),
      scopes: createScopesHooks(this.scopes),
      auth: createAuthHooks(this.auth),
      bank: createBankHooks(this.bank),
      contracts: createContractsHooks(this.contracts),
      config: createConfigHooks(this.config),
    };
  }

  private notifyAuthRequired(): void {
    if (!this.onAuthRequiredCallback || this.hasNotifiedAuthRequired) {
      return;
    }
    this.hasNotifiedAuthRequired = true;
    Promise.resolve(this.onAuthRequiredCallback()).catch(() => {});
  }
}
