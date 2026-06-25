// @ts-nocheck
/**
 * Standard Effects Module
 * 
 * Provides reusable effect classes for common Arcana operations:
 * - Bank transfers (BANK_TRANSFER)
 * - Scope data operations (SCOPE_DATA_SET, SCOPE_DATA_DEL, SCOPE_DATA_INC, SCOPE_DATA_DEC, SCOPE_DATA_MAX, SCOPE_DATA_MIN)
 * - Assert operations (ASSERT_STATE_EQ, ASSERT_STATE_CONTAINS, ASSERT_STATE_GT, ASSERT_STATE_LT, ASSERT_STATE_GTE, ASSERT_STATE_LTE)
 * - History persistence (HISTORY_PERSIST)
 * 
 * These effects are used across multiple contracts and should be imported
 * from this module rather than defined inline.
 */

import { ContractEffect, MsgpackEncodable } from "./response";
import { MessagePackEncoder } from "../primitives/msgpack";

/**
 * Generic named-bytes effect.
 *
 * Use this when a capability expects `{ type, data_bytes }` with a known
 * binary payload format (MessagePack, Borsh, etc).
 */
export class NamedBytesEffect extends ContractEffect {
  dataBytes: Uint8Array;

  constructor(effectType: string, dataBytes: Uint8Array) {
    super(effectType);
    this.dataBytes = dataBytes;
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(2);
    encoder.encodeString("type");
    encoder.encodeString(this.type);
    encoder.encodeString("data_bytes");
    encoder.encodeBin(this.dataBytes);
  }
}

/**
 * ROTATE_SEED effect - reveal the current epoch's committed random seed and
 * commit a fresh one (commit-reveal rotation).
 *
 * The raw random seed is host-managed: committed at instance creation and
 * injected per call via `ContractContext.serverSeed`. Emitting this effect from
 * an action tells the host to, post-commit: move the current epoch's seed into
 * the public `revealed[]` history (so that epoch's randomness becomes verifiable)
 * and commit a new seed for the next epoch. Reset the program's draw index in
 * the same action (`state.resetRandomIndex()`) so the next epoch starts fresh.
 *
 * A program that never rotates still has its single seed revealed automatically
 * when the instance finalizes.
 */
export class RotateSeedEffect extends ContractEffect {
  constructor() {
    super("ROTATE_SEED");
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(2);
    encoder.encodeString("type");
    encoder.encodeString("ROTATE_SEED");
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
  }
}

/**
 * BANK_TRANSFER effect - transfers value between principals in the Arcana Bank
 * 
 * @param fromPrincipal - Source principal (e.g., "user:user_123", "scope:scope_456")
 * @param toPrincipal - Destination principal (e.g., "user:user_123", "scope:scope_456")
 * @param assetId - Asset identifier (e.g., "usdc")
 * @param amount - Amount as U256 decimal string (e.g., "1000000")
 * @param authId - Optional authorization ID (required for user->* transfers)
 */
export class BankTransferEffect extends ContractEffect {
  fromPrincipal: string;
  toPrincipal: string;
  assetId: string;
  amount: string;
  authId: string | null;

  constructor(
    fromPrincipal: string,
    toPrincipal: string,
    assetId: string,
    amount: string,
    authId: string | null = null
  ) {
    super("BANK_TRANSFER");
    this.fromPrincipal = fromPrincipal;
    this.toPrincipal = toPrincipal;
    this.assetId = assetId;
    this.amount = amount;
    this.authId = authId;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(6);
    encoder.encodeString("type");
    encoder.encodeString("BANK_TRANSFER");
    encoder.encodeString("from_principal");
    encoder.encodeString(this.fromPrincipal);
    encoder.encodeString("to_principal");
    encoder.encodeString(this.toPrincipal);
    encoder.encodeString("asset_id");
    encoder.encodeString(this.assetId);
    encoder.encodeString("amount");
    encoder.encodeString(this.amount);
    encoder.encodeString("auth_id");
    this.authId !== null && (this.authId as string).length > 0
      ? encoder.encodeString(this.authId as string)
      : encoder.encodeNil();
  }
}

/**
 * SCOPE_DATA_SET effect - sets a key-value pair in scope storage or project base storage
 * 
 * @param key - Data key (e.g., "config/rate_bps", "public/status")
 * @param valueBytes - Raw bytes (caller-defined encoding, e.g. MessagePack)
 * @param target - Storage target: "scope" (default) or "base" (project base storage)
 * Note: scope_id is automatically set by the host from contract.scope_id for security
 */
export class ScopeDataSetEffect extends ContractEffect {
  key: string;
  valueBytes: Uint8Array;
  target: string;

  constructor(key: string, valueBytes: Uint8Array, target: string = "scope") {
    super("SCOPE_DATA_SET");
    this.key = key;
    this.valueBytes = valueBytes;
    this.target = target;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(5);
    encoder.encodeString("type");
    encoder.encodeString("SCOPE_DATA_SET");
    encoder.encodeString("key");
    encoder.encodeString(this.key);
    encoder.encodeString("value_bytes");
    encoder.encodeBin(this.valueBytes);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
    encoder.encodeString("target");
    encoder.encodeString(this.target);
  }
}

/**
 * SCOPE_DATA_DEL effect - deletes a key from scope storage or project base storage
 * 
 * @param key - Data key to delete
 * @param target - Storage target: "scope" (default) or "base" (project base storage)
 * Note: scope_id is automatically set by the host from contract.scope_id for security
 */
export class ScopeDataDelEffect extends ContractEffect {
  key: string;
  target: string;

  constructor(key: string, target: string = "scope") {
    super("SCOPE_DATA_DEL");
    this.key = key;
    this.target = target;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(4);
    encoder.encodeString("type");
    encoder.encodeString("SCOPE_DATA_DEL");
    encoder.encodeString("key");
    encoder.encodeString(this.key);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
    encoder.encodeString("target");
    encoder.encodeString(this.target);
  }
}

/**
 * SCOPE_DATA_INC effect - increments a U256 value in scope storage or project base storage
 * 
 * @param key - Data key (e.g., "user/123/balance", "house/chips")
 * @param amount - Amount to increment as string (must be > 0, supports values up to U256 max)
 * @param failOnError - If true, fails on error; if false, silently fails on overflow
 * @param target - Storage target: "scope" (default) or "base" (project base storage)
 * Note: scope_id is automatically set by the host from contract.scope_id for security
 */
export class ScopeDataIncEffect extends ContractEffect {
  key: string;
  amount: string;
  failOnError: bool;
  target: string;

  constructor(key: string, amount: string, failOnError: bool = true, target: string = "scope") {
    super("SCOPE_DATA_INC");
    this.key = key;
    this.amount = amount;
    this.failOnError = failOnError;
    this.target = target;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(5);
    encoder.encodeString("type");
    encoder.encodeString("SCOPE_DATA_INC");
    encoder.encodeString("key");
    encoder.encodeString(this.key);
    encoder.encodeString("amount");
    encoder.encodeString(this.amount);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(this.failOnError);
    encoder.encodeString("target");
    encoder.encodeString(this.target);
  }
}

