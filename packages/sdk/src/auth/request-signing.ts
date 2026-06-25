/**
 * Request Signing Utilities
 * 
 * Provides DPoP-style request signing for mutating API requests.
 * Each mutation (POST, PUT, DELETE) includes:
 * - A signed envelope binding the request to the device and token
 * - A monotonic nonce to prevent replay attacks
 */

import type { DeviceKeyStorage, SignedRequest, StoredTokens } from './device-types.js';

/**
 * Options for creating a signed request.
 */
export interface SignRequestOptions {
  /** Device ID */
  deviceId: string;
  /** Access token ID */
  accessTokenId: string;
  /** HTTP method */
  method: string;
  /** Request path (e.g., /api/contracts/123/call) */
  path: string;
  /** Request body (will be JSON serialized and hashed) */
  body?: unknown;
  /** Nonce value (must be monotonically increasing) */
  nonce: number;
  /** Scope ID for nonce tracking (default: '__global__') */
  scopeId?: string;
  /** Envelope expiry in ms (default: 60000 = 1 minute) */
  expiresInMs?: number;
}

/**
 * Convert ArrayBuffer to base64url string.
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Hash request body using SHA-256.
 */
async function hashBody(body: unknown): Promise<Uint8Array> {
  const bodyBytes = body 
    ? new TextEncoder().encode(JSON.stringify(body))
    : new Uint8Array(0);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', bodyBytes);
  return new Uint8Array(hashBuffer);
}

/**
 * Create a signed request envelope.
 * 
 * The envelope is encoded as a JSON array for deterministic serialization:
 * [device_id, access_token_id, method, path, body_hash, nonce, scope_id, expires_at]
 * 
 * @param keyStorage - Device key storage for signing
 * @param options - Request options
 * @returns Signed request data for headers
 */
export async function signRequest(
  keyStorage: DeviceKeyStorage,
  options: SignRequestOptions
): Promise<SignedRequest> {
  const {
    deviceId,
    accessTokenId,
    method,
    path,
    body,
    nonce,
    scopeId = '__global__',
    expiresInMs = 60000,
  } = options;

  // Hash the request body
  const bodyHash = await hashBody(body);
  const expiresAt = Date.now() + expiresInMs;

  // Create envelope as array for deterministic encoding
  // Order: [device_id, access_token_id, method, path, body_hash, nonce, scope_id, expires_at]
  const envelope = [
    deviceId,
    accessTokenId,
    method.toUpperCase(),
    path,
    Array.from(bodyHash), // Convert to regular array for JSON serialization
    nonce,
    scopeId,
    expiresAt,
  ];

  // Encode envelope as JSON
  const envelopeJson = JSON.stringify(envelope);
  const envelopeBytes = new TextEncoder().encode(envelopeJson);

  // Sign the envelope
  const signature = await keyStorage.sign(envelopeBytes);

  return {
    signature,
    envelope: arrayBufferToBase64Url(envelopeBytes.buffer),
  };
}

/**
 * Check if a request method requires signing.
 * Only mutating methods need to be signed.
 */
export function requiresSigning(method: string): boolean {
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  return mutatingMethods.includes(method.toUpperCase());
}

// ============================================================================
// Nonce Manager
// ============================================================================

/**
 * Manages nonces for request signing.
 * Tracks nonces per device+scope and fetches from server when needed.
 */
export class NonceManager {
  private counters: Map<string, number> = new Map();
  private fetchPromises: Map<string, Promise<number>> = new Map();

  /**
   * Create a nonce manager.
   * @param fetchNonce - Function to fetch current nonce from server
   */
  constructor(
    private fetchNonce: (scopeId: string) => Promise<number>
  ) {}

