/**
 * React hooks for on-chain interactions.
 * 
 * Uses TanStack Query for caching.
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import type { ChainModule } from '../chain/index.js';
import type { ChainBalance, TokenInfo } from '../chain/types.js';

/**
 * Create chain hooks bound to a ChainModule.
 */
export function createChainHooks(chain: ChainModule | null) {
  return {
    /**
     * Get token balance for an address.
     */
    useTokenBalance: (
      address: `0x${string}` | undefined,
      tokenAddress: `0x${string}` | undefined,
      decimals?: number,
      options?: Omit<UseQueryOptions<ChainBalance, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['chain', 'tokenBalance', address, tokenAddress],
        queryFn: async () => {
          if (!chain || !address || !tokenAddress) {
            throw new Error('Missing required parameters');
          }
          return chain.getTokenBalance(address, tokenAddress, decimals);
        },
        enabled: !!chain && !!address && !!tokenAddress,
        ...options,
      });
    },

    /**
     * Get token info (name, symbol, decimals).
     */
    useTokenInfo: (
      tokenAddress: `0x${string}` | undefined,
      options?: Omit<UseQueryOptions<TokenInfo, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['chain', 'tokenInfo', tokenAddress],
        queryFn: async () => {
          if (!chain || !tokenAddress) {
            throw new Error('Missing required parameters');
          }
          return chain.getTokenInfo(tokenAddress);
        },
        enabled: !!chain && !!tokenAddress,
        staleTime: 60 * 60 * 1000, // 1 hour (token info rarely changes)
        ...options,
      });
    },

    /**
     * Get native balance (ETH) for an address.
     */
    useNativeBalance: (
      address: `0x${string}` | undefined,
      options?: Omit<UseQueryOptions<ChainBalance, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['chain', 'nativeBalance', address],
        queryFn: async () => {
          if (!chain || !address) {
            throw new Error('Missing required parameters');
          }
          return chain.getNativeBalance(address);
        },
        enabled: !!chain && !!address,
        ...options,
      });
    },
  };
}

/**
 * Type for the chain hooks object.
 */
export type ChainHooks = ReturnType<typeof createChainHooks>;

