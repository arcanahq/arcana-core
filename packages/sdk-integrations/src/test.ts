import { privateKeyToAccount } from 'viem/accounts';
import type { ArcanaWalletAdapter } from '@arcanahq/sdk';
import type { HexAddress } from './common.js';
import { assertHexAddress } from './common.js';

export const DEFAULT_ARCANA_TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

export interface TestArcanaAdapterOptions {
  /**
   * Deterministic private key used only for local/test auth. Defaults to the
   * first Anvil account so local agents can authenticate without OTP flows.
   */
  privateKey?: `0x${string}`;
  /** Chain id to report to Arcana device registration. */
  chainId?: number;
}

export function createTestArcanaWalletAdapter(
  options: TestArcanaAdapterOptions = {}
): ArcanaWalletAdapter {
  const privateKey = options.privateKey ?? DEFAULT_ARCANA_TEST_PRIVATE_KEY;
  const account = privateKeyToAccount(privateKey);
  const address = assertHexAddress(account.address, 'test wallet address');
  const chainId = options.chainId ?? 31337;

  return {
    getAddress(): HexAddress {
      return address;
    },
    getChainId(): number {
      return chainId;
    },
    async signTypedData(request) {
      return account.signTypedData({
        domain: request.domain,
        types: request.types,
        primaryType: request.primaryType,
        message: request.message,
      } as Parameters<typeof account.signTypedData>[0]);
    },
  };
}
