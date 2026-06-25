import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import type { Address } from 'viem';
import type { WalletClient, Account } from 'viem';
import type { AuthModule } from '../auth/index.js';
import type { DomainInfo, SignInResponse, UserInfo } from '../auth/types.js';

/**
 * Auth hooks using TanStack Query
 */
export function createAuthHooks(auth: AuthModule) {
  return {
    /**
     * Get EIP-712 domain info from the server
     */
    useDomainInfo: (options?: Omit<UseQueryOptions<DomainInfo, Error>, 'queryKey' | 'queryFn'>) => {
      return useQuery({
        queryKey: ['auth', 'domain'],
        queryFn: () => auth.getDomainInfo(),
        ...options,
      });
    },

    /**
     * Get current user info
     */
    useUserInfo: (options?: Omit<UseQueryOptions<UserInfo, Error>, 'queryKey' | 'queryFn'>) => {
      return useQuery({
        queryKey: ['auth', 'user'],
        queryFn: () => auth.getUserInfo(),
        ...options,
      });
    },

    // Note: signIn has been removed - use device auth instead
    // See DeviceAuthModule.registerDevice() for device-bound authentication
  };
}

