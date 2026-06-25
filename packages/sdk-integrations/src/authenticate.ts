import type { ArcanaWalletAdapter, DeviceRegistrationResponse, DomainInfo } from '@arcanahq/sdk';
import { assertHexAddress } from './common.js';

export interface ArcanaClientForDeviceRegistration {
  auth: {
    getDomainInfo(): Promise<DomainInfo>;
  };
  deviceAuth?: {
    registerDevice(
      wallet: ArcanaWalletAdapter,
      address: `0x${string}`,
      chainId: number,
      verifyingContract: `0x${string}`,
      deviceName?: string
    ): Promise<DeviceRegistrationResponse>;
  };
}

export interface RegisterArcanaDeviceOptions {
  chainId?: number;
  verifyingContract?: `0x${string}`;
  deviceName?: string;
}

export async function registerArcanaDeviceWithAdapter(
  client: ArcanaClientForDeviceRegistration,
  adapter: ArcanaWalletAdapter,
  options: RegisterArcanaDeviceOptions = {}
): Promise<DeviceRegistrationResponse> {
  if (!client.deviceAuth) {
    throw new Error('Arcana device authentication is not enabled on this client');
  }

  const address = await adapter.getAddress();
  const domainInfo = await client.auth.getDomainInfo();
  const domainVerifyingContract = domainInfo.verifyingContract || domainInfo.verifying_contract;
  const verifyingContract = assertHexAddress(
    options.verifyingContract ?? domainVerifyingContract,
    'Arcana auth verifying contract'
  );

  const adapterChainId = adapter.getChainId ? await adapter.getChainId() : undefined;
  const chainId = options.chainId ?? adapterChainId ?? domainInfo.chainId;

  if (chainId === undefined || !Number.isInteger(chainId)) {
    throw new Error('Arcana device registration requires a chainId');
  }

  return client.deviceAuth.registerDevice(
    adapter,
    address,
    chainId,
    verifyingContract,
    options.deviceName
  );
}
