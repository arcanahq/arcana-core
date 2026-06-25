/**
 * TxIntent Tests
 *
 * Tests for CBOR encoding, intent validation, and cross-language compatibility.
 */

import { describe, it, expect } from 'vitest';
import {
  TxIntent,
  AuthMode,
  encodeIntent,
  decodeIntent,
  validateIntent,
  hashBodySync,
  createDevicePopIntent,
  createWalletDirectIntent,
  buildEip712TypedData,
  computeLaneAPayload,
  INTENT_VERSION,
  MAX_FUTURE_MS,
  MAX_PAST_MS,
} from '../tx-intent.js';
import {
  goldenDevicePopIntent,
  goldenWalletDirectIntent,
  SHA256_EMPTY,
  bytesToHex,
  goldenVectorAssertions,
} from '../golden-vectors.js';

// ============================================================================
// A. CBOR / Intent Canonicalization Tests
// ============================================================================

describe('CBOR Encoding', () => {
  it('A1: roundtrip stability - encode → decode → encode produces identical bytes', () => {
    const intent = goldenDevicePopIntent();
    const encoded1 = encodeIntent(intent);
    const decoded = decodeIntent(encoded1);
    const encoded2 = encodeIntent(decoded);

    expect(bytesToHex(encoded1)).toBe(bytesToHex(encoded2));
  });

  it('A1: wallet direct roundtrip stability', () => {
    const intent = goldenWalletDirectIntent();
    const encoded1 = encodeIntent(intent);
    const decoded = decodeIntent(encoded1);
    const encoded2 = encodeIntent(decoded);

    expect(bytesToHex(encoded1)).toBe(bytesToHex(encoded2));
  });

  it('A2: unsupported version should fail decode', () => {
    const intent = goldenDevicePopIntent();
    // Create a new intent with invalid version
    const badIntent: TxIntent = {
      ...intent,
      version: 99, // Bad version
    };
    const encoded = encodeIntent(badIntent);

    expect(() => decodeIntent(encoded)).toThrow('Unsupported intent version: 99');
  });

  it('A2: invalid CBOR should fail decode', () => {
    const garbage = new Uint8Array([0x00, 0x01, 0x02]);
    expect(() => decodeIntent(garbage)).toThrow();
  });
});

// ============================================================================
// B. Lane A (DevicePoP) Tests
// ============================================================================

describe('Lane A (DevicePop)', () => {
  it('B1: DevicePop intent has correct auth_mode', () => {
    const intent = goldenDevicePopIntent();
    expect(intent.authMode).toBe(AuthMode.DevicePop);
  });

  it('B2: DevicePop intent requires access_token_id', () => {
    const intent = goldenDevicePopIntent();
    expect(intent.accessTokenId).toBe('access-token-id-abc');
  });

  it('B3: Lane A payload is deterministic', async () => {
    const intent = goldenDevicePopIntent();
    const payload1 = await computeLaneAPayload(intent);
    const payload2 = await computeLaneAPayload(intent);

    expect(payload1.length).toBe(32);
    expect(bytesToHex(payload1)).toBe(bytesToHex(payload2));
  });

  it('B4: Different intent produces different payload', async () => {
    const intent1 = goldenDevicePopIntent();
    const intent2 = { ...goldenDevicePopIntent(), nonce: BigInt(999) };

    const payload1 = await computeLaneAPayload(intent1);
    const payload2 = await computeLaneAPayload(intent2);

    expect(bytesToHex(payload1)).not.toBe(bytesToHex(payload2));
  });
});

// ============================================================================
// C. Lane B (WalletDirect) EIP-712 Tests
// ============================================================================