/**
 * SCOPE_DATA_DEC effect - decrements a U256 value in scope storage or project base storage
 * 
 * @param key - Data key (e.g., "user/123/balance", "house/chips")
 * @param amount - Amount to decrement as string (must be > 0, supports values up to U256 max)
 * @param failOnError - If true, fails on underflow; if false, silently fails
 * @param target - Storage target: "scope" (default) or "base" (project base storage)
 * Note: scope_id is automatically set by the host from contract.scope_id for security
 */
export class ScopeDataDecEffect extends ContractEffect {
  key: string;
  amount: string;
  failOnError: bool;
  target: string;

  constructor(key: string, amount: string, failOnError: bool = true, target: string = "scope") {
    super("SCOPE_DATA_DEC");
    this.key = key;
    this.amount = amount;
    this.failOnError = failOnError;
    this.target = target;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(5);
    encoder.encodeString("type");
    encoder.encodeString("SCOPE_DATA_DEC");
    encoder.encodeString("key");
    encoder.encodeString(this.key);
    encoder.encodeString("amount");
    encoder.encodeString(this.amount);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(this.failOnError);
    encoder.encodeString("target");
    encoder.encodeString(this.target);
  }
}

/**
 * SCOPE_DATA_MAX effect - atomically sets key to max(current, amount) for U256 values.
 *
 * @param key - Data key (e.g., "user/123/best_streak")
 * @param amount - Candidate max value as decimal string
 * @param failOnError - If true, fails on parse/invalid data errors; if false, silently skips
 * @param target - Storage target: "scope" (default) or "base" (project base storage)
 */
export class ScopeDataMaxEffect extends ContractEffect {
  key: string;
  amount: string;
  failOnError: bool;
  target: string;

  constructor(key: string, amount: string, failOnError: bool = true, target: string = "scope") {
    super("SCOPE_DATA_MAX");
    this.key = key;
    this.amount = amount;
    this.failOnError = failOnError;
    this.target = target;
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(5);
    encoder.encodeString("type");
    encoder.encodeString("SCOPE_DATA_MAX");
    encoder.encodeString("key");
    encoder.encodeString(this.key);
    encoder.encodeString("amount");
    encoder.encodeString(this.amount);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(this.failOnError);
    encoder.encodeString("target");
    encoder.encodeString(this.target);
  }
}

/**
 * SCOPE_DATA_MIN effect - atomically sets key to min(current, amount) for U256 values.
 *
 * @param key - Data key (e.g., "user/123/lowest_metric")
 * @param amount - Candidate min value as decimal string
 * @param failOnError - If true, fails on parse/invalid data errors; if false, silently skips
 * @param target - Storage target: "scope" (default) or "base" (project base storage)
 */
export class ScopeDataMinEffect extends ContractEffect {
  key: string;
  amount: string;
  failOnError: bool;
  target: string;

  constructor(key: string, amount: string, failOnError: bool = true, target: string = "scope") {
    super("SCOPE_DATA_MIN");
    this.key = key;
    this.amount = amount;
    this.failOnError = failOnError;
    this.target = target;
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(5);
    encoder.encodeString("type");
    encoder.encodeString("SCOPE_DATA_MIN");
    encoder.encodeString("key");
    encoder.encodeString(this.key);
    encoder.encodeString("amount");
    encoder.encodeString(this.amount);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(this.failOnError);
    encoder.encodeString("target");
    encoder.encodeString(this.target);
  }
}

// ============================================================================
// Factory functions for convenience
// ============================================================================

export function createBankTransferEffect(
  fromPrincipal: string,
  toPrincipal: string,
  assetId: string,
  amount: string,
  authId: string | null = null
): BankTransferEffect {
  return new BankTransferEffect(fromPrincipal, toPrincipal, assetId, amount, authId);
}

/** Create a generic `{ type, data_bytes }` effect payload. */
export function createNamedBytesEffect(
  effectType: string,
  dataBytes: Uint8Array
): NamedBytesEffect {
  return new NamedBytesEffect(effectType, dataBytes);
}

/**
 * Create a ROTATE_SEED effect: reveal the current committed seed and commit a
 * new one. Pair with `state.resetRandomIndex()` in the same action.
 */
export function createRotateSeedEffect(): RotateSeedEffect {
  return new RotateSeedEffect();
}

/** Create a SCOPE_DATA_SET effect (scope storage, default) */
export function createScopeDataSetEffect(
  key: string,
  valueBytes: Uint8Array
): ScopeDataSetEffect {
  return new ScopeDataSetEffect(key, valueBytes, "scope");
}

/** Create a SCOPE_DATA_DEL effect (scope storage, default) */
export function createScopeDataDelEffect(
  key: string
): ScopeDataDelEffect {
  return new ScopeDataDelEffect(key, "scope");
}

/** Create a SCOPE_DATA_INC effect (scope storage, default) */
export function createScopeDataIncEffect(
  key: string,
  amount: string,
  failOnError: bool = true
): ScopeDataIncEffect {
  return new ScopeDataIncEffect(key, amount, failOnError, "scope");
}

/** Create a SCOPE_DATA_DEC effect (scope storage, default) */
export function createScopeDataDecEffect(
  key: string,
  amount: string,
  failOnError: bool = true
): ScopeDataDecEffect {
  return new ScopeDataDecEffect(key, amount, failOnError, "scope");
}

/** Create a SCOPE_DATA_MAX effect (scope storage, default) */
export function createScopeDataMaxEffect(
  key: string,
  amount: string,
  failOnError: bool = true
): ScopeDataMaxEffect {
  return new ScopeDataMaxEffect(key, amount, failOnError, "scope");
}

/** Create a SCOPE_DATA_MIN effect (scope storage, default) */
export function createScopeDataMinEffect(
  key: string,
  amount: string,
  failOnError: bool = true
): ScopeDataMinEffect {
  return new ScopeDataMinEffect(key, amount, failOnError, "scope");
}

// ============================================================================
// Base storage factory functions (project base storage, shared across scopes)
// ============================================================================

/** Create a SCOPE_DATA_SET effect targeting project base storage */
export function createBaseDataSetEffect(
  key: string,
  valueBytes: Uint8Array
): ScopeDataSetEffect {
  return new ScopeDataSetEffect(key, valueBytes, "base");
}

/** Create a SCOPE_DATA_DEL effect targeting project base storage */
export function createBaseDataDelEffect(
  key: string
): ScopeDataDelEffect {
  return new ScopeDataDelEffect(key, "base");
}

/** Create a SCOPE_DATA_INC effect targeting project base storage */
export function createBaseDataIncEffect(
  key: string,
  amount: string,
  failOnError: bool = true
): ScopeDataIncEffect {
  return new ScopeDataIncEffect(key, amount, failOnError, "base");
}

/** Create a SCOPE_DATA_DEC effect targeting project base storage */
export function createBaseDataDecEffect(
  key: string,
  amount: string,
  failOnError: bool = true
): ScopeDataDecEffect {
  return new ScopeDataDecEffect(key, amount, failOnError, "base");
}

/** Create a SCOPE_DATA_MAX effect targeting project base storage */
export function createBaseDataMaxEffect(
  key: string,
  amount: string,
  failOnError: bool = true
): ScopeDataMaxEffect {
  return new ScopeDataMaxEffect(key, amount, failOnError, "base");
}

