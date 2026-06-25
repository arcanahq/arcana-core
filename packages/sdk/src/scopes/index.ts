import axios, { AxiosInstance } from 'axios';
import { extractData, ApiResponse, ArcanaApiError } from '../types/common.js';
import type {
  Scope,
  Program,
  Instance,
  CreateScopeRequest,
  DeployProgramRequest,
  InstallProgramRequest,
  UpdateProgramSettingsRequest,
  CreateInstanceRequest,
  KVStore,
  ListScopesOptions,
  ListProgramsOptions,
  ListInstancesOptions,
  Aggregation,
  AggregationTopOptions,
  AggregationTopUser,
} from './types.js';

/**
 * Scopes module
 * 
 * Provides methods for managing scopes, programs, and instances:
 * - Scope creation and management
 * - Program deployment and upgrade
 * - Contract instance creation
 * - KV store operations
 */
export class ScopesModule {
  constructor(private api: AxiosInstance) {}

  /**
   * Create a new scope
   * 
   * @param request - Scope creation request
   */
  async createScope(request: CreateScopeRequest): Promise<Scope> {
    const response = await this.api.post<ApiResponse<Scope>>(
      '/scopes',
      request
    );
    return extractData(response);
  }

  /**
   * List scopes
   * 
   * @param options - Optional filters (project_id, pagination)
   */
  async listScopes(options?: ListScopesOptions): Promise<Scope[]> {
    const params: any = {};
    if (options?.project_id) params.project_id = options.project_id;
    if (options?.limit) params.limit = options.limit;
    if (options?.offset) params.offset = options.offset;

    const response = await this.api.get<ApiResponse<Scope[]>>(
      '/scopes',
      { params }
    );
    return extractData(response);
  }

  /**
   * Get scope details
   * 
   * @param scopeId - The scope ID
   */
  async getScope(scopeId: string): Promise<Scope> {
    const response = await this.api.get<ApiResponse<Scope>>(
      `/scopes/${scopeId}`
    );
    return extractData(response);
  }

  /**
   * Deploy a program to a scope
   * 
   * @param scopeId - The scope ID
   * @param request - Program deployment request
   */
  async deployProgram(
    scopeId: string,
    request: DeployProgramRequest
  ): Promise<Program> {
    // The API expects 'wasm' field containing base64-encoded WASM bytes or IPFS hash
    // The request should already have 'wasm' field set
    const response = await this.api.post<ApiResponse<Program>>(
      `/scopes/${scopeId}/programs`,
      request
    );
    return extractData(response);
  }

  /**
   * List programs in a scope
   * 
   * @param scopeId - The scope ID
   * @param options - Optional pagination options
   */
  async listPrograms(
    scopeId: string,
    options?: ListProgramsOptions
  ): Promise<Program[]> {
    const params: any = {};
    if (options?.limit) params.limit = options.limit;
    if (options?.offset) params.offset = options.offset;

    const response = await this.api.get<ApiResponse<Program[]>>(
      `/scopes/${scopeId}/programs`,
      { params }
    );
    return extractData(response);
  }

  /**
   * Install an existing program in a scope
   *
   * @param scopeId - The scope ID
   * @param programId - The program ID to install
   */
  async installProgram(
    scopeId: string,
    programId: string
  ): Promise<void> {
    await this.api.post<ApiResponse<void>>(
      `/scopes/${scopeId}/programs/install`,
      { program_id: programId }
    );
  }

  /**
   * Uninstall a program from a scope
   *
   * @param scopeId - The scope ID
   * @param programId - The program ID to uninstall
   */
  async uninstallProgram(
    scopeId: string,
    programId: string
  ): Promise<void> {
    await this.api.delete<ApiResponse<void>>(
      `/scopes/${scopeId}/programs/${programId}`
    );
  }

  /**
   * Update program settings (e.g., disable instance creation)
   *
   * @param scopeId - The scope ID
   * @param programId - The program ID
   * @param settings - Program settings to update
   */
  async updateProgramSettings(
    scopeId: string,
    programId: string,
    settings: UpdateProgramSettingsRequest
  ): Promise<Program> {
    const response = await this.api.patch<ApiResponse<Program>>(
      `/scopes/${scopeId}/programs/${programId}/settings`,
      settings
    );
    return extractData(response);
  }

