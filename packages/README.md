# Packages

This directory contains publishable npm packages for the Arcana ecosystem.

## Structure

| Package | Name | Language | Description |
|---------|------|----------|-------------|
| `core/` | `@arcanahq/core` | AssemblyScript | Core utility library for state machine development |
| `cardgames/` | `@arcanahq/cardgames` | AssemblyScript | Card game utilities (deck, blackjack, poker) |
| `sdk/` | `@arcanahq/sdk` | TypeScript | Frontend SDK for interacting with Arcana contracts |
| `sdk-integrations/` | `@arcanahq/sdk-integrations` | TypeScript | Optional Privy, Dynamic, and ZeroDev adapters for the frontend SDK |

## AssemblyScript Packages

### @arcanahq/core

Core framework providing:
- Decorators for entrypoints and state management
- Game primitives (transitions, turns, validation, auth)
- Precompiles (KV storage, time, U256 handling)
- Response and registry utilities

### @arcanahq/cardgames

Card games utility library providing:
- Deck management (shuffling, dealing, multi-deck shoes)
- Blackjack rules and action processing
- Poker game utilities (hand evaluation, pot management, betting rounds)
- Cash game utilities (buy-ins, rake calculation)

## TypeScript Package

### @arcanahq/sdk

Frontend SDK providing:
- Authentication (EIP-712 with viem)
- Contract execution and state viewing
- Transaction management
- Table management
- React Query hooks

### @arcanahq/sdk-integrations

Optional adapters for teams using embedded wallets or account abstraction:
- Privy wallet and Viem account adapters
- Dynamic wallet and Viem wallet-client adapters
- ZeroDev Kernel account-client adapter
- Composed subpath exports for Privy + ZeroDev and Dynamic + ZeroDev

## Usage

### In State Machine Contracts

```json
{
  "dependencies": {
    "@arcanahq/core": "file:../packages/core",
    "@arcanahq/cardgames": "file:../packages/cardgames"
  }
}
```

```typescript
import { action, view, constructor } from "@arcanahq/core/assembly/core/decorators";
import { ContractResponse } from "@arcanahq/core/assembly/core/response";
import { DeckConfig, dealCardByIndex } from "@arcanahq/cardgames/assembly/deck";
```

### In Frontend Applications

```json
{
  "dependencies": {
    "@arcanahq/sdk": "file:../packages/sdk"
  }
}
```

```typescript
import { ArcanaClient } from '@arcanahq/sdk';

const client = new ArcanaClient({
  apiUrl: 'http://localhost:3003',
  getToken: () => localStorage.getItem('auth_token'),
  setToken: (token) => localStorage.setItem('auth_token', token),
});
```

## Building & Testing

Run all package builds and tests:

```bash
./build.sh
```

Or build/test individually:

```bash
cd core && npm test
cd cardgames && npm test
cd sdk && npm test
```

## Documentation

- **Core Library**: See `core/docs/README.md`
- **Card Games Library**: See `cardgames/README.md`
- **SDK**: See `sdk/README.md`
