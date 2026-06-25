/**
 * React hooks for configuration and metadata.
 * 
 * Uses TanStack Query for caching.
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import type { ConfigModule } from '../config/index.js';
import type { ServerMetadata, DeploymentConfig } from '../config/types.js';

/**
 * Create config hooks bound to a ConfigModule.
 */
export function createConfigHooks(config: ConfigModule, defaultRpcUrl: string = 'http://localhost:8545') {
  return {
    /**
     * Get server metadata.
     */
    useMetadata: (
      options?: Omit<UseQueryOptions<ServerMetadata, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['config', 'metadata'],
        queryFn: () => config.getMetadata(),
        staleTime: 5 * 60 * 1000, // 5 minutes
        ...options,
      });
    },

    /**
     * Get deployment configuration.
     */
    useDeploymentConfig: (
      rpcUrl?: string,
      options?: Omit<UseQueryOptions<DeploymentConfig, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['config', 'deployment', rpcUrl || defaultRpcUrl],
        queryFn: () => config.getDeploymentConfig(rpcUrl || defaultRpcUrl),
        staleTime: 5 * 60 * 1000, // 5 minutes
        ...options,
      });
    },
  };
}

/**
 * Type for the config hooks object.
 */
export type ConfigHooks = ReturnType<typeof createConfigHooks>;

