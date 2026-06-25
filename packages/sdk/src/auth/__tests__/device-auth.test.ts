/**
 * Device Authentication Module Tests
 *
 * These tests verify:
 * 1. Device registration flow
 * 2. Token refresh flow
 * 3. Access token management
 * 4. Storage operations (keys and tokens)
 * 5. Error handling
 */

import { DeviceAuthModule } from '../device-auth.js';
import { MemoryKeyStorage, MemoryTokenStorage } from '../device-storage.js';
import type { AxiosInstance } from 'axios';
import type { WalletClient, Account, Address } from 'viem';
import type { ArcanaWalletAdapter } from '../wallet-adapter.js';

// ============================================================================
// Mock Setup
// ============================================================================

function createMockApi(): jest.Mocked<AxiosInstance> {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    request: jest.fn(),
    head: jest.fn(),
    options: jest.fn(),
    getUri: jest.fn(),
    defaults: {} as any,
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } as any,
  } as unknown as jest.Mocked<AxiosInstance>;
}

const testChainId = 31337;
const testVerifyingContract = ('0x' + '12'.repeat(20)) as Address;

function createMockWalletClient(address: Address): jest.Mocked<WalletClient> {
  return {
    signTypedData: jest.fn().mockResolvedValue('0x' + '11'.repeat(65)),
    account: { address } as Account,
    getAddresses: jest.fn().mockResolvedValue([address]),
    chain: { id: testChainId },
  } as unknown as jest.Mocked<WalletClient>;
}

// ============================================================================
// Tests
// ============================================================================

