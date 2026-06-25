/**
 * React hooks for contract/instance interactions.
 * 
 * Uses TanStack Query for caching, retries, and state management.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import type { ContractsModule } from '../contracts/index.js';
import type {
  ArgsStruct,
  InstanceInfo,
  InstanceActionRequest,
  InstanceActionResponse,
  GetEventsOptions,
  InstanceEvent,
} from '../contracts/types.js';

/**
 * Create contract hooks bound to a ContractsModule.
 */
export function createContractsHooks(contracts: ContractsModule) {
  return {
    /**
     * Get a contract/instance by ID.
     */
    useInstance: (
      instanceId: string,
      options?: Omit<UseQueryOptions<InstanceInfo, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['contracts', 'instance', instanceId],
        queryFn: () => contracts.getState(instanceId),
        enabled: !!instanceId,
        ...options,
      });
    },

    /**
     * View a contract's personalized state.
     * 
     * Automatically refetches to keep state up-to-date.
     * 
     * @example
     * ```tsx
     * const { data: gameState, isLoading } = hooks.contracts.useView(gameId);
     * ```
     */
    useView: <TState = unknown>(
      instanceId: string | null,
      options?: Omit<UseQueryOptions<TState, Error>, 'queryKey' | 'queryFn'> & {
        refetchInterval?: number;
      }
    ) => {
      return useQuery({
        queryKey: ['contracts', 'view', instanceId],
        queryFn: async () => {
          if (!instanceId) throw new Error('Instance ID is required');
          const result = await contracts.view(instanceId);
          return result as TState;
        },
        enabled: !!instanceId,
        staleTime: 2000, // Consider data fresh for 2 seconds (views update frequently)
        refetchInterval: options?.refetchInterval ?? 5000, // Refetch every 5 seconds by default
        ...options,
      });
    },

    /**
     * Get contract events.
     */
    useEvents: (
      instanceId: string,
      options?: GetEventsOptions,
      queryOptions?: Omit<UseQueryOptions<InstanceEvent[], Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['contracts', 'events', instanceId, options],
        queryFn: () => contracts.getEvents(instanceId, options),
        enabled: !!instanceId,
        ...queryOptions,
      });
    },

    /**
     * Execute an action on a contract.
     * 
     * @example
     * ```tsx
     * const { hooks } = useArcana();
     * const action = hooks.contracts.useAction();
     * 
     * const handlePlay = async () => {
     *   await action.mutateAsync({
     *     instanceId: gameId,
     *     entrypoint: 'play',
     *     args: { choice: 'rock' }
     *   });
     * };
     * ```
     */
    useAction: (
      options?: Omit<UseMutationOptions<InstanceActionResponse, Error, {
        instanceId: string;
        entrypoint: string;
        args?: ArgsStruct;
        actionOptions?: { block?: boolean };
      }>, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: async ({ instanceId, entrypoint, args, actionOptions }) => {
          return contracts.executeAction(instanceId, entrypoint, args ?? {}, actionOptions);
        },
        onSuccess: (_, variables) => {
          // Invalidate the instance state
          queryClient.invalidateQueries({ queryKey: ['contracts', 'view', variables.instanceId] });
          queryClient.invalidateQueries({ queryKey: ['contracts', 'instance', variables.instanceId] });
          queryClient.invalidateQueries({ queryKey: ['contracts', 'events', variables.instanceId] });
        },
        ...options,
      });
    },

    /**
     * Create a new contract instance.
     */
    useCreate: (
      options?: Omit<UseMutationOptions<InstanceInfo, Error, {
        programType: string;
        args?: ArgsStruct;
        instanceId?: string;
      }>, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: async ({ programType, args, instanceId }) => {
          return contracts.create(programType, args, { instanceId });
        },
        onSuccess: () => {
          // Invalidate all instance lists
          queryClient.invalidateQueries({ queryKey: ['contracts', 'instances'] });
          queryClient.invalidateQueries({ queryKey: ['scopes'] });
        },
        ...options,
      });
    },

    /**
     * Get user's instances.
     * 
     * @example
     * ```tsx
     * const { data: instances, isLoading } = hooks.contracts.useUserInstances(scopeId);
     * ```
     */
    useUserInstances: (
      scopeId?: string | null,
      options?: Omit<UseQueryOptions<InstanceInfo[], Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['contracts', 'instances', 'user', scopeId || 'all-scopes'],
        queryFn: () => contracts.getUserInstances(scopeId ? { scopeId } : undefined),
        staleTime: 5000, // Consider data fresh for 5 seconds
        refetchInterval: 10000, // Refetch every 10 seconds
        ...options,
      });
    },
  };
}

/**
 * Type for the contracts hooks object.
 */
export type ContractsHooks = ReturnType<typeof createContractsHooks>;
