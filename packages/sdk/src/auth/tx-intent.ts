/**
 * TxIntent - Canonical request envelope for authenticated mutations.
 *
 * TxIntent is the single source of truth for all mutating requests.
 * It supports two authentication lanes:
 * - Lane A (DevicePop): Ed25519 device key signature over CBOR bytes
 * - Lane B (WalletDirect): EIP-712 wallet signature over typed data
 *
 * The CBOR encoding uses a fixed-order array (not map) to ensure determinism
 * across all implementations.
 */

import { Encoder, decode } from 'cbor-x';
import { keccak256, encodePacked, Address, toBytes, Hex, hashMessage } from 'viem';

// Configure cbor-x encoder for deterministic output matching Rust's ciborium
// - useRecords: false = don't use cbor-x's custom record format
// - tagUint8Array: false = don't add tag 64 to byte arrays
// - mapsAsObjects: false = use Map instead of Object
const cborEncoder = new Encoder({
  useRecords: false,
  tagUint8Array: false,
  mapsAsObjects: false,
});

/**
 * Authentication mode for the transaction intent.
 */
export enum AuthMode {
  /** Lane A: Device key proof-of-possession (Ed25519 signature) */
  DevicePop = 0,
  /** Lane B: Direct wallet signature (EIP-712) */
  WalletDirect = 1,
}

/**
 * TxIntent - the canonical request envelope.
 */
export interface TxIntent {
  /** Schema version (currently 1) */
  version: number;
  /** Scope ID for domain separation */
  scopeId: string;
  /** Actor ID - wallet address "0x..." (lowercased) */
  actorId: string;
  /** Action - "METHOD /path" (e.g., "POST /tx/submit") */
  action: string;
  /** SHA-256 hash of request body bytes */
  argsHash: Uint8Array;
  /** Idempotency key for exactly-once semantics */
  idempotencyKey: string;
  /** Nonce for replay protection (strict monotonic) */
  nonce: bigint;
  /** Expiry timestamp in milliseconds */
  expiresAtMs: bigint;
  /** Chain ID for cross-chain separation */
  chainId: bigint;
  /** Authentication mode (DevicePop or WalletDirect) */
  authMode: AuthMode;
  /** Access token ID (required for DevicePop, null for WalletDirect) */
  accessTokenId: string | null;
}

/**
 * Constants
 */
export const INTENT_VERSION = 1;
export const LANE_A_SIG_PREFIX = new TextEncoder().encode('Arcana-Intent-v1');
export const MAX_FUTURE_MS = 60_000;
export const MAX_PAST_MS = 30_000;
export const RECOMMENDED_TTL_MS = 30_000;

/**
 * Create a new TxIntent for DevicePop (Lane A).
 */
export async function createDevicePopIntent(options: {
  scopeId: string;
  actorId: string;
  action: string;
  bodyBytes: Uint8Array;
  idempotencyKey: string;
  nonce: bigint;
  chainId: bigint;
  accessTokenId: string;
}): Promise<TxIntent> {
  const nowMs = BigInt(Date.now());
  const argsHash = await hashBody(options.bodyBytes);
  return {
    version: INTENT_VERSION,
    scopeId: options.scopeId,
    actorId: options.actorId.toLowerCase(),
    action: options.action,
    argsHash,
    idempotencyKey: options.idempotencyKey,
    nonce: options.nonce,
    expiresAtMs: nowMs + BigInt(RECOMMENDED_TTL_MS),
    chainId: options.chainId,
    authMode: AuthMode.DevicePop,
    accessTokenId: options.accessTokenId,
  };
}

/**
 * Create a new TxIntent for WalletDirect (Lane B).
 */
export async function createWalletDirectIntent(options: {
  scopeId: string;
  actorId: string;
  action: string;
  bodyBytes: Uint8Array;
  idempotencyKey: string;
  nonce: bigint;
  chainId: bigint;
}): Promise<TxIntent> {
  const nowMs = BigInt(Date.now());
  const argsHash = await hashBody(options.bodyBytes);
  return {
    version: INTENT_VERSION,
    scopeId: options.scopeId,
    actorId: options.actorId.toLowerCase(),
    action: options.action,
    argsHash,
    idempotencyKey: options.idempotencyKey,
    nonce: options.nonce,
    expiresAtMs: nowMs + BigInt(RECOMMENDED_TTL_MS),
    chainId: options.chainId,
    authMode: AuthMode.WalletDirect,
    accessTokenId: null,
  };
}

