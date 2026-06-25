import { BankModule } from '../bank/index.js';
import type { BankBalance } from '../bank/types.js';

describe('BankModule', () => {
  let bankModule: BankModule;
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
    };
    
    bankModule = new BankModule(mockApi);
  });

  describe('getBalances', () => {
    it('should fetch all balances', async () => {
      const mockBalances = [
        { assetId: 'asset:1:abc123', amount: '1000000000000000000' },
        { assetId: 'asset:1:def456', amount: '500000000' },
      ];
      
      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockBalances,
        },
      });

      const result = await bankModule.getBalances();
      
      expect(result).toEqual(mockBalances);
      expect(mockApi.get).toHaveBeenCalledWith('/bank/balances');
    });
  });

  describe('getBalance', () => {
    it('should return balance for specific asset', async () => {
      const mockBalances = [
        { assetId: 'asset:1:abc123', amount: '1000000000000000000' },
        { assetId: 'asset:1:def456', amount: '500000000' },
      ];
      
      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockBalances,
        },
      });

      const result = await bankModule.getBalance('asset:1:abc123');
      
      expect(result).toBe('1000000000000000000');
    });

    it('should return 0 for unknown asset', async () => {
      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: [],
        },
      });

      const result = await bankModule.getBalance('unknown:asset');
      
      expect(result).toBe('0');
    });
  });

  describe('listAssets', () => {
    it('should fetch all assets', async () => {
      const mockAssets = [
        { 
          assetId: 'asset:1:abc123', 
          chainId: 1, 
          address: '0xabc123',
          symbol: 'USDC',
          decimals: 6 
        },
      ];
      
      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockAssets,
        },
      });

      const result = await bankModule.listAssets();
      
      expect(result).toEqual(mockAssets);
      expect(mockApi.get).toHaveBeenCalledWith('/bank/assets');
    });
  });

  describe('findAssetBySymbol', () => {
    it('should find asset by symbol (case-insensitive)', async () => {
      const mockAssets = [
        { assetId: 'asset:1:abc123', chainId: 1, address: '0xabc', symbol: 'USDC', decimals: 6 },
        { assetId: 'asset:1:def456', chainId: 1, address: '0xdef', symbol: 'ETH', decimals: 18 },
      ];
      
      mockApi.get.mockResolvedValue({
        data: { status: 200, message: 'Success', data: mockAssets },
      });

      const result = await bankModule.findAssetBySymbol('usdc');
      
      expect(result?.symbol).toBe('USDC');
    });

    it('should return null for unknown symbol', async () => {
      mockApi.get.mockResolvedValue({
        data: { status: 200, message: 'Success', data: [] },
      });

      const result = await bankModule.findAssetBySymbol('UNKNOWN');
      
      expect(result).toBeNull();
    });
  });

  describe('transfer', () => {
    it('should create a transfer', async () => {
      const mockTransfer = {
        transferId: 'txn-123',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        assetId: 'asset:1:abc123',
        amount: '1000000',
        createdAt: '2024-01-01T00:00:00Z',
      };
      
      mockApi.post.mockResolvedValue({
        data: { status: 200, message: 'Success', data: mockTransfer },
      });

      const result = await bankModule.transfer({
        toUserId: 'user-2',
        assetId: 'asset:1:abc123',
        amount: '1000000',
      });
      
      expect(result).toEqual(mockTransfer);
      expect(mockApi.post).toHaveBeenCalledWith('/bank/transfers', {
        toUserId: 'user-2',
        assetId: 'asset:1:abc123',
        amount: '1000000',
      });
    });
  });

  describe('createWithdrawal', () => {
    it('should create a withdrawal request', async () => {
      mockApi.post.mockResolvedValue({
        data: { status: 200, message: 'Success', data: { withdrawalId: 'wd-123' } },
      });

      const result = await bankModule.createWithdrawal({
        assetId: 'asset:1:abc123',
        amount: '1000000',
        dstAddress: '0x1234567890123456789012345678901234567890',
      });
      
      expect(result.withdrawalId).toBe('wd-123');
    });
  });

  describe('listWithdrawals', () => {
    it('should list withdrawals with pagination', async () => {
      const mockWithdrawals = [
        { withdrawalId: 'wd-1', status: 'completed' },
        { withdrawalId: 'wd-2', status: 'pending' },
      ];
      
      mockApi.get.mockResolvedValue({
        data: { status: 200, message: 'Success', data: mockWithdrawals },
      });

      const result = await bankModule.listWithdrawals({ limit: 10, offset: 0 });
      
      expect(result).toEqual(mockWithdrawals);
      expect(mockApi.get).toHaveBeenCalledWith('/bank/withdrawals', {
        params: { limit: 10, offset: 0 },
      });
    });
  });

  describe('createAuthorization', () => {
    it('should create an authorization', async () => {
      const mockAuth = {
        authId: 'auth-123',
        userId: 'user-1',
        granteeId: 'service-1',
        assetId: 'asset:1:abc123',
        maxAmount: '1000000000',
        usedAmount: '0',
        createdAt: '2024-01-01T00:00:00Z',
      };
      
      mockApi.post.mockResolvedValue({
        data: { status: 200, message: 'Success', data: mockAuth },
      });

      const result = await bankModule.createAuthorization({
        granteeId: 'service-1',
        assetId: 'asset:1:abc123',
        maxAmount: '1000000000',
        expiresInMs: 3600000, // 1 hour
      });
      
      expect(result.authId).toBe('auth-123');
    });
  });

  describe('revokeAuthorization', () => {
    it('should revoke an authorization', async () => {
      mockApi.post.mockResolvedValue({
        data: { status: 200, message: 'Success', data: {} },
      });

      await bankModule.revokeAuthorization('auth-123');
      
      expect(mockApi.post).toHaveBeenCalledWith('/bank/authorizations/auth-123/revoke');
    });
  });

  /**
   * Contract tests to ensure SDK expects the correct format from the backend.
   * 
   * These tests verify the exact JSON structure expected from /bank/balances.
   * If the backend changes its format, these tests will fail and need to be
   * updated along with the SDK.
   */
  describe('BankBalance format contract', () => {
    it('should parse backend response with assetId and amount fields (camelCase)', async () => {
      // This is the exact format the backend MUST return (camelCase)
      const backendResponse = {
        data: {
          status: 200,
          message: 'Success',
          data: [
            { assetId: 'asset:31337:0x5fbdb2315678afecb367f032d93f642f64180aa3', amount: '1000000000000000000000' },
          ],
        },
      };
      
      mockApi.get.mockResolvedValue(backendResponse);
      
      const balances = await bankModule.getBalances();
      
      expect(balances).toHaveLength(1);
      expect(balances[0].assetId).toBe('asset:31337:0x5fbdb2315678afecb367f032d93f642f64180aa3');
      expect(balances[0].amount).toBe('1000000000000000000000');
    });

    it('should reject backend response with legacy field names', async () => {
      // Legacy format that backend should NOT return
      const legacyResponse = {
        data: {
          status: 200,
          message: 'Success',
          data: [
            { 
              scope_id: 'principal:user:123',  // Wrong: should not be present
              asset: 'asset:1:token',          // Wrong: should be 'assetId'
              balance: '1000',                 // Wrong: should be 'amount'
              updated_at: 12345,               // Wrong: should not be present
            },
          ],
        },
      };
      
      mockApi.get.mockResolvedValue(legacyResponse);
      
      const balances = await bankModule.getBalances();
      
      // The SDK will not find the expected fields
      expect(balances[0].assetId).toBeUndefined();
      expect(balances[0].amount).toBeUndefined();
    });

    it('should handle large u256 amounts as strings', async () => {
      // Max u256 value - must be a string to preserve precision
      const maxU256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
      
      const backendResponse = {
        data: {
          status: 200,
          message: 'Success',
          data: [
            { assetId: 'asset:1:token', amount: maxU256 },
          ],
        },
      };
      
      mockApi.get.mockResolvedValue(backendResponse);
      
      const balances = await bankModule.getBalances();
      
      expect(typeof balances[0].amount).toBe('string');
      expect(balances[0].amount).toBe(maxU256);
    });

    it('should use getBalance to find specific asset from balances array', async () => {
      const backendResponse = {
        data: {
          status: 200,
          message: 'Success',
          data: [
            { assetId: 'asset:1:token-a', amount: '100' },
            { assetId: 'asset:1:token-b', amount: '200' },
            { assetId: 'asset:1:token-c', amount: '300' },
          ],
        },
      };
      
      mockApi.get.mockResolvedValue(backendResponse);
      
      const amount = await bankModule.getBalance('asset:1:token-b');
      
      expect(amount).toBe('200');
    });
  });
});

