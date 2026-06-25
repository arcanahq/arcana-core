/**
 * Bank module
 * 
 * Provides methods for on-chain asset management:
 * - Balance queries
 * - Transfers between users
 * - Withdrawals to external wallets
 * - Spending authorizations
 * - Asset registration and listing
 */

import { AxiosInstance } from 'axios';
import { extractData, ApiResponse } from '../types/common.js';
import type {
  BankBalance,
  BankAsset,
  BankAuthorization,
  BankWithdrawal,
  BankTransfer,
  CreateWithdrawalRequest,
  CreateTransferRequest,
  CreateAuthorizationRequest,
  RegisterAssetRequest,
  ListWithdrawalsOptions,
  ListAuthorizationsOptions,
  BankDepositIntent,
  CreateDepositIntentRequest,
  ListDepositIntentsOptions,
  WalletIntent,
  ListIntentsOptions,
} from './types.js';

/**
 * Bank module for on-chain asset management.
 * 
 * Handles user balances, transfers, withdrawals, and spending authorizations.
 */
export class BankModule {
  constructor(private api: AxiosInstance) {}

  // ==========================================================================
  // Balances
  // ==========================================================================

  /**
   * Get all balances for the authenticated user.
   * 
   * @returns Array of balances per asset
   */
  async getBalances(): Promise<BankBalance[]> {
    const response = await this.api.get<ApiResponse<BankBalance[]>>('/bank/balances');
    return extractData(response);
  }

  /**
   * Get balance for a specific asset.
   * 
   * @param assetId - The asset ID
   * @returns Balance amount as string, or '0' if not found
   */
  async getBalance(assetId: string): Promise<string> {
    const balances = await this.getBalances();
    const balance = balances.find(b => b.assetId === assetId);
    return balance?.amount ?? '0';
  }

  // ==========================================================================
  // Assets
  // ==========================================================================

  /**
   * List all registered assets.
   * 
   * @returns Array of registered assets
   */
  async listAssets(): Promise<BankAsset[]> {
    const response = await this.api.get<ApiResponse<BankAsset[]>>(
      '/bank/assets'
    );
    return extractData(response);
  }

  /**
   * Get asset by ID.
   * 
   * @param assetId - The asset ID
   * @returns Asset info or null if not found
   */
  async getAsset(assetId: string): Promise<BankAsset | null> {
    const assets = await this.listAssets();
    return assets.find(a => a.assetId === assetId) ?? null;
  }

  /**
   * Find asset by symbol (e.g., 'USDC').
   * 
   * @param symbol - Asset symbol (case-insensitive)
   * @returns Asset info or null if not found
   */
  async findAssetBySymbol(symbol: string): Promise<BankAsset | null> {
    const assets = await this.listAssets();
    const lowerSymbol = symbol.toLowerCase();
    return assets.find(a => a.symbol.toLowerCase() === lowerSymbol) ?? null;
  }

  /**
   * Register a new asset (admin only).
   * 
   * @param request - Asset registration request
   */
  async registerAsset(request: RegisterAssetRequest): Promise<BankAsset> {
    const response = await this.api.post<ApiResponse<BankAsset>>(
      '/bank/assets',
      request
    );
    return extractData(response);
  }

  // ==========================================================================
  // Transfers
  // ==========================================================================

  /**
   * Transfer funds to another user.
   * 
   * @param request - Transfer request
   * @returns Transfer confirmation
   */
  async transfer(request: CreateTransferRequest): Promise<BankTransfer> {
    const response = await this.api.post<ApiResponse<BankTransfer>>(
      '/bank/transfers',
      request
    );
    return extractData(response);
  }

  // ==========================================================================
  // Withdrawals
  // ==========================================================================

  /**
   * Request a withdrawal to an external wallet.
   * 
   * @param request - Withdrawal request
   * @returns Withdrawal confirmation with ID
   */
  async createWithdrawal(request: CreateWithdrawalRequest): Promise<{ withdrawalId: string }> {
    const response = await this.api.post<ApiResponse<{ withdrawalId: string }>>(
      '/bank/withdrawals',
      request
    );
    return extractData(response);
  }

