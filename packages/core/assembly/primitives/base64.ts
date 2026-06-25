// @ts-nocheck
/**
 * Base64 encoding utilities (AssemblyScript)
 *
 * Encodes raw bytes to base64 string. No decoding is provided here.
 */

const BASE64_TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Encode bytes at memory pointer to base64 string.
 */
export function encodeBase64FromPtr(ptr: usize, len: i32): string {
  if (len <= 0) return "";

  let out = "";
  let i: i32 = 0;
  while (i + 2 < len) {
    const b0 = load<u8>(ptr + i) as i32;
    const b1 = load<u8>(ptr + i + 1) as i32;
    const b2 = load<u8>(ptr + i + 2) as i32;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += BASE64_TABLE.charAt((n >> 18) & 63);
    out += BASE64_TABLE.charAt((n >> 12) & 63);
    out += BASE64_TABLE.charAt((n >> 6) & 63);
    out += BASE64_TABLE.charAt(n & 63);
    i += 3;
  }

  const remaining = len - i;
  if (remaining == 1) {
    const b0 = load<u8>(ptr + i) as i32;
    const n = b0 << 16;
    out += BASE64_TABLE.charAt((n >> 18) & 63);
    out += BASE64_TABLE.charAt((n >> 12) & 63);
    out += "==";
  } else if (remaining == 2) {
    const b0 = load<u8>(ptr + i) as i32;
    const b1 = load<u8>(ptr + i + 1) as i32;
    const n = (b0 << 16) | (b1 << 8);
    out += BASE64_TABLE.charAt((n >> 18) & 63);
    out += BASE64_TABLE.charAt((n >> 12) & 63);
    out += BASE64_TABLE.charAt((n >> 6) & 63);
    out += "=";
  }

  return out;
}

/**
 * Encode a Uint8Array to base64 string.
 */
export function encodeBase64(bytes: Uint8Array): string {
  if (bytes.length == 0) return "";
  const ptr = changetype<usize>(bytes.buffer) + bytes.byteOffset;
  return encodeBase64FromPtr(ptr, bytes.length);
}
