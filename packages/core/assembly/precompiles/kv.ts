// @ts-nocheck
/**
 * KV read precompiles (v2).
 *
 * Scope storage (default):
 *   kvGetBytes(key) / kvGetU256(key) — reads from scope's own KV (scopedata:{scope_id}:{key})
 *
 * Project base storage (shared across scopes):
 *   kvGetBaseBytes(key) / kvGetBaseU256(key) — reads from project base (projectdata:{project_id}:{key})
 *
 * - scope is implicit from contract.scope_id (WASM cannot choose scope)
 * - host enforces kv.read / kv.read.base policy + limits
 */
import { BigInt } from "../primitives/bigint";

// Host imports
@external("arcana", "kv_get")
declare function __host_kv_get(keyPtr: i32, keyLen: i32, outPtr: i32, outCap: i32): i32;

@external("arcana", "kv_get_base")
declare function __host_kv_get_base(keyPtr: i32, keyLen: i32, outPtr: i32, outCap: i32): i32;

// ============================================================================
// Scope storage reads (private to owning scope)
// ============================================================================

/**
 * Convenience: read a U256 value from scope KV.
 * Returns the decimal string or null.
 * Stored values must be canonical 32-byte big-endian U256.
 */
export function kvGetU256(key: string): string | null {
  const bytes = kvGetBytes(key);
  return bytes === null ? null : _u256BytesToDecimal(bytes);
}

// ============================================================================
// Project base storage reads (shared across all scopes in project)
// ============================================================================

/**
 * Convenience: read a U256 value from project base storage.
 * Returns the decimal string or null.
 * Stored values must be canonical 32-byte big-endian U256.
 */
export function kvGetBaseU256(key: string): string | null {
  const bytes = kvGetBaseBytes(key);
  return bytes === null ? null : _u256BytesToDecimal(bytes);
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Read raw bytes from scope KV (returned as bytes).
 *
 * Returns null if missing or disallowed by host policy.
 */
export function kvGetBytes(key: string): Uint8Array | null {
  return _kvGetBytes(__host_kv_get, key);
}

/**
 * Read raw bytes from project base storage (returned as bytes).
 *
 * Requires kv_read_base privilege for the key prefix.
 * Returns null if missing or disallowed by host policy.
 */
export function kvGetBaseBytes(key: string): Uint8Array | null {
  return _kvGetBytes(__host_kv_get_base, key);
}

/** Generic KV get using the specified host function. */
function _kvGetBytes(hostFn: (keyPtr: i32, keyLen: i32, outPtr: i32, outCap: i32) => i32, key: string): Uint8Array | null {
  const keyBuf = String.UTF8.encode(key, false);
  const keyBytes = Uint8Array.wrap(keyBuf);

  let out = new Uint8Array(4096);
  let n = hostFn(
    i32(keyBytes.dataStart),
    i32(keyBytes.byteLength),
    i32(out.dataStart),
    i32(out.byteLength)
  );
  if (n == 0) return null;
  if (n < 0) {
    const needed = -n;
    if (needed <= 0 || needed > 16384) return null;
    out = new Uint8Array(needed);
    n = hostFn(
      i32(keyBytes.dataStart),
      i32(keyBytes.byteLength),
      i32(out.dataStart),
      i32(out.byteLength)
    );
    if (n <= 0) return null;
  }
  return out.subarray(0, n);
}

function _bytesToString(bytes: Uint8Array): string {
  return String.UTF8.decodeUnsafe(bytes.dataStart as usize, bytes.byteLength as usize, true);
}

function _u256BytesToDecimal(bytes: Uint8Array): string | null {
  if (bytes.byteLength != 32) return null;
  let value = BigInt.fromUInt32(0);
  const base = BigInt.fromUInt32(256);
  for (let i = 0; i < bytes.byteLength; i++) {
    value = value.mul(base).add(BigInt.fromUInt32(bytes[i]));
  }
  return value.toString(10);
}
