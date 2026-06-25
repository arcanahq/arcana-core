import type { Address, TypedDataDomain } from 'viem';

export interface ArcanaTypedDataField {
  name: string;
  type: string;
}

export interface ArcanaTypedDataRequest {
  account?: Address;
  domain: TypedDataDomain;
  types: Record<string, readonly ArcanaTypedDataField[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

/**
 * Minimal signer shape required by Arcana device registration.
 *
 * Provider integrations should normalize their wallet, smart account, or
 * account-abstraction client to this interface instead of adding provider
 * dependencies to the base SDK.
 */
export interface ArcanaWalletAdapter {
  getAddress(): Address | Promise<Address>;
  getChainId?(): number | Promise<number>;
  signTypedData(request: ArcanaTypedDataRequest): Promise<`0x${string}`>;
}

export function isArcanaWalletAdapter(value: unknown): value is ArcanaWalletAdapter {
  return !!value
    && typeof value === 'object'
    && typeof (value as ArcanaWalletAdapter).getAddress === 'function'
    && typeof (value as ArcanaWalletAdapter).signTypedData === 'function';
}