describe('Lane B (WalletDirect)', () => {
  it('C1: WalletDirect intent has correct auth_mode', () => {
    const intent = goldenWalletDirectIntent();
    expect(intent.authMode).toBe(AuthMode.WalletDirect);
  });

  it('C2: WalletDirect intent has null access_token_id', () => {
    const intent = goldenWalletDirectIntent();
    expect(intent.accessTokenId).toBeNull();
  });

  it('C3: Actor ID is lowercased', async () => {
    const intent = await createWalletDirectIntent({
      scopeId: 'scope',
      actorId: '0xABCDEF0123456789ABCDEF0123456789ABCDEF01',
      action: 'POST /tx',
      bodyBytes: new Uint8Array(0),
      idempotencyKey: 'test',
      nonce: BigInt(0),
      chainId: BigInt(1),
    });

    expect(intent.actorId).toBe('0xabcdef0123456789abcdef0123456789abcdef01');
  });

  it('C4: Different scope_id produces different salt', () => {
    const intent1 = goldenWalletDirectIntent();
    const intent2 = { ...goldenWalletDirectIntent(), scopeId: 'different-scope' };

    const typedData1 = buildEip712TypedData(intent1, 'arcana:local:dev');
    const typedData2 = buildEip712TypedData(intent2, 'arcana:local:dev');

    expect(typedData1.domain.salt).not.toBe(typedData2.domain.salt);
  });

  it('C5: Different executor_id produces different salt', () => {
    const intent = goldenWalletDirectIntent();

    const typedData1 = buildEip712TypedData(intent, 'arcana:local:dev');
    const typedData2 = buildEip712TypedData(intent, 'arcana:prod:001');

    expect(typedData1.domain.salt).not.toBe(typedData2.domain.salt);
  });

  it('C6: EIP-712 typed data has correct structure', () => {
    const intent = goldenWalletDirectIntent();
    const typedData = buildEip712TypedData(intent, 'arcana:local:dev');

    expect(typedData.domain.name).toBe('Arcana TxIntent');
    expect(typedData.domain.version).toBe('1');
    expect(typedData.domain.chainId).toBe(BigInt(1));
    expect(typedData.domain.verifyingContract).toBe('0x0000000000000000000000000000000000000000');
    expect(typedData.primaryType).toBe('TxIntent');
    expect(typedData.types.TxIntent.length).toBe(11);
  });
});

// ============================================================================
// D. Expiry / Skew Window Tests
// ============================================================================

describe('Expiry Validation', () => {
  it('D1: expired intent should fail validation', () => {
    const intent = {
      ...goldenDevicePopIntent(),
      expiresAtMs: BigInt(Date.now() - 31000), // 31 seconds ago
    };

    expect(() => validateIntent(intent)).toThrow('expired');
  });

  it('D2: intent too far in future should fail', () => {
    const intent = {
      ...goldenDevicePopIntent(),
      expiresAtMs: BigInt(Date.now() + 61000), // 61 seconds in future
    };

    expect(() => validateIntent(intent)).toThrow('future');
  });

  it('D3: intent within skew window should pass', () => {
    const intent = {
      ...goldenDevicePopIntent(),
      expiresAtMs: BigInt(Date.now() + 30000), // 30 seconds in future
    };

    expect(() => validateIntent(intent)).not.toThrow();
  });

  it('D4: intent slightly in past should pass (within skew)', () => {
    const intent = {
      ...goldenDevicePopIntent(),
      expiresAtMs: BigInt(Date.now() - 10000), // 10 seconds ago
    };

    expect(() => validateIntent(intent)).not.toThrow();
  });
});

// ============================================================================
// E. Validation Tests
// ============================================================================

describe('Intent Validation', () => {
  it('E1: invalid actor_id format should fail', () => {
    const intent = {
      ...goldenDevicePopIntent(),
      actorId: 'bad-address',
      expiresAtMs: BigInt(Date.now() + 30000),
    };

    expect(() => validateIntent(intent)).toThrow('actor_id');
  });

  it('E2: DevicePop without access_token_id should fail', () => {
    const intent = {
      ...goldenDevicePopIntent(),
      accessTokenId: null,
      expiresAtMs: BigInt(Date.now() + 30000),
    };

    expect(() => validateIntent(intent)).toThrow('access_token_id');
  });

  it('E3: WalletDirect with access_token_id should fail', () => {
    const intent = {
      ...goldenWalletDirectIntent(),
      accessTokenId: 'should-not-be-here',
      expiresAtMs: BigInt(Date.now() + 30000),
    };

    expect(() => validateIntent(intent)).toThrow('access_token_id');
  });

  it('E4: unsupported version should fail', () => {
    const intent = {
      ...goldenDevicePopIntent(),
      version: 99,
      expiresAtMs: BigInt(Date.now() + 30000),
    };

    expect(() => validateIntent(intent)).toThrow('version');
  });
});

// ============================================================================
// F. Golden Vector Assertions
// ============================================================================

