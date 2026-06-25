// @ts-nocheck
/**
 * Minimal Borsh decoding helpers for contract args/views.
 * Supports little-endian primitives and UTF-8 strings.
 */

export class BorshReader {
  private bytes: Uint8Array;
  private offset: i32 = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  get position(): i32 {
    return this.offset;
  }

  get remaining(): i32 {
    return this.bytes.length - this.offset;
  }

  private ensure(size: i32): void {
    if (size < 0 || this.offset + size > this.bytes.length) {
      throw new Error("Borsh decode out of bounds");
    }
  }

  readU8(): u8 {
    this.ensure(1);
    const out = this.bytes[this.offset];
    this.offset += 1;
    return out;
  }

  readU32LE(): u32 {
    this.ensure(4);
    const b0 = <u32>this.bytes[this.offset];
    const b1 = (<u32>this.bytes[this.offset + 1]) << 8;
    const b2 = (<u32>this.bytes[this.offset + 2]) << 16;
    const b3 = (<u32>this.bytes[this.offset + 3]) << 24;
    this.offset += 4;
    return b0 | b1 | b2 | b3;
  }

  readString(): string {
    const len = <i32>this.readU32LE();
    this.ensure(len);
    const start = this.offset;
    const end = start + len;
    const copy = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      copy[i] = this.bytes[start + i];
    }
    this.offset = end;
    return String.UTF8.decode(changetype<ArrayBuffer>(copy.buffer));
  }

  readOptionString(): string | null {
    const tag = this.readU8();
    if (tag == 0) return null;
    if (tag != 1) throw new Error("Invalid Borsh option tag");
    return this.readString();
  }
}
