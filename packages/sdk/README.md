# Arcana Frontend SDK

A general-purpose TypeScript SDK for building frontends that interact with deployed Arcana contracts.

## Installation

```bash
npm install @arcanahq/sdk viem
```

**Note**: `viem` is a peer dependency and must be installed separately.

## Testing

See [TESTING.md](./TESTING.md) for detailed testing instructions, including how to run E2E tests with Docker.

## Quick Start

```typescript
import { ArcanaClient } from '@arcanahq/sdk';
import { createWalletClient, custom } from 'viem';

// Initialize client
const client = new ArcanaClient({
  apiUrl: 'http://localhost:3003',
  getToken: () => localStorage.getItem('auth_token'),
  setToken: (token) => localStorage.setItem('auth_token', token),
  // Optional: Custom headers for server-side API token auth
  // customHeaders: { 'x-api-token': 'your-token' },
});

// Authenticate with wallet
const walletClient = createWalletClient({
  transport: custom(window.ethereum),
});

const [account] = await walletClient.getAddresses();
await client.auth.signIn(walletClient, account);

// Call contract action
const result = await client.contracts.executeAction(
  'contract-id',
  'play',
  { move: 'rock' }
);

// Wait for transaction
await client.transactions.wait(result.transaction_id);

// Get contract view
const view = await client.contracts.view('contract-id');
```

## Authentication

The SDK supports two authentication methods:

### Device Authentication (Recommended for Web Apps)

Device auth provides the best user experience with minimal wallet prompts:

```typescript
import { ArcanaProvider, useArcana } from '@arcanahq/sdk';

// Wrap your app with the provider
<ArcanaProvider apiUrl="http://localhost:3003">
  <App />
</ArcanaProvider>

// In your components
function GameComponent() {
  const { isAuthenticated, userAddress, connect, client } = useArcana();
  
  if (!isAuthenticated) {
    return <button onClick={connect}>Connect Wallet</button>;
  }
  
  // Use client for API calls
  const view = await client.contracts.view('contract-id');
}
```

### Legacy Session Authentication

For simpler use cases or backend integrations:

```typescript
const client = new ArcanaClient({
  apiUrl: 'http://localhost:3003',
  getToken: () => localStorage.getItem('auth_token'),
  setToken: (token) => localStorage.setItem('auth_token', token),
});

// Sign in with wallet
const walletClient = createWalletClient({ transport: custom(window.ethereum) });
const [account] = await walletClient.getAddresses();
await client.auth.signIn(walletClient, account);
```

### How It Works

1. **Device Registration**: First-time users sign once to register their device
2. **Automatic Tokens**: SDK manages refresh tokens automatically
3. **Per-Request Signing**: Mutating requests are signed with the device key
4. **Wallet Prompts**: Only required for device registration or high-value actions

The SDK signs requests using EIP-712 typed data and an Ed25519 device key; see
the source in [`src/auth/`](./src/auth) for the full flow.

## Architecture

The SDK is organized into focused modules:

- **Auth**: EIP-712 authentication with viem
- **Contracts**: Execute actions, view state, get events
- **History**: Transaction history and events
- **Tables**: Game table management
- **Transactions**: Transaction status and waiting
- **Bank**: Balance management, withdrawals, transfers
- **Config**: Server configuration
- **Chain**: On-chain data queries

## API Reference

### ArcanaClient

Main client class that provides access to all modules.

```typescript
const client = new ArcanaClient({
  apiUrl?: string;           // Default: 'http://localhost:3003'
  getToken?: () => string | null;
  setToken?: (token: string) => void;
});
```

### Auth Module

#### `signIn(walletClient, address, chainId?, verifyingContract?)`

Sign in with wallet using EIP-712.

```typescript
const walletClient = createWalletClient({
  transport: custom(window.ethereum),
});
const [account] = await walletClient.getAddresses();

await client.auth.signIn(walletClient, account);
```

#### `signOut()`

Sign out and clear token.

```typescript
await client.auth.signOut();
```

#### `getUserInfo()`

Get current user information.

```typescript
const userInfo = await client.auth.getUserInfo();
```

#### `isAuthenticated()`

Check if user is authenticated.

```typescript
if (client.auth.isAuthenticated()) {
  // User is signed in
}
```