  /**
   * List withdrawals for the authenticated user.
   * 
   * @param options - Pagination and filter options
   */
  async listWithdrawals(options?: ListWithdrawalsOptions): Promise<BankWithdrawal[]> {
    const params: Record<string, unknown> = {};
    if (options?.limit !== undefined) params.limit = options.limit;
    if (options?.offset !== undefined) params.offset = options.offset;
    if (options?.status) params.status = options.status;

    const response = await this.api.get<ApiResponse<BankWithdrawal[]>>(
      '/bank/withdrawals',
      { params }
    );
    return extractData(response);
  }

  // ==========================================================================
  // Authorizations
  // ==========================================================================

  /**
   * Create a spending authorization for another user/service.
   * 
   * @param request - Authorization request
   */
  async createAuthorization(request: CreateAuthorizationRequest): Promise<BankAuthorization> {
    const response = await this.api.post<ApiResponse<BankAuthorization>>(
      '/bank/authorizations',
      request
    );
    return extractData(response);
  }

  /**
   * List authorizations for the authenticated user.
   * 
   * @param options - Pagination options
   */
  async listAuthorizations(options?: ListAuthorizationsOptions): Promise<BankAuthorization[]> {
    const params: Record<string, unknown> = {};
    if (options?.limit !== undefined) params.limit = options.limit;
    if (options?.offset !== undefined) params.offset = options.offset;

    const response = await this.api.get<ApiResponse<BankAuthorization[]>>(
      '/bank/authorizations',
      { params }
    );
    return extractData(response);
  }

  /**
   * Revoke an authorization.
   * 
   * @param authId - Authorization ID to revoke
   */
  async revokeAuthorization(authId: string): Promise<void> {
    await this.api.post(`/bank/authorizations/${authId}/revoke`);
  }

  // ==========================================================================
  // Deposit Intents
  // ==========================================================================

  /**
   * Create a pre-tx deposit intent keyed by vault depositId (bytes32).
   */
  async createDepositIntent(request: CreateDepositIntentRequest): Promise<BankDepositIntent> {
    const response = await this.api.post<ApiResponse<BankDepositIntent>>(
      '/bank/deposit-intents',
      request
    );
    return extractData(response);
  }

  /**
   * Get a single deposit intent by depositId.
   */
  async getDepositIntent(depositId: string): Promise<BankDepositIntent> {
    const response = await this.api.get<ApiResponse<BankDepositIntent>>(
      `/bank/deposit-intents/${encodeURIComponent(depositId)}`
    );
    return extractData(response);
  }

  /**
   * List deposit intents for the authenticated user.
   */
  async listDepositIntents(options?: ListDepositIntentsOptions): Promise<BankDepositIntent[]> {
    const params: Record<string, unknown> = {};
    if (options?.limit !== undefined) params.limit = options.limit;
    if (options?.offset !== undefined) params.offset = options.offset;

    const response = await this.api.get<ApiResponse<BankDepositIntent[]>>(
      '/bank/deposit-intents',
      { params }
    );
    return extractData(response);
  }

  /**
   * Cancel a pending deposit intent.
   */
  async cancelDepositIntent(depositId: string): Promise<BankDepositIntent> {
    const response = await this.api.post<ApiResponse<BankDepositIntent>>(
      `/bank/deposit-intents/${encodeURIComponent(depositId)}/cancel`
    );
    return extractData(response);
  }

  /**
   * List async intents for the authenticated account from the generic
   * `wallet_intents` table (bank deposits, ERC20 wrap/unwrap, …), optionally
   * filtered by capability and status.
   */
  async listIntents(options: ListIntentsOptions = {}): Promise<WalletIntent[]> {
    const params: Record<string, unknown> = {};
    if (options.capability) params.capability = options.capability;
    if (options.status) params.status = options.status;
    if (options.limit !== undefined) params.limit = options.limit;
    const response = await this.api.get<ApiResponse<WalletIntent[]>>('/bank/intents', { params });
    return extractData(response);
  }

  /**
   * Convenience wrapper around {@link listIntents} that returns only pending
   * intents for the authenticated account.
   */
  async listPendingIntents(
    options: Omit<ListIntentsOptions, 'status'> = {}
  ): Promise<WalletIntent[]> {
    return this.listIntents({ ...options, status: 'PENDING' });
  }
}
