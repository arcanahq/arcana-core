// @ts-nocheck
/**
 * Minimal MessagePack decoder for AssemblyScript.
 * Produces a tree of MsgpackValue objects (no JSON strings).
 */

export enum MsgpackKind {
  Null = 0,
  Bool = 1,
  I64 = 2,
  F64 = 3,
  String = 4,
  Array = 5,
  Map = 6,
  Binary = 7,
}

export class MsgpackValue {
  kind: MsgpackKind = MsgpackKind.Null;
  b: bool = false;
  i: i64 = 0;
  f: f64 = 0.0;
  s: string = "";
  arr: Array<MsgpackValue> = new Array<MsgpackValue>();
  map: Map<string, MsgpackValue> = new Map<string, MsgpackValue>();
  bin: Uint8Array = new Uint8Array(0);

  // Convenience aliases for legacy callers
  get bool(): bool { return this.b; }
  get i64(): i64 { return this.i; }
  get f64(): f64 { return this.f; }
  get str(): string { return this.s; }

  static makeNull(): MsgpackValue {
    return new MsgpackValue();
  }

  static makeBool(v: bool): MsgpackValue {
    const out = new MsgpackValue();
    out.kind = MsgpackKind.Bool;
    out.b = v;
    return out;
  }

  static makeI64(v: i64): MsgpackValue {
    const out = new MsgpackValue();
    out.kind = MsgpackKind.I64;
    out.i = v;
    return out;
  }

  static makeF64(v: f64): MsgpackValue {
    const out = new MsgpackValue();
    out.kind = MsgpackKind.F64;
    out.f = v;
    return out;
  }

  static makeString(v: string): MsgpackValue {
    const out = new MsgpackValue();
    out.kind = MsgpackKind.String;
    out.s = v;
    return out;
  }

  static makeArray(v: Array<MsgpackValue>): MsgpackValue {
    const out = new MsgpackValue();
    out.kind = MsgpackKind.Array;
    out.arr = v;
    return out;
  }

  static makeMap(v: Map<string, MsgpackValue>): MsgpackValue {
    const out = new MsgpackValue();
    out.kind = MsgpackKind.Map;
    out.map = v;
    return out;
  }

  static makeBinary(v: Uint8Array): MsgpackValue {
    const out = new MsgpackValue();
    out.kind = MsgpackKind.Binary;
    out.bin = v;
    return out;
  }
}

class MsgpackCursor {
  buf: Uint8Array;
  off: i32 = 0;
  constructor(buf: Uint8Array) {
    this.buf = buf;
  }
}

function readU8(c: MsgpackCursor): u8 {
  if (c.off >= c.buf.length) return 0;
  const v = c.buf[c.off];
  c.off++;
  return v;
}

function readU16(c: MsgpackCursor): u16 {
  const b0 = readU8(c) as u16;
  const b1 = readU8(c) as u16;
  return (b0 << 8) | b1;
}