### Contracts Module

#### `executeAction(contractId, entrypoint, args, options?)`

Execute an action/entrypoint on a contract.

Low-level action args are encoded exactly by shape: arrays become positional
MessagePack arrays and objects become MessagePack maps. AssemblyScript args
classes generated with `decodeArgsArray` expect positional arrays, so call
`executeAction(instanceId, 'submit_guess', ['cider'])` for a single positional
field. Prefer the generated client from `arcana generate sdk` when you want to
pass named objects; those helpers convert named fields into the program's tuple
order.

**Note**: The response does not include `new_state`. If you need the updated state after an action, fetch it separately using `view()`:

```typescript
const result = await client.contracts.executeAction(
  'contract-id',
  'play',
  ['rock'],
  {
    idempotency_key: 'optional-idempotency-key',
  }
);

// Fetch updated state after action
const updatedState = await client.contracts.view('contract-id');
```

#### `view(contractId)`

Get personalized view of contract state (read-only).

**Note**: The lower-level `client.contracts.view()` / `client.programs.view()`
path returns the decoded MessagePack value exactly as the program emitted it.
View classes that encode positional MessagePack arrays therefore come back as
arrays unless that entrypoint has a built-in SDK normalizer. The generated
client from `arcana generate sdk` includes view-shape normalizers and is the
recommended path when you want named object fields. If you call the lower-level
SDK directly, normalize positional arrays in your app code using the view field
order from the program source.

The response structure may also vary by program. The state may be nested (e.g.,
`result.state` or directly in `result`). Handle both cases:

```typescript
const viewResult = await client.contracts.view('contract-id');
// Handle nested structure - try result.state first, then fallback to result
const state = viewResult?.state || viewResult || {};
```

#### `getState(contractId)`

Get raw contract state (no caller_id filtering).

```typescript
const state = await client.contracts.getState('contract-id');
```

#### `getEvents(contractId, options?)`

Get contract events.

```typescript
const events = await client.contracts.getEvents('contract-id', {
  limit: 50,
  offset: 0,
  event_type: 'GameStarted',
});
```

#### `getEventsPage(contractId, options?)`

Get cursor-paginated instance events.

```typescript
const page = await client.contracts.getEventsPage('contract-id', {
  page_size: 50,
  cursor: 'optional-cursor',
  event_type: 'GameStarted',
});
```

#### `events.queryPage(options?)`

Query event history across scopes, programs, or instances.

```typescript
const page = await client.events.queryPage({
  scope_id: 'my-game:app',
  program_type: 'coinflip',
  event_type: 'coinflip.resolved',
  page_size: 50,
});
```

### Subscriptions Module

The subscriptions module is available from `client.subscriptions` or from the
subpath export:

```typescript
import { SubscriptionsModule } from '@arcanahq/sdk/subscriptions';
```

#### `subscribeInstance(scopeId, instanceId, options)`

Subscribe to public spectator-safe state updates for one instance over SSE.

```typescript
const sub = client.subscriptions.subscribeInstance('my-scope', 'instance-id', {
  initialStateVersion: currentStateVersion,
  onView: (view, event) => {
    // `view` is the public/spectator view emitted by the server after commit.
    // Use it to update cache, then keep private/player-only state refreshed
    // through normal authenticated `view()` calls where needed.
  },
  refetch: () => client.contracts.view('instance-id'),
  onRefetch: (view) => {
    // Re-hydrate authoritative client cache after reconnects or missed events.
  },
});

// Later:
sub.close();
```

The SDK automatically reconnects with backoff, ignores duplicate/stale events
using `sequence` and `state_version`, and can run slow fallback polling through
`refetch` while disconnected.

##### Spectator-view contract

Pushed `view_json` payloads are rendered through the program's **public
subscription view** with `caller_id = "spectator"`. They never contain
hand-private or otherwise scoped data (hole cards, hidden ships, private
balances, etc.).

The subscription path renders the entrypoint named `view`. REST view handlers
also allow custom named view entrypoints, but pushed spectator updates do not
guess which custom view should be public. Use bare `@view` for the
spectator-safe default shape, and explicit names such as `@view("canvas")` for
additional projections.

For player-private state, fall back to authenticated REST views:

```typescript
const sub = client.subscriptions.subscribeInstance(scopeId, instanceId, {
  onView: (publicView) => updateSpectatorCache(publicView),
  refetch: async () => client.contracts.view(instanceId), // authenticated, full view
  onRefetch: (privateView) => updatePlayerCache(privateView),
});
```

A common pattern is: render off `onView` for shared state, then re-fetch the
player's private view via `refetch` after each event (or on a coarser cadence)
when private state actually matters.

##### Reliability features

- **`Last-Event-ID` replay.** Each event carries a per-topic monotonic
  `sequence`, sent in the SSE `id:` field. The SDK echoes the last id on every
  reconnect, and the server replays buffered events past that cursor before
  resuming the live stream. Buffer size defaults to 64 events per topic
  (override at the server with `ARCANA_SUBSCRIPTION_RING_CAPACITY`).

- **Resync sentinel.** If the server detects a lagged subscriber or a publish
  queue overflow, it emits an `event_type: "resync"` sentinel. The SDK
  intercepts it, fires `onStatusChange('resync')` and calls `refetch()` so the
  client re-hydrates from the authoritative view. Sentinels never reach
  `onEvent`/`onView`.

- **Keep-alive watchdog.** The server pings every 15s. The SDK aborts and
  reconnects if no chunk (event or ping) arrives within
  `keepAliveTimeoutMs` (default 45000ms).

- **Online + visibility wakeups.** When the browser fires `window.online` or
  the page becomes visible, the SDK skips the current backoff wait and
  reconnects immediately. Disable with `reconnectOnOnline: false` /
  `reconnectOnVisible: false`.

- **Auth refresh.** On 401/403, the SDK calls the configured `refreshTokens`
  hook and retries the connect. `ensureAccessToken` is also called at the top
  of every reconnect attempt so long-running streams pick up rotated tokens.

##### Server feature flags

The server reads two env vars at startup; both default to enabled.

- **`ARCANA_SUBSCRIPTIONS_ENABLED`** — global kill switch. When `false`,
  `/subscriptions` is not mounted (returns 404) and the publisher is not
  wired. Use to disable the feature without redeploying:
  `fly secrets set ARCANA_SUBSCRIPTIONS_ENABLED=false -a <app>`.
- **`ARCANA_SUBSCRIPTION_RESYNC_SENTINEL`** — compatibility switch. When
  `false`, lagged subscribers' streams end silently and publish-queue
  overflow no longer emits a resync sentinel. Set this if older SDK
  clients cannot interpret `event_type: "resync"` events.

Sizing knobs (also env vars):
`ARCANA_SUBSCRIPTION_RING_CAPACITY` (default 64),
`ARCANA_SUBSCRIPTION_BROADCAST_CAPACITY` (default 256).

##### Single-node assumption

The default `InMemoryBackend` is single-process. In a multi-node deployment
each node has its own ring buffer and broadcast channel, so a publisher on
node A is invisible to subscribers on node B. Multi-node fan-out requires a
Redis/NATS backend (the `SubscriptionBackend` trait is in place but no
distributed implementation ships yet).

#### `subscribeScope(scopeId, options)`

Subscribe to public spectator-safe updates for all instances in a scope.

```typescript
const sub = client.subscriptions.subscribeScope('my-scope', {
  onEvent: (event) => {
    console.log(event.instance_id, event.state_version, event.view_json);
  },
});
```

#### `create(contractType, args?, contractId?)`

Create a new contract instance.

```typescript
const contract = await client.contracts.create(
  'battleship',
  { min_players: 2 },
  'optional-contract-id'
);
```

#### `getUserContracts(userId?)`

Get user's contracts.

```typescript
const contracts = await client.contracts.getUserContracts();
```

### History Module

#### `listContracts()`

List contracts the user has history for.

```typescript
const contracts = await client.history.listContracts();
```

#### `getHistory(contractId, options?)`

Get transaction history for a contract.

```typescript
const history = await client.history.getHistory('contract-id', {
  limit: 50,
  cursor: 'optional-cursor',
});
```

#### `getEventHistory(contractId, options?)`

Get event history for a contract (events only).

```typescript
const events = await client.history.getEventHistory('contract-id', {
  limit: 50,
});
```

### Tables Module

#### `create(request)`

Create a new table.

