// @ts-nocheck
/**
 * Raw argument bytes for the currently executing entrypoint.
 *
 * This enables byte-oriented contracts (e.g., MessagePack/Borsh/custom formats)
 * to parse args directly without forcing JSON decoding in wrappers.
 */

import { decodeMsgpack, MsgpackKind, MsgpackValue, msgpackKindName } from "../primitives/msgpack_decode";

let currentArgsBytes: Uint8Array = new Uint8Array(0);
let currentStateBytes: Uint8Array = new Uint8Array(0);

/** Internal: set by the entrypoint router before dispatching handlers. */
export function __setCurrentArgsBytes(bytes: Uint8Array): void {
  currentArgsBytes = bytes;
}

/** Returns raw args bytes for the current call. */
export function getCurrentArgsBytes(): Uint8Array {
  return currentArgsBytes;
}

/** Internal: set by the entrypoint router before dispatching handlers. */
export function __setCurrentStateBytes(bytes: Uint8Array): void {
  currentStateBytes = bytes;
}

/** Returns raw state bytes for the current call. */
export function getCurrentStateBytes(): Uint8Array {
  return currentStateBytes;
}

export function decodeArgsBytesToMsgpackValue(bytes: Uint8Array): MsgpackValue {
  return decodeMsgpack(bytes);
}

export function decodeStateBytesToMsgpackValue(bytes: Uint8Array): MsgpackValue {
  return decodeMsgpack(bytes);
}

/**
 * Decode MessagePack args that use Arcana's positional array convention.
 * Empty args return an empty array; malformed non-array args throw.
 */
export function decodeArgsArray(bytes: Uint8Array): Array<MsgpackValue> {
  if (bytes.length == 0) return new Array<MsgpackValue>(0);
  const decoded = decodeArgsBytesToMsgpackValue(bytes);
  if (decoded.kind != MsgpackKind.Array) {
    throw new Error("Expected MessagePack args array");
  }
  return decoded.arr;
}

/**
 * Decode MessagePack state that uses Arcana's positional array convention.
 * Empty state returns an empty array; malformed non-array state throws.
 */
export function decodeStateArray(bytes: Uint8Array): Array<MsgpackValue> {
  if (bytes.length == 0) return new Array<MsgpackValue>(0);
  const decoded = decodeStateBytesToMsgpackValue(bytes);
  if (decoded.kind != MsgpackKind.Array) {
    throw new Error(
      "Expected persisted MessagePack state array, got " +
      msgpackKindName(decoded.kind) +
      ". State bytes must be encoded from the storage view, not a public/caller-filtered view."
    );
  }
  return decoded.arr;
}