function readU32(c: MsgpackCursor): u32 {
  const b0 = readU8(c) as u32;
  const b1 = readU8(c) as u32;
  const b2 = readU8(c) as u32;
  const b3 = readU8(c) as u32;
  return (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
}

function readI8(c: MsgpackCursor): i8 {
  return readU8(c) as i8;
}

function readI16(c: MsgpackCursor): i16 {
  return readU16(c) as i16;
}

function readI32(c: MsgpackCursor): i32 {
  return readU32(c) as i32;
}

function readI64(c: MsgpackCursor): i64 {
  const hi = readU32(c) as u64;
  const lo = readU32(c) as u64;
  return ((hi << 32) | lo) as i64;
}

function readU64(c: MsgpackCursor): u64 {
  const hi = readU32(c) as u64;
  const lo = readU32(c) as u64;
  return (hi << 32) | lo;
}

function readF32(c: MsgpackCursor): f32 {
  const bits = readU32(c);
  return reinterpret<f32>(bits);
}

function readF64(c: MsgpackCursor): f64 {
  const hi = readU32(c) as u64;
  const lo = readU32(c) as u64;
  const bits = (hi << 32) | lo;
  return reinterpret<f64>(bits);
}

function decodeUtf8Slice(buf: Uint8Array, start: i32, len: i32): string {
  if (len <= 0 || start < 0 || start + len > buf.length) return "";
  return String.UTF8.decodeUnsafe((buf.dataStart + start) as usize, len, false);
}

function decodeMsgpackValue(c: MsgpackCursor): MsgpackValue {
  const lead = readU8(c);

  // Positive fixint
  if (lead <= 0x7f) return MsgpackValue.makeI64(lead as i64);

  // Fixmap
  if ((lead & 0xf0) == 0x80) {
    const size = (lead & 0x0f) as i32;
    const out = new Map<string, MsgpackValue>();
    for (let i = 0; i < size; i++) {
      const k = decodeMsgpackValue(c);
      const v = decodeMsgpackValue(c);
      out.set(k.kind == MsgpackKind.String ? k.s : "", v);
    }
    return MsgpackValue.makeMap(out);
  }

  // Fixarray
  if ((lead & 0xf0) == 0x90) {
    const size = (lead & 0x0f) as i32;
    const out = new Array<MsgpackValue>(size);
    for (let i = 0; i < size; i++) out[i] = decodeMsgpackValue(c);
    return MsgpackValue.makeArray(out);
  }

  // Fixstr
  if ((lead & 0xe0) == 0xa0) {
    const len = (lead & 0x1f) as i32;
    const s = decodeUtf8Slice(c.buf, c.off, len);
    c.off += len;
    return MsgpackValue.makeString(s);
  }

  // Negative fixint
  if (lead >= 0xe0) return MsgpackValue.makeI64((lead as i8) as i64);

  if (lead == 0xc0) return MsgpackValue.makeNull();
  if (lead == 0xc2) return MsgpackValue.makeBool(false);
  if (lead == 0xc3) return MsgpackValue.makeBool(true);
  if (lead == 0xcc) return MsgpackValue.makeI64(readU8(c) as i64);
  if (lead == 0xcd) return MsgpackValue.makeI64(readU16(c) as i64);
  if (lead == 0xce) return MsgpackValue.makeI64(readU32(c) as i64);
  if (lead == 0xcf) return MsgpackValue.makeI64(readU64(c) as i64);
  if (lead == 0xd0) return MsgpackValue.makeI64(readI8(c) as i64);
  if (lead == 0xd1) return MsgpackValue.makeI64(readI16(c) as i64);
  if (lead == 0xd2) return MsgpackValue.makeI64(readI32(c) as i64);
  if (lead == 0xd3) return MsgpackValue.makeI64(readI64(c));
  if (lead == 0xca) return MsgpackValue.makeF64(readF32(c) as f64);
  if (lead == 0xcb) return MsgpackValue.makeF64(readF64(c));

  if (lead == 0xd9) {
    const len = readU8(c) as i32;
    const s = decodeUtf8Slice(c.buf, c.off, len);
    c.off += len;
    return MsgpackValue.makeString(s);
  }
  if (lead == 0xda) {
    const len = readU16(c) as i32;
    const s = decodeUtf8Slice(c.buf, c.off, len);
    c.off += len;
    return MsgpackValue.makeString(s);
  }
  if (lead == 0xdb) {
    const len = readU32(c) as i32;
    const s = decodeUtf8Slice(c.buf, c.off, len);
    c.off += len;
    return MsgpackValue.makeString(s);
  }
  if (lead == 0xdc) {
    const size = readU16(c) as i32;
    const out = new Array<MsgpackValue>(size);
    for (let i = 0; i < size; i++) out[i] = decodeMsgpackValue(c);
    return MsgpackValue.makeArray(out);
  }
  if (lead == 0xdd) {
    const size = readU32(c) as i32;
    const out = new Array<MsgpackValue>(size);
    for (let i = 0; i < size; i++) out[i] = decodeMsgpackValue(c);
    return MsgpackValue.makeArray(out);
  }
  if (lead == 0xde) {
    const size = readU16(c) as i32;
    const out = new Map<string, MsgpackValue>();
    for (let i = 0; i < size; i++) {
      const k = decodeMsgpackValue(c);
      const v = decodeMsgpackValue(c);
      out.set(k.kind == MsgpackKind.String ? k.s : "", v);
    }
    return MsgpackValue.makeMap(out);
  }
  if (lead == 0xdf) {
    const size = readU32(c) as i32;
    const out = new Map<string, MsgpackValue>();
    for (let i = 0; i < size; i++) {
      const k = decodeMsgpackValue(c);
      const v = decodeMsgpackValue(c);
      out.set(k.kind == MsgpackKind.String ? k.s : "", v);
    }
    return MsgpackValue.makeMap(out);
  }

  // bin 8
  if (lead == 0xc4) {
    const len = readU8(c) as i32;
    if (len < 0 || c.off + len > c.buf.length) return MsgpackValue.makeNull();
    const out = new Uint8Array(len);
    memory.copy(out.dataStart, c.buf.dataStart + c.off, len);
    c.off += len;
    return MsgpackValue.makeBinary(out);
  }
  // bin 16
  if (lead == 0xc5) {
    const len = readU16(c) as i32;
    if (len < 0 || c.off + len > c.buf.length) return MsgpackValue.makeNull();
    const out = new Uint8Array(len);
    memory.copy(out.dataStart, c.buf.dataStart + c.off, len);
    c.off += len;
    return MsgpackValue.makeBinary(out);
  }
  // bin 32
  if (lead == 0xc6) {
    const len = readU32(c) as i32;
    if (len < 0 || c.off + len > c.buf.length) return MsgpackValue.makeNull();
    const out = new Uint8Array(len);
    memory.copy(out.dataStart, c.buf.dataStart + c.off, len);
    c.off += len;
    return MsgpackValue.makeBinary(out);
  }
  // Skip ext types
  if (lead == 0xc7) { c.off += (readU8(c) as i32) + 1; return MsgpackValue.makeNull(); }
  if (lead == 0xc8) { c.off += (readU16(c) as i32) + 1; return MsgpackValue.makeNull(); }
  if (lead == 0xc9) { c.off += (readU32(c) as i32) + 1; return MsgpackValue.makeNull(); }
  if (lead == 0xd4) { c.off += 2; return MsgpackValue.makeNull(); }
  if (lead == 0xd5) { c.off += 3; return MsgpackValue.makeNull(); }
  if (lead == 0xd6) { c.off += 5; return MsgpackValue.makeNull(); }
  if (lead == 0xd7) { c.off += 9; return MsgpackValue.makeNull(); }
  if (lead == 0xd8) { c.off += 17; return MsgpackValue.makeNull(); }

  return MsgpackValue.makeNull();
}

export function decodeMsgpack(bytes: Uint8Array): MsgpackValue {
  if (bytes.length == 0) return MsgpackValue.makeMap(new Map<string, MsgpackValue>());
  const c = new MsgpackCursor(bytes);
  return decodeMsgpackValue(c);
}

// ----------------------------
// Typed field helpers
// ----------------------------

export function getMapField(
  map: Map<string, MsgpackValue>,
  key: string
): MsgpackValue | null {
  if (!map.has(key)) return null;
  return map.get(key);
}

export function getStringField(
  map: Map<string, MsgpackValue>,
  key: string,
  defaultValue: string = ""
): string {
  const v = getMapField(map, key);
  if (v === null) return defaultValue;
  if (v.kind == MsgpackKind.String) return v.s;
  if (v.kind == MsgpackKind.I64) return v.i.toString();
  if (v.kind == MsgpackKind.Bool) return v.b ? "true" : "false";
  return defaultValue;
}

export function getBoolField(
  map: Map<string, MsgpackValue>,
  key: string,
  defaultValue: bool = false
): bool {
  const v = getMapField(map, key);
  if (v === null) return defaultValue;
  if (v.kind == MsgpackKind.Bool) return v.b;
  if (v.kind == MsgpackKind.I64) return v.i != 0;
  if (v.kind == MsgpackKind.String) return v.s == "true" || v.s == "1";
  return defaultValue;
}

export function getI64Field(
  map: Map<string, MsgpackValue>,
  key: string,
  defaultValue: i64 = 0
): i64 {
  const v = getMapField(map, key);
  if (v === null) return defaultValue;
  if (v.kind == MsgpackKind.I64) return v.i;
  if (v.kind == MsgpackKind.Bool) return v.b ? 1 : 0;
  if (v.kind == MsgpackKind.String) {
    const s = v.s;
    let start = 0;
    let negative = false;
    if (s.length > 0 && s.charAt(0) == "-") { negative = true; start = 1; }
    let out: i64 = 0;
    for (let i = start; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 48 || c > 57) break;
      out = out * 10 + ((c - 48) as i64);
    }
    return negative ? -out : out;
  }
  return defaultValue;
}

