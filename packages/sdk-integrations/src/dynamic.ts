import type { ArcanaWalletAdapter } from '@arcanahq/sdk';
import {
  AdapterOptions,
  Eip1193ProviderLike,
  ViemWalletClientLike,
  createEip1193ArcanaWalletAdapter,
  createViemArcanaWalletAdapter,
} from './common.js';
import {
  ArcanaClientForDeviceRegistration,
  RegisterArcanaDeviceOptions,
  registerArcanaDeviceWithAdapter,
} from './authenticate.js';

export { registerArcanaDeviceWithAdapter } from './authenticate.js';
export type { ArcanaClientForDeviceRegistration, RegisterArcanaDeviceOptions } from './authenticate.js';

export interface DynamicWalletLike {
  address?: string;
  getAddress?: () => string | Promise<string>;
  getEthereumProvider?: () => Eip1193ProviderLike | Promise<Eip1193ProviderLike>;
  getWalletClient?: () => ViemWalletClientLike | Promise<ViemWalletClientLike>;
  connector?: {
    getSigner?: () => unknown | Promise<unknown>;
  };
}

export interface DynamicArcanaAdapterOptions extends AdapterOptions {
  wallet?: DynamicWalletLike;
  walletClient?: ViemWalletClientLike;
}

export interface DynamicArcanaAuthClient extends ArcanaClientForDeviceRegistration {
  ensureAuthenticated?(): Promise<boolean>;
  isAuthenticated?(): boolean;
  deviceAuth?: ArcanaClientForDeviceRegistration['deviceAuth'] & {
    activateWallet?(address: string | null): Promise<void>;
    getUserId?(): string | null;
    getWalletAddress?(): string | null;
  };
}

export interface DynamicArcanaAuthOptions extends DynamicArcanaAdapterOptions, RegisterArcanaDeviceOptions {
  client: DynamicArcanaAuthClient;
  deviceName?: string;
  ensureChain?: boolean;
}

export interface DynamicArcanaAuthResult {
  adapter: ArcanaWalletAdapter;
  address: `0x${string}`;
  userId: string;
  status: 'restored' | 'registered';
  restored: boolean;
}

export async function createDynamicArcanaWalletAdapter(
  options: DynamicArcanaAdapterOptions
): Promise<ArcanaWalletAdapter> {
  if (options.walletClient) {
    return createViemArcanaWalletAdapter(options.walletClient, options);
  }

  if (!options.wallet) {
    throw new Error('Dynamic Arcana integration requires a Dynamic wallet or Viem walletClient');
  }

  const walletAddress = options.address
    ?? options.wallet.address
    ?? (typeof options.wallet.getAddress === 'function' ? await options.wallet.getAddress() : undefined);

  if (typeof options.wallet.getWalletClient === 'function') {
    const walletClient = await options.wallet.getWalletClient();
    return createViemArcanaWalletAdapter(walletClient, {
      ...options,
      address: walletAddress,
    });
  }

  if (typeof options.wallet.getEthereumProvider === 'function') {
    const provider = await options.wallet.getEthereumProvider();
    return createEip1193ArcanaWalletAdapter(provider, {
      ...options,
      address: walletAddress,
    });
  }

  throw new Error('Dynamic wallet does not expose getWalletClient() or getEthereumProvider(); pass a Dynamic Viem walletClient instead');
}

export async function ensureArcanaSessionWithDynamic(
  options: DynamicArcanaAuthOptions
): Promise<DynamicArcanaAuthResult> {
  const { client, chainId, ensureChain = true } = options;
  const adapter = await createDynamicArcanaWalletAdapter(options);
  const address = await adapter.getAddress();

  await client.deviceAuth?.activateWallet?.(address);

  if (client.isAuthenticated?.()) {
    const sessionWallet = client.deviceAuth?.getWalletAddress?.()?.toLowerCase() || '';
    if (!sessionWallet || sessionWallet === address.toLowerCase()) {
      const authenticated = await client.ensureAuthenticated?.();
      const userId = client.deviceAuth?.getUserId?.() || '';
      if (authenticated && userId) {
        return { adapter, address, userId, status: 'restored', restored: true };
      }
    }
  }

  if (ensureChain && chainId !== undefined) {
    const adapterChainId = await adapter.getChainId?.();
    if (adapterChainId !== undefined && adapterChainId !== chainId) {
      throw new Error(`Dynamic wallet is connected to chain ${adapterChainId}; switch to chain ${chainId} and retry`);
    }
  }

  const registration = await registerArcanaDeviceWithAdapter(client, adapter, {
    chainId,
    verifyingContract: options.verifyingContract,
    deviceName: options.deviceName,
  });
  const userId = registration.user_id || client.deviceAuth?.getUserId?.() || '';
  if (!userId) {
    throw new Error('Arcana Dynamic authentication did not return a user id');
  }

  return { adapter, address, userId, status: 'registered', restored: false };
}

export async function authenticateArcanaWithDynamic(
  options: DynamicArcanaAuthOptions
): Promise<DynamicArcanaAuthResult> {
  return ensureArcanaSessionWithDynamic(options);
}
