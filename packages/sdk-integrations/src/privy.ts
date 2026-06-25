import type { ArcanaWalletAdapter } from '@arcanahq/sdk';
import {
  AdapterOptions,
  Eip1193ProviderLike,
  ViemWalletClientLike,
  createEip1193ArcanaWalletAdapter,
  createViemArcanaWalletAdapter,
} from './common.js';

export { registerArcanaDeviceWithAdapter } from './authenticate.js';
export type { ArcanaClientForDeviceRegistration, RegisterArcanaDeviceOptions } from './authenticate.js';

export interface PrivyWalletLike {
  address?: string;
  getEthereumProvider?: () => Eip1193ProviderLike | Promise<Eip1193ProviderLike>;
}

export interface PrivyArcanaAdapterOptions extends AdapterOptions {
  wallet?: PrivyWalletLike;
  walletClient?: ViemWalletClientLike;
  account?: ViemWalletClientLike;
}

export async function createPrivyArcanaWalletAdapter(
  options: PrivyArcanaAdapterOptions
): Promise<ArcanaWalletAdapter> {
  if (options.walletClient) {
    return createViemArcanaWalletAdapter(options.walletClient, options);
  }

  if (options.account) {
    return createViemArcanaWalletAdapter(options.account, options);
  }

  if (!options.wallet) {
    throw new Error('Privy Arcana integration requires a Privy wallet, Viem walletClient, or Viem account');
  }

  if (typeof options.wallet.getEthereumProvider !== 'function') {
    throw new Error('Privy wallet does not expose getEthereumProvider(); pass toViemAccount(wallet) as account instead');
  }

  const provider = await options.wallet.getEthereumProvider();
  return createEip1193ArcanaWalletAdapter(provider, {
    ...options,
    address: options.address ?? options.wallet.address,
  });
}