export function getI32Field(
  map: Map<string, MsgpackValue>,
  key: string,
  defaultValue: i32 = 0
): i32 {
  return i32(getI64Field(map, key, defaultValue));
}

export function getStringArrayField(
  map: Map<string, MsgpackValue>,
  key: string
): Array<string> {
  const v = getMapField(map, key);
  if (v === null || v.kind != MsgpackKind.Array) return new Array<string>(0);
  const out = new Array<string>(v.arr.length);
  for (let i = 0; i < v.arr.length; i++) {
    const item = v.arr[i];
    out[i] = item.kind == MsgpackKind.String ? item.s : item.i.toString();
  }
  return out;
}

export function getMapArrayField(
  map: Map<string, MsgpackValue>,
  key: string
): Array<Map<string, MsgpackValue>> {
  const v = getMapField(map, key);
  if (v === null || v.kind != MsgpackKind.Array) return new Array<Map<string, MsgpackValue>>(0);
  const out = new Array<Map<string, MsgpackValue>>(v.arr.length);
  for (let i = 0; i < v.arr.length; i++) {
    const item = v.arr[i];
    out[i] = item.kind == MsgpackKind.Map ? item.map : new Map<string, MsgpackValue>();
  }
  return out;
}

// ----------------------------
// Array struct helpers
// ----------------------------

