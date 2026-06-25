# arcana-core

Open-source core libraries for [Arcana](https://github.com/arcanahq) — a
general-purpose sidecar architecture that runs alongside a main chain, providing
fast off-chain execution for application state with on-chain custody and exits.

This repository is being open-sourced incrementally. It currently contains the
**client and contract libraries**; the Rust server and supporting services will
be added in later phases.

## Packages

| Package | Name | Language | Description |
|---------|------|----------|-------------|
| [`packages/sdk`](packages/sdk) | `@arcanahq/sdk` | TypeScript | Frontend SDK for interacting with Arcana contracts |
| [`packages/sdk-integrations`](packages/sdk-integrations) | `@arcanahq/sdk-integrations` | TypeScript | Optional Privy, Dynamic, and ZeroDev wallet adapters for the SDK |
| [`packages/core`](packages/core) | `@arcanahq/core` | AssemblyScript | Core framework for writing state-machine contracts |
| [`packages/cardgames`](packages/cardgames) | `@arcanahq/cardgames` | AssemblyScript | Card-game utilities (deck, blackjack, poker) built on `core` |

See [`packages/README.md`](packages/README.md) for details on each package.

## Getting started

Each package is self-contained and installs independently:

```bash
cd packages/sdk
npm install
npm test
```

To build and test every package at once:

```bash
cd packages
./build.sh
```

## Roadmap

- [x] TypeScript client SDK and wallet integrations
- [x] AssemblyScript contract framework and game libraries
- [ ] Rust server and runtime
- [ ] Smart contracts (EVM + Solana)
- [ ] Example apps and templates

## License

[MIT](LICENSE)
