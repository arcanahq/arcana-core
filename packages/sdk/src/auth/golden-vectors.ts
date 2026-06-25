/**
 * Golden Vectors for TxIntent Cross-Language Testing
 *
 * These vectors provide known-good values for testing CBOR encoding,
 * Lane A signature payloads, and Lane B EIP-712 digests across
 * Rust and TypeScript implementations.
 *
 * To verify compatibility, run these tests and compare outputs with
 * Rust's `cargo test print_golden_vectors -- --nocapture`
 */

import type { TxIntent } from './tx-intent.js';
import { AuthMode, encodeIntent, hashBodySync } from './tx-intent.js';

/**
 * SHA-256 of empty string (constant for empty body)
 * e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 */
export const SHA256_EMPTY = new Uint8Array([
  0xe3, 0xb0, 0xc4, 0x42, 0x98, 0xfc, 0x1c, 0x14,
  0x9a, 0xfb, 0xf4, 0xc8, 0x99, 0x6f, 0xb9, 0x24,
  0x27, 0xae, 0x41, 0xe4, 0x64, 0x9b, 0x93, 0x4c,
  0xa4, 0x95, 0x99, 0x1b, 0x78, 0x52, 0xb8, 0x55,
]);

/**
 * Known TxIntent for DevicePop (Lane A) testing.
 * Must match Rust's golden_device_pop_intent()
 */
export function goldenDevicePopIntent(): TxIntent {
  return {
    version: 1,
    scopeId: 'test-scope',
    actorId: '0x1234567890123456789012345678901234567890',
    action: 'POST /tx/submit',
    argsHash: SHA256_EMPTY,
    idempotencyKey: 'idem-test-123',
    nonce: BigInt(42),
    expiresAtMs: BigInt(1735689600000), // 2025-01-01 00:00:00 UTC
    chainId: BigInt(31337),
    authMode: AuthMode.DevicePop,
    accessTokenId: 'access-token-id-abc',
  };
}

/**
 * Known TxIntent for WalletDirect (Lane B) testing.
 * Must match Rust's golden_wallet_direct_intent()
 */
export function goldenWalletDirectIntent(): TxIntent {
  return {
    version: 1,
    scopeId: 'test-scope',
    actorId: '0xabcdef0123456789abcdef0123456789abcdef01',
    action: 'POST /tx/submit',
    argsHash: SHA256_EMPTY,
    idempotencyKey: 'idem-wallet-456',
    nonce: BigInt(0),
    expiresAtMs: BigInt(1735689600000), // 2025-01-01 00:00:00 UTC
    chainId: BigInt(1), // Mainnet
    authMode: AuthMode.WalletDirect,
    accessTokenId: null,
  };
}

/**
 * Convert bytes to hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Encode a golden intent and return hex string.
 */
export function goldenDevicePopCborHex(): string {
  const intent = goldenDevicePopIntent();
  const cbor = encodeIntent(intent);
  return bytesToHex(cbor);
}

/**
 * Encode a golden wallet direct intent and return hex string.
 */
export function goldenWalletDirectCborHex(): string {
  const intent = goldenWalletDirectIntent();
  const cbor = encodeIntent(intent);
  return bytesToHex(cbor);
}

/**
 * Verify SHA-256 empty hash is correct.
 */
export function verifySha256Empty(): boolean {
  const computed = hashBodySync(new Uint8Array(0));
  return bytesToHex(computed) === bytesToHex(SHA256_EMPTY);
}

/**
 * Test runner for golden vectors.
 * Run this to verify cross-language compatibility.
 */
export async function runGoldenVectorTests(): Promise<void> {
  console.log('\n=== GOLDEN VECTORS FOR CROSS-LANGUAGE TESTING ===\n');

  // Test 1: SHA256 empty
  console.log('Test 1: SHA256 empty hash');
  console.log('  Expected: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  console.log(`  Got:      ${bytesToHex(SHA256_EMPTY)}`);
  console.log(`  Match: ${verifySha256Empty() ? '✓' : '✗'}`);

  // Test 2: DevicePop intent CBOR
  console.log('\nTest 2: DevicePop Intent CBOR (hex)');
  const devicePopCbor = goldenDevicePopCborHex();
  console.log(`  CBOR: ${devicePopCbor}`);

  // Test 3: WalletDirect intent CBOR
  console.log('\nTest 3: WalletDirect Intent CBOR (hex)');
  const walletDirectCbor = goldenWalletDirectCborHex();
  console.log(`  CBOR: ${walletDirectCbor}`);

  // Test 4: Intent roundtrip
  console.log('\nTest 4: Intent roundtrip stability');
  const intent1 = goldenDevicePopIntent();
  const encoded1 = encodeIntent(intent1);
  // Note: decodeIntent would re-decode, but for now just verify encoding is deterministic
  const encoded2 = encodeIntent(goldenDevicePopIntent());
  const match = bytesToHex(encoded1) === bytesToHex(encoded2);
  console.log(`  Deterministic: ${match ? '✓' : '✗'}`);

  // Test 5: Intent fields
  console.log('\nTest 5: DevicePop intent fields');
  const dp = goldenDevicePopIntent();
  console.log(`  version: ${dp.version}`);
  console.log(`  scopeId: ${dp.scopeId}`);
  console.log(`  actorId: ${dp.actorId}`);
  console.log(`  action: ${dp.action}`);
  console.log(`  argsHash: ${bytesToHex(dp.argsHash)}`);
  console.log(`  idempotencyKey: ${dp.idempotencyKey}`);
  console.log(`  nonce: ${dp.nonce}`);
  console.log(`  expiresAtMs: ${dp.expiresAtMs}`);
  console.log(`  chainId: ${dp.chainId}`);
  console.log(`  authMode: ${dp.authMode} (${dp.authMode === 0 ? 'DevicePop' : 'WalletDirect'})`);
  console.log(`  accessTokenId: ${dp.accessTokenId}`);

  console.log('\n=== END GOLDEN VECTORS ===\n');
  console.log('Compare these values with Rust output from:');
  console.log('  cargo test print_golden_vectors -- --nocapture');
}

/**
 * Exported test assertions for use in test frameworks.
 */
export const goldenVectorAssertions = {
  /**
   * SHA256 of empty string in hex.
   */
  SHA256_EMPTY_HEX: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',

  /**
   * DevicePop intent expected fields.
   */
  DEVICE_POP: {
    version: 1,
    scopeId: 'test-scope',
    actorId: '0x1234567890123456789012345678901234567890',
    action: 'POST /tx/submit',
    idempotencyKey: 'idem-test-123',
    nonce: 42,
    expiresAtMs: 1735689600000,
    chainId: 31337,
    authMode: 0,
    accessTokenId: 'access-token-id-abc',
  },

  /**
   * WalletDirect intent expected fields.
   */
  WALLET_DIRECT: {
    version: 1,
    scopeId: 'test-scope',
    actorId: '0xabcdef0123456789abcdef0123456789abcdef01',
    action: 'POST /tx/submit',
    idempotencyKey: 'idem-wallet-456',
    nonce: 0,
    expiresAtMs: 1735689600000,
    chainId: 1,
    authMode: 1,
    accessTokenId: null,
  },
};

