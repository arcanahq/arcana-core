/**
 * ERC20 capability module
 *
 * Convenience helpers for value-bearing apps that use the optional ERC20
 * wrapper capability: allowance checks, approval/deposit/withdraw wiring,
 * account-id-to-bytes32 conversion, configured wrapper/token metadata, and
 * deposit-credit queries.
 *
 * Pure helpers (`needsApproval`, `arcanaAccountIdToBytes32`) are static and have
 * no network/chain dependency. On-chain reads use a viem public client; the
 * write helpers require the caller to pass a viem `WalletClient` (the SDK does
 * not hold signing keys).
 */

import type { AxiosInstance } from 'axios';
import { extractData, type ApiResponse } from '../types/common.js';
import type { ChainConfig } from '../chain/types.js';
import type {
  Erc20WrapperMetadata,
  Erc20WrapCredit,
  ListErc20CreditsOptions,
  Erc20WalletClient,
} from './types.js';

// ABI fragments needed for allowance/approve/deposit/withdraw.
const ERC20_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

// Wrapper/vault deposit + withdraw entrypoints (recipient encoded as bytes32).
const WRAPPER_ABI = [
  {
    name: 'wrapForArcana',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'arcanaAccount', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'depositNativeForArcana',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'arcanaAccount', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'unwrap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'source', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export class Erc20Module {
  private viemClient: any | null = null;

  constructor(
    private api: AxiosInstance,
    private chainConfig?: ChainConfig
  ) {}

  // ==========================================================================
  // Pure helpers (no network / no chain)
  // ==========================================================================

  /**
   * True if `allowance` is insufficient to cover `amount`. Use to decide
   * whether to show an "Approve" button before a deposit.
   */
  static needsApproval(allowance: bigint | string, amount: bigint | string): boolean {
    return BigInt(allowance) < BigInt(amount);
  }

  /**
   * Convert an Arcana account id to the `bytes32` value expected by a wrapper
   * `depositFor` call.
   *
   * - If `accountId` is already a 0x-prefixed 32-byte hex string, it is returned
   *   lower-cased and passed through unchanged.
   * - Otherwise it is derived as `keccak256(utf8Bytes(accountId))`.
   *
   * IMPORTANT: the on-chain wrapper MUST use the same convention to credit the
   * intended account. If your vault expects a different encoding (e.g. a raw
   * left-padded id), convert it yourself and pass a 0x-32-byte value here.
   */
  static async arcanaAccountIdToBytes32(accountId: string): Promise<`0x${string}`> {
    const trimmed = accountId.trim();
    if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
      return trimmed.toLowerCase() as `0x${string}`;
    }
    const { keccak256, stringToBytes } = await import('viem');
    return keccak256(stringToBytes(trimmed));
  }

  // ==========================================================================
  // On-chain reads
  // ==========================================================================

  private async getClient(): Promise<any> {
    if (this.viemClient) return this.viemClient;
    if (!this.chainConfig) {
      throw new Error(
        'Erc20Module: chain config is required for on-chain calls. Construct the client with a chainConfig.'
      );
    }
    const { createPublicClient, http } = await import('viem');
    const { anvil } = await import('viem/chains');
    this.viemClient = createPublicClient({
      chain: { ...anvil, id: this.chainConfig.chainId },
      transport: http(this.chainConfig.rpcUrl),
    });
    return this.viemClient;
  }

  /** Read the current ERC20 allowance `owner` has granted `spender`. */
  async getAllowance(owner: string, spender: string, tokenAddress: string): Promise<bigint> {
    const client = await this.getClient();
    return (await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [owner as `0x${string}`, spender as `0x${string}`],
    })) as bigint;
  }

  /** True if `owner` must approve `spender` for at least `amount` of `tokenAddress`. */
  async needsApprovalFor(
    owner: string,
    spender: string,
    tokenAddress: string,
    amount: bigint | string
  ): Promise<boolean> {
    const allowance = await this.getAllowance(owner, spender, tokenAddress);
    return Erc20Module.needsApproval(allowance, amount);
  }

  // ==========================================================================
  // On-chain writes (require a caller-provided viem WalletClient)
  // ==========================================================================

  /** Approve `spender` for `amount` only if the current allowance is insufficient.
   *  Returns the approval tx hash, or `null` if no approval was needed. */
  async approveIfNeeded(
    wallet: Erc20WalletClient,
    owner: string,
    spender: string,
    tokenAddress: string,
    amount: bigint | string
  ): Promise<`0x${string}` | null> {
    if (!(await this.needsApprovalFor(owner, spender, tokenAddress, amount))) {
      return null;
    }
    return wallet.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender as `0x${string}`, BigInt(amount)],
    });
  }

  /** Deposit `amount` of `tokenAddress` into `wrapperAddress`, credited to the
   *  given Arcana account id. Returns the deposit tx hash. */
  async depositForArcana(
    wallet: Erc20WalletClient,
    params: {
      wrapperAddress: string;
      tokenAddress: string;
      amount: bigint | string;
      arcanaAccountId: string;
    }
  ): Promise<`0x${string}`> {
    const account = await Erc20Module.arcanaAccountIdToBytes32(params.arcanaAccountId);
    return wallet.writeContract({
      address: params.wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: 'wrapForArcana',
      args: [params.tokenAddress as `0x${string}`, BigInt(params.amount), account],
    });
  }

  /** Deposit native ETH into `wrapperAddress`, credited to an Arcana account id. */
  async depositNativeForArcana(
    wallet: Erc20WalletClient,
    params: { wrapperAddress: string; amount: bigint | string; arcanaAccountId: string }
  ): Promise<`0x${string}`> {
    const account = await Erc20Module.arcanaAccountIdToBytes32(params.arcanaAccountId);
    return wallet.writeContract({
      address: params.wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: 'depositNativeForArcana',
      args: [account],
      value: BigInt(params.amount),
    });
  }

  /** Withdraw `amount` of `tokenAddress` from `wrapperAddress` to `to`.
   *
   * Pass `NATIVE_ETH_ADDRESS` as `tokenAddress` to withdraw native ETH from a
   * vault that was funded through `depositNativeForArcana`.
   */
  async withdrawFromArcana(
    wallet: Erc20WalletClient,
    params: {
      wrapperAddress: string;
      tokenAddress: string;
      source: string;
      amount: bigint | string;
      to: string;
    }
  ): Promise<`0x${string}`> {
    return wallet.writeContract({
      address: params.wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: 'unwrap',
      args: [
        params.tokenAddress as `0x${string}`,
        params.source as `0x${string}`,
        params.to as `0x${string}`,
        BigInt(params.amount),
      ],
    });
  }

  // ==========================================================================
  // Capability routes
  // ==========================================================================

  /** Configured wrapper/vault/token metadata for the scope. */
  async getConfig(): Promise<Erc20WrapperMetadata[]> {
    const response = await this.api.get<ApiResponse<Erc20WrapperMetadata[]>>('/erc20/config');
    return extractData(response);
  }

  /** Query captured deposit credits, optionally filtered by recipient/tx hash. */
  async getDeposits(options: ListErc20CreditsOptions = {}): Promise<Erc20WrapCredit[]> {
    const params: Record<string, string> = {};
    if (options.recipient) params.recipient = options.recipient;
    if (options.txHash) params.txHash = options.txHash;
    const response = await this.api.get<ApiResponse<Erc20WrapCredit[]>>('/erc20/credits', {
      params,
    });
    return extractData(response);
  }
}
