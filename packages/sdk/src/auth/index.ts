import type { Address, TypedDataDomain } from 'viem';
import type { WalletClient, Account } from 'viem';
import axios, { AxiosInstance } from 'axios';
import { extractData, ApiResponse } from '../types/common.js';
import type {
  DomainInfo,
  SignInRequest,
  SignInResponse,
  UserInfo,
  EIP712Domain,
  SignInMessage,
} from './types.js';

// Re-export device auth components
export * from './device-types.js';
export * from './device-storage.js';
export * from './device-auth.js';
export * from './request-signing.js';
export * from './tx-intent.js';
export * from './golden-vectors.js';
export * from './wallet-adapter.js';

// Domain constants - must match server expectations
// Server hashes "Arcana" (capitalized) for domain name
const DOMAIN_NAME = 'Arcana';
const DOMAIN_VERSION = '1';

/**
 * Get EIP-712 domain for signing
 */
function getDomain(chainId: number | string, verifyingContract: string): EIP712Domain {
  let numericChainId: number;
  if (typeof chainId === 'number') {
    numericChainId = chainId;
  } else {
    const chainIdStr = String(chainId);
    numericChainId = chainIdStr.startsWith('0x') 
      ? parseInt(chainIdStr, 16) 
      : parseInt(chainIdStr, 10);
  }
  
  return {
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    chainId: numericChainId,
    verifyingContract: verifyingContract as Address,
  };
}

/**
 * Generate a random nonce for signing
 */
function generateNonce(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Authentication module
 */
export class AuthModule {
  constructor(
    private api: AxiosInstance,
    private getToken: () => string | null,
    private setToken: (token: string) => void
  ) {}

  /**
   * Get EIP-712 domain info from the server
   */
  async getDomainInfo(): Promise<DomainInfo> {
    const response = await this.api.get<ApiResponse<DomainInfo>>('/auth/domain');
    return extractData(response);
  }

  /**
   * Sign out (clears token)
   * 
   * Note: Legacy signIn() method has been removed. Use device registration instead.
   * See device-auth.ts for device-bound authentication.
   */
  async signOut(): Promise<void> {
    console.log('[AuthModule] signOut: Starting...');
    try {
      await this.api.post('/auth/logout');
      console.log('[AuthModule] signOut: Server logout successful');
    } catch (error) {
      // Ignore errors on signout
      console.log('[AuthModule] signOut: Server logout failed (ignoring):', error);
    } finally {
      this.setToken('');
      // Try to remove from localStorage if available
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('auth_token');
          console.log('[AuthModule] signOut: localStorage cleared');
        }
      } catch {
        // Ignore errors
      }
      console.log('[AuthModule] signOut: Complete');
    }
  }

  /**
   * Get current user info
   */
  async getUserInfo(): Promise<UserInfo> {
    const response = await this.api.get<ApiResponse<UserInfo>>('/auth/me');
    return extractData(response);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token && token.length > 0;
  }
}