/**
 * Encode a TxIntent to CBOR bytes.
 *
 * CBOR array layout (v1):
 * [0] version: u8
 * [1] scope_id: text
 * [2] actor_id: text
 * [3] action: text
 * [4] args_hash: bytes(32)
 * [5] idempotency_key: text
 * [6] nonce: u64
 * [7] expires_at_ms: u64
 * [8] chain_id: u64
 * [9] auth_mode: u8
 * [10] access_token_id: text | null
 *
 * Note: Uses minimal integer encoding to match Rust's ciborium.
 * Bigints that fit in Number are converted to ensure compact encoding.
 */
export function encodeIntent(intent: TxIntent): Uint8Array {
  // Convert bigints to numbers ONLY when they fit in uint32, for compact CBOR encoding.
  // Rust's ciborium uses minimal encoding, but cbor-x encodes large Numbers as floats.
  // Values > 2^32 must stay as BigInt to get integer encoding.
  const toCompact = (v: bigint): number | bigint => {
    // Keep as BigInt if > 32-bit (cbor-x encodes large Numbers as floats)
    if (v > BigInt(0xFFFFFFFF)) {
      return v;
    }
    // Small enough to be a Number with proper integer encoding
    return Number(v);
  };

  const arr = [
    intent.version,
    intent.scopeId,
    intent.actorId,
    intent.action,
    intent.argsHash,
    intent.idempotencyKey,
    toCompact(intent.nonce),
    toCompact(intent.expiresAtMs),
    toCompact(intent.chainId),
    intent.authMode,
    intent.accessTokenId,
  ];
  return cborEncoder.encode(arr);
}

/**
 * Decode a TxIntent from CBOR bytes.
 */
export function decodeIntent(cborBytes: Uint8Array): TxIntent {
  let arr: unknown[];
  try {
    arr = decode(cborBytes) as unknown[];
  } catch (error: any) {
    throw new Error(`Invalid intent CBOR: ${error.message || 'decode failed'}`);
  }
  
  if (!Array.isArray(arr) || arr.length < 11) {
    throw new Error('Invalid intent CBOR: expected array of 11 elements');
  }
  
  const version = arr[0] as number;
  if (version !== 1) {
    throw new Error(`Unsupported intent version: ${version}`);
  }
  
  const argsHash = arr[4] as Uint8Array;
  if (argsHash.length !== 32) {
    throw new Error('Invalid args_hash: must be 32 bytes');
  }
  
  return {
    version,
    scopeId: arr[1] as string,
    actorId: (arr[2] as string).toLowerCase(),
    action: arr[3] as string,
    argsHash,
    idempotencyKey: arr[5] as string,
    nonce: BigInt(arr[6] as number | bigint),
    expiresAtMs: BigInt(arr[7] as number | bigint),
    chainId: BigInt(arr[8] as number | bigint),
    authMode: arr[9] as AuthMode,
    accessTokenId: arr[10] as string | null,
  };
}

/**
 * Compute SHA-256 hash of body bytes.
 */
export async function hashBody(bodyBytes: Uint8Array): Promise<Uint8Array> {
  // Use Web Crypto API - convert to plain ArrayBuffer
  const buffer = new ArrayBuffer(bodyBytes.length);
  new Uint8Array(buffer).set(bodyBytes);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return new Uint8Array(hashBuffer);
}

/**
 * Synchronous version that returns empty hash for empty body.
 */
export function hashBodySync(bodyBytes: Uint8Array): Uint8Array {
  // For empty body, return SHA-256 of empty string
  // This is a well-known constant
  if (bodyBytes.length === 0) {
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    return new Uint8Array([
      0xe3, 0xb0, 0xc4, 0x42, 0x98, 0xfc, 0x1c, 0x14,
      0x9a, 0xfb, 0xf4, 0xc8, 0x99, 0x6f, 0xb9, 0x24,
      0x27, 0xae, 0x41, 0xe4, 0x64, 0x9b, 0x93, 0x4c,
      0xa4, 0x95, 0x99, 0x1b, 0x78, 0x52, 0xb8, 0x55,
    ]);
  }
  // For non-empty, we need async - this will throw if used wrong
  throw new Error('hashBodySync only works for empty body; use hashBody for non-empty');
}

/**
 * Compute the Lane A signature payload.
 *
 * sig_payload = SHA256("Arcana-Intent-v1" || cbor_bytes)
 */
