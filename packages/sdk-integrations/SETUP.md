# Arcana Wallet Integrations Setup

This guide covers the environment variables and provider setup needed to use
`@arcanahq/sdk-integrations` with Privy, Dynamic, and ZeroDev.

## Short Answer

Your frontend usually needs provider-specific public IDs:

```bash
# Arcana
VITE_ARCANA_API_URL=http://localhost:3003

# Privy apps
VITE_PRIVY_APP_ID=<privy-app-id>

# Dynamic apps
VITE_DYNAMIC_ENVIRONMENT_ID=<dynamic-environment-id>

# Basic-app auth mode switch
VITE_ARCANA_AUTH_MODE=wallet # or test
VITE_ARCANA_TEST_PRIVATE_KEY=<local-test-private-key>

# ZeroDev apps, if you create Kernel clients yourself
VITE_ZERODEV_RPC=<zerodev-bundler-rpc>
VITE_ZERODEV_PAYMASTER_RPC=<zerodev-paymaster-rpc>
```

For Next.js, use `NEXT_PUBLIC_` instead of `VITE_`:

```bash
NEXT_PUBLIC_ARCANA_API_URL=http://localhost:3003
NEXT_PUBLIC_PRIVY_APP_ID=<privy-app-id>
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=<dynamic-environment-id>
NEXT_PUBLIC_ZERODEV_RPC=<zerodev-bundler-rpc>
NEXT_PUBLIC_ZERODEV_PAYMASTER_RPC=<zerodev-paymaster-rpc>
```

The Arcana SDK integration package does not read those names directly. Your app
reads them and passes the values to Arcana, Privy, Dynamic, and ZeroDev clients.

Your Arcana server needs EIP-712 auth configured:

```yaml
server:
  auth:
    provider: eip712
    providers:
      - eip712
    eip712:
      chain_id: 42161
      allowed_chain_ids:
        - 42161
      verifying_contract_address: "0x0000000000000000000000000000000000000001"
```

Environment variables can override those values:

```bash
AUTH_PROVIDER=eip712
CHAIN_ID=42161
AUTH_CHAIN_IDS=42161
VERIFYING_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000001
ARCANA_TOKEN_PEPPER=<base64-encoded-32-byte-secret>
```

For local development, use your local chain:

```bash
AUTH_PROVIDER=eip712
CHAIN_ID=31337
AUTH_CHAIN_IDS=31337
VERIFYING_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000001
```

Do not use `AUTH_PROVIDER=dev` for production. It skips signature verification.

## Development Auth Switch

For day-to-day app work, keep provider and test auth as explicit modes:

```bash
# Realistic provider flow: MetaMask/Wagmi, Privy, Dynamic, or ZeroDev owner signer.
VITE_ARCANA_AUTH_MODE=wallet npm run dev

# Agentic testing flow: deterministic local signer, no OTP or hosted account.
VITE_ARCANA_AUTH_MODE=test npm run dev
```

The test adapter signs the same Arcana device-registration typed data as the
provider adapters. It should be used only for local automation and tests.

## What Each Value Does

| Setting | Where | Required | Purpose |
|---------|-------|----------|---------|
| `VITE_ARCANA_API_URL` / `NEXT_PUBLIC_ARCANA_API_URL` | Frontend | Yes | Arcana API base URL passed to `new ArcanaClient({ apiUrl })`. |
| `VITE_ARCANA_AUTH_MODE` | Frontend | Local basic-app only | `wallet` for realistic provider auth, `test` for deterministic local signer auth. |
| `VITE_ARCANA_TEST_PRIVATE_KEY` | Frontend | Test auth only | Local-only private key used by `@arcanahq/sdk-integrations/test`. |
| `VITE_PRIVY_APP_ID` / `NEXT_PUBLIC_PRIVY_APP_ID` | Frontend | Privy only | App ID from the Privy Dashboard, passed to `PrivyProvider`. |
| `VITE_DYNAMIC_ENVIRONMENT_ID` / `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` | Frontend | Dynamic only | Environment ID from the Dynamic Dashboard. |
| `VITE_ZERODEV_RPC` / `NEXT_PUBLIC_ZERODEV_RPC` | Frontend | ZeroDev manual setup | ZeroDev bundler RPC from the ZeroDev Dashboard. Dynamic's ZeroDev extension may manage this for you. |
| `VITE_ZERODEV_PAYMASTER_RPC` / `NEXT_PUBLIC_ZERODEV_PAYMASTER_RPC` | Frontend | Gas sponsorship only | Paymaster RPC used when sponsoring UserOps. |
| `AUTH_PROVIDER` | Arcana server | Optional | Legacy single-provider override. Prefer `server.auth.providers` for explicit multi-provider config. |
| `AUTH_PROVIDERS` | Arcana server | Optional | Comma-separated provider list override, such as `eip712,solana`. |
| `CHAIN_ID` | Arcana server | Yes | Default EIP-712 auth chain ID used by `/auth/domain`. |
| `AUTH_CHAIN_IDS` | Arcana server | Recommended | Comma-separated allowlist of chain IDs accepted for EIP-712 auth signatures. |
| `VERIFYING_CONTRACT_ADDRESS` | Arcana server | Yes | EIP-712 domain `verifyingContract`. Must match what the frontend signs. |
| `ARCANA_TOKEN_PEPPER` | Arcana server | Production | Secret used for refresh-token hashing. |

