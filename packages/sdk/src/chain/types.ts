/**
 * Chain module types
 * 
 * Types for on-chain interactions (reading balances, etc.)
 */

/**
 * ERC20 token info.
 */
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
}

/**
 * On-chain balance result.
 */
export interface ChainBalance {
  address: string;
  tokenAddress: string;
  balance: string;
  formatted: string;
  decimals: number;
}

/**
 * Chain configuration.
 */
export interface ChainConfig {
  chainId: number;
  rpcUrl: string;
}