export function getArrayItem(
  arr: Array<MsgpackValue>,
  idx: i32
): MsgpackValue | null {
  if (idx < 0 || idx >= arr.length) return null;
  return arr[idx];
}

export function getArrayString(
  arr: Array<MsgpackValue>,
  idx: i32,
  defaultValue: string = ""
): string {
  const v = getArrayItem(arr, idx);
  if (v === null) return defaultValue;
  if (v.kind == MsgpackKind.String) return v.s;
  if (v.kind == MsgpackKind.I64) return v.i.toString();
  if (v.kind == MsgpackKind.Bool) return v.b ? "true" : "false";
  return defaultValue;
}

export function getArrayBool(
  arr: Array<MsgpackValue>,
  idx: i32,
  defaultValue: bool = false
): bool {
  const v = getArrayItem(arr, idx);
  if (v === null) return defaultValue;
  if (v.kind == MsgpackKind.Bool) return v.b;
  if (v.kind == MsgpackKind.I64) return v.i != 0;
  if (v.kind == MsgpackKind.String) return v.s == "true" || v.s == "1";
  return defaultValue;
}

export function getArrayI64(
  arr: Array<MsgpackValue>,
  idx: i32,
  defaultValue: i64 = 0
): i64 {
  const v = getArrayItem(arr, idx);
  if (v === null) return defaultValue;
  if (v.kind == MsgpackKind.I64) return v.i;
  if (v.kind == MsgpackKind.Bool) return v.b ? 1 : 0;
  if (v.kind == MsgpackKind.String) {
    const s = v.s;
    let start = 0;
    let negative = false;
    if (s.length > 0 && s.charAt(0) == "-") { negative = true; start = 1; }
    let out: i64 = 0;
    for (let i = start; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 48 || c > 57) break;
      out = out * 10 + ((c - 48) as i64);
    }
    return negative ? -out : out;
  }
  return defaultValue;
}

export function getArrayI32(
  arr: Array<MsgpackValue>,
  idx: i32,
  defaultValue: i32 = 0
): i32 {
  return i32(getArrayI64(arr, idx, defaultValue));
}

export function getArrayStringArray(
  arr: Array<MsgpackValue>,
  idx: i32
): Array<string> {
  const v = getArrayItem(arr, idx);
  if (v === null || v.kind != MsgpackKind.Array) return new Array<string>(0);
  const out = new Array<string>(v.arr.length);
  for (let i = 0; i < v.arr.length; i++) {
    const item = v.arr[i];
    out[i] = item.kind == MsgpackKind.String ? item.s : item.i.toString();
  }
  return out;
}

export function getArrayMapArray(
  arr: Array<MsgpackValue>,
  idx: i32
): Array<Map<string, MsgpackValue>> {
  const v = getArrayItem(arr, idx);
  if (v === null || v.kind != MsgpackKind.Array) return new Array<Map<string, MsgpackValue>>(0);
  const out = new Array<Map<string, MsgpackValue>>(v.arr.length);
  for (let i = 0; i < v.arr.length; i++) {
    const item = v.arr[i];
    out[i] = item.kind == MsgpackKind.Map ? item.map : new Map<string, MsgpackValue>();
  }
  return out;
}

