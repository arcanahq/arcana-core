import { describe, expect, it, vi } from 'vitest';
import {
  createEip1193ArcanaWalletAdapter,
  createViemArcanaWalletAdapter,
} from '../common.js';
import {
  authenticateArcanaWithDynamic,
  createDynamicArcanaWalletAdapter,
  ensureArcanaSessionWithDynamic,
} from '../dynamic.js';
import { createZeroDevArcanaWalletAdapter } from '../zerodev.js';
import { registerArcanaDeviceWithAdapter } from '../authenticate.js';
import { createTestArcanaWalletAdapter } from '../test.js';

const address = '0xa0ee7a142d267c1f36714e4a8f75612f20a79720' as const;
const verifyingContract = '0x1212121212121212121212121212121212121212' as const;

const typedData = {
  account: address,
  domain: {
    name: 'Arcana',
    version: '1',
    chainId: 31337,
    verifyingContract,
  },
  types: {
    DeviceRegistration: [
      { name: 'userAddress', type: 'address' },
      { name: 'devicePubkey', type: 'string' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'nonce', type: 'string' },
    ],
  },
  primaryType: 'DeviceRegistration',
  message: {
    userAddress: address,
    devicePubkey: 'ab'.repeat(32),
    timestamp: 1n,
    nonce: 'nonce',
  },
};

