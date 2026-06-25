# @arcanahq/core

Core framework for writing **Arcana state-machine contracts** in
[AssemblyScript](https://www.assemblyscript.org/). It provides the runtime
primitives, decorators, and helpers that compile a program down to the
MessagePack-first WASM ABI the Arcana runtime expects.

- **Decorators** — `@constructor`, `@action`, `@view` for declaring entrypoints
- **State & views** — `ProgramState` / `ProgramStateView` base classes with
  MessagePack (de)serialization
- **Responses** — `ContractResponse`, `ViewResponse`, events, and effects
  (bank transfers, scoped storage, assertions, tables, …)
- **Primitives** — deterministic random (`RandomSeed`), `BigInt`, u256/amount
  conversions, Borsh/MessagePack codecs
- **Game helpers** — turn management, player auth, status transitions, timers

> Card-game utilities (deck, blackjack, poker) live in a separate package,
> [`@arcanahq/cardgames`](../cardgames), which builds on this one.

## Installation

This is an AssemblyScript **source** package — it ships `.ts` source that is
compiled by your program's `asc` build, not a prebuilt `.wasm`.

```json
{
  "dependencies": {
    "@arcanahq/core": "file:../packages/core"
  }
}
```

Once published to npm:

```bash
npm install @arcanahq/core
```

## Usage

A minimal program declares typed entrypoints with decorators and returns a
`ContractResponse`:

```typescript
import { ContractContext } from "@arcanahq/core/assembly/core/context";
import { action, view, constructor } from "@arcanahq/core/assembly/core/decorators";
import { ContractResponse, ViewResponse } from "@arcanahq/core/assembly/core/response";
import { CounterState } from "./types";
import { InitializeArgs, AmountArgs } from "./schema";

@constructor
export function initialize(
  context: ContractContext,
  args: InitializeArgs,
): ContractResponse<CounterState> {
  return ContractResponse.withState(new CounterState(args.initialValue));
}

@action
export function increment(
  context: ContractContext,
  state: CounterState,
  args: AmountArgs,
): ContractResponse<CounterState> {
  state.value += args.amount;
  return ContractResponse.withState(state);
}

@view
export function value(
  context: ContractContext,
  state: CounterState,
): ViewResponse<CounterStateView> {
  return ViewResponse.withView(CounterStateView.from(state));
}
```

The package root re-exports the full surface, so you can also import the
runtime helpers you need directly:

```typescript
import {
  ProgramState,
  ContractStatus,
  Environment,
  RandomSeed,
  getRandomIntInRange,
} from "@arcanahq/core/assembly/index";
```

## Subpath exports

| Import | Contents |
|--------|----------|
| `@arcanahq/core/assembly/index` | Everything (barrel export) |
| `@arcanahq/core/assembly/core/context` | `ContractContext` |
| `@arcanahq/core/assembly/core/decorators` | `@constructor`, `@action`, `@view`, … |
| `@arcanahq/core/assembly/core/response` | `ContractResponse`, `ViewResponse`, events, effects |
| `@arcanahq/core/assembly/core/state` | `ProgramState`, `ContractStatus`, `Environment` |
| `@arcanahq/core/assembly/core/views` | `ProgramStateView`, `ContractContextView` |
| `@arcanahq/core/assembly/primitives/random` | `RandomSeed`, `getRandomIntInRange`, … |
| `@arcanahq/core/assembly/primitives/result` | Event/effect builders |

## Building & testing

```bash
npm install
npm run build   # asc compile of assembly/index.ts
npm test        # AssemblyScript unit tests (as-test)
```

## Documentation

- [`docs/U256_HANDLING.md`](./docs/U256_HANDLING.md) — handling u256 amounts
  from on-chain contracts in AssemblyScript engines.

## License

[MIT](../../LICENSE)
