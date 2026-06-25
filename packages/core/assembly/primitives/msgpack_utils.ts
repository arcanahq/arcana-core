// @ts-nocheck
/**
 * Helpers to encode MessagePack payloads to raw bytes.
 */

import { MessagePackEncoder, encodeMapToMsgPack } from "./msgpack";
import { MsgpackEncodable } from "../core/response";
/**
 * Encode a MsgpackEncodable object and return raw bytes.
 */
export function encodeMsgpackToBytes(encodable: MsgpackEncodable): Uint8Array {
  const encoder = new MessagePackEncoder();
  encodable.encodeToMsgpack(encoder);
  const len = encoder.getLength();
  const out = new Uint8Array(len);
  memory.copy(out.dataStart, encoder.getBufferPtr(), len);
  return out;
}

/**
 * Encode a Map<string,string> as MessagePack map and return raw bytes.
 */
export function encodeMsgpackMapToBytes(map: Map<string, string>): Uint8Array {
  const packed = encodeMapToMsgPack(map);
  const len = <i32>(packed >> 32);
  const ptr = <i32>(packed & 0xffffffff);
  const out = new Uint8Array(len);
  memory.copy(out.dataStart, ptr as usize, len);
  return out;
}