describe('Arcana integration adapters', () => {
  it('wraps a Viem-compatible wallet client', async () => {
    const signTypedData = vi.fn().mockResolvedValue('0x' + '11'.repeat(65));
    const walletClient = {
      account: { address },
      getChainId: vi.fn().mockResolvedValue(31337),
      signTypedData,
    };

    const adapter = createViemArcanaWalletAdapter(walletClient);

    await expect(adapter.getAddress()).resolves.toBe(address);
    await expect(adapter.getChainId?.()).resolves.toBe(31337);
    await expect(adapter.signTypedData(typedData)).resolves.toBe('0x' + '11'.repeat(65));
    expect(signTypedData).toHaveBeenCalledWith(expect.objectContaining({ account: address }));
  });

  it('wraps an EIP-1193 provider and signs typed data v4', async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_accounts') return [address];
      if (method === 'eth_chainId') return '0x7a69';
      if (method === 'eth_signTypedData_v4') return '0x' + '22'.repeat(65);
      throw new Error(`unexpected method ${method}`);
    });

    const adapter = createEip1193ArcanaWalletAdapter({ request });

    await expect(adapter.getAddress()).resolves.toBe(address);
    await expect(adapter.getChainId?.()).resolves.toBe(31337);
    await expect(adapter.signTypedData(typedData)).resolves.toBe('0x' + '22'.repeat(65));
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'eth_signTypedData_v4',
      params: expect.arrayContaining([address]),
    }));
  });

  it('uses Dynamic getWalletClient when present', async () => {
    const walletClient = {
      account: { address },
      signTypedData: vi.fn().mockResolvedValue('0x' + '33'.repeat(65)),
    };

    const adapter = await createDynamicArcanaWalletAdapter({
      wallet: {
        address,
        getWalletClient: vi.fn().mockResolvedValue(walletClient),
      },
    });

    await expect(adapter.getAddress()).resolves.toBe(address);
    await expect(adapter.signTypedData(typedData)).resolves.toBe('0x' + '33'.repeat(65));
  });

  it('restores Dynamic Arcana device auth without registering again', async () => {
    const walletClient = {
      account: { address },
      getChainId: vi.fn().mockResolvedValue(31337),
      signTypedData: vi.fn().mockResolvedValue('0x' + '33'.repeat(65)),
    };
    const registerDevice = vi.fn();
    const activateWallet = vi.fn();

    const result = await authenticateArcanaWithDynamic({
      client: {
        auth: {
          getDomainInfo: vi.fn().mockResolvedValue({
            name: 'Arcana',
            version: '1',
            chainId: 31337,
            verifyingContract,
          }),
        },
        isAuthenticated: vi.fn().mockReturnValue(true),
        ensureAuthenticated: vi.fn().mockResolvedValue(true),
        deviceAuth: {
          activateWallet,
          getWalletAddress: vi.fn().mockReturnValue(address),
          getUserId: vi.fn().mockReturnValue(address),
          registerDevice,
        },
      },
      walletClient,
      chainId: 31337,
    });

    expect(result).toMatchObject({ address, userId: address, status: 'restored', restored: true });
    expect(activateWallet).toHaveBeenCalledWith(address);
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('exposes a Dynamic session helper for one-button Arcana sign-in flows', async () => {
    const walletClient = {
      account: { address },
      getChainId: vi.fn().mockResolvedValue(31337),
      signTypedData: vi.fn().mockResolvedValue('0x' + '33'.repeat(65)),
    };
    const registerDevice = vi.fn().mockResolvedValue({
      device_id: 'dev-1',
      refresh_token: 'refresh',
      refresh_expires_at: 1,
      access_token: 'access',
      access_token_id: 'access-id',
      access_expires_at: 2,
      user_id: address,
    });

    const result = await ensureArcanaSessionWithDynamic({
      client: {
        auth: {
          getDomainInfo: vi.fn().mockResolvedValue({
            name: 'Arcana',
            version: '1',
            chainId: 31337,
            verifyingContract,
          }),
        },
        isAuthenticated: vi.fn().mockReturnValue(false),
        ensureAuthenticated: vi.fn().mockResolvedValue(false),
        deviceAuth: {
          activateWallet: vi.fn(),
          getWalletAddress: vi.fn().mockReturnValue(null),
          getUserId: vi.fn().mockReturnValue(address),
          registerDevice,
        },
      },
      walletClient,
      chainId: 31337,
      deviceName: 'dynamic one button',
    });

    expect(result).toMatchObject({
      address,
      userId: address,
      status: 'registered',
      restored: false,
    });
  });

  it('registers Dynamic Arcana device auth when restore is unavailable', async () => {
    const walletClient = {
      account: { address },
      getChainId: vi.fn().mockResolvedValue(31337),
      signTypedData: vi.fn().mockResolvedValue('0x' + '33'.repeat(65)),
    };
    const registerDevice = vi.fn().mockResolvedValue({
      device_id: 'dev-1',
      refresh_token: 'refresh',
      refresh_expires_at: 1,
      access_token: 'access',
      access_token_id: 'access-id',
      access_expires_at: 2,
      user_id: address,
      user: { id: address },
    });

    const result = await authenticateArcanaWithDynamic({
      client: {
        auth: {
          getDomainInfo: vi.fn().mockResolvedValue({
            name: 'Arcana',
            version: '1',
            chainId: 31337,
            verifyingContract,
          }),
        },
        isAuthenticated: vi.fn().mockReturnValue(false),
        ensureAuthenticated: vi.fn().mockResolvedValue(false),
        deviceAuth: {
          activateWallet: vi.fn(),
          getWalletAddress: vi.fn().mockReturnValue(null),
          getUserId: vi.fn().mockReturnValue(address),
          registerDevice,
        },
      },
      walletClient,
      chainId: 31337,
      deviceName: 'dynamic test',
    });

    expect(result).toMatchObject({ address, userId: address, status: 'registered', restored: false });
    expect(registerDevice).toHaveBeenCalledWith(
      expect.any(Object),
      address,
      31337,
      verifyingContract,
      'dynamic test'
    );
  });

  it('creates a deterministic local test adapter', async () => {
    const adapter = createTestArcanaWalletAdapter();

    expect(await adapter.getAddress()).toBe('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
    expect(await adapter.getChainId?.()).toBe(31337);
    await expect(adapter.signTypedData(typedData)).resolves.toMatch(/^0x[0-9a-f]+$/);
  });

  it('requires a ZeroDev owner signer instead of accepting a Kernel-only client', () => {
    expect(() => createZeroDevArcanaWalletAdapter({
      kernelClient: {
        account: { address: '0x2222222222222222222222222222222222222222' },
        signTypedData: vi.fn().mockResolvedValue('0x' + '44'.repeat(65)),
      },
    })).toThrow('ownerWalletClient');
  });

  it('registers Arcana device auth with adapter domain values', async () => {
    const adapter = createViemArcanaWalletAdapter({
      account: { address },
      getChainId: vi.fn().mockResolvedValue(31337),
      signTypedData: vi.fn().mockResolvedValue('0x' + '55'.repeat(65)),
    });

    const registerDevice = vi.fn().mockResolvedValue({
      device_id: 'dev-1',
      refresh_token: 'refresh',
      refresh_expires_at: 1,
      access_token: 'access',
      access_token_id: 'access-id',
      access_expires_at: 2,
      user_id: address,
    });

    await registerArcanaDeviceWithAdapter({
      auth: {
        getDomainInfo: vi.fn().mockResolvedValue({
          name: 'Arcana',
          version: '1',
          chainId: 31337,
          verifyingContract,
        }),
      },
      deviceAuth: { registerDevice },
    }, adapter, { deviceName: 'test device' });

    expect(registerDevice).toHaveBeenCalledWith(
      adapter,
      address,
      31337,
      verifyingContract,
      'test device'
    );
  });
});
