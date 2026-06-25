import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import type { ScopesModule } from '../scopes/index.js';
import type {
  Scope,
  Program,
  Instance,
  CreateScopeRequest,
  DeployProgramRequest,
  CreateInstanceRequest,
  KVStore,
  ListScopesOptions,
  ListProgramsOptions,
  ListInstancesOptions,
} from '../scopes/types.js';

function normalizeListInstancesOptions(options?: ListInstancesOptions): ListInstancesOptions | undefined {
  const normalized: ListInstancesOptions = {};

  if (typeof options?.limit === 'number') normalized.limit = options.limit;
  if (typeof options?.offset === 'number') normalized.offset = options.offset;
  if (typeof options?.program_type === 'string' && options.program_type.trim().length > 0) {
    normalized.program_type = options.program_type;
  }
  if (typeof options?.status === 'string' && options.status.trim().length > 0) {
    normalized.status = options.status;
  }
  if (typeof options?.include_terminated === 'boolean') {
    normalized.include_terminated = options.include_terminated;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/**
 * Scopes hooks using TanStack Query
 */
export function createScopesHooks(scopes: ScopesModule) {
  return {
    /**
     * List scopes
     */
    useScopes: (
      options?: ListScopesOptions,
      queryOptions?: Omit<UseQueryOptions<Scope[], Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['scopes', options],
        queryFn: () => scopes.listScopes(options),
        ...queryOptions,
      });
    },

    /**
     * Get scope details
     */
    useScope: (
      scopeId: string,
      options?: Omit<UseQueryOptions<Scope, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['scopes', scopeId],
        queryFn: () => scopes.getScope(scopeId),
        enabled: !!scopeId,
        ...options,
      });
    },

    /**
     * List programs in a scope
     */
    usePrograms: (
      scopeId: string,
      options?: ListProgramsOptions,
      queryOptions?: Omit<UseQueryOptions<Program[], Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['scopes', scopeId, 'programs', options],
        queryFn: () => scopes.listPrograms(scopeId, options),
        enabled: !!scopeId,
        staleTime: 60000, // Program lists don't change often
        ...queryOptions,
      });
    },

    /**
     * Get a program by type (convenience hook)
     * 
     * @example
     * ```tsx
     * const { data: programId } = hooks.scopes.useProgramByType(scopeId, 'roshambo');
     * ```
     */
    useProgramByType: (
      scopeId: string,
      programType: string,
      options?: Omit<UseQueryOptions<string | null, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['scopes', scopeId, 'programs', 'by-type', programType],
        queryFn: async () => {
          const programs = await scopes.listPrograms(scopeId);
          const program = programs.find(p => p.program_type === programType);
          return program?.program_id || null;
        },
        enabled: !!scopeId && !!programType,
        staleTime: 60000, // Program IDs don't change often
        ...options,
      });
    },

    /**
     * List contract instances in a scope
     */
    useInstances: (
      scopeId: string,
      options?: ListInstancesOptions,
      queryOptions?: Omit<UseQueryOptions<Instance[], Error>, 'queryKey' | 'queryFn'>
    ) => {
      const normalizedOptions = normalizeListInstancesOptions(options);
      return useQuery({
        queryKey: ['scopes', scopeId, 'instances', normalizedOptions ?? null],
        queryFn: () => scopes.listInstances(scopeId, normalizedOptions),
        enabled: !!scopeId,
        staleTime: 60000, // Prevent immediate duplicate refetches on fresh mount
        retry: false, // Avoid retry bursts that look like duplicate initial requests
        ...queryOptions,
      });
    },

    /**
     * Get KV store for a scope
     */
    useKV: (
      scopeId: string,
      options?: Omit<UseQueryOptions<KVStore, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['scopes', scopeId, 'kv'],
        queryFn: () => scopes.getKV(scopeId),
        enabled: !!scopeId,
        ...options,
      });
    },

    /**
     * Create a new scope
     */
    useCreateScope: (
      options?: Omit<UseMutationOptions<Scope, Error, CreateScopeRequest>, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (request: CreateScopeRequest) => scopes.createScope(request),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['scopes'] });
        },
        ...options,
      });
    },

    /**
     * Deploy a program to a scope
     */
    useDeployProgram: (
      scopeId: string,
      options?: Omit<UseMutationOptions<Program, Error, DeployProgramRequest>, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (request: DeployProgramRequest) => scopes.deployProgram(scopeId, request),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['scopes', scopeId, 'programs'] });
        },
        ...options,
      });
    },

    /**
     * Create a contract instance in a scope
     */
    useCreateInstance: (
      scopeId: string,
      options?: Omit<UseMutationOptions<Instance, Error, CreateInstanceRequest>, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (request: CreateInstanceRequest) => scopes.createInstance(scopeId, request),
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: ['scopes', scopeId, 'instances'] });
          // Also invalidate user instances (the new instance might belong to the user)
          queryClient.invalidateQueries({ queryKey: ['contracts', 'instances', 'user'] });
          // Pre-populate the view cache
          if (data.instance_id) {
            queryClient.setQueryData(
              ['contracts', 'view', data.instance_id],
              () => ({})
            );
          }
        },
        ...options,
      });
    },

    /**
     * Set KV store for a scope
     */
    useSetKV: (
      scopeId: string,
      options?: Omit<UseMutationOptions<void, Error, KVStore>, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (kv: KVStore) => scopes.setKV(scopeId, kv),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['scopes', scopeId, 'kv'] });
        },
        ...options,
      });
    },
  };
}