export async function computeLaneAPayload(intent: TxIntent): Promise<Uint8Array> {
  const cborBytes = encodeIntent(intent);
  const combined = new Uint8Array(LANE_A_SIG_PREFIX.length + cborBytes.length);
  combined.set(LANE_A_SIG_PREFIX, 0);
  combined.set(cborBytes, LANE_A_SIG_PREFIX.length);
  // Convert to plain ArrayBuffer for crypto.subtle.digest
  const buffer = new ArrayBuffer(combined.length);
  new Uint8Array(buffer).set(combined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return new Uint8Array(hashBuffer);
}

/**
 * Validate basic intent properties.
 */
export function validateIntent(intent: TxIntent): void {
  // Check version
  if (intent.version !== INTENT_VERSION) {
    throw new Error(`Unsupported intent version: ${intent.version}`);
  }
  
  // Check expiry window
  const now = BigInt(Date.now());
  if (intent.expiresAtMs < now - BigInt(MAX_PAST_MS)) {
    throw new Error('Intent expired');
  }
  if (intent.expiresAtMs > now + BigInt(MAX_FUTURE_MS)) {
    throw new Error('Intent expires too far in future');
  }
  
  // Check actor_id format
  if (!intent.actorId.startsWith('0x') || intent.actorId.length !== 42) {
    throw new Error('Invalid actor_id format');
  }
  
  // Check access_token_id requirement
  if (intent.authMode === AuthMode.DevicePop && !intent.accessTokenId) {
    throw new Error('access_token_id required for DevicePop');
  }
  if (intent.authMode === AuthMode.WalletDirect && intent.accessTokenId) {
    throw new Error('access_token_id must be null for WalletDirect');
  }
}

/**
 * EIP-712 typed data for TxIntent.
 */
export interface TxIntentTypedData {
  domain: {
    name: string;
    version: string;
    chainId: bigint;
    verifyingContract: Address;
    salt: Hex;
  };
  types: {
    TxIntent: Array<{ name: string; type: string }>;
  };
  primaryType: 'TxIntent';
  message: {
    version: number;
    scopeHash: Hex;
    actor: Address;
    actionHash: Hex;
    argsHash: Hex;
    idempotencyKeyHash: Hex;
    nonce: bigint;
    expiresAtMs: bigint;
    chainId: bigint;
    authMode: number;
    accessTokenIdHash: Hex;
  };
}

/**
 * Build EIP-712 typed data for WalletDirect signing.
 */
export function buildEip712TypedData(
  intent: TxIntent,
  executorId: string
): TxIntentTypedData {
  // Compute salt: keccak256("arcana:" || executor_id || "|" || scope_id)
  const saltInput = `arcana:${executorId}|${intent.scopeId}`;
  const salt = keccak256(new TextEncoder().encode(saltInput)) as Hex;
  
  // Compute hashes
  const scopeHash = keccak256(new TextEncoder().encode(intent.scopeId)) as Hex;
  const actionHash = keccak256(new TextEncoder().encode(intent.action)) as Hex;
  const idempotencyKeyHash = keccak256(new TextEncoder().encode(intent.idempotencyKey)) as Hex;
  const accessTokenIdHash = intent.accessTokenId
    ? (keccak256(new TextEncoder().encode(intent.accessTokenId)) as Hex)
    : ('0x0000000000000000000000000000000000000000000000000000000000000000' as Hex);
  
  // Convert argsHash to hex
  const argsHashHex = ('0x' + Array.from(intent.argsHash)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')) as Hex;
  
  return {
    domain: {
      name: 'Arcana TxIntent',
      version: '1',
      chainId: intent.chainId,
      verifyingContract: '0x0000000000000000000000000000000000000000' as Address,
      salt,
    },
    types: {
      TxIntent: [
        { name: 'version', type: 'uint8' },
        { name: 'scopeHash', type: 'bytes32' },
        { name: 'actor', type: 'address' },
        { name: 'actionHash', type: 'bytes32' },
        { name: 'argsHash', type: 'bytes32' },
        { name: 'idempotencyKeyHash', type: 'bytes32' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiresAtMs', type: 'uint256' },
        { name: 'chainId', type: 'uint256' },
        { name: 'authMode', type: 'uint8' },
        { name: 'accessTokenIdHash', type: 'bytes32' },
      ],
    },
    primaryType: 'TxIntent',
    message: {
      version: intent.version,
      scopeHash,
      actor: intent.actorId as Address,
      actionHash,
      argsHash: argsHashHex,
      idempotencyKeyHash,
      nonce: intent.nonce,
      expiresAtMs: intent.expiresAtMs,
      chainId: intent.chainId,
      authMode: intent.authMode,
      accessTokenIdHash,
    },
  };
}

/**
 * Generate a random idempotency key.
 */
export function generateIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Base64url encode without padding.
 */
export function base64urlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64url decode.
 */
export function base64urlDecode(str: string): Uint8Array {
  // Add padding if needed
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

