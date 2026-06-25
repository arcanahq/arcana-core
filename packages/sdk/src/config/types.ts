/**
 * Config module types
 * 
 * Types for server configuration and metadata.
 */

/**
 * Asset configuration from server.
 */
export interface AssetConfig {
  id: string;
  address: string;
  symbol: string | null;
  decimals: number;
  name?: string;
}

/**
 * Vault information for a specific chain.
 */
export interface VaultInfo {
  chainId: number;
  UserVault: string;
  asset: AssetConfig[];
}

/**
 * Bank configuration from /bank/config endpoint.
 * 
 * Bank supports multiple vaults on different chains.
 * Each vault can have its own chainId and set of assets.
 */
export interface BankConfig {
  vaults: VaultInfo[];
}

/**
 * EIP-712 authentication domain info.
 * Used for wallet-based signature authentication.
 */
export interface AuthDomain {
  name: string;
  version: string;
  /** Chain ID for EIP-712 signatures (authentication only, not bank operations) */
  chainId: number;
  verifyingContract: string;
}

/**
 * Server metadata response from /config/metadata.
 * 
 * This provides general server information.
 * For bank configuration (vaults, assets, chains), use getBankConfig() which calls /bank/config.
 */
export interface ServerMetadata {
  /** Project name */
  project: string;
  /** Server version */
  version: string;
  /** List of enabled capabilities */
  capabilities: string[];
  /** EIP-712 domain info for authentication */
  authDomain: AuthDomain;
}

/**
 * Deployment configuration derived from bank config.
 */
export interface DeploymentConfig {
  chainId: number;
  rpcUrl: string;
  contracts: {
    [name: string]: string;
  };
  assets: AssetConfig[];
  defaultAssetId: string | null;
}

/**
 * Runtime status for a single monitor, as surfaced by `/health`.
 * `data` carries module-specific fields (start_block, last_processed_block,
 * required_confirmations, last_error, …).
 */
export interface MonitorStatus {
  id: string;
  module: string;
  kind: string;
  running: boolean;
  data: Record<string, unknown>;
}
