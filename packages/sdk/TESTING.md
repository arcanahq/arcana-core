# Testing the Arcana SDK

This document explains how to run the SDK's test suite.

## Test Structure

The SDK is covered by **unit tests** (`src/**/__tests__/*.test.ts`) that exercise
individual modules with mocked transport. They run fully offline — no server,
chain, or network access required.

> End-to-end tests that run against a live Arcana server will be added back
> alongside the server itself in a later phase of this repository.

## Running Tests

### Install dependencies

```bash
npm install
```

`viem` and `@tanstack/react-query` are peer dependencies; install them in the
consuming app (they are already present here as devDependencies for the tests).

### Run the unit tests

```bash
npm test            # vitest run
npm run test:watch  # watch mode
npm run test:coverage
```

## Test Coverage

Current unit coverage includes:

- ✅ Client initialization and configuration
- ✅ Auth module (sign in, sign out, device keys, user info)
- ✅ Contracts module (actions, views, state, events)
- ✅ Subscriptions (HTTP + WebSocket transport)
- ✅ Chain / config helpers

Areas that could use more tests:

- History module
- Tables module
- Transactions module
- Error-handling edge cases
- Token-refresh scenarios

## Troubleshooting

### Tests fail with "Cannot find module 'viem'"

Install peer dependencies:

```bash
npm install viem @tanstack/react-query
```

### Type errors in tests

Make sure TypeScript can find type definitions:

```bash
npm install --save-dev @types/node
```
