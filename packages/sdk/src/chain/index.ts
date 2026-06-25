/**
 * Chain module
 * 
 * Provides methods for on-chain interactions like reading token balances.
 * Uses viem for EVM chain interactions.
 */

import type { ChainBalance, ChainConfig, TokenInfo } from './types.js';
import { formatBalance } from '../utils/index.js';

// ERC20 ABI for balance and decimals
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

/**
 * Chain module for on-chain interactions.
 * 
 * This module provides utilities for reading on-chain data like ERC20 balances.
 * It dynamically imports viem to avoid bundling issues for projects not using it.
 */
export class ChainModule {
  private config: ChainConfig;
  private viemClient: any | null = null;

  constructor(config: ChainConfig) {
    this.config = config;
  }

  /**
   * Get or create the viem public client.
   */
  private async getClient(): Promise<any> {
    if (this.viemClient) {
      return this.viemClient;
    }

    // Dynamic import to avoid bundling viem if not used
    const { createPublicClient, http } = await import('viem');
    const { anvil } = await import('viem/chains');

    this.viemClient = createPublicClient({
      chain: { ...anvil, id: this.config.chainId },
      transport: http(this.config.rpcUrl),
    });

    return this.viemClient;
  }

  /**
   * Get ERC20 token balance for an address.
   * 
   * @param userAddress - Wallet address to check
   * @param tokenAddress - ERC20 token contract address
   * @param precision - Decimal precision for formatted output (default: 2)
   */
  async getTokenBalance(
    userAddress: string,
    tokenAddress: string,
    precision: number = 2
  ): Promise<ChainBalance> {
    const client = await this.getClient();

    const [balance, decimals] = await Promise.all([
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`],
        blockTag: 'latest',
      }),
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
    ]);

    const balanceStr = (balance as bigint).toString();

    return {
      address: userAddress,
      tokenAddress,
      balance: balanceStr,
      formatted: formatBalance(balanceStr, decimals as number, precision),
      decimals: decimals as number,
    };
  }

  /**
   * Get token info (symbol, decimals, name).
   * 
   * @param tokenAddress - ERC20 token contract address
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    const client = await this.getClient();

    const [symbol, decimals, name] = await Promise.all([
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'name',
      }).catch(() => undefined), // name is optional
    ]);

    return {
      address: tokenAddress,
      symbol: symbol as string,
      decimals: decimals as number,
      name: name as string | undefined,
    };
  }

  /**
   * Get native token balance (ETH).
   * 
   * @param userAddress - Wallet address to check
   * @param precision - Decimal precision for formatted output (default: 4)
   */
  async getNativeBalance(
    userAddress: string,
    precision: number = 4
  ): Promise<ChainBalance> {
    const client = await this.getClient();
    const balance = await client.getBalance({ address: userAddress as `0x${string}` });
    const balanceStr = (balance as bigint).toString();

    return {
      address: userAddress,
      tokenAddress: '0x0000000000000000000000000000000000000000',
      balance: balanceStr,
      formatted: formatBalance(balanceStr, 18, precision),
      decimals: 18,
    };
  }

  /**
   * Update chain configuration.
   */
  setConfig(config: Partial<ChainConfig>): void {
    this.config = { ...this.config, ...config };
    this.viemClient = null; // Reset client to use new config
  }
}

/**
 * Create a chain module with the given configuration.
 */
export function createChainModule(config: ChainConfig): ChainModule {
  return new ChainModule(config);
}