## Important EIP-712 Details

Arcana device registration signs this EIP-712 domain:

```typescript
{
  name: 'Arcana',
  version: '1',
  chainId,
  verifyingContract,
}
```

The frontend gets `chainId` and `verifyingContract` from:

```typescript
const domain = await client.auth.getDomainInfo();
```

`registerArcanaDeviceWithAdapter` does this for you. If your Arcana server
returns the wrong chain ID or verifying contract, provider signatures will fail.

`VERIFYING_CONTRACT_ADDRESS` does not need to be an Arcana protocol contract for
local development. It only needs to be a valid EVM address that stays stable and
matches the server-side verifier. In production, use the stable verifying
contract address chosen for your deployment.

## Privy Setup

Install:

```bash
npm install @arcanahq/sdk @arcanahq/sdk-integrations @privy-io/react-auth viem
```

Frontend env:

```bash
VITE_ARCANA_API_URL=https://arcana-api.example.com
VITE_PRIVY_APP_ID=<privy-app-id>
```

Provider setup:

```tsx
import { PrivyProvider } from '@privy-io/react-auth';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID}
      config={{
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'all-users',
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```

Arcana auth:

```typescript
import { ArcanaClient } from '@arcanahq/sdk';
import {
  createPrivyArcanaWalletAdapter,
  registerArcanaDeviceWithAdapter,
} from '@arcanahq/sdk-integrations/privy';

const client = new ArcanaClient({
  apiUrl: import.meta.env.VITE_ARCANA_API_URL,
});
await client.init();

const adapter = await createPrivyArcanaWalletAdapter({
  wallet: privyWallet,
});

await registerArcanaDeviceWithAdapter(client, adapter, {
  deviceName: 'Privy wallet',
});
```

## Dynamic Setup

Install for the current Dynamic JavaScript SDK:

```bash
npm install @arcanahq/sdk @arcanahq/sdk-integrations @dynamic-labs-sdk/client @dynamic-labs-sdk/evm viem
```

Frontend env:

```bash
VITE_ARCANA_API_URL=https://arcana-api.example.com
VITE_DYNAMIC_ENVIRONMENT_ID=<dynamic-environment-id>
```

Dynamic client setup:

```typescript
import { createDynamicClient } from '@dynamic-labs-sdk/client';
import { addEvmExtension } from '@dynamic-labs-sdk/evm';

export const dynamicClient = createDynamicClient({
  environmentId: import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID,
});

addEvmExtension();
```

Arcana auth:

```typescript
import { getPrimaryWalletAccount } from '@dynamic-labs-sdk/client';
import { createWalletClientForWalletAccount } from '@dynamic-labs-sdk/evm/viem';
import {
  ensureArcanaSessionWithDynamic,
} from '@arcanahq/sdk-integrations/dynamic';

const walletAccount = getPrimaryWalletAccount();
if (!walletAccount) {
  throw new Error('No Dynamic wallet account is connected');
}

const walletClient = await createWalletClientForWalletAccount({
  walletAccount,
});

const session = await ensureArcanaSessionWithDynamic({
  client,
  walletClient,
  deviceName: 'Dynamic wallet',
});
console.log(`Arcana ${session.status} for ${session.address}`);
```

## ZeroDev Setup

ZeroDev is for onchain account abstraction. Arcana auth still uses the EOA or
embedded signer that owns the Kernel account.

Install:

```bash
npm install @arcanahq/sdk @arcanahq/sdk-integrations @zerodev/sdk @zerodev/ecdsa-validator viem
```

Frontend env:

```bash
VITE_ARCANA_API_URL=https://arcana-api.example.com
VITE_ZERODEV_RPC=<zerodev-bundler-rpc>
VITE_ZERODEV_PAYMASTER_RPC=<zerodev-paymaster-rpc>
```

Arcana auth with the Kernel owner signer:

```typescript
import {
  createZeroDevArcanaWalletAdapter,
  registerArcanaDeviceWithAdapter,
} from '@arcanahq/sdk-integrations/zerodev';

const adapter = createZeroDevArcanaWalletAdapter({
  ownerWalletClient,
  smartAccountAddress: kernelClient.account.address,
});

await registerArcanaDeviceWithAdapter(client, adapter, {
  deviceName: 'ZeroDev owner signer',
});

const smartAccountAddress = adapter.getSmartAccountAddress();
```

Do not pass only `kernelClient` for Arcana auth. Arcana currently verifies a
65-byte ECDSA signature by recovering the signer address, so smart-account
contract signatures are not accepted by device registration.

## Dynamic + ZeroDev

Install:

```bash
npm install @arcanahq/sdk @arcanahq/sdk-integrations @dynamic-labs-sdk/client @dynamic-labs-sdk/evm @dynamic-labs-sdk/zerodev viem
```

Frontend env:

```bash
VITE_ARCANA_API_URL=https://arcana-api.example.com
VITE_DYNAMIC_ENVIRONMENT_ID=<dynamic-environment-id>
```

Setup:

```typescript
import { createDynamicClient, getPrimaryWalletAccount } from '@dynamic-labs-sdk/client';
import { addEvmExtension } from '@dynamic-labs-sdk/evm';
import {
  addZerodevExtension,
  createKernelClientForWalletAccount,
  getSignerForSmartWalletAccount,
} from '@dynamic-labs-sdk/zerodev';
import {
  createDynamicZeroDevArcanaWalletAdapter,
  registerArcanaDeviceWithAdapter,
} from '@arcanahq/sdk-integrations/dynamic-zerodev';

const dynamicClient = createDynamicClient({
  environmentId: import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID,
});

addEvmExtension();
addZerodevExtension();

const smartWalletAccount = getPrimaryWalletAccount();
if (!smartWalletAccount) {
  throw new Error('No Dynamic smart wallet account is connected');
}

const signerWalletClient = await getSignerForSmartWalletAccount({
  smartWalletAccount,
});

const kernelClient = await createKernelClientForWalletAccount({
  walletAccount: smartWalletAccount,
});

const adapter = createDynamicZeroDevArcanaWalletAdapter({
  signerWalletClient,
  smartAccountAddress: kernelClient.account.address,
});

await registerArcanaDeviceWithAdapter(client, adapter, {
  deviceName: 'Dynamic + ZeroDev',
});
```

## Production Checklist

- Arcana server enables a verified auth provider, such as `server.auth.providers: [eip712]`.
- `ALLOW_DEV_AUTH` is unset or `false`.
- `ARCANA_ENV=production` is set for production deployments.
- `CHAIN_ID` matches the chain ID returned to the frontend for EIP-712 auth.
- `AUTH_CHAIN_IDS` includes every chain ID you intend to accept for auth.
- `VERIFYING_CONTRACT_ADDRESS` is stable and matches frontend signing.
- `ARCANA_TOKEN_PEPPER` is a real secret, not the dev default.
- Provider dashboard domains/callback URLs include your production origin.
- Dynamic ZeroDev is enabled in the Dynamic dashboard when using Dynamic + ZeroDev.
- ZeroDev gas sponsorship policies are configured before enabling sponsored UserOps.

## Troubleshooting

`Signature verification failed`

The Arcana server and frontend are not signing/verifying the same EIP-712 domain,
or the app passed the wrong signer. Check `CHAIN_ID`,
`VERIFYING_CONTRACT_ADDRESS`, and the wallet address returned by the adapter.

`Unsupported chain_id`

The frontend signed with a chain not included in `AUTH_CHAIN_IDS`. Add the chain
to `AUTH_CHAIN_IDS` or switch the wallet/provider to the expected auth chain.

`Kernel smart-account signatures are not accepted`

Pass the owner EOA or embedded wallet signer to Arcana auth. Use the Kernel
client only for onchain UserOps.

`Arcana device authentication is not enabled on this client`

Create the client in a browser context or pass `useDeviceAuth: true` plus
browser-compatible storage. Device auth is the required flow for these adapters.