/** Create a SCOPE_DATA_MIN effect targeting project base storage */
export function createBaseDataMinEffect(
  key: string,
  amount: string,
  failOnError: bool = true
): ScopeDataMinEffect {
  return new ScopeDataMinEffect(key, amount, failOnError, "base");
}


/**
 * HISTORY_PERSIST effect - persists game history (capsule + envelopes)
 * 
 * @param data - History data (use HistoryDataBuilder from "./history" to construct)
 * @param isRoot - Whether this is a root summary (true) or instance replay (false)
 */
export class HistoryPersistEffect extends ContractEffect {
  payload: MsgpackEncodable;
  isRoot: bool;

  constructor(data: MsgpackEncodable, isRoot: bool = false) {
    super("HISTORY_PERSIST");
    this.payload = data;
    this.isRoot = isRoot;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(4);
    encoder.encodeString("type");
    encoder.encodeString("HISTORY_PERSIST");
    encoder.encodeString("data_bytes");
    const inner = new MessagePackEncoder(2048);
    this.payload.encodeToMsgpack(inner);
    const len = inner.getLength();
    const out = new Uint8Array(len);
    memory.copy(out.dataStart, inner.getBufferPtr(), len);
    encoder.encodeBin(out);
    encoder.encodeString("is_root");
    encoder.encodeBool(this.isRoot);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
  }
}

/**
 * ASSERT_STATE_EQ effect - asserts that a KV value equals an expected value
 * 
 * @param key - KV key to assert against (e.g., "config/rate", "public/status")
 * @param expectedValueBytes - Expected value as raw bytes (caller-defined encoding)
 * Note: scope_id is automatically set by the host from contract.scope_id for security
 */
export class AssertStateEqEffect extends ContractEffect {
  key: string;
  expectedValueBytes: Uint8Array;
  errorCode: string | null;
  errorMessage: string | null;

  constructor(key: string, expectedValueBytes: Uint8Array, errorCode: string | null = null, errorMessage: string | null = null) {
    super("ASSERT_STATE_EQ");
    this.key = key;
    this.expectedValueBytes = expectedValueBytes;
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(6);
    encoder.encodeString("type");
    encoder.encodeString("ASSERT_STATE_EQ");
    encoder.encodeString("key");
    encoder.encodeString(this.key);
    encoder.encodeString("expected_value_bytes");
    encoder.encodeBin(this.expectedValueBytes);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
    encoder.encodeString("error_code");
    this.errorCode !== null && (this.errorCode as string).length > 0
      ? encoder.encodeString(this.errorCode as string)
      : encoder.encodeNil();
    encoder.encodeString("error_message");
    this.errorMessage !== null && (this.errorMessage as string).length > 0
      ? encoder.encodeString(this.errorMessage as string)
      : encoder.encodeNil();
  }
}

/**
 * ASSERT_STATE_NOT_EXISTS effect - asserts that a KV key does not exist.
 *
 * @param key - KV key to assert absent
 * Note: scope_id is automatically set by the host from contract.scope_id for security
 */
export class AssertStateNotExistsEffect extends ContractEffect {
  key: string;
  errorCode: string | null;
  errorMessage: string | null;

  constructor(key: string, errorCode: string | null = null, errorMessage: string | null = null) {
    super("ASSERT_STATE_NOT_EXISTS");
    this.key = key;
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(5);
    encoder.encodeString("type");
    encoder.encodeString("ASSERT_STATE_NOT_EXISTS");
    encoder.encodeString("key");
    encoder.encodeString(this.key);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
    encoder.encodeString("error_code");
    this.errorCode !== null && (this.errorCode as string).length > 0
      ? encoder.encodeString(this.errorCode as string)
      : encoder.encodeNil();
    encoder.encodeString("error_message");
    this.errorMessage !== null && (this.errorMessage as string).length > 0
      ? encoder.encodeString(this.errorMessage as string)
      : encoder.encodeNil();
  }
}

/**
 * ASSERT_STATE_CONTAINS effect - asserts that a KV value is an array of strings containing a specific string
 * 
 * @param key - KV key to assert against (e.g., "config/approved_users", "public/tags")
 * @param expectedString - String that must be contained in the array
 * Note: scope_id is automatically set by the host from contract.scope_id for security
 */
export class AssertStateContainsEffect extends ContractEffect {
  key: string;
  expectedString: string;
  errorCode: string | null;
  errorMessage: string | null;

  constructor(key: string, expectedString: string, errorCode: string | null = null, errorMessage: string | null = null) {
    super("ASSERT_STATE_CONTAINS");
    this.key = key;
    this.expectedString = expectedString;
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(6);
    encoder.encodeString("type");
    encoder.encodeString("ASSERT_STATE_CONTAINS");
    encoder.encodeString("key");
    encoder.encodeString(this.key);
    encoder.encodeString("expected_string");
    encoder.encodeString(this.expectedString);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
    encoder.encodeString("error_code");
    this.errorCode !== null && (this.errorCode as string).length > 0
      ? encoder.encodeString(this.errorCode as string)
      : encoder.encodeNil();
    encoder.encodeString("error_message");
    this.errorMessage !== null && (this.errorMessage as string).length > 0
      ? encoder.encodeString(this.errorMessage as string)
      : encoder.encodeNil();
  }
}

export function createAssertStateEqEffect(
  key: string,
  expectedValueBytes: Uint8Array,
  errorCode: string | null = null,
  errorMessage: string | null = null
): AssertStateEqEffect {
  return new AssertStateEqEffect(key, expectedValueBytes, errorCode, errorMessage);
}

export function createAssertStateNotExistsEffect(
  key: string,
  errorCode: string | null = null,
  errorMessage: string | null = null
): AssertStateNotExistsEffect {
  return new AssertStateNotExistsEffect(key, errorCode, errorMessage);
}

export function createAssertStateContainsEffect(
  key: string,
  expectedString: string,
  errorCode: string | null = null,
  errorMessage: string | null = null
): AssertStateContainsEffect {
  return new AssertStateContainsEffect(key, expectedString, errorCode, errorMessage);
}

/**
 * ASSERT_STATE_GT effect - asserts that a KV value is greater than a threshold value
 * 
 * @param key - KV key to assert against (e.g., "config/min_balance", "public/score")
 * @param thresholdValueBytes - Threshold value as raw bytes (caller-defined encoding)
 * Note: scope_id is automatically set by the host from contract.scope_id for security
 */
export class AssertStateGtEffect extends ContractEffect {
  key: string;
  thresholdValueBytes: Uint8Array;
  errorCode: string | null;
  errorMessage: string | null;

  constructor(key: string, thresholdValueBytes: Uint8Array, errorCode: string | null = null, errorMessage: string | null = null) {
    super("ASSERT_STATE_GT");
    this.key = key;
    this.thresholdValueBytes = thresholdValueBytes;
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(6);
    encoder.encodeString("type");
    encoder.encodeString("ASSERT_STATE_GT");
    encoder.encodeString("key");
    encoder.encodeString(this.key);
    encoder.encodeString("threshold_value_bytes");
    encoder.encodeBin(this.thresholdValueBytes);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
    encoder.encodeString("error_code");
    this.errorCode !== null && (this.errorCode as string).length > 0
      ? encoder.encodeString(this.errorCode as string)
      : encoder.encodeNil();
    encoder.encodeString("error_message");
    this.errorMessage !== null && (this.errorMessage as string).length > 0
      ? encoder.encodeString(this.errorMessage as string)
      : encoder.encodeNil();
  }
}

