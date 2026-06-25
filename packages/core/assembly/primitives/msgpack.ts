/**
 * Minimal MessagePack encoder for AssemblyScript
 * Supports: nil, bool, i32, i64, f64, string, array, object
 * 
 * MessagePack format reference:
 * - nil: 0xc0
 * - false: 0xc2, true: 0xc3
 * - positive fixint: 0x00-0x7f
 * - uint8: 0xcc + u8
 * - uint16: 0xcd + u16 (big-endian)
 * - uint32: 0xce + u32 (big-endian)
 * - int8: 0xd0 + i8
 * - int16: 0xd1 + i16 (big-endian)
 * - int32: 0xd2 + i32 (big-endian)
 * - int64: 0xd3 + i64 (big-endian)
 * - float64: 0xcb + f64 (big-endian)
 * - fixstr: 0xa0-0xbf (length 0-31)
 * - str8: 0xd9 + u8 + bytes
 * - str16: 0xda + u16 + bytes
 * - str32: 0xdb + u32 + bytes
 * - fixarray: 0x90-0x9f (length 0-15)
 * - array16: 0xdc + u16 + items
 * - array32: 0xdd + u32 + items
 * - fixmap: 0x80-0x8f (length 0-15)
 * - map16: 0xde + u16 + key-value pairs
 * - map32: 0xdf + u32 + key-value pairs
 * - bin8: 0xc4 + u8 + bytes
 * - bin16: 0xc5 + u16 + bytes
 * - bin32: 0xc6 + u32 + bytes
 */

import { scratch_alloc } from "../core/wasm";

// Note: __new, __pin, __unpin are provided by the AssemblyScript runtime
// They should be available globally, but we declare them here for type checking
// The linker will provide the actual implementations

// Helper to write bytes to memory at a specific offset
// Returns the new offset after writing
function writeByte(ptr: usize, offset: usize, value: u8): usize {
  const writePtr = ptr + offset;
  store<u8>(writePtr, value);
  // Verify write
  const readBack = load<u8>(writePtr);
  if (readBack != value) {
    // Write verification failed - this shouldn't happen
    // For now, we'll continue but this indicates a problem
  }
  return offset + 1;
}

function writeU16(ptr: usize, offset: usize, value: u16): usize {
  // Big-endian
  store<u8>(ptr + offset, (value >> 8) as u8);
  store<u8>(ptr + offset + 1, (value & 0xff) as u8);
  return offset + 2;
}

function writeU32(ptr: usize, offset: usize, value: u32): usize {
  // Big-endian
  store<u8>(ptr + offset, ((value >> 24) & 0xff) as u8);
  store<u8>(ptr + offset + 1, ((value >> 16) & 0xff) as u8);
  store<u8>(ptr + offset + 2, ((value >> 8) & 0xff) as u8);
  store<u8>(ptr + offset + 3, (value & 0xff) as u8);
  return offset + 4;
}

function writeI64(ptr: usize, offset: usize, value: i64): usize {
  // Big-endian
  const u64Value = value as u64;
  store<u8>(ptr + offset, ((u64Value >> 56) & 0xff) as u8);
  store<u8>(ptr + offset + 1, ((u64Value >> 48) & 0xff) as u8);
  store<u8>(ptr + offset + 2, ((u64Value >> 40) & 0xff) as u8);
  store<u8>(ptr + offset + 3, ((u64Value >> 32) & 0xff) as u8);
  store<u8>(ptr + offset + 4, ((u64Value >> 24) & 0xff) as u8);
  store<u8>(ptr + offset + 5, ((u64Value >> 16) & 0xff) as u8);
  store<u8>(ptr + offset + 6, ((u64Value >> 8) & 0xff) as u8);
  store<u8>(ptr + offset + 7, (u64Value & 0xff) as u8);
  return offset + 8;
}

function writeF64(ptr: usize, offset: usize, value: f64): usize {
  // Big-endian IEEE 754 double
  // AssemblyScript doesn't have DataView, so we need to manually extract bytes
  // Using memory.store with proper byte order
  const u64Value = reinterpret<u64>(value);
  store<u8>(ptr + offset, ((u64Value >> 56) & 0xff) as u8);
  store<u8>(ptr + offset + 1, ((u64Value >> 48) & 0xff) as u8);
  store<u8>(ptr + offset + 2, ((u64Value >> 40) & 0xff) as u8);
  store<u8>(ptr + offset + 3, ((u64Value >> 32) & 0xff) as u8);
  store<u8>(ptr + offset + 4, ((u64Value >> 24) & 0xff) as u8);
  store<u8>(ptr + offset + 5, ((u64Value >> 16) & 0xff) as u8);
  store<u8>(ptr + offset + 6, ((u64Value >> 8) & 0xff) as u8);
  store<u8>(ptr + offset + 7, (u64Value & 0xff) as u8);
  return offset + 8;
}

