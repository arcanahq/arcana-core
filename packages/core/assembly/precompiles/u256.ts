// @ts-nocheck
/**
 * U256 precompiles (host-provided).
 *
 * Encoding:
 * - All U256 values are **32-byte big-endian** buffers.
 *
 * Semantics:
 * - add/sub/mul wrap modulo 2^256.
 * - div/mod return false if divisor is zero (and output is set to 0).
 * - cmp returns -1, 0, 1.
 */

// Host imports
@external("precompiles", "u256_add")
declare function __host_u256_add(aPtr: i32, bPtr: i32, outPtr: i32): i32;

@external("precompiles", "u256_sub")
declare function __host_u256_sub(aPtr: i32, bPtr: i32, outPtr: i32): i32;

@external("precompiles", "u256_mul")
declare function __host_u256_mul(aPtr: i32, bPtr: i32, outPtr: i32): i32;

@external("precompiles", "u256_div")
declare function __host_u256_div(aPtr: i32, bPtr: i32, outPtr: i32): i32;

@external("precompiles", "u256_mod")
declare function __host_u256_mod(aPtr: i32, bPtr: i32, outPtr: i32): i32;

@external("precompiles", "u256_cmp")
declare function __host_u256_cmp(aPtr: i32, bPtr: i32): i32;

function isLen32(buf: Uint8Array): bool {
  return buf.byteLength == 32;
}

/**
 * Add: out = (a + b) mod 2^256
 */
export function u256Add(a: Uint8Array, b: Uint8Array, out: Uint8Array): bool {
  if (!isLen32(a) || !isLen32(b) || !isLen32(out)) return false;
  return __host_u256_add(i32(a.dataStart), i32(b.dataStart), i32(out.dataStart)) != 0;
}

/**
 * Sub: out = (a - b) mod 2^256
 */
export function u256Sub(a: Uint8Array, b: Uint8Array, out: Uint8Array): bool {
  if (!isLen32(a) || !isLen32(b) || !isLen32(out)) return false;
  return __host_u256_sub(i32(a.dataStart), i32(b.dataStart), i32(out.dataStart)) != 0;
}

/**
 * Mul: out = (a * b) mod 2^256
 */
export function u256Mul(a: Uint8Array, b: Uint8Array, out: Uint8Array): bool {
  if (!isLen32(a) || !isLen32(b) || !isLen32(out)) return false;
  return __host_u256_mul(i32(a.dataStart), i32(b.dataStart), i32(out.dataStart)) != 0;
}

/**
 * Div: out = a / b, returns false if b == 0 (and out = 0)
 */
export function u256Div(a: Uint8Array, b: Uint8Array, out: Uint8Array): bool {
  if (!isLen32(a) || !isLen32(b) || !isLen32(out)) return false;
  return __host_u256_div(i32(a.dataStart), i32(b.dataStart), i32(out.dataStart)) != 0;
}

/**
 * Mod: out = a % b, returns false if b == 0 (and out = 0)
 */
export function u256Mod(a: Uint8Array, b: Uint8Array, out: Uint8Array): bool {
  if (!isLen32(a) || !isLen32(b) || !isLen32(out)) return false;
  return __host_u256_mod(i32(a.dataStart), i32(b.dataStart), i32(out.dataStart)) != 0;
}

/**
 * Compare: returns -1 if a < b, 0 if a == b, 1 if a > b.
 */
export function u256Cmp(a: Uint8Array, b: Uint8Array): i32 {
  if (!isLen32(a) || !isLen32(b)) return 0;
  return __host_u256_cmp(i32(a.dataStart), i32(b.dataStart));
}