/**
 * ASSERT_STATE_LT effect - asserts that a KV value is less than a threshold value
 * 
 * @param key - KV key to assert against (e.g., "config/max_balance", "public/score")
 * @param thresholdValueBytes - Threshold value as raw bytes (caller-defined encoding)
 * Note: scope_id is automatically set by the host from contract.scope_id for security
 */
export class AssertStateLtEffect extends ContractEffect {
  key: string;
  thresholdValueBytes: Uint8Array;
  errorCode: string | null;
  errorMessage: string | null;

  constructor(key: string, thresholdValueBytes: Uint8Array, errorCode: string | null = null, errorMessage: string | null = null) {
    super("ASSERT_STATE_LT");
    this.key = key;
    this.thresholdValueBytes = thresholdValueBytes;
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(6);
    encoder.encodeString("type");
    encoder.encodeString("ASSERT_STATE_LT");
    encoder.encodeString("key");
    encoder.encodeString(this.key);
    encoder.encodeString("threshold_value_bytes");
    encoder.encodeBin(this.thresholdValueBytes);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
    encoder.encodeString("error_code");
    this.errorCode !== null && (this.errorCode as string).length > 0
      ? encoder.encodeString(this.errorCode as string)
      : encoder.encodeNil();
    encoder.encodeString("error_message");
    this.errorMessage !== null && (this.errorMessage as string).length > 0
      ? encoder.encodeString(this.errorMessage as string)
      : encoder.encodeNil();
  }
}

export function createAssertStateGtEffect(
  key: string,
  thresholdValueBytes: Uint8Array,
  errorCode: string | null = null,
  errorMessage: string | null = null
): AssertStateGtEffect {
  return new AssertStateGtEffect(key, thresholdValueBytes, errorCode, errorMessage);
}

export function createAssertStateLtEffect(
  key: string,
  thresholdValueBytes: Uint8Array,
  errorCode: string | null = null,
  errorMessage: string | null = null
): AssertStateLtEffect {
  return new AssertStateLtEffect(key, thresholdValueBytes, errorCode, errorMessage);
}

/**
 * ASSERT_STATE_GTE effect - asserts that a KV value is greater than or equal to a threshold value
 * 
 * @param key - KV key to assert against (e.g., "config/min_balance", "public/score")
 * @param thresholdValueBytes - Threshold value as raw bytes (caller-defined encoding)
 * Note: scope_id is automatically set by the host from contract.scope_id for security
 */
export class AssertStateGteEffect extends ContractEffect {
  key: string;
  thresholdValueBytes: Uint8Array;
  errorCode: string | null;
  errorMessage: string | null;

  constructor(key: string, thresholdValueBytes: Uint8Array, errorCode: string | null = null, errorMessage: string | null = null) {
    super("ASSERT_STATE_GTE");
    this.key = key;
    this.thresholdValueBytes = thresholdValueBytes;
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(6);
    encoder.encodeString("type");
    encoder.encodeString("ASSERT_STATE_GTE");
    encoder.encodeString("key");
    encoder.encodeString(this.key);
    encoder.encodeString("threshold_value_bytes");
    encoder.encodeBin(this.thresholdValueBytes);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
    encoder.encodeString("error_code");
    this.errorCode !== null && (this.errorCode as string).length > 0
      ? encoder.encodeString(this.errorCode as string)
      : encoder.encodeNil();
    encoder.encodeString("error_message");
    this.errorMessage !== null && (this.errorMessage as string).length > 0
      ? encoder.encodeString(this.errorMessage as string)
      : encoder.encodeNil();
  }
}

/**
 * ASSERT_STATE_LTE effect - asserts that a KV value is less than or equal to a threshold value
 * 
 * @param key - KV key to assert against (e.g., "config/max_balance", "public/score")
 * @param thresholdValueBytes - Threshold value as raw bytes (caller-defined encoding)
 * Note: scope_id is automatically set by the host from contract.scope_id for security
 */
export class AssertStateLteEffect extends ContractEffect {
  key: string;
  thresholdValueBytes: Uint8Array;
  errorCode: string | null;
  errorMessage: string | null;

  constructor(key: string, thresholdValueBytes: Uint8Array, errorCode: string | null = null, errorMessage: string | null = null) {
    super("ASSERT_STATE_LTE");
    this.key = key;
    this.thresholdValueBytes = thresholdValueBytes;
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(6);
    encoder.encodeString("type");
    encoder.encodeString("ASSERT_STATE_LTE");
    encoder.encodeString("key");
    encoder.encodeString(this.key);
    encoder.encodeString("threshold_value_bytes");
    encoder.encodeBin(this.thresholdValueBytes);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
    encoder.encodeString("error_code");
    this.errorCode !== null && (this.errorCode as string).length > 0
      ? encoder.encodeString(this.errorCode as string)
      : encoder.encodeNil();
    encoder.encodeString("error_message");
    this.errorMessage !== null && (this.errorMessage as string).length > 0
      ? encoder.encodeString(this.errorMessage as string)
      : encoder.encodeNil();
  }
}

export function createAssertStateGteEffect(
  key: string,
  thresholdValueBytes: Uint8Array,
  errorCode: string | null = null,
  errorMessage: string | null = null
): AssertStateGteEffect {
  return new AssertStateGteEffect(key, thresholdValueBytes, errorCode, errorMessage);
}

export function createAssertStateLteEffect(
  key: string,
  thresholdValueBytes: Uint8Array,
  errorCode: string | null = null,
  errorMessage: string | null = null
): AssertStateLteEffect {
  return new AssertStateLteEffect(key, thresholdValueBytes, errorCode, errorMessage);
}

// =============================================================================
// Table Effects - For TablesCapability table discovery and lifecycle tracking
// =============================================================================

/**
 * TABLE_CREATED effect - Registers a new table for discovery
 * 
 * @param tableId - Table ID (usually the instance_id)
 * @param gameType - Game type (e.g., "battleship", "blackjack")
 * @param tableMode - Mode ("cash" or "tournament")
 * @param scopeId - Scope ID for the table
 * @param isPrivate - Whether the table is private (invite-only)
 * @param inviteCode - Optional invite code for private tables
 * @param entryFee - Optional entry fee as U256 decimal string
 * @param token - Optional token for entry fee
 * @param minPlayers - Minimum players to start
 * @param maxPlayers - Maximum players allowed
 * @param createdBy - User who created the table
 * @param customMetadata - Optional JSON string with game-specific metadata
 */
export class TableCreatedEffect extends ContractEffect {
  tableId: string;
  gameType: string;
  tableMode: string;
  scopeId: string;
  isPrivate: bool;
  inviteCode: string | null;
  entryFee: string | null;
  token: string | null;
  minPlayers: i32;
  maxPlayers: i32;
  createdBy: string;
  customMetadata: string | null;