// ----------------------------
// Strict helpers for generated positional structs
// ----------------------------

export function msgpackKindName(kind: MsgpackKind): string {
  if (kind == MsgpackKind.Null) return "null";
  if (kind == MsgpackKind.Bool) return "bool";
  if (kind == MsgpackKind.I64) return "i64";
  if (kind == MsgpackKind.F64) return "f64";
  if (kind == MsgpackKind.String) return "string";
  if (kind == MsgpackKind.Array) return "array";
  if (kind == MsgpackKind.Map) return "map";
  if (kind == MsgpackKind.Binary) return "binary";
  return "unknown";
}

function strictFieldError(
  className: string,
  fieldName: string,
  idx: i32,
  expected: string,
  actual: string
): string {
  return className + "." + fieldName + " at index " + idx.toString() +
    " expected " + expected + ", got " + actual;
}

export function requireArrayLength(
  arr: Array<MsgpackValue>,
  expected: i32,
  className: string
): void {
  if (arr.length != expected) {
    let message = className + " expected " + expected.toString() +
      " MessagePack fields, got " + arr.length.toString();
    if (className.endsWith("StateView")) {
      message += ". Persisted state shape does not match the expected storage view; ensure state.toBytes()/toView() encodes the storage view, not a public/caller-filtered view.";
    }
    throw new Error(message);
  }
}

export function requireArrayItem(
  arr: Array<MsgpackValue>,
  idx: i32,
  className: string,
  fieldName: string
): MsgpackValue {
  if (idx < 0 || idx >= arr.length) {
    throw new Error(strictFieldError(className, fieldName, idx, "present", "missing"));
  }
  return arr[idx];
}

export function requireArrayBool(
  arr: Array<MsgpackValue>,
  idx: i32,
  className: string,
  fieldName: string
): bool {
  const v = requireArrayItem(arr, idx, className, fieldName);
  if (v.kind != MsgpackKind.Bool) {
    throw new Error(strictFieldError(className, fieldName, idx, "bool", msgpackKindName(v.kind)));
  }
  return v.b;
}

export function requireArrayI64(
  arr: Array<MsgpackValue>,
  idx: i32,
  className: string,
  fieldName: string
): i64 {
  const v = requireArrayItem(arr, idx, className, fieldName);
  if (v.kind != MsgpackKind.I64) {
    throw new Error(strictFieldError(className, fieldName, idx, "i64", msgpackKindName(v.kind)));
  }
  return v.i;
}

export function requireArrayI32(
  arr: Array<MsgpackValue>,
  idx: i32,
  className: string,
  fieldName: string
): i32 {
  return i32(requireArrayI64(arr, idx, className, fieldName));
}

export function requireArrayF64(
  arr: Array<MsgpackValue>,
  idx: i32,
  className: string,
  fieldName: string
): f64 {
  const v = requireArrayItem(arr, idx, className, fieldName);
  if (v.kind != MsgpackKind.F64) {
    throw new Error(strictFieldError(className, fieldName, idx, "f64", msgpackKindName(v.kind)));
  }
  return v.f;
}

export function requireArrayStringStrict(
  arr: Array<MsgpackValue>,
  idx: i32,
  className: string,
  fieldName: string
): string {
  const v = requireArrayItem(arr, idx, className, fieldName);
  if (v.kind != MsgpackKind.String) {
    throw new Error(strictFieldError(className, fieldName, idx, "string", msgpackKindName(v.kind)));
  }
  return v.s;
}

export function requireArrayBin(
  arr: Array<MsgpackValue>,
  idx: i32,
  className: string,
  fieldName: string
): Uint8Array {
  const v = requireArrayItem(arr, idx, className, fieldName);
  if (v.kind != MsgpackKind.Binary) {
    throw new Error(strictFieldError(className, fieldName, idx, "binary", msgpackKindName(v.kind)));
  }
  return v.bin;
}

