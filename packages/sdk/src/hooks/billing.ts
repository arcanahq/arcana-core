import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import type { BillingModule } from '../billing/index.js';
import type {
  Project,
  ProjectFunding,
  BillingEvent,
  Budget,
  BillingTransaction,
  UserBalance,
  CreateProjectRequest,
  FundProjectRequest,
  FundUserRequest,
  ProjectUsage,
  ProjectStorage,
} from '../billing/types.js';

/**
 * Billing hooks using TanStack Query
 */
export function createBillingHooks(billing: BillingModule) {
  return {
    /**
     * Get user account balance
     */
    useUserBalance: (options?: Omit<UseQueryOptions<UserBalance[], Error>, 'queryKey' | 'queryFn'>) => {
      return useQuery({
        queryKey: ['billing', 'user', 'balance'],
        queryFn: () => billing.getUserBalance(),
        ...options,
      });
    },

    /**
     * Get user transaction history
     */
    useUserTransactions: (
      options?: {
        limit?: number;
        offset?: number;
      },
      queryOptions?: Omit<UseQueryOptions<BillingTransaction[], Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['billing', 'user', 'transactions', options],
        queryFn: () => billing.getUserTransactions(options),
        ...queryOptions,
      });
    },

    /**
     * List all projects for the authenticated user
     */
    useProjects: (options?: Omit<UseQueryOptions<Project[], Error>, 'queryKey' | 'queryFn'>) => {
      return useQuery({
        queryKey: ['billing', 'projects'],
        queryFn: () => billing.listProjects(),
        ...options,
      });
    },

    /**
     * Get project details
     */
    useProject: (
      projectId: string,
      options?: Omit<UseQueryOptions<Project, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['billing', 'projects', projectId],
        queryFn: () => billing.getProject(projectId),
        enabled: !!projectId,
        ...options,
      });
    },

    /**
     * Get project funding balances
     */
    useProjectFunding: (
      projectId: string,
      options?: Omit<UseQueryOptions<ProjectFunding[], Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['billing', 'projects', projectId, 'funding'],
        queryFn: () => billing.getProjectFunding(projectId),
        enabled: !!projectId,
        ...options,
      });
    },

    /**
     * Get project transaction history
     */
    useProjectTransactions: (
      projectId: string,
      options?: {
        limit?: number;
        offset?: number;
      },
      queryOptions?: Omit<UseQueryOptions<BillingTransaction[], Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['billing', 'projects', projectId, 'transactions', options],
        queryFn: () => billing.getProjectTransactions(projectId, options),
        enabled: !!projectId,
        ...queryOptions,
      });
    },

    /**
     * Get project usage statistics
     */
    useProjectUsage: (
      projectId: string,
      options?: Omit<UseQueryOptions<ProjectUsage, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['billing', 'projects', projectId, 'usage'],
        queryFn: () => billing.getProjectUsage(projectId),
        enabled: !!projectId,
        ...options,
      });
    },

    /**
     * Get project storage statistics
     */
    useProjectStorage: (
      projectId: string,
      options?: Omit<UseQueryOptions<ProjectStorage, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['billing', 'projects', projectId, 'storage'],
        queryFn: () => billing.getProjectStorage(projectId),
        enabled: !!projectId,
        ...options,
      });
    },

    /**
     * Get scope budget
     */
    useScopeBudget: (
      scopeId: string,
      options?: Omit<UseQueryOptions<Budget | null, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['billing', 'scopes', scopeId, 'budget'],
        queryFn: () => billing.getScopeBudget(scopeId),
        enabled: !!scopeId,
        ...options,
      });
    },

    /**
     * Get scope billing events
     */
    useScopeEvents: (
      scopeId: string,
      options?: {
        limit?: number;
        offset?: number;
        event_type?: string;
      },
      queryOptions?: Omit<UseQueryOptions<BillingEvent[], Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['billing', 'scopes', scopeId, 'events', options],
        queryFn: () => billing.getScopeEvents(scopeId, options),
        enabled: !!scopeId,
        ...queryOptions,
      });
    },

    /**
     * Create a new project
     */
    useCreateProject: (
      options?: Omit<UseMutationOptions<Project, Error, CreateProjectRequest>, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (request: CreateProjectRequest) => billing.createProject(request),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['billing', 'projects'] });
        },
        ...options,
      });
    },

    /**
     * Fund user account
     */
    useFundUserAccount: (
      options?: Omit<UseMutationOptions<any, Error, FundUserRequest>, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (request: FundUserRequest) => billing.fundUserAccount(request),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['billing', 'user', 'balance'] });
          queryClient.invalidateQueries({ queryKey: ['billing', 'user', 'transactions'] });
        },
        ...options,
      });
    },

    /**
     * Fund a project from user balance
     */
    useFundProject: (
      projectId: string,
      options?: Omit<UseMutationOptions<any, Error, FundProjectRequest>, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (request: FundProjectRequest) => billing.fundProject(projectId, request),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['billing', 'user', 'balance'] });
          queryClient.invalidateQueries({ queryKey: ['billing', 'projects', projectId, 'funding'] });
          queryClient.invalidateQueries({ queryKey: ['billing', 'projects', projectId, 'transactions'] });
        },
        ...options,
      });
    },

    /**
     * Delete a project
     */
    useDeleteProject: (
      projectId: string,
      options?: Omit<UseMutationOptions<{ project_id: string }, Error, void>, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: () => billing.deleteProject(projectId),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['billing', 'projects'] });
          queryClient.removeQueries({ queryKey: ['billing', 'projects', projectId] });
        },
        ...options,
      });
    },
  };
}

