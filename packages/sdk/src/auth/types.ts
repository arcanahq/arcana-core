/**
 * Authentication types
 */

export interface DomainInfo {
  name: string;
  version: string;
  /** Verifying contract address (camelCase from server) */
  verifyingContract: string;
  /** @deprecated Use verifyingContract (snake_case for backwards compatibility) */
  verifying_contract?: string;
  /** Chain ID (optional, may be included by server) */
  chainId?: number;
  /** Accepted EIP-712 auth chain IDs. Empty means no server-side allowlist. */
  allowedChainIds?: number[];
}

export interface SignInRequest {
  address: string;
  signature: string;
  message: string;
  timestamp: number;
  nonce: string;
}

export interface SignInResponse {
  token: string;
  user_id: string;
  address: string;
  expires_at: string;
}

export interface UserInfo {
  user_id: string;
  address: string;
  created_at: string;
  last_login: string;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface SignInMessage {
  address: string;
  message: string;
  timestamp: number;
  nonce: string;
}
