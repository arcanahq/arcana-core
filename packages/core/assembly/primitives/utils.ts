// @ts-nocheck
/**
 * Utility functions for JSON/MessagePack conversion and manipulation.
 * No json-as dependency - all parsing/encoding is done natively.
 */

// ============================================================================
// Primitive parsers
// ============================================================================

export function parseI64FromStr(s: string): i64 {
  if (s.length === 0) return 0;
  let result: i64 = 0;
  let start = 0;
  let negative = false;
  if (s.charAt(0) === '-') { negative = true; start = 1; }
  for (let i = start; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) break;
    result = result * 10 + ((c - 48) as i64);
  }
  return negative ? -result : result;
}

export function parseI32FromStr(s: string): i32 {
  return i32(parseI64FromStr(s));
}

// ============================================================================
// JSON string escaping / unescaping
// ============================================================================

/**
 * Escape a string for JSON serialization.
 * Returns the escaped string wrapped in double quotes.
 */
export function escapeJsonStr(s: string): string {
  if (s.length === 0) return '""';
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 34) out += '\\"';
    else if (c === 92) out += '\\\\';
    else if (c === 10) out += '\\n';
    else if (c === 13) out += '\\r';
    else if (c === 9) out += '\\t';
    else out += s.charAt(i);
  }
  return out + '"';
}

/**
 * Remove JSON string quotes and unescape escape sequences.
 * Input: `"hello \"world\""` → Output: `hello "world"`
 */
export function unquoteJsonString(s: string): string {
  if (s.length < 2) return s;
  if (s.charAt(0) !== '"') return s;
  const end = s.charAt(s.length - 1) === '"' ? s.length - 1 : s.length;
  let result = "";
  let i = 1;
  while (i < end) {
    if (s.charAt(i) === '\\' && i + 1 < end) {
      const next = s.charAt(i + 1);
      if (next === '"') { result += '"'; i += 2; }
      else if (next === '\\') { result += '\\'; i += 2; }
      else if (next === 'n') { result += '\n'; i += 2; }
      else if (next === 'r') { result += '\r'; i += 2; }
      else if (next === 't') { result += '\t'; i += 2; }
      else { result += s.charAt(i); i++; }
    } else {
      result += s.charAt(i);
      i++;
    }
  }
  return result;
}

// ============================================================================
// JSON object parsing  (Map<string, string>)
// ============================================================================

/**
 * Parse a JSON object string into a Map<string, string>.
 * Values are stored as their raw JSON representation:
 *   - strings: with quotes, e.g. `"hello"`
 *   - numbers/booleans/null: unquoted, e.g. `42`, `true`, `null`
 *   - nested objects/arrays: their raw JSON string
 */
export function parseJSONToMap(jsonStr: string): Map<string, string> {
  const result = new Map<string, string>();
  let i = 0;
  const len = jsonStr.length;

  // Skip whitespace and opening brace
  while (i < len && isWhitespace(jsonStr.charCodeAt(i))) i++;
  if (i >= len || jsonStr.charAt(i) !== '{') return result;
  i++;

  while (i < len) {
    while (i < len && isWhitespace(jsonStr.charCodeAt(i))) i++;
    if (i >= len || jsonStr.charAt(i) === '}') break;

    // Parse key
    if (jsonStr.charAt(i) !== '"') break;
    i++;
    let keyStart = i;
    while (i < len && jsonStr.charAt(i) !== '"') {
      if (jsonStr.charAt(i) === '\\') i++;
      i++;
    }
    const key = jsonStr.substring(keyStart, i);
    i++; // skip closing quote

    // Skip whitespace and colon
    while (i < len && isWhitespace(jsonStr.charCodeAt(i))) i++;
    if (i >= len || jsonStr.charAt(i) !== ':') break;
    i++;
    while (i < len && isWhitespace(jsonStr.charCodeAt(i))) i++;

    // Parse value
    const valueStart = i;
    const firstChar = jsonStr.charAt(i);
    if (firstChar === '"') {
      i++;
      while (i < len && jsonStr.charAt(i) !== '"') {
        if (jsonStr.charAt(i) === '\\') i++;
        i++;
      }
      i++;
      result.set(key, jsonStr.substring(valueStart, i));
    } else if (firstChar === '{') {
      let depth = 1; i++;
      while (i < len && depth > 0) {
        const c = jsonStr.charCodeAt(i);
        if (c === 92) { i++; } // backslash
        else if (c === 34) { i++; while (i < len && jsonStr.charCodeAt(i) !== 34) { if (jsonStr.charCodeAt(i) === 92) i++; i++; } } // string
        else if (c === 123) depth++;
        else if (c === 125) depth--;
        i++;
      }
      result.set(key, jsonStr.substring(valueStart, i));
    } else if (firstChar === '[') {
      let depth = 1; i++;
      while (i < len && depth > 0) {
        const c = jsonStr.charCodeAt(i);
        if (c === 92) { i++; }
        else if (c === 34) { i++; while (i < len && jsonStr.charCodeAt(i) !== 34) { if (jsonStr.charCodeAt(i) === 92) i++; i++; } }
        else if (c === 91) depth++;
        else if (c === 93) depth--;
        i++;
      }
      result.set(key, jsonStr.substring(valueStart, i));
    } else {
      // Primitive (number, boolean, null)
      while (i < len && !isWhitespace(jsonStr.charCodeAt(i)) && jsonStr.charAt(i) !== ',' && jsonStr.charAt(i) !== '}') i++;
      result.set(key, jsonStr.substring(valueStart, i));
    }

    // Skip whitespace and comma
    while (i < len && isWhitespace(jsonStr.charCodeAt(i))) i++;
    if (i < len && jsonStr.charAt(i) === ',') i++;
  }

  return result;
}

