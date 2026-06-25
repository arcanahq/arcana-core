import axios, { AxiosInstance } from 'axios';
import { extractData, ApiResponse } from '../types/common.js';
import type {
  HistoryPage,
  HistoryItem,
  HistoryListOptions,
  ScopeSummary,
  CapsuleInfo,
  SessionView,
} from './types.js';

/**
 * History module
 * 
 * Provides methods for accessing game history using the capsule + envelope pattern.
 * 
 * ## Scope-based queries (primary API):
 * - `listScopes()` - List scopes the user has history in
 * - `getHistory(scopeId, contractId)` - List sessions for a game type
 * - `getRoots(scopeId, contractId)` - List root sessions (for multi-round games)
 * - `getRootInstances(scopeId, contractId, rootId)` - List child sessions in a root
 * 
 * ## Session/Capsule queries:
 * - `getCapsules(sessionId)` - List capsules in a session
 * - `viewSession(sessionId)` - View session with combined capsule + envelope
 * - `viewCapsule(capsuleId)` - View specific capsule + envelope
 */
export class HistoryModule {
  constructor(private api: AxiosInstance) {}

  // =========================================================================
  // Scope-based queries (primary API)
  // =========================================================================

  /**
   * List scopes the user has history in
   */
  async listScopes(): Promise<ScopeSummary[]> {
    const response = await this.api.get<ApiResponse<ScopeSummary[]>>(
      '/history/scopes'
    );
    return extractData(response);
  }

  /**
   * Get history (sessions) for a scope + game type
   * 
   * @param scopeId - The scope ID
   * @param contractId - The contract/game type ID (e.g., "battleship")
   * @param options - Pagination options
   */
  async getHistory(
    scopeId: string,
    contractId: string,
    options?: HistoryListOptions
  ): Promise<HistoryPage> {
    const params: Record<string, any> = {};
    if (options?.limit) params.limit = options.limit;
    if (options?.cursor) params.cursor = options.cursor;

    const response = await this.api.get<ApiResponse<HistoryPage>>(
      `/history/scope/${scopeId}/contract/${contractId}`,
      { params }
    );
    return extractData(response);
  }

  /**
   * Get root sessions for a scope + game type
   * Roots are sessions where session_id = root_id (top-level games/matches)
   * 
   * @param scopeId - The scope ID
   * @param contractId - The contract/game type ID
   * @param options - Pagination options
   */
  async getRoots(
    scopeId: string,
    contractId: string,
    options?: HistoryListOptions
  ): Promise<HistoryPage> {
    const params: Record<string, any> = {};
    if (options?.limit) params.limit = options.limit;
    if (options?.cursor) params.cursor = options.cursor;

    const response = await this.api.get<ApiResponse<HistoryPage>>(
      `/history/scope/${scopeId}/contract/${contractId}/roots`,
      { params }
    );
    return extractData(response);
  }

  /**
   * Get child sessions in a root session
   * For multi-round games, this returns all rounds within a match
   * 
   * @param scopeId - The scope ID
   * @param contractId - The contract/game type ID
   * @param rootId - The root session ID
   */
  async getRootInstances(
    scopeId: string,
    contractId: string,
    rootId: string
  ): Promise<HistoryItem[]> {
    const response = await this.api.get<ApiResponse<HistoryItem[]>>(
      `/history/scope/${scopeId}/contract/${contractId}/root/${rootId}`
    );
    return extractData(response);
  }

  // =========================================================================
  // Session/Capsule queries
  // =========================================================================

  /**
   * List capsules in a session
   * 
   * @param sessionId - The session ID
   * @param participatedOnly - If true, only return capsules where user has an envelope
   */
  async getCapsules(
    sessionId: string,
    participatedOnly: boolean = false
  ): Promise<CapsuleInfo[]> {
    const params: Record<string, any> = {};
    if (participatedOnly) params.participated_only = true;

    const response = await this.api.get<ApiResponse<CapsuleInfo[]>>(
      `/history/session/${sessionId}/capsules`,
      { params }
    );
    return extractData(response);
  }

  /**
   * View a session with combined capsule + envelope data
   * Returns all capsules in the session, rendered with the user's private envelope data
   * 
   * @param sessionId - The session ID
   * @param limit - Maximum number of capsules to return (default: 50, max: 200)
   */
  async viewSession(sessionId: string, limit?: number): Promise<SessionView> {
    const params: Record<string, any> = {};
    if (limit) params.limit = limit;

    const response = await this.api.get<ApiResponse<SessionView>>(
      `/history/session/${sessionId}/view`,
      { params }
    );
    return extractData(response);
  }

  /**
   * View a specific capsule with the user's envelope data
   * 
   * @param capsuleId - The capsule ID
   */
  async viewCapsule(capsuleId: string): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>(
      `/history/capsule/${capsuleId}/view`
    );
    return extractData(response);
  }

}
