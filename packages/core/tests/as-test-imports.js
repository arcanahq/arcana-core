import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FALLBACK_HEAP_BASE = 64 * 1024;
const HEAP_REGEX = /\(global \$~lib\/memory\/__heap_base i32 \(i32\.const (\d+)\)\)/;

function resolveHeapBase(contractDir, outputDir) {
  const watPath = join(contractDir, outputDir, "test.wat");
  if (existsSync(watPath)) {
    try {
      const contents = readFileSync(watPath, "utf8");
      const match = contents.match(HEAP_REGEX);
      if (match) {
        return Number(match[1]);
      }
    } catch {
      // fall through to fallback
    }
  }
  return FALLBACK_HEAP_BASE;
}

/**
 * Shared `as-test` imports for all contracts.
 *
 * Why:
 * - We need deterministic mocks for host imports (e.g. precompiles.now_ms) so unit tests are stable.
 * - We also need to provide wasm::__heap_base so the scratch allocator behaves correctly.
 *
 * @param {string} contractDir - absolute directory of the contract (usually `__dirname`)
 * @param {object} options
 * @param {string} [options.outputDir] - where as-test writes `test.wat` (default: ".as-test/output")
 * @param {bigint} [options.nowMs] - deterministic "current time" used by precompiles.now_ms
 * @param {number} [options.seed] - deterministic seed for env.seed
 */
export function createAsTestImports(contractDir, options = {}) {
  const outputDir = options.outputDir ? options.outputDir : ".as-test/output";
  const heapBase = resolveHeapBase(contractDir, outputDir);

  const nowMs = options.nowMs !== undefined ? options.nowMs : 1700000000000n;
  const seed = options.seed !== undefined ? options.seed : 12345.0;

  return {
    wasm: {
      __heap_base: new WebAssembly.Global({ value: "i32", mutable: false }, heapBase),
    },
    precompiles: {
      // WebAssembly i64 values must be returned as BigInt from JS.
      now_ms: () => nowMs,
      // U256 precompiles are exercised in Rust integration tests (real host).
      // For as-test (JS host), we provide no-op stubs so contracts can instantiate.
      // If a unit test needs these, add proper memory-aware mocks.
      u256_add: () => 0,
      u256_sub: () => 0,
      u256_mul: () => 0,
      u256_div: () => 0,
      u256_mod: () => 0,
      u256_cmp: () => 0,
    },
    arcana: {
      kv_get: () => 0,
    },
    env: {
      seed: () => seed,
    },
  };
}