  /**
   * Get the next nonce for a scope.
   * Fetches from server if not cached, then increments locally.
   */
  async getNext(deviceId: string, scopeId: string = '__global__'): Promise<number> {
    const key = `${deviceId}:${scopeId}`;

    // If not cached, fetch from server
    if (!this.counters.has(key)) {
      // Deduplicate concurrent fetches
      let fetchPromise = this.fetchPromises.get(key);
      if (!fetchPromise) {
        fetchPromise = this.fetchFromServer(scopeId);
        this.fetchPromises.set(key, fetchPromise);
      }

      try {
        const serverNonce = await fetchPromise;
        this.counters.set(key, serverNonce);
      } finally {
        this.fetchPromises.delete(key);
      }
    }

    // Get and increment
    const nonce = this.counters.get(key) ?? 0;
    this.counters.set(key, nonce + 1);
    return nonce;
  }

  /**
   * Reset nonce to a specific value (e.g., after server rejects with expected nonce).
   */
  reset(deviceId: string, scopeId: string, value: number): void {
    const key = `${deviceId}:${scopeId}`;
    this.counters.set(key, value);
  }

  /**
   * Clear all cached nonces for a device.
   */
  clearDevice(deviceId: string): void {
    for (const key of this.counters.keys()) {
      if (key.startsWith(`${deviceId}:`)) {
        this.counters.delete(key);
      }
    }
  }

  /**
   * Clear all cached nonces.
   */
  clearAll(): void {
    this.counters.clear();
    this.fetchPromises.clear();
  }

  private async fetchFromServer(scopeId: string): Promise<number> {
    try {
      return await this.fetchNonce(scopeId);
    } catch (e) {
      console.warn('[NonceManager] Failed to fetch nonce, starting from 0:', e);
      return 0;
    }
  }
}

// ============================================================================
// Request Interceptor
// ============================================================================

/**
 * Configuration for the request signing interceptor.
 */
export interface SigningInterceptorConfig {
  /** Device key storage */
  keyStorage: DeviceKeyStorage;
  /** Function to get current tokens */
  getTokens: () => StoredTokens | null;
  /** Nonce manager */
  nonceManager: NonceManager;
  /** Whether device auth is enabled */
  isEnabled: () => boolean;
}

/**
 * Create an axios request interceptor that signs mutating requests.
 * 
 * @param config - Interceptor configuration
 * @returns Axios request interceptor function
 */
export function createSigningInterceptor(config: SigningInterceptorConfig) {
  const { keyStorage, getTokens, nonceManager, isEnabled } = config;

  return async (requestConfig: any) => {
    // Skip if device auth is disabled
    if (!isEnabled()) {
      return requestConfig;
    }

    // Skip signing for refresh endpoint - it doesn't need signing and we may not have access token yet
    const url = requestConfig.url || '';
    const isRefreshRequest = url.includes('/auth/token/refresh');
    
    if (isRefreshRequest) {
      console.log('[SigningInterceptor] Skipping signing for refresh request:', url);
      return requestConfig;
    }

    // Skip if not a mutating method
    if (!requiresSigning(requestConfig.method || 'GET')) {
      return requestConfig;
    }

    // Get tokens
    const tokens = getTokens();
    if (!tokens?.deviceId || !tokens?.accessTokenId) {
      return requestConfig;
    }

    // Check if we have a device key
    if (!(await keyStorage.hasKey())) {
      throw new Error('Device request signing key is missing');
    }

    try {
      // Get next nonce
      const nonce = await nonceManager.getNext(tokens.deviceId);

      // Sign the request
      const signed = await signRequest(keyStorage, {
        deviceId: tokens.deviceId,
        accessTokenId: tokens.accessTokenId,
        method: requestConfig.method,
        path: requestConfig.url,
        body: requestConfig.data,
        nonce,
      });

      // Add signature headers
      requestConfig.headers = requestConfig.headers || {};
      requestConfig.headers['Arcana-ReqSig'] = signed.signature;
      requestConfig.headers['Arcana-ReqMeta'] = signed.envelope;
    } catch (e) {
      console.warn('[SigningInterceptor] Failed to sign request:', e);
      throw e;
    }

    return requestConfig;
  };
}
