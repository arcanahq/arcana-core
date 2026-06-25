// @ts-nocheck
/**
 * Time precompiles (host-provided functions).
 *
 * WARNING:
 * - These calls are **non-deterministic** unless the host fixes or mocks them.
 * - For deterministic gameplay logic/replay, prefer `ContractContext.nowMs`.
 */

// Host import: (module="precompiles", name="now_ms") -> i64
@external("precompiles", "now_ms")
declare function __host_now_ms(): i64;

/**
 * Returns the current UNIX time in milliseconds from the Rust host.
 */
export function nowMs(): i64 {
  return __host_now_ms();
}


