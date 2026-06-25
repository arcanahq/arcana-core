import type { ArcanaWalletAdapter } from '@arcanahq/sdk';
import {
  AdapterOptions,
  ViemWalletClientLike,
  assertHexAddress,
  createViemArcanaWalletAdapter,
} from './common.js';

export { registerArcanaDeviceWithAdapter } from './authenticate.js';
export type { ArcanaClientForDeviceRegistration, RegisterArcanaDeviceOptions } from './authenticate.js';

export interface ZeroDevAccountLike {
  address?: string;
}

export interface ZeroDevClientLike extends ViemWalletClientLike {
  account?: ZeroDevAccountLike | `0x${string}` | null;
}

export interface ZeroDevArcanaAdapterOptions extends AdapterOptions {
  /**
   * EOA or embedded wallet signer that controls the Kernel account.
   *
   * Arcana device registration currently verifies ECDSA recovery against
   * user_address, so the signer must be the controlling wallet, not the Kernel
   * smart-account address.
   */
  ownerWalletClient?: ViemWalletClientLike;
  /** Alias used by Dynamic's ZeroDev helper docs. */
  signerWalletClient?: ViemWalletClientLike;
  /** Optional smart account address for app bookkeeping. It is not used for Arcana auth. */
  smartAccountAddress?: string;
  /** @deprecated Pass ownerWalletClient/signerWalletClient. Kernel signatures are not valid for Arcana auth yet. */
  kernelClient?: ZeroDevClientLike;
  /** @deprecated Use smartAccountAddress. */
  smartAccount?: ZeroDevAccountLike;
}

export interface ZeroDevArcanaWalletAdapter extends ArcanaWalletAdapter {
  getSmartAccountAddress(): `0x${string}` | null;
}

export function createZeroDevArcanaWalletAdapter(
  options: ZeroDevArcanaAdapterOptions
): ZeroDevArcanaWalletAdapter {
  const ownerWalletClient = options.ownerWalletClient ?? options.signerWalletClient;
  if (!ownerWalletClient) {
    throw new Error('ZeroDev Arcana integration requires ownerWalletClient/signerWalletClient for Arcana auth; Kernel smart-account signatures are not accepted by Arcana device registration yet');
  }

  if (options.kernelClient && !options.ownerWalletClient && !options.signerWalletClient) {
    throw new Error('ZeroDev kernelClient was provided without an owner signer. Pass ownerWalletClient/signerWalletClient for Arcana auth');
  }

  const smartAccountAddress = options.smartAccountAddress
    ?? (typeof options.kernelClient?.account === 'string' ? options.kernelClient.account : options.kernelClient?.account?.address)
    ?? options.smartAccount?.address
    ?? null;

  const adapter = createViemArcanaWalletAdapter(ownerWalletClient, {
    ...options,
    address: options.address,
  });

  return {
    ...adapter,
    getSmartAccountAddress() {
      return smartAccountAddress
        ? assertHexAddress(smartAccountAddress, 'ZeroDev smart account address')
        : null;
    },
  };
}
