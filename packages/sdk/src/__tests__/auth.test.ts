import { AuthModule } from '../auth/index.js';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;

describe('AuthModule', () => {
  let authModule: AuthModule;
  let mockApi: any;
  let getToken: vi.Mock;
  let setToken: vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    
    getToken = vi.fn(() => null);
    setToken = vi.fn();
    
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
    };
    
    authModule = new AuthModule(mockApi, getToken, setToken);
  });

  describe('getDomainInfo', () => {
    it('should fetch domain info from server', async () => {
      const mockDomainInfo = {
        name: 'Arcana',
        version: '1',
        verifyingContract: '0x1234567890123456789012345678901234567890',
        chainId: 31337,
      };
      
      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockDomainInfo,
        },
      });

      const result = await authModule.getDomainInfo();
      
      expect(result).toEqual(mockDomainInfo);
      expect(mockApi.get).toHaveBeenCalledWith('/auth/domain');
    });
  });

  describe('signOut', () => {
    it('should sign out and clear token', async () => {
      mockApi.post.mockResolvedValue({
        data: { status: 200, message: 'Success', data: {} },
      });

      await authModule.signOut();
      
      expect(setToken).toHaveBeenCalledWith('');
    });

    it('should handle signout errors gracefully', async () => {
      mockApi.post.mockRejectedValue(new Error('Network error'));

      await authModule.signOut();
      
      // Should still clear token even on error
      expect(setToken).toHaveBeenCalledWith('');
    });
  });

  describe('getUserInfo', () => {
    it('should get user info', async () => {
      const mockUserInfo = {
        user_id: 'user-123',
        address: '0x1234',
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-02T00:00:00Z',
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockUserInfo,
        },
      });

      const result = await authModule.getUserInfo();
      
      expect(result).toEqual(mockUserInfo);
      expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when token exists', () => {
      getToken.mockReturnValue('test-token');
      expect(authModule.isAuthenticated()).toBe(true);
    });

    it('should return false when token is null', () => {
      getToken.mockReturnValue(null);
      expect(authModule.isAuthenticated()).toBe(false);
    });

    it('should return false when token is empty', () => {
      getToken.mockReturnValue('');
      expect(authModule.isAuthenticated()).toBe(false);
    });
  });
});
