import axios, { AxiosInstance } from 'axios';
import { extractData, ApiResponse } from '../types/common.js';
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
} from './types.js';

/**
 * Billing module
 * 
 * Provides methods for managing projects, funding, and billing:
 * - User account balance and funding
 * - Project creation and management
 * - Project funding
 * - Scope budgets and billing events
 * - Transaction history
 */
export class BillingModule {
  constructor(private api: AxiosInstance) {}

  /**
   * Get user account balance
   * 
   * @returns Array of balances per asset
   */
  async getUserBalance(): Promise<UserBalance[]> {
    const response = await this.api.get<ApiResponse<UserBalance[]>>(
      '/billing/user/balance'
    );
    return extractData(response);
  }

  /**
   * Fund user account
   * 
   * @param request - Funding request with asset_id and amount
   */
  async fundUserAccount(request: FundUserRequest): Promise<any> {
    const response = await this.api.post<ApiResponse<any>>(
      '/billing/user/fund',
      request
    );
    return extractData(response);
  }

  /**
   * Get user transaction history
   * 
   * @param options - Optional pagination options
   */
  async getUserTransactions(options?: {
    limit?: number;
    offset?: number;
  }): Promise<BillingTransaction[]> {
    const params: any = {};
    if (options?.limit) params.limit = options.limit;
    if (options?.offset) params.offset = options.offset;

    const response = await this.api.get<ApiResponse<BillingTransaction[]>>(
      '/billing/user/transactions',
      { params }
    );
    return extractData(response);
  }

  /**
   * Create a new project
   * 
   * @param request - Project creation request
   */
  async createProject(request: CreateProjectRequest): Promise<Project> {
    const response = await this.api.post<ApiResponse<Project>>(
      '/billing/projects',
      request
    );
    return extractData(response);
  }

  /**
   * List all projects for the authenticated user
   */
  async listProjects(): Promise<Project[]> {
    const response = await this.api.get<ApiResponse<Project[]>>(
      '/billing/projects'
    );
    return extractData(response);
  }

  /**
   * Get project details
   * 
   * @param projectId - The project ID
   */
  async getProject(projectId: string): Promise<Project> {
    const response = await this.api.get<ApiResponse<Project>>(
      `/billing/projects/${projectId}`
    );
    return extractData(response);
  }

  /**
   * Delete a project
   * 
   * @param projectId - The project ID
   */
  async deleteProject(projectId: string): Promise<{ project_id: string }> {
    const response = await this.api.delete<ApiResponse<{ project_id: string }>>(
      `/billing/projects/${projectId}`
    );
    return extractData(response);
  }

  /**
   * Get project funding balances
   * 
   * @param projectId - The project ID
   */
  async getProjectFunding(projectId: string): Promise<ProjectFunding[]> {
    const response = await this.api.get<ApiResponse<ProjectFunding[]>>(
      `/billing/projects/${projectId}/funding`
    );
    return extractData(response);
  }

  /**
   * Fund a project from user balance
   * 
   * @param projectId - The project ID
   * @param request - Funding request with asset_id and amount
   */
  async fundProject(
    projectId: string,
    request: FundProjectRequest
  ): Promise<any> {
    const response = await this.api.post<ApiResponse<any>>(
      `/billing/projects/${projectId}/fund`,
      request
    );
    return extractData(response);
  }

  /**
   * Get project transaction history
   * 
   * @param projectId - The project ID
   * @param options - Optional pagination options
   */
  async getProjectTransactions(
    projectId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<BillingTransaction[]> {
    const params: any = {};
    if (options?.limit) params.limit = options.limit;
    if (options?.offset) params.offset = options.offset;

    const response = await this.api.get<ApiResponse<BillingTransaction[]>>(
      `/billing/projects/${projectId}/transactions`,
      { params }
    );
    return extractData(response);
  }

  /**
   * Get project usage statistics
   * 
   * @param projectId - The project ID
   */
  async getProjectUsage(projectId: string): Promise<ProjectUsage> {
    const response = await this.api.get<ApiResponse<ProjectUsage>>(
      `/billing/projects/${projectId}/usage`
    );
    return extractData(response);
  }

  /**
   * Get project storage statistics
   * 
   * @param projectId - The project ID
   */
  async getProjectStorage(projectId: string): Promise<ProjectStorage> {
    const response = await this.api.get<ApiResponse<ProjectStorage>>(
      `/billing/projects/${projectId}/storage`
    );
    return extractData(response);
  }

  /**
   * Get scope budget
   * 
   * @param scopeId - The scope ID
   */
  async getScopeBudget(scopeId: string): Promise<Budget | null> {
    try {
      const response = await this.api.get<ApiResponse<Budget>>(
        `/billing/scopes/${scopeId}/budget`
      );
      return extractData(response);
    } catch (error: any) {
      // Endpoint may not exist yet, return null
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get scope billing events
   * 
   * @param scopeId - The scope ID
   * @param options - Optional pagination and filter options
   */
  async getScopeEvents(
    scopeId: string,
    options?: {
      limit?: number;
      offset?: number;
      event_type?: string;
    }
  ): Promise<BillingEvent[]> {
    const params: any = {};
    if (options?.limit) params.limit = options.limit;
    if (options?.offset) params.offset = options.offset;
    if (options?.event_type) params.event_type = options.event_type;

    const response = await this.api.get<ApiResponse<BillingEvent[]>>(
      `/billing/scopes/${scopeId}/events`,
      { params }
    );
    return extractData(response);
  }
}