  constructor(
    tableId: string,
    gameType: string,
    tableMode: string,
    scopeId: string,
    isPrivate: bool,
    inviteCode: string | null,
    entryFee: string | null,
    token: string | null,
    minPlayers: i32,
    maxPlayers: i32,
    createdBy: string,
    customMetadata: string | null = null
  ) {
    super("TABLE_CREATED");
    this.tableId = tableId;
    this.gameType = gameType;
    this.tableMode = tableMode;
    this.scopeId = scopeId;
    this.isPrivate = isPrivate;
    this.inviteCode = inviteCode;
    this.entryFee = entryFee;
    this.token = token;
    this.minPlayers = minPlayers;
    this.maxPlayers = maxPlayers;
    this.createdBy = createdBy;
    this.customMetadata = customMetadata;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    // Required fields + optional ones.
    let count = 10;
    if (this.inviteCode !== null) count++;
    if (this.entryFee !== null) count++;
    if (this.token !== null) count++;
    if (this.customMetadata !== null) count++;
    encoder.encodeMapStart(count);
    encoder.encodeString("type");
    encoder.encodeString("TABLE_CREATED");
    encoder.encodeString("table_id");
    encoder.encodeString(this.tableId);
    encoder.encodeString("game_type");
    encoder.encodeString(this.gameType);
    encoder.encodeString("table_mode");
    encoder.encodeString(this.tableMode);
    encoder.encodeString("scope_id");
    encoder.encodeString(this.scopeId);
    encoder.encodeString("is_private");
    encoder.encodeBool(this.isPrivate);
    encoder.encodeString("min_players");
    encoder.encodeI32(this.minPlayers);
    encoder.encodeString("max_players");
    encoder.encodeI32(this.maxPlayers);
    encoder.encodeString("created_by");
    encoder.encodeString(this.createdBy);
    if (this.inviteCode !== null) {
      encoder.encodeString("invite_code");
      encoder.encodeString(this.inviteCode as string);
    }
    if (this.entryFee !== null) {
      encoder.encodeString("entry_fee");
      encoder.encodeString(this.entryFee as string);
    }
    if (this.token !== null) {
      encoder.encodeString("token");
      encoder.encodeString(this.token as string);
    }
    if (this.customMetadata !== null) {
      encoder.encodeString("custom_metadata");
      encoder.encodeString(this.customMetadata as string);
    }
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
  }
}

/**
 * TABLE_PLAYER_JOINED effect - Tracks player joining a table
 * 
 * @param tableId - Table ID
 * @param userId - User who joined
 */
export class TablePlayerJoinedEffect extends ContractEffect {
  tableId: string;
  userId: string;

  constructor(tableId: string, userId: string) {
    super("TABLE_PLAYER_JOINED");
    this.tableId = tableId;
    this.userId = userId;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(4);
    encoder.encodeString("type");
    encoder.encodeString("TABLE_PLAYER_JOINED");
    encoder.encodeString("table_id");
    encoder.encodeString(this.tableId);
    encoder.encodeString("user_id");
    encoder.encodeString(this.userId);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
  }
}

/**
 * TABLE_PLAYER_LEFT effect - Tracks player leaving a table
 * 
 * @param tableId - Table ID
 * @param userId - User who left
 */
export class TablePlayerLeftEffect extends ContractEffect {
  tableId: string;
  userId: string;

  constructor(tableId: string, userId: string) {
    super("TABLE_PLAYER_LEFT");
    this.tableId = tableId;
    this.userId = userId;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(4);
    encoder.encodeString("type");
    encoder.encodeString("TABLE_PLAYER_LEFT");
    encoder.encodeString("table_id");
    encoder.encodeString(this.tableId);
    encoder.encodeString("user_id");
    encoder.encodeString(this.userId);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
  }
}

/**
 * TABLE_STARTED effect - Marks table game as started (status: playing)
 * 
 * @param tableId - Table ID
 */
export class TableStartedEffect extends ContractEffect {
  tableId: string;

  constructor(tableId: string) {
    super("TABLE_STARTED");
    this.tableId = tableId;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(3);
    encoder.encodeString("type");
    encoder.encodeString("TABLE_STARTED");
    encoder.encodeString("table_id");
    encoder.encodeString(this.tableId);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
  }
}

/**
 * TABLE_FINISHED effect - Marks table game as finished with winner
 * 
 * @param tableId - Table ID
 * @param winner - Winner address/ID
 */
export class TableFinishedEffect extends ContractEffect {
  tableId: string;
  winner: string;

  constructor(tableId: string, winner: string) {
    super("TABLE_FINISHED");
    this.tableId = tableId;
    this.winner = winner;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(4);
    encoder.encodeString("type");
    encoder.encodeString("TABLE_FINISHED");
    encoder.encodeString("table_id");
    encoder.encodeString(this.tableId);
    encoder.encodeString("winner");
    encoder.encodeString(this.winner);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
  }
}

/**
 * TABLE_CLOSED effect - Marks table as closed (cancelled before game started)
 * 
 * @param tableId - Table ID
 * @param reason - Reason for closing
 */
export class TableClosedEffect extends ContractEffect {
  tableId: string;
  reason: string;

  constructor(tableId: string, reason: string) {
    super("TABLE_CLOSED");
    this.tableId = tableId;
    this.reason = reason;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(4);
    encoder.encodeString("type");
    encoder.encodeString("TABLE_CLOSED");
    encoder.encodeString("table_id");
    encoder.encodeString(this.tableId);
    encoder.encodeString("reason");
    encoder.encodeString(this.reason);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
  }
}

/**
 * TABLE_METADATA_UPDATE effect - Updates custom metadata with merge semantics
 * 
 * @param tableId - Table ID
 * @param metadataJson - JSON string with updates (new keys added, null values delete keys)
 */
export class TableMetadataUpdateEffect extends ContractEffect {
  tableId: string;
  metadataJson: string;

  constructor(tableId: string, metadataJson: string) {
    super("TABLE_METADATA_UPDATE");
    this.tableId = tableId;
    this.metadataJson = metadataJson;
  }


  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(4);
    encoder.encodeString("type");
    encoder.encodeString("TABLE_METADATA_UPDATE");
    encoder.encodeString("table_id");
    encoder.encodeString(this.tableId);
    encoder.encodeString("metadata");
    encoder.encodeString(this.metadataJson);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(true);
  }
}

// Table effect factory functions
export function createTableCreatedEffect(
  tableId: string,
  gameType: string,
  tableMode: string,
  scopeId: string,
  isPrivate: bool,
  inviteCode: string | null,
  entryFee: string | null,
  token: string | null,
  minPlayers: i32,
  maxPlayers: i32,
  createdBy: string,
  customMetadata: string | null = null
): TableCreatedEffect {
  return new TableCreatedEffect(
    tableId, gameType, tableMode, scopeId, isPrivate,
    inviteCode, entryFee, token, minPlayers, maxPlayers,
    createdBy, customMetadata
  );
}

export function createTablePlayerJoinedEffect(
  tableId: string,
  userId: string
): TablePlayerJoinedEffect {
  return new TablePlayerJoinedEffect(tableId, userId);
}

export function createTablePlayerLeftEffect(
  tableId: string,
  userId: string
): TablePlayerLeftEffect {
  return new TablePlayerLeftEffect(tableId, userId);
}

export function createTableStartedEffect(
  tableId: string
): TableStartedEffect {
  return new TableStartedEffect(tableId);
}

