import { HistoryModule } from '../history/index.js';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;

describe('HistoryModule', () => {
  let historyModule: HistoryModule;
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockApi = {
      get: vi.fn(),
    };
    
    historyModule = new HistoryModule(mockApi);
  });

  describe('listScopes', () => {
    it('should list scopes the user has history in', async () => {
      const mockScopes = [
        { scope_id: 'app:main', n: 5, last_ts: 1700000000000 },
        { scope_id: 'app:test', n: 2, last_ts: 1699000000000 },
      ];

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockScopes,
        },
      });

      const result = await historyModule.listScopes();

      expect(result).toEqual(mockScopes);
      expect(mockApi.get).toHaveBeenCalledWith('/history/scopes');
    });
  });

  describe('getHistory', () => {
    it('should get history for scope + game type without options', async () => {
      const mockHistory = {
        items: [
          {
            session_id: 'sess1',
            scope_id: 'app:main',
            root_id: 'sess1',
            ts: 1700000000000,
          },
        ],
        next_cursor: null,
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockHistory,
        },
      });

      const result = await historyModule.getHistory('app:main', 'blackjack');

      expect(result).toEqual(mockHistory);
      expect(mockApi.get).toHaveBeenCalledWith(
        '/history/scope/app:main/contract/blackjack',
        { params: {} }
      );
    });

    it('should get history with pagination', async () => {
      const mockHistory = {
        items: [{ session_id: 'sess1', scope_id: 'app:main', root_id: 'sess1', ts: 1700000000000 }],
        next_cursor: 'cursor123',
      };
      const options = { limit: 50, cursor: 'cursor123' };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockHistory,
        },
      });

      const result = await historyModule.getHistory('app:main', 'blackjack', options);

      expect(result).toEqual(mockHistory);
      expect(mockApi.get).toHaveBeenCalledWith(
        '/history/scope/app:main/contract/blackjack',
        { params: { limit: 50, cursor: 'cursor123' } }
      );
    });
  });

  describe('getRoots', () => {
    it('should get root sessions for scope + game type', async () => {
      const mockRoots = {
        items: [
          { session_id: 'root1', scope_id: 'app:main', root_id: 'root1', ts: 1700000000000 },
        ],
        next_cursor: null,
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockRoots,
        },
      });

      const result = await historyModule.getRoots('app:main', 'battleship');

      expect(result).toEqual(mockRoots);
      expect(mockApi.get).toHaveBeenCalledWith(
        '/history/scope/app:main/contract/battleship/roots',
        { params: {} }
      );
    });
  });

  describe('viewSession', () => {
    it('should view session with capsule + envelope data', async () => {
      const mockView = {
        session_id: 'sess1',
        capsules: [
          { capsule_id: 'cap1', ts: 1700000000000, view: { move: 'hit' } },
        ],
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockView,
        },
      });

      const result = await historyModule.viewSession('sess1');

      expect(result).toEqual(mockView);
      expect(mockApi.get).toHaveBeenCalledWith(
        '/history/session/sess1/view',
        { params: {} }
      );
    });
  });
});