// Encode a string as UTF-8 bytes
function encodeString(ptr: usize, offset: usize, s: string): usize {
  const utf8Len = String.UTF8.byteLength(s);
  
  if (utf8Len <= 31) {
    // fixstr: 0xa0-0xbf
    offset = writeByte(ptr, offset, (0xa0 + utf8Len) as u8);
  } else if (utf8Len <= 255) {
    // str8: 0xd9 + u8
    offset = writeByte(ptr, offset, 0xd9);
    offset = writeByte(ptr, offset, utf8Len as u8);
  } else if (utf8Len <= 65535) {
    // str16: 0xda + u16
    offset = writeByte(ptr, offset, 0xda);
    offset = writeU16(ptr, offset, utf8Len as u16);
  } else {
    // str32: 0xdb + u32
    offset = writeByte(ptr, offset, 0xdb);
    offset = writeU32(ptr, offset, utf8Len as u32);
  }
  
  // Write UTF-8 bytes directly into buffer
  const written = String.UTF8.encodeUnsafe(
    changetype<usize>(s),
    s.length,
    (ptr + offset) as usize
  );
  return offset + written;
}

/**
 * Encode a value to MessagePack format
 * Returns (ptr, len) where ptr points to the encoded bytes
 */
export class MessagePackEncoder {
  private buffer: usize = 0;
  private offset: usize = 0;
  private capacity: usize = 0;

  constructor(initialCapacity: i32 = 65536) {
    this.capacity = initialCapacity as usize;
    // Use scratch_alloc for now - it's simpler and works with the existing memory management
    // We can switch to __new/ArrayBuffer later if needed
    const bufPtr = scratch_alloc(initialCapacity);
    if (bufPtr == 0) {
      throw new Error("Failed to allocate MessagePack buffer");
    }
    this.buffer = bufPtr as usize;
    this.offset = 0;
  }

  private ensureCapacity(needed: usize): void {
    const required = this.offset + needed;
    if (required > this.capacity) {
      // Buffer too small — grow by doubling until it fits, allocate a
      // fresh region from scratch space, copy what we've encoded so far
      // into it, and continue. The old region's bytes become "leaked"
      // until the next `scratch_reset()` (which fires between contract
      // calls anyway), so the only cost is some throwaway scratch space
      // for the rest of this call. Without this growth path, encoding
      // any payload bigger than `initialCapacity` traps the WASM —
      // surfaced in production as the kill-shot panic in battleship
      // when a long real-money game's history capsule (50+ attacks per
      // player) overflowed the 1024-byte default.
      let newCapacity: usize = this.capacity > 0 ? this.capacity * 2 : 1024;
      while (newCapacity < required) newCapacity = newCapacity * 2;
      const newPtr = scratch_alloc(newCapacity as i32);
      if (newPtr == 0) {
        throw new Error("Failed to grow MessagePack buffer");
      }
      if (this.offset > 0) {
        memory.copy(newPtr as usize, this.buffer, this.offset);
      }
      this.buffer = newPtr as usize;
      this.capacity = newCapacity;
    }
  }

  encodeNil(): void {
    this.ensureCapacity(1);
    store<u8>(this.buffer + this.offset, 0xc0);
    this.offset = this.offset + 1;
  }

  encodeBool(value: bool): void {
    this.ensureCapacity(1);
    this.offset = writeByte(this.buffer, this.offset, value ? 0xc3 : 0xc2);
  }

