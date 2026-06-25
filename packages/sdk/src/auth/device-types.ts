/**
 * Device-bound Authentication Types
 * 
 * These types support the secure device-bound authentication flow:
 * - Device registration with wallet signature
 * - Rotating refresh tokens with theft detection
 * - Short-lived access tokens
 * - Per-request signing for mutations (DPoP-style)
 */

import type { Address } from 'viem';

// ============================================================================
// Device Registration
// ============================================================================

/**
 * Request to register a new device with the server.
 * Requires a wallet signature to prove ownership of the address.
 */
export interface DeviceRegistrationRequest {
  /** User's Ethereum address */
  user_address: string;
  /** Ed25519/ECDSA public key for device (hex-encoded) */
  device_pubkey: string;
  /** Optional device name for user reference */
  device_name?: string;
  /** EIP-712 signature from wallet authorizing this device */
  wallet_signature: string;
  /** Timestamp of the registration request (unix seconds) */
  timestamp: number;
  /** Nonce for replay protection */
  nonce: string;
  /** Chain ID used for EIP-712 signing (preferred, fallback to server config if not provided) */
  chain_id?: number;
}

/**
 * Response from device registration.
 */
export interface DeviceRegistrationResponse {
  /** Unique device ID */
  device_id: string;
  /** Initial refresh token (base64url-encoded) */
  refresh_token: string;
  /** Refresh token expiry (unix milliseconds) */
  refresh_expires_at: number;
  /** Initial access token (base64url-encoded) */
  access_token: string;
  /** Access token ID (for request signing) */
  access_token_id: string;
  /** Access token expiry (unix milliseconds) */
  access_expires_at: number;
  /** User ID */
  user_id: string;
}

/**
 * Information about a registered device.
 */
export interface DeviceInfo {
  /** Unique device ID */
  id: string;
  /** User-friendly device name */
  device_name?: string;
  /** Device public key (hex-encoded) */
  device_pubkey: string;
  /** Device status: 'active' | 'revoked' | 'suspended' */
  status: string;
  /** When the device was registered (unix milliseconds) */
  created_at: number;
  /** When the device was last used (unix milliseconds) */
  last_seen_at?: number;
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * Request to refresh tokens.
 */
export interface TokenRefreshRequest {
  /** Current refresh token (base64url-encoded) */
  refresh_token: string;
}

/**
 * Response from token refresh.
 * The old refresh token is invalidated (rotated).
 */
export interface TokenRefreshResponse {
  /** New access token (base64url-encoded) */
  access_token: string;
  /** Access token ID (for request signing envelope) */
  access_token_id: string;
  /** Access token expiry (unix milliseconds) */
  access_expires_at: number;
  /** New refresh token (rotated) */
  refresh_token?: string;
  /** Refresh token expiry (unix milliseconds) */
  refresh_expires_at?: number;
  /** Device ID */
  device_id: string;
  /** User ID */
  user_id: string;
}

/**
 * Stored token data (persisted in IndexedDB).
 */
export interface StoredTokens {
  /** Device ID */
  deviceId: string | null;
  /** User ID */
  userId: string | null;
  /** Wallet address (Ethereum or Solana) */
  walletAddress: string | null;
  /** Current refresh token */
  refreshToken: string | null;
  /** Current access token */
  accessToken: string | null;
  /** Access token ID (for request signing) */
  accessTokenId: string | null;
  /** Access token expiry (unix milliseconds) */
  accessExpiresAt: number | null;
}

/**
 * Response from nonce endpoint.
 */
export interface NonceResponse {
  /** Current nonce value */
  nonce: number;
  /** Scope ID */
  scope_id: string;
  /** Device ID */
  device_id: string;
}

// ============================================================================
// Request Signing (DPoP-style)
// ============================================================================

/**
 * Request envelope for signing.
 * Encoded as a CBOR/JSON array for deterministic serialization.
 */
export interface RequestEnvelope {
  /** Device ID */
  deviceId: string;
  /** Access token ID */
  accessTokenId: string;
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** SHA-256 hash of request body */
  bodyHash: Uint8Array;
  /** Monotonic nonce */
  nonce: number;
  /** Scope ID for nonce tracking */
  scopeId: string;
  /** Envelope expiry (unix milliseconds) */
  expiresAt: number;
}

/**
 * Signed request data to include in headers.
 */
export interface SignedRequest {
  /** Base64url-encoded signature */
  signature: string;
  /** Base64url-encoded envelope */
  envelope: string;
}

// ============================================================================
// Key Storage
// ============================================================================

/**
 * Interface for device key storage.
 * Implementations can use IndexedDB, Keychain, etc.
 */
export interface DeviceKeyStorage {
  /**
   * Generate and store a new device keypair.
   * @param ownerAddress - Optional wallet/user address this key is bound to.
   * @returns The public key as hex string.
   */
  generateKey(ownerAddress?: string): Promise<string>;

  /**
   * Check if a device key exists.
   */
  hasKey(): Promise<boolean>;

  /**
   * Get the public key.
   * @returns The public key as hex string, or null if not found.
   */
  getPublicKey(): Promise<string | null>;

  /**
   * Get the wallet/user address this key is bound to, if tracked.
   */
  getKeyOwner?(): Promise<string | null>;

  /**
   * Select the wallet/user address whose device key should be active.
   * Browser storage uses this to preserve separate device keys per wallet.
   */
  activateOwner?(ownerAddress: string | null): Promise<void>;

  /**
   * Sign data with the device private key.
   * @param data - Data to sign (as Uint8Array or string).
   * @returns The signature as base64url string.
   */
  sign(data: Uint8Array | string): Promise<string>;

  /**
   * Clear the stored key.
   */
  clear(): Promise<void>;
}

/**
 * Interface for token storage.
 * Implementations can use IndexedDB, Keychain, etc.
 */
export interface TokenStorage {
  /**
   * Store tokens.
   */
  store(tokens: Partial<StoredTokens>): Promise<void>;

  /**
   * Get stored tokens.
   */
  get(): Promise<StoredTokens>;

  /**
   * Get stored tokens synchronously (from cache).
   * Returns null if cache not initialized.
   */
  getSync(): StoredTokens | null;

  /**
   * Initialize the cache (load from storage).
   */
  init(): Promise<void>;

  /**
   * Select the wallet/user address whose token record should be active.
   * Browser storage uses this to preserve separate refresh tokens per wallet.
   */
  activateWallet?(walletAddress: string | null): Promise<void>;

  /**
   * Clear all stored tokens.
   */
  clear(): Promise<void>;
}

// ============================================================================
// EIP-712 Types
// ============================================================================

/**
 * EIP-712 typed data for device registration.
 */
export interface DeviceRegistrationTypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  types: {
    DeviceRegistration: Array<{ name: string; type: string }>;
  };
  primaryType: 'DeviceRegistration';
  message: {
    userAddress: Address;
    devicePubkey: string;
    timestamp: bigint;
    nonce: string;
  };
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Device auth configuration options.
 */
export interface DeviceAuthConfig {
  /** Use device auth (default: true) */
  enabled?: boolean;
  /** Access token refresh buffer (ms before expiry to refresh, default: 30000) */
  refreshBuffer?: number;
  /** Request envelope expiry (ms, default: 60000) */
  envelopeExpiry?: number;
  /** Default scope ID for nonce tracking (default: '__global__') */
  defaultScopeId?: string;
}
