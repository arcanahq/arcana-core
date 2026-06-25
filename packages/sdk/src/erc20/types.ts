/**
 * ERC20 capability module types.
 */

/** Configured wrapper/vault/token metadata for a single asset in a scope. */
export interface Erc20WrapperMetadata {
  assetId: string;
  /** The vault/wrapper contract address (alias: vaultAddress). */
  wrapperAddress: string;
  /** Underlying token the wrapper wraps (e.g. wETH), if applicable. */
  underlying?: string;
  /** Tokens accepted by this wrapper. */
  supportedTokens?: string[];
  chainId: number;
  rpcUrl?: string;
}

/** A captured on-chain deposit/wrap credit. */
export interface Erc20WrapCredit {
  assetId: string;
  recipient: string;
  txHash: string;
  logIndex: number;
  amount: string;
  chainId: number;
}

/** Options for querying deposit credits. */
export interface ListErc20CreditsOptions {
  /** Filter by Arcana recipient account id (or its bytes32 form). */
  recipient?: string;
  /** Filter by on-chain deposit transaction hash. */
  txHash?: string;
}

/**
 * Minimal viem WalletClient surface needed for the write helpers. Callers pass
 * a real viem `WalletClient`; this avoids a hard dependency on viem's types.
 */
export interface Erc20WalletClient {
  writeContract(args: any): Promise<`0x${string}`>;
  account?: { address: string } | string;
}
