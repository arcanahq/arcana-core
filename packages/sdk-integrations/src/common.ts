import type { ArcanaTypedDataRequest, ArcanaWalletAdapter } from '@arcanahq/sdk';

export type HexAddress = `0x${string}`;
export type HexSignature = `0x${string}`;

export interface SignTypedDataCapable {
  signTypedData(request: ArcanaTypedDataRequest & { account?: HexAddress }): Promise<HexSignature>;
}

export interface ViemWalletClientLike extends SignTypedDataCapable {
  account?: { address?: string } | HexAddress | null;
  getAddresses?: () => Promise<string[]>;
  getChainId?: () => Promise<number>;
}

export interface Eip1193ProviderLike {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export interface AdapterOptions {
  address?: string;
  chainId?: number;
}

export function assertHexAddress(address: string | undefined | null, label: string = 'address'): HexAddress {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Arcana integration requires a valid EVM ${label}`);
  }
  return address.toLowerCase() as HexAddress;
}

export async function resolveAddress(
  provided: string | undefined,
  walletClient?: ViemWalletClientLike,
  provider?: Eip1193ProviderLike
): Promise<HexAddress> {
  if (provided) {
    return assertHexAddress(provided);
  }

  const account = walletClient?.account;
  if (typeof account === 'string') {
    return assertHexAddress(account);
  }
  if (account && typeof account === 'object' && account.address) {
    return assertHexAddress(account.address);
  }

  if (walletClient?.getAddresses) {
    const addresses = await walletClient.getAddresses();
    return assertHexAddress(addresses[0], 'wallet address');
  }

  if (provider) {
    const addresses = await provider.request({ method: 'eth_accounts' });
    if (!Array.isArray(addresses)) {
      throw new Error('Arcana integration expected eth_accounts to return an array');
    }
    return assertHexAddress(addresses[0] as string | undefined, 'wallet address');
  }

  throw new Error('Arcana integration could not resolve a wallet address');
}

export async function resolveChainId(
  provided: number | undefined,
  walletClient?: ViemWalletClientLike,
  provider?: Eip1193ProviderLike
): Promise<number | undefined> {
  if (provided !== undefined) {
    return provided;
  }
  if (walletClient?.getChainId) {
    return walletClient.getChainId();
  }
  if (provider) {
    const chainId = await provider.request({ method: 'eth_chainId' });
    if (typeof chainId === 'string') {
      const parsed = chainId.startsWith('0x') ? parseInt(chainId, 16) : parseInt(chainId, 10);
      if (!Number.isInteger(parsed)) {
        throw new Error('Arcana integration expected eth_chainId to be parseable as an integer');
      }
      return parsed;
    }
    if (typeof chainId === 'number') {
      return chainId;
    }
    throw new Error('Arcana integration expected eth_chainId to return a string or number');
  }
  return undefined;
}

export function stringifyTypedData(request: ArcanaTypedDataRequest): string {
  return JSON.stringify({
    domain: request.domain,
    types: request.types,
    primaryType: request.primaryType,
    message: request.message,
  }, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
}

export function createViemArcanaWalletAdapter(
  walletClient: ViemWalletClientLike,
  options: AdapterOptions = {}
): ArcanaWalletAdapter {
  if (!walletClient || typeof walletClient.signTypedData !== 'function') {
    throw new Error('Arcana integration requires a Viem-compatible signer with signTypedData');
  }

  return {
    async getAddress() {
      return resolveAddress(options.address, walletClient);
    },
    async getChainId() {
      const chainId = await resolveChainId(options.chainId, walletClient);
      if (chainId === undefined) {
        throw new Error('Arcana integration could not resolve chainId from the Viem signer');
      }
      return chainId;
    },
    async signTypedData(request) {
      const address = await resolveAddress(options.address, walletClient);
      return walletClient.signTypedData({
        ...request,
        account: address,
      });
    },
  };
}

export function createEip1193ArcanaWalletAdapter(
  provider: Eip1193ProviderLike,
  options: AdapterOptions = {}
): ArcanaWalletAdapter {
  if (!provider || typeof provider.request !== 'function') {
    throw new Error('Arcana integration requires an EIP-1193 provider with request()');
  }

  return {
    async getAddress() {
      return resolveAddress(options.address, undefined, provider);
    },
    async getChainId() {
      const chainId = await resolveChainId(options.chainId, undefined, provider);
      if (chainId === undefined) {
        throw new Error('Arcana integration could not resolve chainId from the EIP-1193 provider');
      }
      return chainId;
    },
    async signTypedData(request) {
      const address = await resolveAddress(options.address, undefined, provider);
      const signature = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [address, stringifyTypedData(request)],
      });
      if (typeof signature !== 'string' || !signature.startsWith('0x')) {
        throw new Error('Arcana integration expected eth_signTypedData_v4 to return a hex signature');
      }
      return signature as HexSignature;
    },
  };
}