  /**
   * Create a contract instance in a scope
   * 
   * @param scopeId - The scope ID
   * @param request - Instance creation request
   */
  async createInstance(
    scopeId: string,
    request: CreateInstanceRequest
  ): Promise<Instance> {
    const response = await this.api.post<ApiResponse<Instance>>(
      `/scopes/${scopeId}/instances`,
      request
    );
    return extractData(response);
  }

  /**
   * List contract instances in a scope
   * 
   * @param scopeId - The scope ID
   * @param options - Optional pagination options
   * @throws ArcanaApiError with status 404 if scope doesn't exist (deploy scope with 'arcana apply')
   */
  async listInstances(
    scopeId: string,
    options?: ListInstancesOptions
  ): Promise<Instance[]> {
    const params: any = {};
    if (options?.limit) params.limit = options.limit;
    if (options?.offset) params.offset = options.offset;
    if (options?.program_type) params.program_type = options.program_type;
    if (options?.status) params.status = options.status;
    if (options?.include_terminated !== undefined) {
      params.include_terminated = options.include_terminated;
    }

    try {
      const response = await this.api.get<ApiResponse<Instance[]>>(
        `/scopes/${scopeId}/instances`,
        { params }
      );
      return extractData(response);
    } catch (error: any) {
      // Provide helpful error message for 404 (scope doesn't exist)
      if (error instanceof ArcanaApiError && error.status === 404) {
        throw new ArcanaApiError(
          404,
          `Scope '${scopeId}' not found.`,
          error.data
        );
      }
      throw error;
    }
  }

  /**
   * Get KV store for a scope
   * 
   * @param scopeId - The scope ID
   */
  async getKV(scopeId: string, key?: string): Promise<KVStore> {
    const path = `/scopes/${scopeId}/kv`;
    const response = key
      ? await this.api.get<ApiResponse<KVStore>>(path, { params: { key } })
      : await this.api.get<ApiResponse<KVStore>>(path);
    return extractData(response);
  }

  /**
   * Set KV store for a scope
   *
   * @param scopeId - The scope ID
   * @param kv - Key-value pairs to set
   */
  async setKV(scopeId: string, kv: KVStore): Promise<void> {
    const entries = Object.entries(kv);
    for (const [key, value] of entries) {
      await this.api.put<ApiResponse<void>>(
        `/scopes/${scopeId}/kv`,
        { key, value }
      );
    }
  }

  /**
   * List aggregation rules for a scope
   *
   * @param scopeId - The scope ID
   */
  async listScopeAggregations(scopeId: string): Promise<Aggregation[]> {
    const response = await this.api.get<ApiResponse<{ aggregations: Aggregation[] }>>(
      `/scopes/${scopeId}/aggregations`
    );
    return extractData(response).aggregations;
  }

  /**
   * Get a specific aggregation rule for a scope
   *
   * @param scopeId - The scope ID
   * @param aggregationId - The aggregation ID (rule name)
   */
  async getScopeAggregation(
    scopeId: string,
    aggregationId: string
  ): Promise<Aggregation> {
    const response = await this.api.get<ApiResponse<Aggregation>>(
      `/scopes/${scopeId}/aggregations/${aggregationId}`
    );
    return extractData(response);
  }

  /**
   * Get top users for an aggregation (leaderboard)
   *
   * @param scopeId - The scope ID
   * @param aggregationId - The aggregation ID (rule name)
   * @param options - Optional query parameters (limit, offset, order)
   */
  async getAggregationTop(
    scopeId: string,
    aggregationId: string,
    options?: AggregationTopOptions
  ): Promise<{
    aggregation_id: string;
    aggregation_name: string;
    metric: string;
    period: string;
    users: AggregationTopUser[];
  }> {
    const params: any = {};
    if (options?.limit) params.limit = options.limit;
    if (options?.offset) params.offset = options.offset;
    if (options?.order) params.order = options.order;

    const response = await this.api.get<ApiResponse<{
      aggregation_id: string;
      aggregation_name: string;
      metric: string;
      period: string;
      users: AggregationTopUser[];
    }>>(
      `/scopes/${scopeId}/aggregations/${aggregationId}/top`,
      { params }
    );
    return extractData(response);
  }
}
