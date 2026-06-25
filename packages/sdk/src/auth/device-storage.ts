/**
 * Device Key and Token Storage for Browser (IndexedDB)
 * 
 * Provides secure storage for:
 * - Device keypairs (Ed25519, stored in IndexedDB)
 * - Auth tokens (refresh token, access token, etc.)
 * 
 * Uses IndexedDB for better security than localStorage:
 * - Same-origin only
 * - Not accessible via document.cookie
 * - Less vulnerable to certain XSS attacks
 */

import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import type { DeviceKeyStorage, TokenStorage, StoredTokens } from './device-types.js';

// Configure ed25519 to use sha512 (required for Node.js, works in browsers too)
ed25519.etc.sha512Sync = (...m) => sha512(ed25519.etc.concatBytes(...m));

const DB_NAME = 'arcana_device_auth';
const DB_VERSION = 3; // Bump version for Ed25519 migration
const KEYS_STORE = 'device_keys';
const TOKENS_STORE = 'auth_tokens';
const KEY_ID = 'primary_device_key';
const TOKENS_ID = 'current_tokens';
const ACTIVE_WALLET_ID = 'active_wallet';

function normalizeOwner(value?: string | null): string | null {
  const trimmed = value?.trim().toLowerCase() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function scopedRecordId(prefix: string, owner?: string | null): string {
  const normalized = normalizeOwner(owner);
  return normalized ? `${prefix}:${normalized}` : prefix;
}

/**
 * Open IndexedDB for device auth storage.
 */
async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Device keys store
      if (!db.objectStoreNames.contains(KEYS_STORE)) {
        db.createObjectStore(KEYS_STORE, { keyPath: 'id' });
      }
      
      // Auth tokens store
      if (!db.objectStoreNames.contains(TOKENS_STORE)) {
        db.createObjectStore(TOKENS_STORE, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Convert Uint8Array to hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64url string.
 */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ============================================================================
// WebKeyStorage - Browser implementation using IndexedDB + Ed25519
// ============================================================================

interface StoredEd25519KeyRecord {
  id: string;
  privateKeyHex: string; // Ed25519 private key (32 bytes = 64 hex chars)
  publicKeyHex: string;  // Ed25519 public key (32 bytes = 64 hex chars)
  ownerAddress?: string | null;
  createdAt: number;
}

/**
 * Browser implementation of DeviceKeyStorage using IndexedDB and Ed25519.
 * 
 * Uses Ed25519 for signing, which matches the server's expectations.
 * Note: The private key is stored in IndexedDB. While not as secure as
 * non-extractable CryptoKey, Ed25519 is not yet universally supported
 * in Web Crypto API. The key is still protected by same-origin policy.
 */
export class WebKeyStorage implements DeviceKeyStorage {
  private keyRecord: StoredEd25519KeyRecord | null = null;
  private activeOwnerAddress: string | null = null;

  /**
   * Generate and store a new Ed25519 keypair.
   */
  async generateKey(ownerAddress?: string): Promise<string> {
    // Generate Ed25519 keypair using @noble/ed25519
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = await ed25519.getPublicKeyAsync(privateKey);
    
    const privateKeyHex = bytesToHex(privateKey);
    const publicKeyHex = bytesToHex(publicKey);
    const normalizedOwnerAddress = normalizeOwner(ownerAddress) ?? this.activeOwnerAddress;

    // Store the keypair in IndexedDB
    const record: StoredEd25519KeyRecord = {
      id: scopedRecordId(KEY_ID, normalizedOwnerAddress),
      privateKeyHex,
      publicKeyHex,
      ownerAddress: normalizedOwnerAddress,
      createdAt: Date.now(),
    };

    const db = await openDb();
    const tx = db.transaction(KEYS_STORE, 'readwrite');
    const store = tx.objectStore(KEYS_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    this.keyRecord = record;
    this.activeOwnerAddress = normalizedOwnerAddress;
    return publicKeyHex;
  }

  /**
   * Check if a device key exists.
   */
  async hasKey(): Promise<boolean> {
    const key = await this.getKeyRecord();
    return key !== null;
  }

  /**
   * Get the public key as hex string (64 chars for Ed25519).
   */
  async getPublicKey(): Promise<string | null> {
    const record = await this.getKeyRecord();
    return record?.publicKeyHex ?? null;
  }

  async getKeyOwner(): Promise<string | null> {
    const record = await this.getKeyRecord();
    return record?.ownerAddress ?? null;
  }

  async activateOwner(ownerAddress: string | null): Promise<void> {
    this.activeOwnerAddress = normalizeOwner(ownerAddress);
    this.keyRecord = null;
    await this.getKeyRecord();
  }

  /**
   * Sign data with the Ed25519 private key.
   */
  async sign(data: Uint8Array | string): Promise<string> {
    const record = await this.getKeyRecord();
    if (!record) {
      throw new Error('No device key found. Call generateKey() first.');
    }

    const dataBytes = typeof data === 'string' 
      ? new TextEncoder().encode(data)
      : data;

    const privateKey = hexToBytes(record.privateKeyHex);
    const signature = await ed25519.signAsync(dataBytes, privateKey);

    return bytesToBase64Url(signature);
  }

  /**
   * Clear the stored key.
   */
  async clear(): Promise<void> {
    try {
      const db = await openDb();
      const tx = db.transaction(KEYS_STORE, 'readwrite');
      const store = tx.objectStore(KEYS_STORE);

      await new Promise<void>((resolve) => {
        const request = store.delete(scopedRecordId(KEY_ID, this.activeOwnerAddress));
        request.onsuccess = () => resolve();
        request.onerror = () => resolve(); // Ignore errors
      });

      this.keyRecord = null;
    } catch {
      // Ignore errors during cleanup
    }
  }

  /**
   * Get the stored key record.
   */
  private async getKeyRecord(): Promise<StoredEd25519KeyRecord | null> {
    if (this.keyRecord) {
      return this.keyRecord;
    }

    try {
      const db = await openDb();
      const tx = db.transaction(KEYS_STORE, 'readonly');
      const store = tx.objectStore(KEYS_STORE);

      let record = await new Promise<StoredEd25519KeyRecord | null>((resolve) => {
        const request = store.get(scopedRecordId(KEY_ID, this.activeOwnerAddress));
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => resolve(null);
      });

      if (!record) {
        const legacyRecord = await new Promise<StoredEd25519KeyRecord | null>((resolve) => {
          const request = store.get(KEY_ID);
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => resolve(null);
        });
        const legacyOwner = normalizeOwner(legacyRecord?.ownerAddress);
        if (!this.activeOwnerAddress || legacyOwner === this.activeOwnerAddress) {
          record = legacyRecord;
        }
      }

      if (record) {
        this.keyRecord = record;
        this.activeOwnerAddress = record.ownerAddress ?? this.activeOwnerAddress;
      }

      return record;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// WebTokenStorage - Browser implementation using IndexedDB
// ============================================================================

interface StoredTokenRecord {
  id: string;
  deviceId: string | null;
  userId: string | null;
  walletAddress: string | null;
  refreshToken: string | null;
  accessToken: string | null;
  accessTokenId: string | null;
  accessExpiresAt: number | null;
  updatedAt: number;
}

interface ActiveWalletRecord {
  id: string;
  walletAddress: string | null;
  updatedAt: number;
}

/**
 * Browser implementation of TokenStorage using IndexedDB.
 * 
 * Tokens are stored in IndexedDB for better security than localStorage.
 * Provides a sync cache for fast access after initialization.
 */
export class WebTokenStorage implements TokenStorage {
  private cache: StoredTokens | null = null;
  private activeWalletAddress: string | null = null;

  /**
   * Store tokens.
   */
  async store(tokens: Partial<StoredTokens>): Promise<void> {
    // Merge with existing cache
    const existing = this.cache || await this.get();
    
    // Use 'in' operator to check if key exists in the object
    // This allows explicitly setting null to clear a field
    const record: StoredTokenRecord = {
      id: scopedRecordId(TOKENS_ID, tokens.walletAddress ?? existing.walletAddress ?? this.activeWalletAddress),
      deviceId: 'deviceId' in tokens ? (tokens.deviceId ?? null) : existing.deviceId,
      userId: 'userId' in tokens ? (tokens.userId ?? null) : existing.userId,
      walletAddress: 'walletAddress' in tokens ? (tokens.walletAddress ?? null) : existing.walletAddress,
      refreshToken: 'refreshToken' in tokens ? (tokens.refreshToken ?? null) : existing.refreshToken,
      accessToken: 'accessToken' in tokens ? (tokens.accessToken ?? null) : existing.accessToken,
      accessTokenId: 'accessTokenId' in tokens ? (tokens.accessTokenId ?? null) : existing.accessTokenId,
      accessExpiresAt: 'accessExpiresAt' in tokens ? (tokens.accessExpiresAt ?? null) : existing.accessExpiresAt,
      updatedAt: Date.now(),
    };

    // Update cache immediately
    this.cache = {
      deviceId: record.deviceId,
      userId: record.userId,
      walletAddress: record.walletAddress,
      refreshToken: record.refreshToken,
      accessToken: record.accessToken,
      accessTokenId: record.accessTokenId,
      accessExpiresAt: record.accessExpiresAt,
    };
    this.activeWalletAddress = normalizeOwner(record.walletAddress) ?? this.activeWalletAddress;

    // Persist to IndexedDB
    try {
      const db = await openDb();
      const tx = db.transaction(TOKENS_STORE, 'readwrite');
      const store = tx.objectStore(TOKENS_STORE);

      await new Promise<void>((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('[WebTokenStorage] Failed to persist to IndexedDB:', request.error);
          reject(request.error);
        };
      });

      if (record.walletAddress) {
        await new Promise<void>((resolve, reject) => {
          const request = store.put({
            id: ACTIVE_WALLET_ID,
            walletAddress: record.walletAddress,
            updatedAt: Date.now(),
          } satisfies ActiveWalletRecord);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    } catch (e) {
      console.error('[WebTokenStorage] Failed to persist tokens:', e);
    }
  }

  /**
   * Get stored tokens (loads from IndexedDB if cache not populated).
   */
  async get(): Promise<StoredTokens> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const db = await openDb();
      const tx = db.transaction(TOKENS_STORE, 'readonly');
      const store = tx.objectStore(TOKENS_STORE);

      if (!this.activeWalletAddress) {
        const activeWalletRecord = await new Promise<ActiveWalletRecord | null>((resolve) => {
          const request = store.get(ACTIVE_WALLET_ID);
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => resolve(null);
        });
        this.activeWalletAddress = normalizeOwner(activeWalletRecord?.walletAddress);
      }

      let record = await new Promise<StoredTokenRecord | null>((resolve) => {
        const request = store.get(scopedRecordId(TOKENS_ID, this.activeWalletAddress));
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => resolve(null);
      });

      if (!record) {
        const legacyRecord = await new Promise<StoredTokenRecord | null>((resolve) => {
          const request = store.get(TOKENS_ID);
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => resolve(null);
        });
        const legacyWallet = normalizeOwner(legacyRecord?.walletAddress);
        if (!this.activeWalletAddress || legacyWallet === this.activeWalletAddress) {
          record = legacyRecord;
        }
      }

      if (!record && !this.activeWalletAddress) {
        record = await this.findMostRecentScopedRecord(store);
      }

      if (record) {
        this.cache = {
          deviceId: record.deviceId,
          userId: record.userId,
          walletAddress: record.walletAddress,
          refreshToken: record.refreshToken,
          accessToken: record.accessToken,
          accessTokenId: record.accessTokenId,
          accessExpiresAt: record.accessExpiresAt,
        };
        this.activeWalletAddress = normalizeOwner(record.walletAddress) ?? this.activeWalletAddress;
        if (this.activeWalletAddress) {
          await this.persistActiveWalletAddress(this.activeWalletAddress);
        }
        return this.cache;
      }
    } catch (e) {
      console.warn('[WebTokenStorage] Failed to load from IndexedDB:', e);
    }

    // Return empty tokens
    return {
      deviceId: null,
      userId: null,
      walletAddress: null,
      refreshToken: null,
      accessToken: null,
      accessTokenId: null,
      accessExpiresAt: null,
    };
  }

  /**
   * Get stored tokens synchronously (from cache).
   */
  getSync(): StoredTokens | null {
    return this.cache;
  }

  /**
   * Initialize the cache (load from storage).
   */
  async init(): Promise<void> {
    await this.get();
  }

  async activateWallet(walletAddress: string | null): Promise<void> {
    this.activeWalletAddress = normalizeOwner(walletAddress);
    this.cache = null;
    await this.get();
    if (this.activeWalletAddress) {
      try {
        await this.persistActiveWalletAddress(this.activeWalletAddress);
      } catch {
        // Keep the in-memory activation even if IndexedDB is unavailable.
      }
    }
  }

  /**
   * Clear all stored tokens.
   */
  async clear(): Promise<void> {
    try {
      const db = await openDb();
      const tx = db.transaction(TOKENS_STORE, 'readwrite');
      const store = tx.objectStore(TOKENS_STORE);

      await new Promise<void>((resolve) => {
        const request = store.delete(scopedRecordId(TOKENS_ID, this.activeWalletAddress));
        request.onsuccess = () => resolve();
        request.onerror = () => resolve(); // Ignore errors
      });

      if (this.activeWalletAddress) {
        const activeWalletRecord = await new Promise<ActiveWalletRecord | null>((resolve) => {
          const request = store.get(ACTIVE_WALLET_ID);
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => resolve(null);
        });
        if (normalizeOwner(activeWalletRecord?.walletAddress) === this.activeWalletAddress) {
          await new Promise<void>((resolve) => {
            const request = store.delete(ACTIVE_WALLET_ID);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
          });
        }
      }

      this.cache = null;
    } catch {
      // Ignore errors during cleanup
    }
  }

  private async findMostRecentScopedRecord(store: IDBObjectStore): Promise<StoredTokenRecord | null> {
    return new Promise((resolve) => {
      const request = store.openCursor();
      let newest: StoredTokenRecord | null = null;
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(newest);
          return;
        }
        const record = cursor.value as StoredTokenRecord | ActiveWalletRecord | undefined;
        if (
          record &&
          typeof record.id === 'string' &&
          record.id.startsWith(`${TOKENS_ID}:`) &&
          'refreshToken' in record &&
          record.refreshToken &&
          (!newest || record.updatedAt > newest.updatedAt)
        ) {
          newest = record;
        }
        cursor.continue();
      };
      request.onerror = () => resolve(null);
    });
  }

  private async persistActiveWallet(store: IDBObjectStore, walletAddress: string): Promise<void> {
    await new Promise<void>((resolve) => {
      const request = store.put({
        id: ACTIVE_WALLET_ID,
        walletAddress,
        updatedAt: Date.now(),
      } satisfies ActiveWalletRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  private async persistActiveWalletAddress(walletAddress: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(TOKENS_STORE, 'readwrite');
    const store = tx.objectStore(TOKENS_STORE);
    await this.persistActiveWallet(store, walletAddress);
  }
}

// ============================================================================
// In-Memory Storage (for testing/Node.js environments)
// ============================================================================

/**
 * In-memory implementation of DeviceKeyStorage using Ed25519.
 * Useful for testing or Node.js environments.
 */
export class MemoryKeyStorage implements DeviceKeyStorage {
  private publicKeyHex: string | null = null;
  private privateKeyHex: string | null = null;
  private ownerAddress: string | null = null;

  async generateKey(ownerAddress?: string): Promise<string> {
    // Generate Ed25519 keypair using @noble/ed25519
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = await ed25519.getPublicKeyAsync(privateKey);
    
    this.privateKeyHex = bytesToHex(privateKey);
    this.publicKeyHex = bytesToHex(publicKey);
    this.ownerAddress = ownerAddress?.toLowerCase() ?? null;
    
    return this.publicKeyHex;
  }

  async hasKey(): Promise<boolean> {
    return this.publicKeyHex !== null;
  }

  async getPublicKey(): Promise<string | null> {
    return this.publicKeyHex;
  }

  async getKeyOwner(): Promise<string | null> {
    return this.ownerAddress;
  }

  async sign(data: Uint8Array | string): Promise<string> {
    if (!this.privateKeyHex) {
      throw new Error('No key generated');
    }

    const dataBytes = typeof data === 'string' 
      ? new TextEncoder().encode(data)
      : data;

    const privateKey = hexToBytes(this.privateKeyHex);
    const signature = await ed25519.signAsync(dataBytes, privateKey);

    return bytesToBase64Url(signature);
  }

  async clear(): Promise<void> {
    this.publicKeyHex = null;
    this.privateKeyHex = null;
    this.ownerAddress = null;
  }
}

/**
 * In-memory implementation of TokenStorage.
 * Useful for testing or Node.js environments.
 */
export class MemoryTokenStorage implements TokenStorage {
  private tokens: StoredTokens = {
    deviceId: null,
    userId: null,
    walletAddress: null,
    refreshToken: null,
    accessToken: null,
    accessTokenId: null,
    accessExpiresAt: null,
  };

  async store(tokens: Partial<StoredTokens>): Promise<void> {
    // Merge tokens, allowing explicit null to clear fields
    this.tokens = {
      ...this.tokens,
      ...tokens,
    };
  }

  async get(): Promise<StoredTokens> {
    return this.tokens;
  }

  getSync(): StoredTokens | null {
    return this.tokens;
  }

  async init(): Promise<void> {
    // No-op for memory storage
  }

  async clear(): Promise<void> {
    this.tokens = {
      deviceId: null,
      userId: null,
      walletAddress: null,
      refreshToken: null,
      accessToken: null,
      accessTokenId: null,
      accessExpiresAt: null,
    };
  }
}
