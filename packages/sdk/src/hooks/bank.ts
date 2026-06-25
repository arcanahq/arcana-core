import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import type { BankModule } from '../bank/index.js';
import type {
  BankBalance,
  BankAsset,
  BankAuthorization,
  BankWithdrawal,
  BankTransfer,
  CreateWithdrawalRequest,
  CreateTransferRequest,
  CreateAuthorizationRequest,
  ListWithdrawalsOptions,
  ListAuthorizationsOptions,
} from '../bank/types.js';

/**
 * Bank hooks using TanStack Query
 */
export function createBankHooks(bank: BankModule) {
  return {
    /**
     * Get all balances for the authenticated user.
     */
    useBalances: (options?: Omit<UseQueryOptions<BankBalance[], Error>, 'queryKey' | 'queryFn'>) => {
      return useQuery({
        queryKey: ['bank', 'balances'],
        queryFn: () => bank.getBalances(),
        ...options,
      });
    },

    /**
     * Get balance for a specific asset.
     */
    useBalance: (
      assetId: string,
      options?: Omit<UseQueryOptions<string, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['bank', 'balances', assetId],
        queryFn: () => bank.getBalance(assetId),
        enabled: !!assetId,
        ...options,
      });
    },

    /**
     * List all registered assets.
     */
    useAssets: (options?: Omit<UseQueryOptions<BankAsset[], Error>, 'queryKey' | 'queryFn'>) => {
      return useQuery({
        queryKey: ['bank', 'assets'],
        queryFn: () => bank.listAssets(),
        ...options,
      });
    },

    /**
     * Get a specific asset by ID.
     */
    useAsset: (
      assetId: string,
      options?: Omit<UseQueryOptions<BankAsset | null, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['bank', 'assets', assetId],
        queryFn: () => bank.getAsset(assetId),
        enabled: !!assetId,
        ...options,
      });
    },

    /**
     * List withdrawals for the authenticated user.
     */
    useWithdrawals: (
      options?: ListWithdrawalsOptions,
      queryOptions?: Omit<UseQueryOptions<BankWithdrawal[], Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['bank', 'withdrawals', options],
        queryFn: () => bank.listWithdrawals(options),
        ...queryOptions,
      });
    },

    /**
     * List authorizations for the authenticated user.
     */
    useAuthorizations: (
      options?: ListAuthorizationsOptions,
      queryOptions?: Omit<UseQueryOptions<BankAuthorization[], Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['bank', 'authorizations', options],
        queryFn: () => bank.listAuthorizations(options),
        ...queryOptions,
      });
    },

    /**
     * Transfer funds to another user.
     */
    useTransfer: (
      options?: Omit<UseMutationOptions<BankTransfer, Error, CreateTransferRequest>, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (request: CreateTransferRequest) => bank.transfer(request),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['bank', 'balances'] });
        },
        ...options,
      });
    },

    /**
     * Request a withdrawal to an external wallet.
     */
    useCreateWithdrawal: (
      options?: Omit<UseMutationOptions<{ withdrawalId: string }, Error, CreateWithdrawalRequest>, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (request: CreateWithdrawalRequest) => bank.createWithdrawal(request),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['bank', 'balances'] });
          queryClient.invalidateQueries({ queryKey: ['bank', 'withdrawals'] });
        },
        ...options,
      });
    },

    /**
     * Create a spending authorization.
     */
    useCreateAuthorization: (
      options?: Omit<UseMutationOptions<BankAuthorization, Error, CreateAuthorizationRequest>, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (request: CreateAuthorizationRequest) => bank.createAuthorization(request),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['bank', 'authorizations'] });
        },
        ...options,
      });
    },

    /**
     * Revoke an authorization.
     */
    useRevokeAuthorization: (
      options?: Omit<UseMutationOptions<void, Error, string>, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (authId: string) => bank.revokeAuthorization(authId),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['bank', 'authorizations'] });
        },
        ...options,
      });
    },
  };
}