export function createTableFinishedEffect(
  tableId: string,
  winner: string
): TableFinishedEffect {
  return new TableFinishedEffect(tableId, winner);
}

export function createTableClosedEffect(
  tableId: string,
  reason: string
): TableClosedEffect {
  return new TableClosedEffect(tableId, reason);
}

export function createTableMetadataUpdateEffect(
  tableId: string,
  metadataJson: string
): TableMetadataUpdateEffect {
  return new TableMetadataUpdateEffect(tableId, metadataJson);
}

// ============================================================================
// Custom Project/Scoped Table DML Effects
// ============================================================================

/** Table namespace target for custom table DML effects. */
export class CustomTableScope {
  static readonly Scoped: string = "scoped";
  static readonly Project: string = "project";
}

/**
 * TABLE_INSERT effect - insert one row into a custom table.
 *
 * @param tableName - Logical table name from arcana.yaml
 * @param rowJson - JSON object string containing column values
 * @param tableScope - "scoped" (default) or "project"
 */
export class TableInsertEffect extends ContractEffect {
  tableName: string;
  rowJson: string;
  tableScope: string;

  constructor(tableName: string, rowJson: string, tableScope: string = CustomTableScope.Scoped) {
    super("TABLE_INSERT");
    this.tableName = tableName;
    this.rowJson = rowJson;
    this.tableScope = tableScope;
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(4);
    encoder.encodeString("type");
    encoder.encodeString("TABLE_INSERT");
    encoder.encodeString("table_name");
    encoder.encodeString(this.tableName);
    encoder.encodeString("row_json");
    encoder.encodeString(this.rowJson);
    encoder.encodeString("table_scope");
    encoder.encodeString(this.tableScope);
  }
}

/**
 * TABLE_UPSERT effect - upsert one row into a custom table.
 *
 * @param tableName - Logical table name from arcana.yaml
 * @param rowJson - JSON object string containing column values
 * @param tableScope - "scoped" (default) or "project"
 */
export class TableUpsertEffect extends ContractEffect {
  tableName: string;
  rowJson: string;
  tableScope: string;

  constructor(tableName: string, rowJson: string, tableScope: string = CustomTableScope.Scoped) {
    super("TABLE_UPSERT");
    this.tableName = tableName;
    this.rowJson = rowJson;
    this.tableScope = tableScope;
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(4);
    encoder.encodeString("type");
    encoder.encodeString("TABLE_UPSERT");
    encoder.encodeString("table_name");
    encoder.encodeString(this.tableName);
    encoder.encodeString("row_json");
    encoder.encodeString(this.rowJson);
    encoder.encodeString("table_scope");
    encoder.encodeString(this.tableScope);
  }
}

/**
 * TABLE_INSERT effect (MessagePack row) - insert one row into a custom table.
 *
 * @param tableName - Logical table name from arcana.yaml
 * @param rowMsgpack - MessagePack map bytes containing column values
 * @param tableScope - "scoped" (default) or "project"
 */
export class TableInsertMsgpackEffect extends ContractEffect {
  tableName: string;
  rowMsgpack: Uint8Array;
  tableScope: string;

  constructor(
    tableName: string,
    rowMsgpack: Uint8Array,
    tableScope: string = CustomTableScope.Scoped
  ) {
    super("TABLE_INSERT");
    this.tableName = tableName;
    this.rowMsgpack = rowMsgpack;
    this.tableScope = tableScope;
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(4);
    encoder.encodeString("type");
    encoder.encodeString("TABLE_INSERT");
    encoder.encodeString("table_name");
    encoder.encodeString(this.tableName);
    encoder.encodeString("row_msgpack");
    encoder.encodeBin(this.rowMsgpack);
    encoder.encodeString("table_scope");
    encoder.encodeString(this.tableScope);
  }
}

/**
 * TABLE_UPSERT effect (MessagePack row) - upsert one row into a custom table.
 *
 * @param tableName - Logical table name from arcana.yaml
 * @param rowMsgpack - MessagePack map bytes containing column values
 * @param tableScope - "scoped" (default) or "project"
 */
export class TableUpsertMsgpackEffect extends ContractEffect {
  tableName: string;
  rowMsgpack: Uint8Array;
  tableScope: string;

  constructor(
    tableName: string,
    rowMsgpack: Uint8Array,
    tableScope: string = CustomTableScope.Scoped
  ) {
    super("TABLE_UPSERT");
    this.tableName = tableName;
    this.rowMsgpack = rowMsgpack;
    this.tableScope = tableScope;
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(4);
    encoder.encodeString("type");
    encoder.encodeString("TABLE_UPSERT");
    encoder.encodeString("table_name");
    encoder.encodeString(this.tableName);
    encoder.encodeString("row_msgpack");
    encoder.encodeBin(this.rowMsgpack);
    encoder.encodeString("table_scope");
    encoder.encodeString(this.tableScope);
  }
}

/**
 * TABLE_UPDATE_WHERE effect - update rows in a custom table.
 *
 * @param tableName - Logical table name from arcana.yaml
 * @param predicateJson - JSON predicate string
 * @param updatesJson - JSON object string of column updates
 * @param limit - Optional maximum updated rows (0 means unlimited)
 * @param tableScope - "scoped" (default) or "project"
 */
export class TableUpdateWhereEffect extends ContractEffect {
  tableName: string;
  predicateJson: string;
  updatesJson: string;
  limit: i32;
  tableScope: string;

  constructor(
    tableName: string,
    predicateJson: string,
    updatesJson: string,
    limit: i32 = 0,
    tableScope: string = CustomTableScope.Scoped
  ) {
    super("TABLE_UPDATE_WHERE");
    this.tableName = tableName;
    this.predicateJson = predicateJson;
    this.updatesJson = updatesJson;
    this.limit = limit;
    this.tableScope = tableScope;
  }

}

/**
 * TABLE_DELETE_WHERE effect - delete rows in a custom table.
 *
 * @param tableName - Logical table name from arcana.yaml
 * @param predicateJson - JSON predicate string
 * @param limit - Optional maximum deleted rows (0 means unlimited)
 * @param tableScope - "scoped" (default) or "project"
 */
export class TableDeleteWhereEffect extends ContractEffect {
  tableName: string;
  predicateJson: string;
  limit: i32;
  tableScope: string;

  constructor(
    tableName: string,
    predicateJson: string,
    limit: i32 = 0,
    tableScope: string = CustomTableScope.Scoped
  ) {
    super("TABLE_DELETE_WHERE");
    this.tableName = tableName;
    this.predicateJson = predicateJson;
    this.limit = limit;
    this.tableScope = tableScope;
  }

}

/**
 * TABLE_SET_WHERE_EQ effect - set one column where another column equals a value.
 */
export class TableSetWhereEqEffect extends ContractEffect {
  tableName: string;
  whereColumn: string;
  whereValueJson: string;
  setColumn: string;
  setValueJson: string;
  limit: i32;
  tableScope: string;

  constructor(
    tableName: string,
    whereColumn: string,
    whereValueJson: string,
    setColumn: string,
    setValueJson: string,
    limit: i32 = 0,
    tableScope: string = CustomTableScope.Scoped
  ) {
    super("TABLE_SET_WHERE_EQ");
    this.tableName = tableName;
    this.whereColumn = whereColumn;
    this.whereValueJson = whereValueJson;
    this.setColumn = setColumn;
    this.setValueJson = setValueJson;
    this.limit = limit;
    this.tableScope = tableScope;
  }

}

