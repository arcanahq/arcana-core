/**
 * Bank module types
 * 
 * Types for on-chain asset management:
 * - Balances
 * - Transfers
 * - Withdrawals
 * - Authorizations
 * - Assets
 */

/**
 * Bank balance for a specific asset.
 */
export interface BankBalance {
  principalId: string;
  assetId: string;
  amount: string;
}

/**
 * Asset registered in the bank.
 */
export interface BankAsset {
  assetId: string;
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Authorization for spending from user's bank account.
 */
export interface BankAuthorization {
  authId: string;
  userId: string;
  granteeId: string;
  assetId: string;
  maxAmount: string;
  usedAmount: string;
  expiresAt?: string;
  createdAt: string;
}

/**
 * Withdrawal request.
 */
export interface BankWithdrawal {
  withdrawalId: string;
  userId: string;
  assetId: string;
  amount: string;
  dstAddress: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txHash?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * Transfer between users.
 */
export interface BankTransfer {
  transferId: string;
  fromUserId: string;
  toUserId: string;
  assetId: string;
  amount: string;
  memo?: string;
  createdAt: string;
}

// Request types

export interface CreateWithdrawalRequest {
  assetId: string;
  amount: string;
  dstAddress: string;
}

export interface CreateTransferRequest {
  toUserId: string;
  assetId: string;
  amount: string;
  memo?: string;
}

export interface CreateAuthorizationRequest {
  assetId: string;
  maxAmount: string;
  expiresInMs: number;
  toPrincipal?: string;
  scopeId?: string;
  // Legacy fields for backward compatibility
  granteeId?: string;
  expiresAt?: string;
}

export interface RegisterAssetRequest {
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
  metadata?: Record<string, unknown>;
}

// Pagination options

export interface ListWithdrawalsOptions {
  limit?: number;
  offset?: number;
  status?: string;
}

export interface ListAuthorizationsOptions {
  limit?: number;
  offset?: number;
}

export type DepositIntentStatus = 'PENDING' | 'CANCELED' | 'COMPLETED' | 'UNROUTED' | 'FAILED';
export type DepositIntentAmountMode = 'EXACT' | 'ALL_AVAILABLE';

export interface BankDepositIntent {
  depositId: string;
  userId: string;
  assetId: string;
  amount: string;
  amountMode: DepositIntentAmountMode;
  targetScopeId?: string | null;
  targetInstanceId?: string | null;
  status: DepositIntentStatus;
  createdAtMs: number;
  expiresAtMs: number;
  matchedTxHash?: string | null;
  routedAtMs?: number | null;
  lastError?: string | null;
}

export interface CreateDepositIntentRequest {
  depositId: string;
  assetId: string;
  amount?: string;
  amountMode?: DepositIntentAmountMode;
  targetScopeId?: string;
  targetInstanceId?: string;
}

export interface ListDepositIntentsOptions {
  limit?: number;
  offset?: number;
}

/**
 * A row from the generic `wallet_intents` table — the canonical async-intent
 * record shared across capabilities (bank deposits, ERC20 wrap/unwrap, …).
 */
export interface WalletIntent {
  intentId: string;
  userId: string;
  /** Namespaced lifecycle type, e.g. `bank.deposit`, `erc20.unwrap`. */
  intentType: string;
  assetId: string;
  amount: string;
  destination?: string | null;
  status: string;
  /** Stable idempotency key for the external action. */
  correlationId: string;
  createdAtMs: number;
  expiresAtMs?: number | null;
  updatedAtMs: number;
  lastError?: string | null;
}

export interface ListIntentsOptions {
  /** Filter by capability (`intentType` prefix), e.g. `erc20` or `bank`. */
  capability?: string;
  /** Filter by status (e.g. `PENDING`). */
  status?: string;
  /** Max rows to return (default 100, max 500). */
  limit?: number;
}