describe('Golden Vectors', () => {
  it('F1: SHA256 empty hash matches expected', () => {
    expect(bytesToHex(SHA256_EMPTY)).toBe(goldenVectorAssertions.SHA256_EMPTY_HEX);
  });

  it('F2: hashBodySync returns correct empty hash', () => {
    const hash = hashBodySync(new Uint8Array(0));
    expect(bytesToHex(hash)).toBe(goldenVectorAssertions.SHA256_EMPTY_HEX);
  });

  it('F3: DevicePop intent fields match expected', () => {
    const intent = goldenDevicePopIntent();
    const expected = goldenVectorAssertions.DEVICE_POP;

    expect(intent.version).toBe(expected.version);
    expect(intent.scopeId).toBe(expected.scopeId);
    expect(intent.actorId).toBe(expected.actorId);
    expect(intent.action).toBe(expected.action);
    expect(intent.idempotencyKey).toBe(expected.idempotencyKey);
    expect(Number(intent.nonce)).toBe(expected.nonce);
    expect(Number(intent.expiresAtMs)).toBe(expected.expiresAtMs);
    expect(Number(intent.chainId)).toBe(expected.chainId);
    expect(intent.authMode).toBe(expected.authMode);
    expect(intent.accessTokenId).toBe(expected.accessTokenId);
  });

  it('F4: WalletDirect intent fields match expected', () => {
    const intent = goldenWalletDirectIntent();
    const expected = goldenVectorAssertions.WALLET_DIRECT;

    expect(intent.version).toBe(expected.version);
    expect(intent.scopeId).toBe(expected.scopeId);
    expect(intent.actorId).toBe(expected.actorId);
    expect(intent.action).toBe(expected.action);
    expect(intent.idempotencyKey).toBe(expected.idempotencyKey);
    expect(Number(intent.nonce)).toBe(expected.nonce);
    expect(Number(intent.expiresAtMs)).toBe(expected.expiresAtMs);
    expect(Number(intent.chainId)).toBe(expected.chainId);
    expect(intent.authMode).toBe(expected.authMode);
    expect(intent.accessTokenId).toBe(expected.accessTokenId);
  });

  it('F5: Encoding is deterministic across calls', () => {
    const cbor1 = encodeIntent(goldenDevicePopIntent());
    const cbor2 = encodeIntent(goldenDevicePopIntent());
    expect(bytesToHex(cbor1)).toBe(bytesToHex(cbor2));
  });
});

// ============================================================================
// G. Intent Creation Helpers
// ============================================================================

describe('Intent Creation', () => {
  it('G1: createDevicePopIntent sets correct defaults', async () => {
    const intent = await createDevicePopIntent({
      scopeId: 'test',
      actorId: '0x1234567890123456789012345678901234567890',
      action: 'POST /test',
      bodyBytes: new Uint8Array(0),
      idempotencyKey: 'idem',
      nonce: BigInt(0),
      chainId: BigInt(31337),
      accessTokenId: 'token-id',
    });

    expect(intent.version).toBe(INTENT_VERSION);
    expect(intent.authMode).toBe(AuthMode.DevicePop);
    expect(intent.accessTokenId).toBe('token-id');
    expect(intent.argsHash.length).toBe(32);
    expect(Number(intent.expiresAtMs)).toBeGreaterThan(Date.now());
  });

  it('G2: createWalletDirectIntent sets correct defaults', async () => {
    const intent = await createWalletDirectIntent({
      scopeId: 'test',
      actorId: '0x1234567890123456789012345678901234567890',
      action: 'POST /test',
      bodyBytes: new Uint8Array([1, 2, 3]),
      idempotencyKey: 'idem',
      nonce: BigInt(0),
      chainId: BigInt(1),
    });

    expect(intent.version).toBe(INTENT_VERSION);
    expect(intent.authMode).toBe(AuthMode.WalletDirect);
    expect(intent.accessTokenId).toBeNull();
    expect(intent.argsHash.length).toBe(32);
    expect(Number(intent.expiresAtMs)).toBeGreaterThan(Date.now());
  });

  it('G3: actorId is lowercased on creation', async () => {
    const intent = await createDevicePopIntent({
      scopeId: 'test',
      actorId: '0xABCD1234ABCD1234ABCD1234ABCD1234ABCD1234',
      action: 'POST /test',
      bodyBytes: new Uint8Array(0),
      idempotencyKey: 'idem',
      nonce: BigInt(0),
      chainId: BigInt(1),
      accessTokenId: 'token',
    });

    expect(intent.actorId).toBe('0xabcd1234abcd1234abcd1234abcd1234abcd1234');
  });
});