/**
 * TABLE_INC_WHERE_EQ effect - increment numeric column where another column equals a value.
 */
export class TableIncWhereEqEffect extends ContractEffect {
  tableName: string;
  whereColumn: string;
  whereValueJson: string;
  targetColumn: string;
  amountJson: string;
  limit: i32;
  tableScope: string;

  constructor(
    tableName: string,
    whereColumn: string,
    whereValueJson: string,
    targetColumn: string,
    amountJson: string,
    limit: i32 = 0,
    tableScope: string = CustomTableScope.Scoped
  ) {
    super("TABLE_INC_WHERE_EQ");
    this.tableName = tableName;
    this.whereColumn = whereColumn;
    this.whereValueJson = whereValueJson;
    this.targetColumn = targetColumn;
    this.amountJson = amountJson;
    this.limit = limit;
    this.tableScope = tableScope;
  }

}

/**
 * TABLE_DEC_WHERE_EQ effect - decrement numeric column where another column equals a value.
 */
export class TableDecWhereEqEffect extends ContractEffect {
  tableName: string;
  whereColumn: string;
  whereValueJson: string;
  targetColumn: string;
  amountJson: string;
  limit: i32;
  tableScope: string;

  constructor(
    tableName: string,
    whereColumn: string,
    whereValueJson: string,
    targetColumn: string,
    amountJson: string,
    limit: i32 = 0,
    tableScope: string = CustomTableScope.Scoped
  ) {
    super("TABLE_DEC_WHERE_EQ");
    this.tableName = tableName;
    this.whereColumn = whereColumn;
    this.whereValueJson = whereValueJson;
    this.targetColumn = targetColumn;
    this.amountJson = amountJson;
    this.limit = limit;
    this.tableScope = tableScope;
  }

}

/**
 * TABLE_ASSERT_EQ_WHERE_EQ effect - assert equality on matching rows.
 */
export class TableAssertEqWhereEqEffect extends ContractEffect {
  tableName: string;
  whereColumn: string;
  whereValueJson: string;
  assertColumn: string;
  expectedValueJson: string;
  limit: i32;
  tableScope: string;

  constructor(
    tableName: string,
    whereColumn: string,
    whereValueJson: string,
    assertColumn: string,
    expectedValueJson: string,
    limit: i32 = 0,
    tableScope: string = CustomTableScope.Scoped
  ) {
    super("TABLE_ASSERT_EQ_WHERE_EQ");
    this.tableName = tableName;
    this.whereColumn = whereColumn;
    this.whereValueJson = whereValueJson;
    this.assertColumn = assertColumn;
    this.expectedValueJson = expectedValueJson;
    this.limit = limit;
    this.tableScope = tableScope;
  }

}

/**
 * TABLE_CAS_SET_WHERE_EQ effect - compare-and-set where equality matches.
 * Asserts `assertColumn == expectedValueJson` on all matched rows, then sets `setColumn`.
 */
export class TableCasSetWhereEqEffect extends ContractEffect {
  tableName: string;
  whereColumn: string;
  whereValueJson: string;
  assertColumn: string;
  expectedValueJson: string;
  setColumn: string;
  setValueJson: string;
  limit: i32;
  tableScope: string;

  constructor(
    tableName: string,
    whereColumn: string,
    whereValueJson: string,
    assertColumn: string,
    expectedValueJson: string,
    setColumn: string,
    setValueJson: string,
    limit: i32 = 0,
    tableScope: string = CustomTableScope.Scoped
  ) {
    super("TABLE_CAS_SET_WHERE_EQ");
    this.tableName = tableName;
    this.whereColumn = whereColumn;
    this.whereValueJson = whereValueJson;
    this.assertColumn = assertColumn;
    this.expectedValueJson = expectedValueJson;
    this.setColumn = setColumn;
    this.setValueJson = setValueJson;
    this.limit = limit;
    this.tableScope = tableScope;
  }

}

export function createTableInsertEffect(
  tableName: string,
  rowJson: string,
  tableScope: string = CustomTableScope.Scoped
): TableInsertEffect {
  return new TableInsertEffect(tableName, rowJson, tableScope);
}

export function createTableUpsertEffect(
  tableName: string,
  rowJson: string,
  tableScope: string = CustomTableScope.Scoped
): TableUpsertEffect {
  return new TableUpsertEffect(tableName, rowJson, tableScope);
}

export function createTableInsertEffectMsgpack(
  tableName: string,
  rowMsgpack: Uint8Array,
  tableScope: string = CustomTableScope.Scoped
): TableInsertMsgpackEffect {
  return new TableInsertMsgpackEffect(tableName, rowMsgpack, tableScope);
}

export function createTableUpsertEffectMsgpack(
  tableName: string,
  rowMsgpack: Uint8Array,
  tableScope: string = CustomTableScope.Scoped
): TableUpsertMsgpackEffect {
  return new TableUpsertMsgpackEffect(tableName, rowMsgpack, tableScope);
}

export function createTableUpdateWhereEffect(
  tableName: string,
  predicateJson: string,
  updatesJson: string,
  limit: i32 = 0,
  tableScope: string = CustomTableScope.Scoped
): TableUpdateWhereEffect {
  return new TableUpdateWhereEffect(tableName, predicateJson, updatesJson, limit, tableScope);
}

export function createTableDeleteWhereEffect(
  tableName: string,
  predicateJson: string,
  limit: i32 = 0,
  tableScope: string = CustomTableScope.Scoped
): TableDeleteWhereEffect {
  return new TableDeleteWhereEffect(tableName, predicateJson, limit, tableScope);
}

export function createTableSetWhereEqEffect(
  tableName: string,
  whereColumn: string,
  whereValueJson: string,
  setColumn: string,
  setValueJson: string,
  limit: i32 = 0,
  tableScope: string = CustomTableScope.Scoped
): TableSetWhereEqEffect {
  return new TableSetWhereEqEffect(
    tableName,
    whereColumn,
    whereValueJson,
    setColumn,
    setValueJson,
    limit,
    tableScope
  );
}

export function createTableIncWhereEqEffect(
  tableName: string,
  whereColumn: string,
  whereValueJson: string,
  targetColumn: string,
  amountJson: string,
  limit: i32 = 0,
  tableScope: string = CustomTableScope.Scoped
): TableIncWhereEqEffect {
  return new TableIncWhereEqEffect(
    tableName,
    whereColumn,
    whereValueJson,
    targetColumn,
    amountJson,
    limit,
    tableScope
  );
}

export function createTableDecWhereEqEffect(
  tableName: string,
  whereColumn: string,
  whereValueJson: string,
  targetColumn: string,
  amountJson: string,
  limit: i32 = 0,
  tableScope: string = CustomTableScope.Scoped
): TableDecWhereEqEffect {
  return new TableDecWhereEqEffect(
    tableName,
    whereColumn,
    whereValueJson,
    targetColumn,
    amountJson,
    limit,
    tableScope
  );
}

