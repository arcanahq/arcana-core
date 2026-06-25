import axios, { AxiosInstance } from 'axios';
import { extractData, ApiResponse } from '../types/common.js';
import type {
  Table,
  CreateTableRequest,
  JoinTableRequest,
  TableSeat,
  ListTablesOptions,
} from './types.js';

/**
 * Tables module
 * 
 * Provides methods for managing game tables:
 * - Create tables
 * - List tables (with filters)
 * - Get table by ID or invite code
 * - Join/leave tables
 */
export class TablesModule {
  constructor(private api: AxiosInstance) {}

  /**
   * Create a new table
   * Note: Table creation is typically done via instance creation (scopes.createInstance)
   * This method is for future direct table creation support
   */
  async create(request: CreateTableRequest): Promise<Table> {
    const response = await this.api.post<ApiResponse<{ table: Table; seats?: TableSeat[] } | Table>>(
      '/tables',
      request
    );
    const data = extractData(response);

    // Handle both response formats
    if (data && typeof data === 'object' && 'table' in data) {
      return (data as { table: Table }).table;
    }
    return data as Table;
  }

  /**
   * List tables with optional filters
   * 
   * Uses the TablesCapability endpoint at /tables
   */
  async list(options?: ListTablesOptions): Promise<Table[]> {
    const params: any = {};
    if (options?.game_type) params.game_type = options.game_type;
    if (options?.table_mode) params.table_mode = options.table_mode;
    if (options?.status) params.status = options.status;
    if (options?.scope_id) params.scope_id = options.scope_id;
    if (options?.limit) params.limit = options.limit;
    if (options?.offset) params.offset = options.offset;

    const response = await this.api.get<ApiResponse<Array<{ table: Table; player_count?: number; players?: string[] }> | Table[]>>(
      '/tables',
      { params }
    );
    const data = extractData(response);

    if (!Array.isArray(data)) {
      throw new Error('Invalid tables response: expected an array');
    }

    // Handle both response formats
    return data.map((item: any) => {
      if (item && typeof item === 'object' && 'table' in item) {
        return { ...item.table, player_count: item.player_count, players: item.players };
      }
      return item as Table;
    });
  }

  /**
   * Get table by ID
   * 
   * Uses the TablesCapability endpoint at /tables/{id}
   */
  async get(tableId: string): Promise<Table> {
    const response = await this.api.get<ApiResponse<{ table: Table; seats?: TableSeat[] } | Table>>(
      `/tables/${tableId}`
    );
    const data = extractData(response);

    // Handle wrapped { table, seats } response
    if (data && typeof data === 'object' && 'table' in data) {
      return (data as { table: Table }).table;
    }

    // Handle instance metadata-shaped response
    if (data && typeof data === 'object' && 'id' in data && 'metadata' in data) {
      const raw = data as any;
      const metadata = raw.metadata || {};
      return {
        id: raw.id,
        contract_id: raw.id,
        game_type: raw.contract_type || raw.game_type || metadata.game_type,
        table_mode: metadata.table_mode,
        min_players: metadata.min_players,
        max_players: metadata.max_players,
        created_by: metadata.created_by,
        is_private: metadata.is_private || false,
        invite_code: raw.invite_code || metadata.invite_code,
        status: metadata.table_status || raw.status,
        entry_fee: metadata.entry_fee,
        token: metadata.token,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        player_count: metadata.player_count,
      } as Table;
    }

    return data as Table;
  }

  /**
   * Get table by invite code
   */
  async getByInvite(inviteCode: string, scopeId?: string): Promise<Table> {
    const params = scopeId ? { scope_id: scopeId } : {};
    const response = await this.api.get<ApiResponse<{ table: Table; seats?: TableSeat[] } | Table>>(
      `/tables/invite/${inviteCode}`,
      { params }
    );
    const data = extractData(response);

    // Handle response format
    if (data && typeof data === 'object' && 'table' in data) {
      return (data as { table: Table }).table;
    }

    // Extract from contract response format if needed
    if (data && typeof data === 'object') {
      const metadata = (data as any).metadata || {};
      const contractId = (data as any).id;
      const gameType = (data as any).contract_type || (data as any).game_type;

      return {
        id: contractId,
        contract_id: contractId,
        game_type: gameType,
        table_mode: metadata.table_mode,
        min_players: metadata.min_players,
        max_players: metadata.max_players,
        created_by: metadata.created_by,
        is_private: metadata.is_private || false,
        invite_code: (data as any).invite_code || metadata.invite_code,
        status: metadata.table_status || (data as any).status,
        entry_fee: metadata.entry_fee,
        token: metadata.token,
        created_at: (data as any).created_at,
        updated_at: (data as any).updated_at,
        player_count: metadata.player_count,
      } as Table;
    }

    return data as Table;
  }

  /**
   * Join a table
   * 
   * Note: This is typically done via contract action (contracts.executeAction with join_table)
   * This method is for future direct table join support via the TablesCapability
   */
  async join(tableId: string, request?: JoinTableRequest): Promise<Table> {
    const response = await this.api.post<ApiResponse<{ table: Table; seats?: TableSeat[] } | Table>>(
      `/tables/${tableId}/join`,
      request || {}
    );
    const data = extractData(response);

    // Handle response format
    if (data && typeof data === 'object' && 'table' in data) {
      return (data as { table: Table }).table;
    }

    // Extract from contract action response
    if (data && typeof data === 'object') {
      const metadata = (data as any).metadata || {};
      return {
        id: tableId,
        contract_id: tableId,
        game_type: metadata.game_type || '',
        table_mode: metadata.table_mode || 'tournament',
        min_players: metadata.min_players || 2,
        max_players: metadata.max_players || 2,
        created_by: metadata.created_by || '',
        is_private: metadata.is_private || false,
        invite_code: metadata.invite_code,
        status: metadata.table_status || 'playing',
        entry_fee: metadata.entry_fee,
        token: metadata.token,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Table;
    }

    return data as Table;
  }
}