function isWhitespace(c: i32): bool {
  return c === 32 || c === 9 || c === 10 || c === 13;
}

// ============================================================================
// Typed field getters from Map
// ============================================================================

export function getString(json: Map<string, string>, key: string, defaultValue: string = ""): string {
  if (!json.has(key)) return defaultValue;
  const val = json.get(key);
  if (val === null || val.length === 0) return defaultValue;
  if (val.charAt(0) === '"') return unquoteJsonString(val);
  return val;
}

export function getNumber(json: Map<string, string>, key: string, defaultValue: i64 = 0): i64 {
  if (!json.has(key)) return defaultValue;
  const val = json.get(key);
  if (val === null || val.length === 0) return defaultValue;
  // If it's a quoted string (shouldn't be for numbers, but handle gracefully)
  const s = val.charAt(0) === '"' ? unquoteJsonString(val) : val;
  return parseI64FromStr(s);
}

export function getBoolean(json: Map<string, string>, key: string, defaultValue: bool = false): bool {
  if (!json.has(key)) return defaultValue;
  const val = json.get(key);
  if (val === null || val.length === 0) return defaultValue;
  return val === "true" || val === "1";
}

export function getStringArray(json: Map<string, string>, key: string, defaultValue: string[] = []): string[] {
  if (!json.has(key)) return defaultValue;
  const val = json.get(key);
  if (val === null || val.length === 0) return defaultValue;
  return parseStringArrayFromJson(val);
}

export function getArray(json: Map<string, string>, key: string): string[] | null {
  if (!json.has(key)) return null;
  const val = json.get(key);
  if (val === null) return null;
  return parseStringArrayFromJson(val);
}

export function getObject(json: Map<string, string>, key: string): Map<string, string> | null {
  if (!json.has(key)) return null;
  const val = json.get(key);
  if (val === null) return null;
  return parseJSONToMap(val);
}

// ============================================================================
// Array parsers
// ============================================================================

/**
 * Parse a JSON string array, e.g. `["a","b","c"]`
 */
export function parseStringArrayFromJson(arrayStr: string): string[] {
  const result: string[] = [];
  let i = 0;
  const len = arrayStr.length;
  while (i < len && arrayStr.charAt(i) !== '[') i++;
  if (i >= len) return result;
  i++; // skip [

  while (i < len) {
    while (i < len && isWhitespace(arrayStr.charCodeAt(i))) i++;
    const c = arrayStr.charAt(i);
    if (c === ']' || i >= len) break;
    if (c === ',') { i++; continue; }

    if (c === '"') {
      let start = i;
      i++;
      while (i < len) {
        if (arrayStr.charAt(i) === '\\') { i += 2; continue; }
        if (arrayStr.charAt(i) === '"') { i++; break; }
        i++;
      }
      result.push(unquoteJsonString(arrayStr.substring(start, i)));
    } else {
      // Non-string primitive
      let start = i;
      while (i < len && arrayStr.charAt(i) !== ',' && arrayStr.charAt(i) !== ']') i++;
      result.push(arrayStr.substring(start, i));
    }
  }
  return result;
}

