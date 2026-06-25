# Arcana SDK Integrations

Optional wallet and account-abstraction integrations for `@arcanahq/sdk`.

The base SDK remains provider-agnostic. This package normalizes Privy, Dynamic,
and ZeroDev setup into Arcana's device-auth flow without making those providers
required dependencies of `@arcanahq/sdk`.

For environment variables, provider dashboard setup, and complete project setup,
see [SETUP.md](./SETUP.md).

## Install

```bash
npm install @arcanahq/sdk @arcanahq/sdk-integrations viem
```

Install only the provider packages your app uses.

Privy:

```bash
npm install @privy-io/react-auth
```

Dynamic JavaScript SDK:

```bash
npm install @dynamic-labs-sdk/client @dynamic-labs-sdk/evm
```

Dynamic React SDK:

```bash
npm install @dynamic-labs/sdk-react-core @dynamic-labs/ethereum
```

Dynamic + ZeroDev:

```bash
npm install @dynamic-labs-sdk/client @dynamic-labs-sdk/evm @dynamic-labs-sdk/zerodev
```

Local test auth:

```bash
npm install @arcanahq/sdk-integrations viem
```

ZeroDev:

```bash
npm install @zerodev/sdk @zerodev/ecdsa-validator
```

## How Arcana Auth Works With Account Abstraction

Arcana device registration currently verifies an EIP-712 ECDSA signature by
recovering the signer address and requiring it to match `user_address`.

That means Arcana auth must use the EOA or embedded signer that controls the
smart account. Do not pass a Kernel/smart-account client as the Arcana auth
signer. Use ZeroDev/Kernel for onchain account-abstraction transactions after
Arcana auth is complete.

The ZeroDev helpers in this package enforce that: they require
`ownerWalletClient` or `signerWalletClient` and keep the smart-account address
only as metadata for your app.

## Privy

Privy wallets expose an EIP-1193 provider through `wallet.getEthereumProvider()`.
This package can use that directly.

```typescript
import { ArcanaClient } from '@arcanahq/sdk';
import {
  createPrivyArcanaWalletAdapter,
  registerArcanaDeviceWithAdapter,
} from '@arcanahq/sdk-integrations/privy';

const client = new ArcanaClient({ apiUrl: 'http://localhost:3003' });
await client.init();

const adapter = await createPrivyArcanaWalletAdapter({
  wallet: privyWallet,
});

await registerArcanaDeviceWithAdapter(client, adapter, {
  deviceName: 'Privy wallet',
});
```

If you already converted a Privy wallet to a Viem account with Privy's
`toViemAccount`, pass it as `account`:

```typescript
const adapter = await createPrivyArcanaWalletAdapter({ account });
await registerArcanaDeviceWithAdapter(client, adapter);
```

## Dynamic

Dynamic's current JavaScript SDK exposes Viem wallet clients through
`createWalletClientForWalletAccount` from `@dynamic-labs-sdk/evm/viem`.

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

For Dynamic React projects using wallet objects that expose `getWalletClient()`
or `getEthereumProvider()`, you can pass the wallet directly:

```typescript
const session = await ensureArcanaSessionWithDynamic({
  client,
  wallet: primaryWallet,
  chainId: 57073,
  deviceName: 'Dynamic wallet',
});
```

Use `ensureArcanaSessionWithDynamic` from the sign-in button after Dynamic has a
connected wallet. It restores an existing Arcana device session for that wallet
or registers a new one. Keep action guards separate: submit actions only after
this helper returns a `userId`.

## Local Test Auth

Use the test adapter for local automation and agentic E2E runs where OTP or
hosted embedded-wallet flows would slow the loop down. It exposes the same
`ArcanaWalletAdapter` shape as Privy and Dynamic, but signs with a deterministic
local private key.

```typescript
import {
  createTestArcanaWalletAdapter,
  registerArcanaDeviceWithAdapter,
} from '@arcanahq/sdk-integrations/test';

const adapter = createTestArcanaWalletAdapter({
  chainId: 31337,
  privateKey: import.meta.env.VITE_ARCANA_TEST_PRIVATE_KEY,
});

await registerArcanaDeviceWithAdapter(client, adapter, {
  deviceName: 'Arcana test user',
});
```

The default private key is Anvil's first account. Only enable this in local or
test environments.

## Dynamic + ZeroDev

Dynamic's ZeroDev extension can return the EOA signer for a smart wallet account
with `getSignerForSmartWalletAccount`. Use that signer for Arcana auth, and use
the Kernel client for onchain UserOps.

```typescript
import { getPrimaryWalletAccount } from '@dynamic-labs-sdk/client';
import { createKernelClientForWalletAccount } from '@dynamic-labs-sdk/zerodev';
import {
  getSignerForSmartWalletAccount,
} from '@dynamic-labs-sdk/zerodev';
import {
  createDynamicZeroDevArcanaWalletAdapter,
  registerArcanaDeviceWithAdapter,
} from '@arcanahq/sdk-integrations/dynamic-zerodev';

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

const smartAccountAddress = adapter.getSmartAccountAddress();
```

## Privy + ZeroDev

Privy smart wallets are controlled by an embedded signer. Use the embedded
wallet signer for Arcana auth, then use your ZeroDev Kernel client for onchain
account-abstraction transactions.

```typescript
import {
  createPrivyArcanaWalletAdapter,
  registerArcanaDeviceWithAdapter,
} from '@arcanahq/sdk-integrations/privy';

const authAdapter = await createPrivyArcanaWalletAdapter({
  wallet: privyEmbeddedWallet,
});

await registerArcanaDeviceWithAdapter(client, authAdapter, {
  deviceName: 'Privy + ZeroDev',
});
```

If you build Kernel manually, pass the same owner signer you used for
`signerToEcdsaValidator` to Arcana:

```typescript
import {
  createPrivyZeroDevArcanaWalletAdapter,
  registerArcanaDeviceWithAdapter,
} from '@arcanahq/sdk-integrations/privy-zerodev';

const adapter = createPrivyZeroDevArcanaWalletAdapter({
  ownerWalletClient,
  smartAccountAddress: kernelClient.account.address,
});

await registerArcanaDeviceWithAdapter(client, adapter);
```

## ZeroDev

ZeroDev Kernel accounts are smart accounts owned by a signer. Use the signer for
Arcana auth:

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
```

## Failure Behavior

The adapters intentionally fail loudly when required integration pieces are
missing:

- invalid or missing EVM address
- missing `signTypedData`
- malformed `eth_accounts` or `eth_chainId` provider responses
- missing Arcana `deviceAuth`
- Kernel/smart-account client passed without an owner signer

There is no silent fallback from a smart account to an EOA signer. The app must
choose and pass the correct signer explicitly.