  encodeI32(value: i32): void {
    if (value >= 0 && value <= 127) {
      // positive fixint
      this.ensureCapacity(1);
      this.offset = writeByte(this.buffer, this.offset, value as u8);
    } else if (value >= -32 && value < 0) {
      // negative fixint
      this.ensureCapacity(1);
      this.offset = writeByte(this.buffer, this.offset, (0xe0 + (value + 32)) as u8);
    } else if (value >= -128 && value <= 127) {
      // int8
      this.ensureCapacity(2);
      this.offset = writeByte(this.buffer, this.offset, 0xd0);
      this.offset = writeByte(this.buffer, this.offset, value as u8);
    } else if (value >= -32768 && value <= 32767) {
      // int16
      this.ensureCapacity(3);
      this.offset = writeByte(this.buffer, this.offset, 0xd1);
      this.offset = writeU16(this.buffer, this.offset, value as u16);
    } else {
      // int32
      this.ensureCapacity(5);
      this.offset = writeByte(this.buffer, this.offset, 0xd2);
      this.offset = writeU32(this.buffer, this.offset, value as u32);
    }
  }

  encodeI64(value: i64): void {
    if (value >= -2147483648 && value <= 2147483647) {
      // Can fit in int32
      this.encodeI32(value as i32);
    } else {
      // int64
      this.ensureCapacity(9);
      this.offset = writeByte(this.buffer, this.offset, 0xd3);
      this.offset = writeI64(this.buffer, this.offset, value);
    }
  }

  encodeBin(bytes: Uint8Array): void {
    const len = bytes.length as usize;
    if (len <= 0xff) {
      this.ensureCapacity(2 + len);
      this.offset = writeByte(this.buffer, this.offset, 0xc4);
      this.offset = writeByte(this.buffer, this.offset, len as u8);
    } else if (len <= 0xffff) {
      this.ensureCapacity(3 + len);
      this.offset = writeByte(this.buffer, this.offset, 0xc5);
      this.offset = writeU16(this.buffer, this.offset, len as u16);
    } else {
      this.ensureCapacity(5 + len);
      this.offset = writeByte(this.buffer, this.offset, 0xc6);
      this.offset = writeU32(this.buffer, this.offset, len as u32);
    }

    // Write raw bytes
    for (let i = 0; i < bytes.length; i++) {
      store<u8>(this.buffer + this.offset + i, bytes[i]);
    }
    this.offset = this.offset + len;
  }

  encodeF64(value: f64): void {
    this.ensureCapacity(9);
    this.offset = writeByte(this.buffer, this.offset, 0xcb);
    this.offset = writeF64(this.buffer, this.offset, value);
  }

  encodeString(value: string): void {
    const utf8Len = String.UTF8.byteLength(value);
    let headerLen: usize = 0;
    
    if (utf8Len <= 31) {
      headerLen = 1;
    } else if (utf8Len <= 255) {
      headerLen = 2;
    } else if (utf8Len <= 65535) {
      headerLen = 3;
    } else {
      headerLen = 5;
    }
    
    this.ensureCapacity(headerLen + utf8Len);
    // Use the standalone encodeString function which writes directly to buffer+offset
    const newOffset = encodeString(this.buffer, this.offset, value);
    this.offset = newOffset;
  }

  encodeArrayStart(length: i32): void {
    if (length <= 15) {
      // fixarray
      this.ensureCapacity(1);
      this.offset = writeByte(this.buffer, this.offset, (0x90 + length) as u8);
    } else if (length <= 65535) {
      // array16
      this.ensureCapacity(3);
      this.offset = writeByte(this.buffer, this.offset, 0xdc);
      this.offset = writeU16(this.buffer, this.offset, length as u16);
    } else {
      // array32
      this.ensureCapacity(5);
      this.offset = writeByte(this.buffer, this.offset, 0xdd);
      this.offset = writeU32(this.buffer, this.offset, length as u32);
    }
  }

  encodeMapStart(length: i32): void {
    if (length <= 15) {
      // fixmap: 0x80-0x8f for maps with 0-15 elements
      this.ensureCapacity(1);
      const writePtr = this.buffer + this.offset;
      const byteValue = (0x80 + length) as u8;
      store<u8>(writePtr, byteValue);
      // Verify the write
      const readBack = load<u8>(writePtr);
      if (readBack != byteValue) {
        // Write failed - this is a critical error
        // For now, we'll continue but this indicates a serious problem
      }
      this.offset = this.offset + 1;
    } else if (length <= 65535) {
      // map16
      this.ensureCapacity(3);
      store<u8>(this.buffer + this.offset, 0xde);
      this.offset = this.offset + 1;
      store<u8>(this.buffer + this.offset, ((length >> 8) & 0xff) as u8);
      store<u8>(this.buffer + this.offset + 1, (length & 0xff) as u8);
      this.offset = this.offset + 2;
    } else {
      // map32
      this.ensureCapacity(5);
      store<u8>(this.buffer + this.offset, 0xdf);
      this.offset = this.offset + 1;
      const lenU32 = length as u32;
      store<u8>(this.buffer + this.offset, ((lenU32 >> 24) & 0xff) as u8);
      store<u8>(this.buffer + this.offset + 1, ((lenU32 >> 16) & 0xff) as u8);
      store<u8>(this.buffer + this.offset + 2, ((lenU32 >> 8) & 0xff) as u8);
      store<u8>(this.buffer + this.offset + 3, (lenU32 & 0xff) as u8);
      this.offset = this.offset + 4;
    }
  }

