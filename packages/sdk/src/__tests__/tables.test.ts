import { TablesModule } from '../tables/index.js';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;

describe('TablesModule', () => {
  let tablesModule: TablesModule;
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
    };
    
    tablesModule = new TablesModule(mockApi);
  });

  describe('create', () => {
    it('should create a table with wrapped response', async () => {
      const request = {
        game_type: 'poker',
        table_mode: 'tournament' as const,
        min_players: 2,
        max_players: 4,
      };
      const mockResponse = {
        table: {
          id: 'table1',
          game_type: 'poker',
          table_mode: 'tournament',
          min_players: 2,
          max_players: 4,
        },
        seats: [],
      };

      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockResponse,
        },
      });

      const result = await tablesModule.create(request);

      expect(result).toEqual(mockResponse.table);
      expect(mockApi.post).toHaveBeenCalledWith('/tables', request);
    });

    it('should create a table with direct response', async () => {
      const request = { 
        game_type: 'poker',
        table_mode: 'tournament' as const,
      };
      const mockTable = {
        id: 'table1',
        game_type: 'poker',
        table_mode: 'tournament',
      };

      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockTable,
        },
      });

      const result = await tablesModule.create(request);

      expect(result).toEqual(mockTable);
    });
  });

  describe('list', () => {
    it('should list tables without filters', async () => {
      const mockTables = [
        { table: { id: 'table1', game_type: 'poker' }, player_count: 2 },
        { id: 'table2', game_type: 'blackjack' },
      ];

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockTables,
        },
      });

      const result = await tablesModule.list();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('table1');
      expect(result[0].player_count).toBe(2);
      expect(result[1].id).toBe('table2');
      expect(mockApi.get).toHaveBeenCalledWith('/tables', { params: {} });
    });

    it('should list tables with filters', async () => {
      const options = {
        game_type: 'poker',
        table_mode: 'tournament',
        status: 'waiting',
        scope_id: 'scope1',
        limit: 10,
        offset: 0,
      };
      const mockTables = [{ id: 'table1' }];

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockTables,
        },
      });

      const result = await tablesModule.list(options);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('table1');
      expect(mockApi.get).toHaveBeenCalledWith('/tables', {
        params: expect.objectContaining({
          game_type: 'poker',
          table_mode: 'tournament',
          status: 'waiting',
        }),
      });
    });

    it('should reject non-array responses', async () => {
      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: { error: 'Invalid' },
        },
      });

      await expect(tablesModule.list()).rejects.toThrow('Invalid tables response');
    });
  });

  describe('get', () => {
    it('should get table by ID with wrapped response', async () => {
      const mockResponse = {
        table: {
          id: 'table1',
          game_type: 'poker',
          table_mode: 'tournament',
        },
        seats: [],
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockResponse,
        },
      });

      const result = await tablesModule.get('table1');

      expect(result).toEqual(mockResponse.table);
      expect(mockApi.get).toHaveBeenCalledWith('/tables/table1');
    });

    it('should get table by ID with direct response', async () => {
      const mockTable = {
        id: 'table1',
        game_type: 'poker',
        table_mode: 'tournament',
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockTable,
        },
      });

      const result = await tablesModule.get('table1');

      expect(result.id).toBe('table1');
      expect(result.game_type).toBe('poker');
      expect(result.table_mode).toBe('tournament');
    });

    it('should extract table from contract response format', async () => {
      const mockResponse = {
        id: 'table1',
        contract_type: 'poker',
        metadata: {
          table_mode: 'tournament',
          min_players: 2,
          max_players: 4,
          created_by: 'user1',
          is_private: false,
          invite_code: 'ABC123',
          table_status: 'waiting',
          entry_fee: '100',
          token: 'token1',
          player_count: 1,
        },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockResponse,
        },
      });

      const result = await tablesModule.get('table1');

      expect(result.id).toBe('table1');
      expect(result.contract_id).toBe('table1');
      expect(result.game_type).toBe('poker');
      expect(result.table_mode).toBe('tournament');
      expect(result.min_players).toBe(2);
      expect(result.max_players).toBe(4);
      expect(result.status).toBe('waiting');
    });
  });

  describe('getByInvite', () => {
    it('should get table by invite code', async () => {
      const mockResponse = {
        table: {
          id: 'table1',
          invite_code: 'ABC123',
          game_type: 'poker',
        },
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockResponse,
        },
      });

      const result = await tablesModule.getByInvite('ABC123');

      expect(result).toEqual(mockResponse.table);
      expect(mockApi.get).toHaveBeenCalledWith('/tables/invite/ABC123', {
        params: {},
      });
    });

    it('should get table by invite code with scope', async () => {
      const mockTable = { id: 'table1', invite_code: 'ABC123' };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockTable,
        },
      });

      const result = await tablesModule.getByInvite('ABC123', 'scope1');

      expect(result.id).toBe('table1');
      expect(result.invite_code).toBe('ABC123');
      expect(mockApi.get).toHaveBeenCalledWith('/tables/invite/ABC123', {
        params: { scope_id: 'scope1' },
      });
    });
  });

  describe('join', () => {
    it('should join a table', async () => {
      const request = {};
      const mockResponse = {
        table: {
          id: 'table1',
          status: 'playing',
        },
        seats: [{ seat: 0, player_id: 'user1' }],
      };

      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockResponse,
        },
      });

      const result = await tablesModule.join('table1', request);

      expect(result).toEqual(mockResponse.table);
      expect(mockApi.post).toHaveBeenCalledWith('/tables/table1/join', request);
    });

    it('should join a table without request', async () => {
      const mockTable = { id: 'table1', status: 'playing' };

      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockTable,
        },
      });

      const result = await tablesModule.join('table1');

      expect(result.id).toBe('table1');
      expect(result.status).toBe('playing');
      expect(mockApi.post).toHaveBeenCalledWith('/tables/table1/join', {});
    });

    it('should extract table from action response', async () => {
      const mockResponse = {
        metadata: {
          game_type: 'poker',
          table_mode: 'tournament',
          min_players: 2,
          max_players: 4,
          created_by: 'user1',
          is_private: false,
          invite_code: 'ABC123',
          table_status: 'playing',
          entry_fee: '100',
          token: 'token1',
        },
      };

      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockResponse,
        },
      });

      const result = await tablesModule.join('table1');

      expect(result.id).toBe('table1');
      expect(result.contract_id).toBe('table1');
      expect(result.status).toBe('playing');
    });
  });
});