```typescript
const table = await client.tables.create({
  game_type: 'battleship',
  table_mode: 'tournament',
  min_players: 2,
  max_players: 2,
});
```

#### `list(options?)`

List tables with optional filters.

```typescript
const tables = await client.tables.list({
  game_type: 'battleship',
  status: 'waiting',
  limit: 20,
});
```

#### `get(tableId)`

Get table by ID.

```typescript
const table = await client.tables.get('table-id');
```

#### `getByInvite(inviteCode, scopeId?)`

Get table by invite code.

```typescript
const table = await client.tables.getByInvite('ABC123');
```

#### `join(tableId, request?)`

Join a table.

```typescript
const table = await client.tables.join('table-id', {
  password: 'optional-password',
  seat_number: 1,
  buy_in_amount: '1000000000000000000',
});
```

### Transactions Module

#### `getStatus(transactionId)`

Get transaction status.

```typescript
const status = await client.transactions.getStatus('tx-id');
if (status) {
  console.log(status.status); // 'pending' | 'executing' | 'completed' | 'failed'
}
```

#### `wait(transactionId, options?)`

Wait for transaction to complete.

```typescript
const result = await client.transactions.wait('tx-id', {
  timeout: 30000,      // 30 seconds
  pollInterval: 100,   // 100ms
});
```

## Error Handling

The SDK provides custom error classes:

- `ArcanaApiError`: API errors (400, 401, 403, 500, etc.)
- `ArcanaNetworkError`: Network errors
- `ArcanaContractError`: Contract action errors

```typescript
import { ArcanaApiError, ArcanaContractError } from '@arcanahq/sdk';

try {
  await client.contracts.executeAction('contract-id', 'play', {});
} catch (error) {
  if (error instanceof ArcanaContractError) {
    console.error('Contract error:', error.message);
    console.error('Contract ID:', error.contractId);
    console.error('Entrypoint:', error.entrypoint);
  } else if (error instanceof ArcanaApiError) {
    console.error('API error:', error.status, error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## TypeScript Support

The SDK is fully typed with TypeScript. All modules export their types:

```typescript
import type {
  ContractInfo,
  ContractActionResponse,
  Table,
  TransactionResult,
} from '@arcanahq/sdk';
```

## Examples

### Complete Game Flow

```typescript
import { ArcanaClient } from '@arcanahq/sdk';
import { createWalletClient, custom } from 'viem';

const client = new ArcanaClient({
  apiUrl: 'http://localhost:3003',
  getToken: () => localStorage.getItem('auth_token'),
  setToken: (token) => localStorage.setItem('auth_token', token),
});

// 1. Authenticate
const walletClient = createWalletClient({
  transport: custom(window.ethereum),
});
const [account] = await walletClient.getAddresses();
await client.auth.signIn(walletClient, account);

// 2. Create or join a table
const table = await client.tables.create({
  game_type: 'battleship',
  table_mode: 'tournament',
  min_players: 2,
  max_players: 2,
});

// 3. Join the table
await client.tables.join(table.id);

// 4. Execute game actions
const result = await client.contracts.executeAction(
  table.contract_id!,
  'place_ship',
  { row: 0, column: 0, shipType: 'carrier', horizontal: true }
);

// 5. Wait for transaction
await client.transactions.wait(result.transaction_id!);

// 6. Get updated state
const view = await client.contracts.view(table.contract_id!);
```

### Polling for State Changes

```typescript
async function waitForGameStart(contractId: string) {
  while (true) {
    const view = await client.contracts.view(contractId);
    if (view.status === 'playing') {
      return view;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

### Error Handling

```typescript
try {
  const result = await client.contracts.executeAction(
    'contract-id',
    'play',
    { move: 'rock' }
  );
  
  if (result.error) {
    console.error('Action failed:', result.error);
    return;
  }
  
  console.log('Action succeeded:', result.new_state);
} catch (error) {
  if (error instanceof ArcanaContractError) {
    console.error('Contract error:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Differences from server/sdk

- **General-purpose**: Not game-specific, works with any Arcana contract
- **Frontend-focused**: Designed for client-side usage
- **Type-safe**: Full TypeScript support
- **Modular**: Clear separation of concerns
- **Helper utilities**: Transaction waiting, polling, batching

## License

MIT