/**
 * Parse a JSON array of objects, returning each element as a raw JSON string.
 * e.g. `[{"a":1},{"b":2}]` → `["{\"a\":1}", "{\"b\":2}"]`
 */
export function parseObjectArrayFromJson(arrayStr: string): string[] {
  const result: string[] = [];
  let i = 0;
  const len = arrayStr.length;
  while (i < len && arrayStr.charAt(i) !== '[') i++;
  if (i >= len) return result;
  i++;

  while (i < len) {
    while (i < len && isWhitespace(arrayStr.charCodeAt(i))) i++;
    const c = arrayStr.charAt(i);
    if (c === ']' || i >= len) break;
    if (c === ',' || isWhitespace(arrayStr.charCodeAt(i))) { i++; continue; }

    if (c === '{') {
      let start = i;
      let depth = 1; i++;
      while (i < len && depth > 0) {
        const ch = arrayStr.charCodeAt(i);
        if (ch === 92) { i += 2; continue; }
        if (ch === 34) {
          i++;
          while (i < len && arrayStr.charCodeAt(i) !== 34) {
            if (arrayStr.charCodeAt(i) === 92) i++;
            i++;
          }
          i++;
          continue;
        }
        if (ch === 123) depth++;
        else if (ch === 125) depth--;
        i++;
      }
      result.push(arrayStr.substring(start, i));
    } else {
      // Skip unknown element
      while (i < len && arrayStr.charAt(i) !== ',' && arrayStr.charAt(i) !== ']') i++;
    }
  }
  return result;
}

/**
 * Parse a JSON array of string arrays (2D string array).
 * e.g. `[["a","b"],["c","d"]]`
 */
export function parseStringArrayArrayFromJson(arrayStr: string): string[][] {
  const result: string[][] = [];
  let i = 0;
  const len = arrayStr.length;
  while (i < len && arrayStr.charAt(i) !== '[') i++;
  if (i >= len) return result;
  i++;

  while (i < len) {
    while (i < len && isWhitespace(arrayStr.charCodeAt(i))) i++;
    const c = arrayStr.charAt(i);
    if (c === ']' || i >= len) break;
    if (c === ',') { i++; continue; }

    if (c === '[') {
      let start = i;
      let depth = 1; i++;
      while (i < len && depth > 0) {
        const ch = arrayStr.charCodeAt(i);
        if (ch === 92) { i += 2; continue; }
        if (ch === 34) {
          i++;
          while (i < len && arrayStr.charCodeAt(i) !== 34) {
            if (arrayStr.charCodeAt(i) === 92) i++;
            i++;
          }
          i++;
          continue;
        }
        if (ch === 91) depth++;
        else if (ch === 93) depth--;
        i++;
      }
      result.push(parseStringArrayFromJson(arrayStr.substring(start, i)));
    } else {
      while (i < len && arrayStr.charAt(i) !== ',' && arrayStr.charAt(i) !== ']') i++;
    }
  }
  return result;
}

// ============================================================================
// Array encoders
// ============================================================================

export function encodeStringArray(arr: string[]): string {
  if (arr.length === 0) return "[]";
  let out = "[";
  for (let i = 0; i < arr.length; i++) {
    if (i > 0) out += ",";
    out += escapeJsonStr(arr[i]);
  }
  return out + "]";
}

export function encodeI32Array(arr: i32[]): string {
  if (arr.length === 0) return "[]";
  let out = "[";
  for (let i = 0; i < arr.length; i++) {
    if (i > 0) out += ",";
    out += arr[i].toString();
  }
  return out + "]";
}

export function encodeI32ArrayArray(arr: i32[][]): string {
  if (arr.length === 0) return "[]";
  let out = "[";
  for (let i = 0; i < arr.length; i++) {
    if (i > 0) out += ",";
    out += encodeI32Array(arr[i]);
  }
  return out + "]";
}

export function encodeStringArrayArray(arr: string[][]): string {
  if (arr.length === 0) return "[]";
  let out = "[";
  for (let i = 0; i < arr.length; i++) {
    if (i > 0) out += ",";
    out += encodeStringArray(arr[i]);
  }
  return out + "]";
}

// ============================================================================
// Legacy compatibility helpers (kept for backward compatibility)
// ============================================================================

export function numberToJSON(value: i64): string {
  return value.toString();
}

export function stringToJSON(value: string): string {
  return escapeJsonStr(value);
}

export function booleanToJSON(value: bool): string {
  return value ? "true" : "false";
}

export function stringArrayToJSON(values: string[]): string {
  return encodeStringArray(values);
}