export function requireStringArrayValue(
  v: MsgpackValue,
  className: string,
  fieldName: string,
  idx: i32
): string[] {
  if (v.kind != MsgpackKind.Array) {
    throw new Error(strictFieldError(className, fieldName, idx, "string[]", msgpackKindName(v.kind)));
  }
  const out = new Array<string>(v.arr.length);
  for (let i = 0; i < v.arr.length; i++) {
    const item = v.arr[i];
    if (item.kind != MsgpackKind.String) {
      throw new Error(
        className + "." + fieldName + "[" + i.toString() + "] expected string, got " +
        msgpackKindName(item.kind)
      );
    }
    out[i] = item.s;
  }
  return out;
}

export function requireBoolArrayValue(
  v: MsgpackValue,
  className: string,
  fieldName: string,
  idx: i32
): bool[] {
  if (v.kind != MsgpackKind.Array) {
    throw new Error(strictFieldError(className, fieldName, idx, "bool[]", msgpackKindName(v.kind)));
  }
  const out = new Array<bool>(v.arr.length);
  for (let i = 0; i < v.arr.length; i++) {
    const item = v.arr[i];
    if (item.kind != MsgpackKind.Bool) {
      throw new Error(
        className + "." + fieldName + "[" + i.toString() + "] expected bool, got " +
        msgpackKindName(item.kind)
      );
    }
    out[i] = item.b;
  }
  return out;
}

export function requireI64ArrayValue(
  v: MsgpackValue,
  className: string,
  fieldName: string,
  idx: i32
): i64[] {
  if (v.kind != MsgpackKind.Array) {
    throw new Error(strictFieldError(className, fieldName, idx, "i64[]", msgpackKindName(v.kind)));
  }
  const out = new Array<i64>(v.arr.length);
  for (let i = 0; i < v.arr.length; i++) {
    const item = v.arr[i];
    if (item.kind != MsgpackKind.I64) {
      throw new Error(
        className + "." + fieldName + "[" + i.toString() + "] expected i64, got " +
        msgpackKindName(item.kind)
      );
    }
    out[i] = item.i;
  }
  return out;
}

export function requireI32ArrayValue(
  v: MsgpackValue,
  className: string,
  fieldName: string,
  idx: i32
): i32[] {
  const values = requireI64ArrayValue(v, className, fieldName, idx);
  const out = new Array<i32>(values.length);
  for (let i = 0; i < values.length; i++) out[i] = i32(values[i]);
  return out;
}

export function requireF64ArrayValue(
  v: MsgpackValue,
  className: string,
  fieldName: string,
  idx: i32
): f64[] {
  if (v.kind != MsgpackKind.Array) {
    throw new Error(strictFieldError(className, fieldName, idx, "f64[]", msgpackKindName(v.kind)));
  }
  const out = new Array<f64>(v.arr.length);
  for (let i = 0; i < v.arr.length; i++) {
    const item = v.arr[i];
    if (item.kind != MsgpackKind.F64) {
      throw new Error(
        className + "." + fieldName + "[" + i.toString() + "] expected f64, got " +
        msgpackKindName(item.kind)
      );
    }
    out[i] = item.f;
  }
  return out;
}

export function requireBinArrayValue(
  v: MsgpackValue,
  className: string,
  fieldName: string,
  idx: i32
): Uint8Array[] {
  if (v.kind != MsgpackKind.Array) {
    throw new Error(strictFieldError(className, fieldName, idx, "Uint8Array[]", msgpackKindName(v.kind)));
  }
  const out = new Array<Uint8Array>(v.arr.length);
  for (let i = 0; i < v.arr.length; i++) {
    const item = v.arr[i];
    if (item.kind != MsgpackKind.Binary) {
      throw new Error(
        className + "." + fieldName + "[" + i.toString() + "] expected binary, got " +
        msgpackKindName(item.kind)
      );
    }
    out[i] = item.bin;
  }
  return out;
}

export function requireI64MatrixValue(
  v: MsgpackValue,
  className: string,
  fieldName: string,
  idx: i32
): i64[][] {
  if (v.kind != MsgpackKind.Array) {
    throw new Error(strictFieldError(className, fieldName, idx, "i64[][]", msgpackKindName(v.kind)));
  }
  const out = new Array<i64[]>(v.arr.length);
  for (let i = 0; i < v.arr.length; i++) {
    out[i] = requireI64ArrayValue(v.arr[i], className, fieldName + "[" + i.toString() + "]", idx);
  }
  return out;
}

