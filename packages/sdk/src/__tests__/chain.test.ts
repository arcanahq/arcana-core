import { ChainModule, createChainModule } from '../chain/index.js';
import { createPublicClient } from 'viem';

// Mock viem
vi.mock('viem', () => ({
  createPublicClient: vi.fn(),
  http: vi.fn(),
}));

vi.mock('viem/chains', () => ({
  anvil: {
    id: 31337,
    name: 'Anvil',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: ['http://localhost:8545'] },
    },
  },
}));

describe('ChainModule', () => {
  let chainModule: ChainModule;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock viem client
    mockClient = {
      readContract: vi.fn(),
      getBalance: vi.fn(),
    };

    vi.mocked(createPublicClient).mockReturnValue(mockClient as any);

    chainModule = new ChainModule({
      chainId: 31337,
      rpcUrl: 'http://localhost:8545',
    });
  });

  describe('getTokenBalance', () => {
    it('should get ERC20 token balance', async () => {
      mockClient.readContract
        .mockResolvedValueOnce(BigInt('1000000000000000000')) // balance
        .mockResolvedValueOnce(18); // decimals

      const result = await chainModule.getTokenBalance(
        '0x1234567890123456789012345678901234567890',
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        2
      );

      expect(result).toEqual({
        address: '0x1234567890123456789012345678901234567890',
        tokenAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        balance: '1000000000000000000',
        formatted: '1.00',
        decimals: 18,
      });

      expect(mockClient.readContract).toHaveBeenCalledTimes(2);
    });

    it('should use default precision', async () => {
      mockClient.readContract
        .mockResolvedValueOnce(BigInt('1500000000000000000'))
        .mockResolvedValueOnce(18);

      const result = await chainModule.getTokenBalance(
        '0x1234',
        '0xabcd'
      );

      expect(result.formatted).toBe('1.50');
    });
  });

  describe('getTokenInfo', () => {
    it('should get token info', async () => {
      mockClient.readContract
        .mockResolvedValueOnce('USDC') // symbol
        .mockResolvedValueOnce(6) // decimals
        .mockResolvedValueOnce('USD Coin'); // name

      const result = await chainModule.getTokenInfo(
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
      );

      expect(result).toEqual({
        address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        symbol: 'USDC',
        decimals: 6,
        name: 'USD Coin',
      });

      expect(mockClient.readContract).toHaveBeenCalledTimes(3);
    });

    it('should handle missing name', async () => {
      mockClient.readContract
        .mockResolvedValueOnce('TOKEN')
        .mockResolvedValueOnce(18)
        .mockRejectedValueOnce(new Error('Name not found')); // name fails

      const result = await chainModule.getTokenInfo('0xabcd');

      expect(result).toEqual({
        address: '0xabcd',
        symbol: 'TOKEN',
        decimals: 18,
        name: undefined,
      });
    });
  });

  describe('getNativeBalance', () => {
    it('should get native token balance', async () => {
      mockClient.getBalance.mockResolvedValue(BigInt('2000000000000000000'));

      const result = await chainModule.getNativeBalance(
        '0x1234567890123456789012345678901234567890',
        4
      );

      expect(result).toEqual({
        address: '0x1234567890123456789012345678901234567890',
        tokenAddress: '0x0000000000000000000000000000000000000000',
        balance: '2000000000000000000',
        formatted: '2.0000',
        decimals: 18,
      });

      expect(mockClient.getBalance).toHaveBeenCalledWith({
        address: '0x1234567890123456789012345678901234567890',
      });
    });

    it('should use default precision', async () => {
      mockClient.getBalance.mockResolvedValue(BigInt('1000000000000000000'));

      const result = await chainModule.getNativeBalance('0x1234');

      expect(result.formatted).toBe('1.0000');
    });
  });

  describe('setConfig', () => {
    it('should update configuration', async () => {
      chainModule.setConfig({
        chainId: 1,
        rpcUrl: 'http://new-rpc:8545',
      });

      // Config should be updated, client should be reset
      // Next call should create new client
      vi.mocked(createPublicClient).mockClear();

      // Mock the client methods for the new call
      const newMockClient = {
        readContract: vi.fn()
          .mockResolvedValueOnce(BigInt('1000'))
          .mockResolvedValueOnce(18),
      };
      vi.mocked(createPublicClient).mockReturnValue(newMockClient as any);

      // Trigger client creation
      await chainModule.getTokenBalance('0x1234', '0xabcd');

      expect(createPublicClient).toHaveBeenCalled();
    });
  });

  describe('createChainModule', () => {
    it('should create a chain module', () => {
      const module = createChainModule({
        chainId: 1,
        rpcUrl: 'http://localhost:8545',
      });

      expect(module).toBeInstanceOf(ChainModule);
    });
  });

  describe('client caching', () => {
    it('should cache client instance', async () => {
      vi.mocked(createPublicClient).mockClear();

      // Reset the module to start fresh
      chainModule = new ChainModule({
        chainId: 31337,
        rpcUrl: 'http://localhost:8545',
      });

      const freshMockClient = {
        readContract: vi.fn()
          .mockResolvedValueOnce(BigInt('1000'))
          .mockResolvedValueOnce(18)
          .mockResolvedValueOnce(BigInt('2000'))
          .mockResolvedValueOnce(18),
      };
      vi.mocked(createPublicClient).mockReturnValue(freshMockClient as any);

      // First call
      await chainModule.getTokenBalance('0x1234', '0xabcd');
      
      // Second call should use cached client
      await chainModule.getTokenBalance('0x1234', '0xabcd');

      // Should only create client once
      expect(createPublicClient).toHaveBeenCalledTimes(1);
    });
  });
});