describe('DeviceAuthModule', () => {
  let api: jest.Mocked<AxiosInstance>;
  let keyStorage: MemoryKeyStorage;
  let tokenStorage: MemoryTokenStorage;
  let deviceAuth: DeviceAuthModule;
  const testAddress = '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720' as Address;

  beforeEach(async () => {
    jest.clearAllMocks();
    api = createMockApi();
    keyStorage = new MemoryKeyStorage();
    tokenStorage = new MemoryTokenStorage();
    deviceAuth = new DeviceAuthModule(api, keyStorage, tokenStorage);
    await deviceAuth.init();
  });

  describe('initialization', () => {
    it('should initialize without errors', async () => {
      const freshAuth = new DeviceAuthModule(api, new MemoryKeyStorage(), new MemoryTokenStorage());
      await expect(freshAuth.init()).resolves.not.toThrow();
    });

    it('should return not authenticated before registration', () => {
      expect(deviceAuth.isAuthenticated()).toBe(false);
    });

    it('should return null for getAccessToken before registration', () => {
      expect(deviceAuth.getAccessToken()).toBeNull();
    });

    it('should return null for getUserId before registration', () => {
      expect(deviceAuth.getUserId()).toBeNull();
    });
  });

  describe('registerDevice', () => {
    const mockDeviceResponse = {
      data: {
        status: 200,
        data: {
          device_id: 'test-device-id-123',
          user_id: '0xa0ee7a142d267c1f36714e4a8f75612f20a79720',
          refresh_token: 'refresh-token-abc',
          access_token: 'access-token-xyz',
          access_token_id: 'access-id-456',
          access_expires_at: Date.now() + 15 * 60 * 1000,
        },
      },
    };

    const mockDomainResponse = {
      data: {
        status: 200,
        data: {
          name: 'arcana',
          version: '1',
          verifyingContract: '0x' + '12'.repeat(20),
          chainId: 31337,
        },
      },
    };

    beforeEach(() => {
      api.get.mockImplementation((url: string) => {
        if (url === '/auth/domain') {
          return Promise.resolve(mockDomainResponse);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      api.post.mockImplementation((url: string) => {
        if (url === '/auth/devices/register') {
          return Promise.resolve(mockDeviceResponse);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
    });

    it('should register a device with wallet signature', async () => {
      const walletClient = createMockWalletClient(testAddress);
      
      const result = await deviceAuth.registerDevice(walletClient, testAddress, testChainId, testVerifyingContract);
      
      expect(result.device_id).toBe('test-device-id-123');
      expect(result.user_id).toBe('0xa0ee7a142d267c1f36714e4a8f75612f20a79720');
      expect(api.post).toHaveBeenCalledWith('/auth/devices/register', expect.any(Object));
    });

    it('should return device info from registration', async () => {
      const walletClient = createMockWalletClient(testAddress);
      
      const result = await deviceAuth.registerDevice(walletClient, testAddress, testChainId, testVerifyingContract);
      
      // Verify registration returned expected data
      expect(result.device_id).toBe('test-device-id-123');
      expect(result.user_id).toBe('0xa0ee7a142d267c1f36714e4a8f75612f20a79720');
    });

    it('should store access token returned by registration', async () => {
      const walletClient = createMockWalletClient(testAddress);
      
      await deviceAuth.registerDevice(walletClient, testAddress, testChainId, testVerifyingContract);
      
      expect(deviceAuth.getAccessToken()).toBe('access-token-xyz');
    });

    it('should register a device with an Arcana wallet adapter', async () => {
      const adapter: ArcanaWalletAdapter = {
        getAddress: jest.fn().mockResolvedValue(testAddress),
        getChainId: jest.fn().mockResolvedValue(testChainId),
        signTypedData: jest.fn().mockResolvedValue('0x' + '22'.repeat(65)),
      };

      await deviceAuth.registerDevice(adapter, testAddress, testChainId, testVerifyingContract);

      expect(adapter.getAddress).toHaveBeenCalled();
      expect(adapter.signTypedData).toHaveBeenCalledWith(expect.objectContaining({
        account: testAddress,
        primaryType: 'DeviceRegistration',
      }));
      expect(api.post).toHaveBeenCalledWith('/auth/devices/register', expect.objectContaining({
        user_address: testAddress,
        wallet_signature: '0x' + '22'.repeat(65),
        chain_id: testChainId,
      }));
    });

    it('should reject an Arcana wallet adapter with a mismatched address', async () => {
      const adapter: ArcanaWalletAdapter = {
        getAddress: jest.fn().mockResolvedValue('0x1111111111111111111111111111111111111111'),
        getChainId: jest.fn().mockResolvedValue(testChainId),
        signTypedData: jest.fn().mockResolvedValue('0x' + '22'.repeat(65)),
      };

      await expect(
        deviceAuth.registerDevice(adapter, testAddress, testChainId, testVerifyingContract)
      ).rejects.toThrow('does not match requested address');

      expect(adapter.signTypedData).not.toHaveBeenCalled();
      expect(api.post).not.toHaveBeenCalledWith('/auth/devices/register', expect.any(Object));
    });

    it('should generate a device key if not exists', async () => {
      const walletClient = createMockWalletClient(testAddress);
      
      // Before registration, no key
      expect(await keyStorage.getPublicKey()).toBeNull();
      
      await deviceAuth.registerDevice(walletClient, testAddress, testChainId, testVerifyingContract);
      
      // After registration, key should exist
      const pubkey = await keyStorage.getPublicKey();
      expect(pubkey).not.toBeNull();
      expect(pubkey!.length).toBe(64); // Ed25519 pubkey is 32 bytes = 64 hex chars
    });

    it('should rotate the device key when registering a different wallet', async () => {
      const firstWallet = createMockWalletClient(testAddress);
      const secondAddress = '0x1111111111111111111111111111111111111111' as Address;
      const secondWallet = createMockWalletClient(secondAddress);

      await deviceAuth.registerDevice(firstWallet, testAddress, testChainId, testVerifyingContract);
      const firstPubkey = await keyStorage.getPublicKey();
      expect(await keyStorage.getKeyOwner?.()).toBe(testAddress.toLowerCase());

      await deviceAuth.clearAuth();
      api.post.mockClear();

      await deviceAuth.registerDevice(secondWallet, secondAddress, testChainId, testVerifyingContract);
      const secondPubkey = await keyStorage.getPublicKey();

      expect(firstPubkey).not.toBeNull();
      expect(secondPubkey).not.toBeNull();
      expect(secondPubkey).not.toBe(firstPubkey);
      expect(await keyStorage.getKeyOwner?.()).toBe(secondAddress.toLowerCase());
    });
  });

  describe('refreshTokens', () => {
    it('should return false if no refresh token', async () => {
      // Without registration, no refresh token
      const result = await deviceAuth.refreshTokens();
      expect(result).toBe(false);
    });

    it('should call /auth/token/refresh when refreshTokens is invoked', async () => {
      // Setup: register first
      const walletClient = createMockWalletClient(testAddress);
      api.get.mockResolvedValue({
        data: { status: 200, data: { name: 'arcana', version: '1', verifyingContract: '0x' + '12'.repeat(20), chainId: 31337 } },
      });
      api.post.mockImplementation((url: string) => {
        if (url === '/auth/devices/register') {
          return Promise.resolve({
            data: {
              status: 200,
              data: {
                device_id: 'dev-1',
                user_id: testAddress.toLowerCase(),
                refresh_token: 'refresh-1',
                access_token: 'access-1',
                access_token_id: 'aid-1',
                access_expires_at: Date.now() + 900000,
              },
            },
          });
        }
        if (url === '/auth/token/refresh') {
          return Promise.resolve({
            data: { status: 200, data: { access_token: 'new-access-token', access_token_id: 'aid-1', access_expires_at: Date.now() + 900000 } },
          });
        }
        return Promise.reject(new Error('Unknown'));
      });
      
      await deviceAuth.registerDevice(walletClient, testAddress, testChainId, testVerifyingContract);
      await deviceAuth.refreshTokens();
      
      // Verify the refresh endpoint was called during token refresh.
      expect(api.post).toHaveBeenCalledWith('/auth/token/refresh', expect.any(Object));
    });
  });

  describe('ensureAccessToken', () => {
    it('should return true if token is valid', async () => {
      // Setup with registration
      const walletClient = createMockWalletClient(testAddress);
      api.get.mockResolvedValue({
        data: { status: 200, data: { name: 'arcana', version: '1', verifyingContract: '0x' + '12'.repeat(20), chainId: 31337 } },
      });
      api.post.mockImplementation((url: string) => {
        if (url === '/auth/devices/register') {
          return Promise.resolve({
            data: {
              status: 200,
              data: {
                device_id: 'dev-1',
                user_id: testAddress.toLowerCase(),
                refresh_token: 'refresh-1',
                access_token: 'access-1',
                access_token_id: 'aid-1',
                access_expires_at: Date.now() + 900000,
              },
            },
          });
        }
        if (url === '/auth/token/refresh') {
          return Promise.resolve({
            data: { status: 200, data: { access_token: 'access-1', access_token_id: 'aid-1', access_expires_at: Date.now() + 900000 } },
          });
        }
        return Promise.reject(new Error('Unknown'));
      });
      
      await deviceAuth.registerDevice(walletClient, testAddress, testChainId, testVerifyingContract);
      
      const result = await deviceAuth.ensureAccessToken();
      expect(result).toBe(true);
    });

    it('should return false if not authenticated', async () => {
      const result = await deviceAuth.ensureAccessToken();
      expect(result).toBe(false);
    });
  });

  describe('clearAuth', () => {
    it('should clear all auth data', async () => {
      // Manually store tokens to simulate authenticated state
      await tokenStorage.store({
        deviceId: 'test-device',
        userId: testAddress.toLowerCase(),
        refreshToken: 'refresh-123',
        accessToken: 'access-123',
        accessTokenId: 'aid-123',
        accessExpiresAt: Date.now() + 900000,
      });
      
      // Reinitialize to pick up stored tokens
      await deviceAuth.init();
      
      // Now clear
      await deviceAuth.clearAuth();
      
      expect(deviceAuth.isAuthenticated()).toBe(false);
      expect(deviceAuth.getAccessToken()).toBeNull();
      expect(deviceAuth.getUserId()).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw on registration failure', async () => {
      const walletClient = createMockWalletClient(testAddress);
      api.get.mockResolvedValue({
        data: { status: 200, data: { name: 'arcana', version: '1', verifyingContract: '0x' + '12'.repeat(20), chainId: 31337 } },
      });
      api.post.mockRejectedValue(new Error('Network error'));
      
      await expect(deviceAuth.registerDevice(walletClient, testAddress, testChainId, testVerifyingContract))
        .rejects.toThrow();
    });

    it('should handle refresh token failure gracefully', async () => {
      // Setup with registration
      const walletClient = createMockWalletClient(testAddress);
      let refreshCallCount = 0;
      
      api.get.mockResolvedValue({
        data: { status: 200, data: { name: 'arcana', version: '1', verifyingContract: '0x' + '12'.repeat(20), chainId: 31337 } },
      });
      api.post.mockImplementation((url: string) => {
        if (url === '/auth/devices/register') {
          return Promise.resolve({
            data: {
              status: 200,
              data: {
                device_id: 'dev-1',
                user_id: testAddress.toLowerCase(),
                refresh_token: 'refresh-1',
                access_token: 'access-1',
                access_token_id: 'aid-1',
                access_expires_at: Date.now() + 900000,
              },
            },
          });
        }
        if (url === '/auth/token/refresh') {
          refreshCallCount++;
          if (refreshCallCount === 1) {
            return Promise.resolve({
              data: { status: 200, data: { access_token: 'access-1', access_token_id: 'aid-1', access_expires_at: Date.now() + 900000 } },
            });
          }
          return Promise.reject(new Error('Token expired'));
        }
        return Promise.reject(new Error('Unknown'));
      });
      
      await deviceAuth.registerDevice(walletClient, testAddress, testChainId, testVerifyingContract);
      
      // First refresh succeeds, second refresh should fail.
      const first = await deviceAuth.refreshTokens();
      expect(first).toBe(true);
      const result = await deviceAuth.refreshTokens();
      expect(result).toBe(false);
    });
  });
});

describe('MemoryKeyStorage', () => {
  let storage: MemoryKeyStorage;

  beforeEach(() => {
    storage = new MemoryKeyStorage();
  });

  it('should generate and store a keypair', async () => {
    const pubkey = await storage.generateKey();
    expect(pubkey).not.toBeNull();
    expect(pubkey.length).toBe(64); // 32 bytes = 64 hex chars
  });

  it('should return same pubkey on multiple calls to getPublicKey', async () => {
    const pubkey1 = await storage.generateKey();
    const pubkey2 = await storage.getPublicKey();
    expect(pubkey1).toBe(pubkey2);
  });

  it('should sign data', async () => {
    await storage.generateKey();
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const signature = await storage.sign(data);
    expect(signature).not.toBeNull();
    // Ed25519 signature is 64 bytes = 86 base64url chars (approx)
    expect(signature!.length).toBeGreaterThan(80);
  });

  it('should clear storage', async () => {
    await storage.generateKey();
    await storage.clear();
    expect(await storage.getPublicKey()).toBeNull();
  });
});

describe('MemoryTokenStorage', () => {
  let storage: MemoryTokenStorage;

  beforeEach(() => {
    storage = new MemoryTokenStorage();
  });

  it('should store and retrieve tokens', async () => {
    await storage.store({
      deviceId: 'dev-1',
      userId: 'user-1',
      refreshToken: 'refresh-1',
      accessToken: 'access-1',
      accessTokenId: 'aid-1',
      accessExpiresAt: Date.now() + 900000,
    });

    const tokens = await storage.get();
    expect(tokens.deviceId).toBe('dev-1');
    expect(tokens.refreshToken).toBe('refresh-1');
    expect(tokens.accessToken).toBe('access-1');
  });

  it('should update tokens partially', async () => {
    await storage.store({
      deviceId: 'dev-1',
      userId: 'user-1',
      refreshToken: 'refresh-1',
      accessToken: 'access-1',
      accessTokenId: 'aid-1',
      accessExpiresAt: Date.now() + 900000,
    });

    await storage.store({
      accessToken: 'access-2',
      accessTokenId: 'aid-2',
    });

    const tokens = await storage.get();
    expect(tokens.deviceId).toBe('dev-1'); // Unchanged
    expect(tokens.accessToken).toBe('access-2'); // Updated
  });

  it('should clear storage', async () => {
    await storage.store({
      deviceId: 'dev-1',
      userId: 'user-1',
      refreshToken: 'refresh-1',
      accessToken: 'access-1',
      accessTokenId: 'aid-1',
      accessExpiresAt: Date.now() + 900000,
    });

    await storage.clear();

    const tokens = await storage.get();
    expect(tokens.deviceId).toBeNull();
    expect(tokens.accessToken).toBeNull();
  });
});
