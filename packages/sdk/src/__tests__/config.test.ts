import { ConfigModule } from '../config/index.js';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;

describe('ConfigModule', () => {
  let configModule: ConfigModule;
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockApi = {
      get: vi.fn(),
    };
    
    configModule = new ConfigModule(mockApi);
  });

  describe('getMetadata', () => {
    it('should get server metadata', async () => {
      const mockMetadata = {
        project: 'test-project',
        version: '1.0.0',
        capabilities: ['bank', 'billing'],
        authDomain: {
          name: 'Arcana',
          version: '1',
          chainId: 31337,
          verifyingContract: '0x1234',
        },
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockMetadata,
        },
      });

      const result = await configModule.getMetadata();

      expect(result).toEqual(mockMetadata);
      expect(mockApi.get).toHaveBeenCalledWith('/config/metadata');
    });

    it('should use cached metadata', async () => {
      const mockMetadata = { 
        project: 'test',
        version: '1.0.0',
        capabilities: [],
        authDomain: { name: 'Arcana', version: '1', chainId: 31337, verifyingContract: '0x0' },
      };

      mockApi.get.mockResolvedValueOnce({
        data: {
          status: 200,
          message: 'Success',
          data: mockMetadata,
        },
      });

      // First call
      await configModule.getMetadata();
      
      // Second call should use cache (default useCache=true)
      const result = await configModule.getMetadata();

      expect(result).toEqual(mockMetadata);
      expect(mockApi.get).toHaveBeenCalledTimes(1);
    });

    it('should bypass cache when useCache is false', async () => {
      const mockMetadata = { 
        project: 'test',
        version: '1.0.0',
        capabilities: [],
        authDomain: { name: 'Arcana', version: '1', chainId: 31337, verifyingContract: '0x0' },
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockMetadata,
        },
      });

      await configModule.getMetadata();
      await configModule.getMetadata(false);

      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('getBankConfig', () => {
    it('should get bank configuration from /bank/config', async () => {
      const mockBankConfig = {
        vaults: [
          {
            chainId: 31337,
            UserVault: '0xabcd',
            asset: [
              {
                id: 'asset1',
                symbol: 'USDC',
                address: '0x1234',
                decimals: 6,
              },
            ],
          },
        ],
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockBankConfig,
        },
      });

      const result = await configModule.getBankConfig();

      expect(result).toEqual(mockBankConfig);
      expect(mockApi.get).toHaveBeenCalledWith('/bank/config');
    });

    it('should return null when bank capability is not enabled', async () => {
      mockApi.get.mockRejectedValue(new Error('Not found'));

      const result = await configModule.getBankConfig();

      expect(result).toBeNull();
    });

    it('should use cached bank config', async () => {
      const mockBankConfig = {
        vaults: [
          {
            chainId: 31337,
            UserVault: '0xabcd',
            asset: [],
          },
        ],
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockBankConfig,
        },
      });

      await configModule.getBankConfig();
      const result = await configModule.getBankConfig();

      expect(result).toEqual(mockBankConfig);
      expect(mockApi.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDeploymentConfig', () => {
    it('should get deployment config from bank config', async () => {
      const mockBankConfig = {
        vaults: [
          {
            chainId: 31337,
            UserVault: '0xabcd',
            asset: [
              {
                id: 'asset1',
                symbol: 'USDC',
                address: '0x1234',
                decimals: 6,
              },
            ],
          },
        ],
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockBankConfig,
        },
      });

      const result = await configModule.getDeploymentConfig('http://localhost:8545');

      expect(result).toEqual({
        chainId: 31337,
        rpcUrl: 'http://localhost:8545',
        contracts: {
          USDC: '0x1234',
          UserVault: '0xabcd',
        },
        assets: [
          {
            id: 'asset1',
            symbol: 'USDC',
            address: '0x1234',
            decimals: 6,
          },
        ],
        defaultAssetId: 'asset1',
      });
      expect(mockApi.get).toHaveBeenCalledWith('/bank/config');
    });

    it('should select vault by chain ID when provided', async () => {
      const mockBankConfig = {
        vaults: [
          {
            chainId: 31337,
            UserVault: '0xabcd',
            asset: [],
          },
          {
            chainId: 1,
            UserVault: '0xefgh',
            asset: [
              {
                id: 'asset2',
                symbol: 'USDC',
                address: '0x5678',
                decimals: 6,
              },
            ],
          },
        ],
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockBankConfig,
        },
      });

      const result = await configModule.getDeploymentConfig('http://localhost:8545', true, 1);

      expect(result.chainId).toBe(1);
      expect(result.contracts.UserVault).toBe('0xefgh');
    });

    it('should use default RPC URL', async () => {
      const mockBankConfig = {
        vaults: [
          {
            chainId: 31337,
            UserVault: '0xabcd',
            asset: [],
          },
        ],
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockBankConfig,
        },
      });

      const result = await configModule.getDeploymentConfig();

      expect(result.rpcUrl).toBe('http://localhost:8545');
    });

    it('should handle missing assets', async () => {
      const mockBankConfig = {
        vaults: [
          {
            chainId: 31337,
            UserVault: '0xabcd',
            asset: [],
          },
        ],
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockBankConfig,
        },
      });

      const result = await configModule.getDeploymentConfig();

      expect(result.contracts).toEqual({ UserVault: '0xabcd' });
      expect(result.defaultAssetId).toBeNull();
    });

    it('should use cached deployment config', async () => {
      const mockBankConfig = {
        vaults: [
          {
            chainId: 31337,
            UserVault: '0xabcd',
            asset: [],
          },
        ],
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockBankConfig,
        },
      });

      await configModule.getDeploymentConfig();
      const result = await configModule.getDeploymentConfig();

      expect(result.chainId).toBe(31337);
      expect(mockApi.get).toHaveBeenCalledTimes(1); // Only called once for bank config
    });

    it('should throw when bank config is not available', async () => {
      mockApi.get.mockRejectedValue(new Error('Not found'));

      await expect(configModule.getDeploymentConfig()).rejects.toThrow(
        'No bank configuration found'
      );
    });

    it('should throw when no vaults are found', async () => {
      const mockBankConfig = {
        vaults: [],
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockBankConfig,
        },
      });

      await expect(configModule.getDeploymentConfig()).rejects.toThrow(
        'No bank configuration found'
      );
    });

    it('should throw when chain ID not found', async () => {
      const mockBankConfig = {
        vaults: [
          {
            chainId: 31337,
            UserVault: '0xabcd',
            asset: [],
          },
        ],
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockBankConfig,
        },
      });

      await expect(configModule.getDeploymentConfig('http://localhost:8545', true, 999)).rejects.toThrow(
        'No vault found for chain ID 999'
      );
    });
  });

  describe('clearCache', () => {
    it('should clear cached configuration', async () => {
      const mockMetadata = {
        project: 'test',
        version: '1.0.0',
        capabilities: [],
        authDomain: { name: 'Arcana', version: '1', chainId: 31337, verifyingContract: '0x0' },
      };

      const mockBankConfig = {
        vaults: [
          {
            chainId: 31337,
            UserVault: '0xabcd',
            asset: [],
          },
        ],
      };

      // Setup mock for both endpoints
      mockApi.get.mockImplementation((url: string) => {
        if (url === '/config/metadata') {
          return Promise.resolve({
            data: { status: 200, message: 'Success', data: mockMetadata },
          });
        } else if (url === '/bank/config') {
          return Promise.resolve({
            data: { status: 200, message: 'Success', data: mockBankConfig },
          });
        }
      });

      await configModule.getMetadata();
      await configModule.getBankConfig();
      
      configModule.clearCache();

      // Next calls should fetch again
      await configModule.getMetadata(false);
      await configModule.getBankConfig(false);

      // 2 calls before clearCache + 2 calls after = 4 total
      expect(mockApi.get).toHaveBeenCalledTimes(4);
    });
  });
});