export function createTableAssertEqWhereEqEffect(
  tableName: string,
  whereColumn: string,
  whereValueJson: string,
  assertColumn: string,
  expectedValueJson: string,
  limit: i32 = 0,
  tableScope: string = CustomTableScope.Scoped
): TableAssertEqWhereEqEffect {
  return new TableAssertEqWhereEqEffect(
    tableName,
    whereColumn,
    whereValueJson,
    assertColumn,
    expectedValueJson,
    limit,
    tableScope
  );
}

export function createTableCasSetWhereEqEffect(
  tableName: string,
  whereColumn: string,
  whereValueJson: string,
  assertColumn: string,
  expectedValueJson: string,
  setColumn: string,
  setValueJson: string,
  limit: i32 = 0,
  tableScope: string = CustomTableScope.Scoped
): TableCasSetWhereEqEffect {
  return new TableCasSetWhereEqEffect(
    tableName,
    whereColumn,
    whereValueJson,
    assertColumn,
    expectedValueJson,
    setColumn,
    setValueJson,
    limit,
    tableScope
  );
}

export class Principal {
  static user(address: string): string {
    return "user:" + address;
  }

  static scope(scopeId: string): string {
    return "scope:" + scopeId;
  }
}

export class Effects {
  static namedBytes(effectType: string, dataBytes: Uint8Array): NamedBytesEffect {
    return createNamedBytesEffect(effectType, dataBytes);
  }

  static rotateSeed(): RotateSeedEffect {
    return createRotateSeedEffect();
  }

  static bankTransfer(
    fromPrincipal: string,
    toPrincipal: string,
    assetId: string,
    amount: string,
    authId: string | null = null
  ): BankTransferEffect {
    return createBankTransferEffect(fromPrincipal, toPrincipal, assetId, amount, authId);
  }

  static scopeSet(key: string, valueBytes: Uint8Array): ScopeDataSetEffect {
    return createScopeDataSetEffect(key, valueBytes);
  }

  static scopeDel(key: string): ScopeDataDelEffect {
    return createScopeDataDelEffect(key);
  }

  static scopeInc(key: string, amount: string, failOnError: bool = true): ScopeDataIncEffect {
    return createScopeDataIncEffect(key, amount, failOnError);
  }

  static scopeDec(key: string, amount: string, failOnError: bool = true): ScopeDataDecEffect {
    return createScopeDataDecEffect(key, amount, failOnError);
  }

  static scopeMax(key: string, amount: string, failOnError: bool = true): ScopeDataMaxEffect {
    return createScopeDataMaxEffect(key, amount, failOnError);
  }

  static scopeMin(key: string, amount: string, failOnError: bool = true): ScopeDataMinEffect {
    return createScopeDataMinEffect(key, amount, failOnError);
  }

  static baseSet(key: string, valueBytes: Uint8Array): ScopeDataSetEffect {
    return createBaseDataSetEffect(key, valueBytes);
  }

  static baseDel(key: string): ScopeDataDelEffect {
    return createBaseDataDelEffect(key);
  }

  static baseInc(key: string, amount: string, failOnError: bool = true): ScopeDataIncEffect {
    return createBaseDataIncEffect(key, amount, failOnError);
  }

  static baseDec(key: string, amount: string, failOnError: bool = true): ScopeDataDecEffect {
    return createBaseDataDecEffect(key, amount, failOnError);
  }

  static baseMax(key: string, amount: string, failOnError: bool = true): ScopeDataMaxEffect {
    return createBaseDataMaxEffect(key, amount, failOnError);
  }

  static baseMin(key: string, amount: string, failOnError: bool = true): ScopeDataMinEffect {
    return createBaseDataMinEffect(key, amount, failOnError);
  }

  static assertEq(
    key: string,
    expectedValueBytes: Uint8Array,
    errorCode: string | null = null,
    errorMessage: string | null = null
  ): AssertStateEqEffect {
    return createAssertStateEqEffect(key, expectedValueBytes, errorCode, errorMessage);
  }

  static assertContains(
    key: string,
    expectedString: string,
    errorCode: string | null = null,
    errorMessage: string | null = null
  ): AssertStateContainsEffect {
    return createAssertStateContainsEffect(key, expectedString, errorCode, errorMessage);
  }

  static assertGt(
    key: string,
    thresholdValueBytes: Uint8Array,
    errorCode: string | null = null,
    errorMessage: string | null = null
  ): AssertStateGtEffect {
    return createAssertStateGtEffect(key, thresholdValueBytes, errorCode, errorMessage);
  }

  static assertGte(
    key: string,
    thresholdValueBytes: Uint8Array,
    errorCode: string | null = null,
    errorMessage: string | null = null
  ): AssertStateGteEffect {
    return createAssertStateGteEffect(key, thresholdValueBytes, errorCode, errorMessage);
  }

  static assertLt(
    key: string,
    thresholdValueBytes: Uint8Array,
    errorCode: string | null = null,
    errorMessage: string | null = null
  ): AssertStateLtEffect {
    return createAssertStateLtEffect(key, thresholdValueBytes, errorCode, errorMessage);
  }

  static assertLte(
    key: string,
    thresholdValueBytes: Uint8Array,
    errorCode: string | null = null,
    errorMessage: string | null = null
  ): AssertStateLteEffect {
    return createAssertStateLteEffect(key, thresholdValueBytes, errorCode, errorMessage);
  }

  static tableCreated(
    tableId: string,
    gameType: string,
    tableMode: string,
    scopeId: string,
    isPrivate: bool,
    inviteCode: string | null,
    entryFee: string | null,
    token: string | null,
    minPlayers: i32,
    maxPlayers: i32,
    createdBy: string,
    customMetadata: string | null = null
  ): TableCreatedEffect {
    return createTableCreatedEffect(
      tableId,
      gameType,
      tableMode,
      scopeId,
      isPrivate,
      inviteCode,
      entryFee,
      token,
      minPlayers,
      maxPlayers,
      createdBy,
      customMetadata
    );
  }

  static tablePlayerJoined(tableId: string, userId: string): TablePlayerJoinedEffect {
    return createTablePlayerJoinedEffect(tableId, userId);
  }

  static tablePlayerLeft(tableId: string, userId: string): TablePlayerLeftEffect {
    return createTablePlayerLeftEffect(tableId, userId);
  }

  static tableStarted(tableId: string): TableStartedEffect {
    return createTableStartedEffect(tableId);
  }

  static tableFinished(tableId: string, winner: string): TableFinishedEffect {
    return createTableFinishedEffect(tableId, winner);
  }

  static tableClosed(tableId: string, reason: string): TableClosedEffect {
    return createTableClosedEffect(tableId, reason);
  }

  static tableMetadataUpdate(tableId: string, metadataJson: string): TableMetadataUpdateEffect {
    return createTableMetadataUpdateEffect(tableId, metadataJson);
  }

  static tableInsert(
    tableName: string,
    rowJson: string,
    tableScope: string = CustomTableScope.Scoped
  ): TableInsertEffect {
    return createTableInsertEffect(tableName, rowJson, tableScope);
  }

  static tableUpsert(
    tableName: string,
    rowJson: string,
    tableScope: string = CustomTableScope.Scoped
  ): TableUpsertEffect {
    return createTableUpsertEffect(tableName, rowJson, tableScope);
  }
}