export function requireStringMatrixValue(
  v: MsgpackValue,
  className: string,
  fieldName: string,
  idx: i32
): string[][] {
  if (v.kind != MsgpackKind.Array) {
    throw new Error(strictFieldError(className, fieldName, idx, "string[][]", msgpackKindName(v.kind)));
  }
  const out = new Array<string[]>(v.arr.length);
  for (let i = 0; i < v.arr.length; i++) {
    out[i] = requireStringArrayValue(v.arr[i], className, fieldName + "[" + i.toString() + "]", idx);
  }
  return out;
}

export function requireStringStringMapValue(
  v: MsgpackValue,
  className: string,
  fieldName: string,
  idx: i32
): Map<string, string> {
  if (v.kind != MsgpackKind.Map) {
    throw new Error(strictFieldError(className, fieldName, idx, "Map<string,string>", msgpackKindName(v.kind)));
  }
  const out = new Map<string, string>();
  const keys = v.map.keys();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const item = v.map.get(key);
    if (item.kind != MsgpackKind.String) {
      throw new Error(
        className + "." + fieldName + "[\"" + key + "\"] expected string, got " +
        msgpackKindName(item.kind)
      );
    }
    out.set(key, item.s);
  }
  return out;
}

export function requireStringI64MapValue(
  v: MsgpackValue,
  className: string,
  fieldName: string,
  idx: i32
): Map<string, i64> {
  if (v.kind != MsgpackKind.Map) {
    throw new Error(strictFieldError(className, fieldName, idx, "Map<string,i64>", msgpackKindName(v.kind)));
  }
  const out = new Map<string, i64>();
  const keys = v.map.keys();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const item = v.map.get(key);
    if (item.kind != MsgpackKind.I64) {
      throw new Error(
        className + "." + fieldName + "[\"" + key + "\"] expected i64, got " +
        msgpackKindName(item.kind)
      );
    }
    out.set(key, item.i);
  }
  return out;
}

export function requireStringI32MapValue(
  v: MsgpackValue,
  className: string,
  fieldName: string,
  idx: i32
): Map<string, i32> {
  const values = requireStringI64MapValue(v, className, fieldName, idx);
  const out = new Map<string, i32>();
  const keys = values.keys();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    out.set(key, i32(values.get(key)));
  }
  return out;
}

export function requireStringBoolMapValue(
  v: MsgpackValue,
  className: string,
  fieldName: string,
  idx: i32
): Map<string, bool> {
  if (v.kind != MsgpackKind.Map) {
    throw new Error(strictFieldError(className, fieldName, idx, "Map<string,bool>", msgpackKindName(v.kind)));
  }
  const out = new Map<string, bool>();
  const keys = v.map.keys();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const item = v.map.get(key);
    if (item.kind != MsgpackKind.Bool) {
      throw new Error(
        className + "." + fieldName + "[\"" + key + "\"] expected bool, got " +
        msgpackKindName(item.kind)
      );
    }
    out.set(key, item.b);
  }
  return out;
}

export function requireStringF64MapValue(
  v: MsgpackValue,
  className: string,
  fieldName: string,
  idx: i32
): Map<string, f64> {
  if (v.kind != MsgpackKind.Map) {
    throw new Error(strictFieldError(className, fieldName, idx, "Map<string,f64>", msgpackKindName(v.kind)));
  }
  const out = new Map<string, f64>();
  const keys = v.map.keys();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const item = v.map.get(key);
    if (item.kind != MsgpackKind.F64) {
      throw new Error(
        className + "." + fieldName + "[\"" + key + "\"] expected f64, got " +
        msgpackKindName(item.kind)
      );
    }
    out.set(key, item.f);
  }
  return out;
}

export function requireStringBinMapValue(
  v: MsgpackValue,
  className: string,
  fieldName: string,
  idx: i32
): Map<string, Uint8Array> {
  if (v.kind != MsgpackKind.Map) {
    throw new Error(strictFieldError(className, fieldName, idx, "Map<string,Uint8Array>", msgpackKindName(v.kind)));
  }
  const out = new Map<string, Uint8Array>();
  const keys = v.map.keys();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const item = v.map.get(key);
    if (item.kind != MsgpackKind.Binary) {
      throw new Error(
        className + "." + fieldName + "[\"" + key + "\"] expected binary, got " +
        msgpackKindName(item.kind)
      );
    }
    out.set(key, item.bin);
  }
  return out;
}