  /**
   * Get the encoded buffer as (ptr, len)
   * The buffer is owned by the scratch allocator and will be reset on next call
   */
  getBuffer(): i32 {
    // Return the buffer pointer - this should be valid
    return this.buffer as i32;
  }
  
  /**
   * Get the buffer pointer as usize (for internal use)
   */
  getBufferPtr(): usize {
    return this.buffer;
  }
  
  /**
   * Set the offset (for manual encoding)
   */
  setOffset(offset: usize): void {
    this.offset = offset;
  }

  getLength(): i32 {
    return this.offset as i32;
  }
}

/**
 * Encode a Map<string, string> to MessagePack
 * Returns (ptr, len) packed as i64: high 32 bits = len, low 32 bits = ptr
 */
export function encodeMapToMsgPack(map: Map<string, string>): i64 {
  const keys = map.keys();
  const length = keys.length;
  
  // Calculate total size needed for MessagePack encoding
  // Map header: 1 byte (fixmap) or 3 bytes (map16) or 5 bytes (map32)
  let totalSize: usize = length <= 15 ? 1 : (length <= 65535 ? 3 : 5);
  
  // Calculate size for each key-value pair
  for (let i = 0; i < length; i++) {
    const key = keys[i];
    if (key !== null) {
      const keyLen = String.UTF8.byteLength(key);
      // Key encoding: fixstr (1 byte) or str8 (2 bytes) or str16 (3 bytes) or str32 (5 bytes) + key data
      if (keyLen <= 31) {
        totalSize = totalSize + 1 + keyLen;
      } else if (keyLen <= 255) {
        totalSize = totalSize + 2 + keyLen;
      } else if (keyLen <= 65535) {
        totalSize = totalSize + 3 + keyLen;
      } else {
        totalSize = totalSize + 5 + keyLen;
      }
      
      const value = map.get(key);
      if (value !== null) {
        const valueLen = String.UTF8.byteLength(value);
        // Value encoding: fixstr (1 byte) or str8 (2 bytes) or str16 (3 bytes) or str32 (5 bytes) + value data
        if (valueLen <= 31) {
          totalSize = totalSize + 1 + valueLen;
        } else if (valueLen <= 255) {
          totalSize = totalSize + 2 + valueLen;
        } else if (valueLen <= 65535) {
          totalSize = totalSize + 3 + valueLen;
        } else {
          totalSize = totalSize + 5 + valueLen;
        }
      } else {
        // nil: 1 byte
        totalSize = totalSize + 1;
      }
    }
  }
  
  // Allocate buffer with calculated size + some headroom
  // Use the exact calculated size (no cap needed since we calculated it correctly)
  const allocSize = (totalSize + 100) as i32;
  const bufPtr = scratch_alloc(allocSize);
  if (bufPtr == 0) {
    return 0; // Allocation failed - telemetry will be read by Rust
  }
  const bufPtrU = bufPtr as usize;
  
  // Verify allocation is within bounds
  const curBytes = (memory.size() as usize) * 65536;
  if (bufPtrU + totalSize > curBytes) {
    // Allocation succeeded but would write out of bounds - this shouldn't happen
    return 0;
  }
  
  let offset: usize = 0;
  
  // Write map header
  if (length == 0) {
    store<u8>(bufPtrU, 0x80);
    offset = 1;
  } else {
    store<u8>(bufPtrU, (0x80 + length) as u8);
    offset = 1;
    
    // Encode key-value pairs
    for (let i = 0; i < length; i++) {
      const key = keys[i];
      if (key !== null) {
        // Encode key string
        const keyUtf8Len = String.UTF8.byteLength(key);
        if (keyUtf8Len <= 31) {
          // fixstr: 0xa0-0xbf
          store<u8>(bufPtrU + offset, (0xa0 + keyUtf8Len) as u8);
          offset = offset + 1;
        } else if (keyUtf8Len <= 255) {
          // str8: 0xd9 + u8
          store<u8>(bufPtrU + offset, 0xd9);
          store<u8>(bufPtrU + offset + 1, keyUtf8Len as u8);
          offset = offset + 2;
        } else if (keyUtf8Len <= 65535) {
          // str16: 0xda + u16 (big-endian)
          store<u8>(bufPtrU + offset, 0xda);
          store<u8>(bufPtrU + offset + 1, ((keyUtf8Len >> 8) & 0xff) as u8);
          store<u8>(bufPtrU + offset + 2, (keyUtf8Len & 0xff) as u8);
          offset = offset + 3;
        } else {
          // str32: 0xdb + u32 (big-endian)
          store<u8>(bufPtrU + offset, 0xdb);
          const lenU32 = keyUtf8Len as u32;
          store<u8>(bufPtrU + offset + 1, ((lenU32 >> 24) & 0xff) as u8);
          store<u8>(bufPtrU + offset + 2, ((lenU32 >> 16) & 0xff) as u8);
          store<u8>(bufPtrU + offset + 3, ((lenU32 >> 8) & 0xff) as u8);
          store<u8>(bufPtrU + offset + 4, (lenU32 & 0xff) as u8);
          offset = offset + 5;
        }
        const keyBuf = String.UTF8.encode(key, false);
        const keyPtr = changetype<usize>(keyBuf);
        const curBytes = (memory.size() as usize) * 65536;
        if ((bufPtrU + offset + keyUtf8Len) > curBytes) {
          return 0;
        }
        memory.copy(bufPtrU + offset, keyPtr, keyUtf8Len);
        offset = offset + keyUtf8Len;
        
        const value = map.get(key);
        if (value !== null) {
          // Encode value string
          const valueUtf8Len = String.UTF8.byteLength(value);
          if (valueUtf8Len <= 31) {
            // fixstr: 0xa0-0xbf
            store<u8>(bufPtrU + offset, (0xa0 + valueUtf8Len) as u8);
            offset = offset + 1;
          } else if (valueUtf8Len <= 255) {
            // str8: 0xd9 + u8
            store<u8>(bufPtrU + offset, 0xd9);
            store<u8>(bufPtrU + offset + 1, valueUtf8Len as u8);
            offset = offset + 2;
          } else if (valueUtf8Len <= 65535) {
            // str16: 0xda + u16 (big-endian)
            store<u8>(bufPtrU + offset, 0xda);
            store<u8>(bufPtrU + offset + 1, ((valueUtf8Len >> 8) & 0xff) as u8);
            store<u8>(bufPtrU + offset + 2, (valueUtf8Len & 0xff) as u8);
            offset = offset + 3;
          } else {
            // str32: 0xdb + u32 (big-endian)
            store<u8>(bufPtrU + offset, 0xdb);
            const lenU32 = valueUtf8Len as u32;
            store<u8>(bufPtrU + offset + 1, ((lenU32 >> 24) & 0xff) as u8);
            store<u8>(bufPtrU + offset + 2, ((lenU32 >> 16) & 0xff) as u8);
            store<u8>(bufPtrU + offset + 3, ((lenU32 >> 8) & 0xff) as u8);
            store<u8>(bufPtrU + offset + 4, (lenU32 & 0xff) as u8);
            offset = offset + 5;
          }
          const valueBuf = String.UTF8.encode(value, false);
          const valuePtr = changetype<usize>(valueBuf);
          const curBytes = (memory.size() as usize) * 65536;
          if ((bufPtrU + offset + valueUtf8Len) > curBytes) {
            return 0;
          }
          memory.copy(bufPtrU + offset, valuePtr, valueUtf8Len);
          offset = offset + valueUtf8Len;
        } else {
          store<u8>(bufPtrU + offset, 0xc0);
          offset = offset + 1;
        }
      }
    }
  }
  
  // CRITICAL: Verify the first byte was written before returning
  const firstByteCheck = load<u8>(bufPtrU);
  if (firstByteCheck == 0 && length > 0) {
    // Write failed - try one more time right before returning
    store<u8>(bufPtrU, (0x80 + length) as u8);
  }
  
  // Pack (ptr, len) into i64: high 32 bits = len, low 32 bits = ptr
  return (<i64>offset << 32) | (<i64>bufPtr & 0xffffffff);
}
