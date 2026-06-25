/**
 * AssemblyScript Decorator Transform
 * 
 * Generates wrappers for @constructor, @action, and @view decorated functions.
 * Produces a synthetic file (contract.generated.ts) containing:
 *   - Wrapper functions for each decorated entrypoint
 *   - Unified `handle` function for call routing
 *   - Re-exports of scratch_alloc/init_scratch_base for WASM runtime
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const requireFromConsumer = createRequire(`${process.cwd()}/package.json`);
const transformModulePath = requireFromConsumer.resolve("assemblyscript/dist/transform.js");
const assemblyscriptModulePath = requireFromConsumer.resolve(
  "assemblyscript/dist/assemblyscript.js"
);
const { Transform } = await import(pathToFileURL(transformModulePath).href);
const { NodeKind, Parser, Source, Tokenizer } = await import(pathToFileURL(assemblyscriptModulePath).href);

class SimpleParser {
  static get parser() {
    return new Parser();
  }

  static getTokenizer(sourceText, file = "index.ts") {
    return new Tokenizer(new Source(0, file, sourceText));
  }

  static parseClassMember(sourceText, classNode) {
    const parsed = this.parser.parseClassMember(
      this.getTokenizer(sourceText, classNode.range.source.normalizedPath),
      classNode
    );
    if (parsed == null) {
      throw new Error(`Failed to parse generated class member: ${sourceText}`);
    }
    return parsed;
  }

}

// ============================================================
// Entry Info Model
// ============================================================

class EntryInfo {
  constructor(kind, regName, userFnName, stateType, argsType, retTypeName) {
    this.kind = kind;           // "constructor" | "action" | "view"
    this.regName = regName;     // Name used in registry
    this.userFnName = userFnName;
    this.stateType = stateType;
    this.argsType = argsType;
    this.retTypeName = retTypeName;
  }
}

function isRawBytesArgType(typeName) {
  return typeName === "Uint8Array" || typeName === "ArrayBuffer";
}

function isRawBytesStateType(typeName) {
  return typeName === "Uint8Array" || typeName === "ArrayBuffer";
}

const BLOCKED_ACTION_PRECOMPILE_FN_NAMES = new Set([
  "kvGetU256",
  "kvGetBaseU256",
  "kvGetBytes",
  "kvGetBaseBytes",
]);

// ============================================================
// AST Helpers
// ============================================================

/** Check if function has a specific decorator */
function hasDecorator(fn, name) {
  return fn.decorators?.some(d => d.name?.text === name) ?? false;
}

/** Extract string literal value from decorator argument */
function extractStringLiteral(expr) {
  const r = expr?.range;
  const text = r?.source?.text;
  if (typeof text !== "string" || r.start == null || r.end == null) return null;

  const raw = text.slice(r.start, r.end).trim();
  const match = raw.match(/^(['"])([\s\S]*)\1$/);
  if (!match) return null;

  return match[2]
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, `"`)
    .replace(/\\'/g, `'`)
    .replace(/\\\\/g, `\\`);
}

/** Get string argument from a decorator (e.g., @view("custom_name")) */
function getDecoratorStringArg(fn, decName) {
  const dec = fn.decorators?.find(d => d.name?.text === decName);
  if (!dec?.args?.length) return null;

  const value = extractStringLiteral(dec.args[0])?.trim();
  if (!value) return null;

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`@${decName} argument must be an identifier, got "${value}"`);
  }
  return value;
}

/** Get raw string argument from a decorator without identifier restrictions. */
function getDecoratorRawStringArg(node, decName) {
  const dec = node.decorators?.find(d => d.name?.text === decName);
  if (!dec?.args?.length) return null;
  const value = extractStringLiteral(dec.args[0]);
  if (value === null || value.length === 0) {
    throw new Error(`@${decName} argument must be a non-empty string literal`);
  }
  return value;
}

/** Extract type name from AST type node (handles generics) */
function getTypeName(typeNode) {
  if (!typeNode) return "";

  const range = typeNode.range;
  const sourceText = range?.source?.text;
  if (typeof sourceText === "string" && range.start != null && range.end != null) {
    return sourceText.slice(range.start, range.end).trim().replace(/\s+/g, " ");
  }

  const nameNode = typeNode.name;
  let base = nameNode?.text ?? nameNode?.identifier?.text ?? typeNode.text ?? "";

  if (base && typeNode.typeArguments?.length) {
    const args = typeNode.typeArguments.map(getTypeName).filter(Boolean);
    return args.length ? `${base}<${args.join(", ")}>` : base;
  }
  return base;
}

/** Get parameter type name */
const paramType = (p) => getTypeName(p?.type);

/** Get function return type name */
const returnType = (fn) => getTypeName(fn.signature.returnType);

/** Get function name */
const fnName = (fn) => fn.name?.text ?? "";

/** Best-effort source text extraction for a function declaration. */
function getFunctionSourceText(fn) {
  const r = fn?.range;
  const text = r?.source?.text;
  if (typeof text !== "string" || r.start == null || r.end == null) return "";
  return text.slice(r.start, r.end);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Collect local alias names for blocked kvGet* precompile imports. */
function collectBlockedPrecompileImportAliases(sourceText) {
  const aliases = new Set();
  const importRe = /import\s*\{([\s\S]*?)\}\s*from\s*["'](@arcana\/core\/assembly\/index|@arcana\/core\/assembly\/precompiles\/kv)["']/g;
  let m = null;
  while ((m = importRe.exec(sourceText)) !== null) {
    const specList = m[1];
    const specs = specList.split(",").map(s => s.trim()).filter(Boolean);
    for (const spec of specs) {
      const parts = spec.split(/\s+as\s+/i).map(s => s.trim()).filter(Boolean);
      const imported = parts[0] ?? "";
      const local = parts[1] ?? imported;
      if (BLOCKED_ACTION_PRECOMPILE_FN_NAMES.has(imported) || /^kvGet[A-Za-z0-9_]*$/.test(imported)) {
        aliases.add(local);
      }
    }
  }
  return aliases;
}

function collectNamedImportSources(sourceText) {
  const sources = new Map();
  const importRe = /import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']/g;
  let m = null;
  while ((m = importRe.exec(sourceText)) !== null) {
    const specList = m[1];
    const modulePath = m[2];
    const specs = specList.split(",").map(s => s.trim()).filter(Boolean);
    for (const spec of specs) {
      const parts = spec.split(/\s+as\s+/i).map(s => s.trim()).filter(Boolean);
      const imported = parts[0] ?? "";
      const local = parts[1] ?? imported;
      if (local) sources.set(local, modulePath);
    }
  }
  return sources;
}

function pushImport(lines, names, modulePath) {
  const unique = [...new Set(names)].filter(Boolean).sort();
  if (unique.length) {
    lines.push(`import { ${unique.join(", ")} } from ${modulePath};`);
  }
}

/** Collect blocked kvGet* precompile calls used inside an action function body. */
function findBlockedActionPrecompileCallsInFunction(fn) {
  const sourceText = fn?.range?.source?.text;
  if (typeof sourceText !== "string") return [];
  const src = getFunctionSourceText(fn);
  if (!src) return [];

  const used = new Set();

  // Match direct/qualified kvGet* calls, e.g. kvGetU256(...) or kv.kvGetBaseBytes(...).
  const qualifiedKvGetRe = /(?:^|[^\w$])(?:\w+\.)?(kvGet[A-Za-z0-9_]*)\s*\(/g;
  let match = null;
  while ((match = qualifiedKvGetRe.exec(src)) !== null) {
    used.add(match[1]);
  }

  // Match aliased calls, e.g. readKv(...), where alias maps to kvGet* imports.
  const aliases = collectBlockedPrecompileImportAliases(sourceText);
  for (const alias of aliases) {
    const re = new RegExp(`(?:^|[^\\w$])${escapeRegExp(alias)}\\s*\\(`);
    if (re.test(src)) {
      used.add(alias);
    }
  }

  return [...used];
}

/** Extract inner type from ContractResponse<T> or ViewResponse<T> */
function extractInnerType(typeName) {
  const match = typeName.match(/(?:ViewResponse|ContractResponse)\s*<\s*(.+?)\s*>/);
  return match?.[1]?.trim() ?? typeName;
}

function isPrimitiveReturnType(typeName) {
  return typeName === "bool" ||
    typeName === "i32" ||
    typeName === "i64" ||
    typeName === "f64" ||
    typeName === "string";
}

// ============================================================
// MessagePack Class Generation
// ============================================================

class MsgpackFieldInfo {
  constructor(name, typeName, index, isTopic = false) {
    this.name = name;
    this.typeName = normalizeTypeName(typeName);
    this.index = index;
    this.isTopic = isTopic;
  }
}

class MsgpackClassInfo {
  constructor(kind, name, fields) {
    this.kind = kind; // "view" | "args"
    this.name = name;
    this.fields = fields;
  }
}

class EventClassInfo {
  constructor(name, type, fields) {
    this.name = name;
    this.type = type;
    this.fields = fields;
  }
}

class ArcanaStateInfo {
  constructor(name, viewName, fields, viewInfo) {
    this.name = name;
    this.viewName = viewName;
    this.fields = fields;
    this.viewInfo = viewInfo;
  }
}

function normalizeTypeName(typeName) {
  return (typeName ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/^Array<(.+)>$/, "$1[]");
}

function nullableInnerType(typeName) {
  const parts = typeName.split("|").filter(Boolean);
  if (parts.length !== 2) return null;
  if (parts[0] === "null") return parts[1];
  if (parts[1] === "null") return parts[0];
  return null;
}

function getMsgpackClassKind(node) {
  const decorators = node.decorators ?? [];
  if (decorators.some(d => d.name?.text === "msgpackView")) return "view";
  if (decorators.some(d => d.name?.text === "msgpackArgs")) return "args";
  return null;
}

function isStaticMember(node) {
  // AssemblyScript CommonFlags.Static is 32 in the versions used by this repo.
  return (node.flags & 32) !== 0;
}

function collectMsgpackFields(node) {
  const fields = [];
  for (const member of node.members ?? []) {
    if (member.kind !== NodeKind.FieldDeclaration) continue;
    if (isStaticMember(member)) continue;
    const name = member.name?.text ?? "";
    if (!name) continue;
    const typeName = getTypeName(member.type);
    if (!typeName) {
      throw new Error(`@msgpack class ${node.name.text}.${name} must have an explicit field type`);
    }
    fields.push(new MsgpackFieldInfo(name, typeName, fields.length));
  }
  return fields;
}

function collectDataFields(node, decoratorName) {
  const fields = [];
  for (const member of node.members ?? []) {
    if (member.kind !== NodeKind.FieldDeclaration) continue;
    if (isStaticMember(member)) continue;
    const name = member.name?.text ?? "";
    if (!name) continue;
    const typeName = getTypeName(member.type);
    if (!typeName) {
      throw new Error(`@${decoratorName} class ${node.name.text}.${name} must have an explicit field type`);
    }
    const isTopic = member.decorators?.some(d => d.name?.text === "topic") ?? false;
    fields.push(new MsgpackFieldInfo(name, typeName, fields.length, isTopic));
  }
  return fields;
}

function fieldCategory(field, generatedClassNames) {
  const typeName = field.typeName;
  const nullableInner = nullableInnerType(typeName);
  if (nullableInner !== null) {
    if (nullableInner === "bool") return "nullableBool";
    if (nullableInner === "i32") return "nullableI32";
    if (nullableInner === "i64") return "nullableI64";
    if (nullableInner === "f64") return "nullableF64";
    if (nullableInner === "string") return "nullableString";
    if (nullableInner === "Uint8Array") return "nullableBin";
    if (generatedClassNames.has(nullableInner)) return { kind: "nullableNestedView", typeName: nullableInner };
  }
  const arrayMatch = typeName.match(/^(.+)\[\]$/);
  if (arrayMatch) {
    const itemType = arrayMatch[1];
    if (itemType === "string[]") return "stringMatrix";
    if (itemType === "i64[]") return "i64Matrix";
    if (itemType === "bool") return { kind: "array", itemType: "bool" };
    if (itemType === "i32") return { kind: "array", itemType: "i32" };
    if (itemType === "i64") return { kind: "array", itemType: "i64" };
    if (itemType === "f64") return { kind: "array", itemType: "f64" };
    if (itemType === "string") return { kind: "array", itemType: "string" };
    if (itemType === "Uint8Array") return { kind: "array", itemType: "bin" };
    if (generatedClassNames.has(itemType)) return { kind: "array", itemType: "nestedView", typeName: itemType };
  }
  const mapMatch = typeName.match(/^Map<([^,]+),(.+)>$/);
  if (mapMatch) {
    const keyType = mapMatch[1];
    const valueType = mapMatch[2];
    if (keyType !== "string") {
      throw new Error(`@msgpack unsupported map key type ${keyType} for ${field.name}; only string keys are supported`);
    }
    if (valueType === "bool") return { kind: "map", valueType: "bool" };
    if (valueType === "i32") return { kind: "map", valueType: "i32" };
    if (valueType === "i64") return { kind: "map", valueType: "i64" };
    if (valueType === "f64") return { kind: "map", valueType: "f64" };
    if (valueType === "string") return { kind: "map", valueType: "string" };
    if (valueType === "Uint8Array") return { kind: "map", valueType: "bin" };
    if (generatedClassNames.has(valueType)) return { kind: "map", valueType: "nestedView", typeName: valueType };
    throw new Error(`@msgpack unsupported map value type ${valueType} for ${field.name}`);
  }
  if (typeName === "bool") return "bool";
  if (typeName === "i32") return "i32";
  if (typeName === "i64") return "i64";
  if (typeName === "f64") return "f64";
  if (typeName === "string") return "string";
  if (typeName === "Uint8Array") return "bin";
  if (typeName === "i64[][]") return "i64Matrix";
  if (typeName === "string[][]") return "stringMatrix";
  if (typeName === "ProgramStateView" || typeName === "GameStateView") return "baseView";
  if (generatedClassNames.has(typeName)) return "nestedView";
  throw new Error(
    `@msgpack unsupported field type ${typeName} for ${field.name}. ` +
    `Supported v1 types include primitives, nullable primitives, Uint8Array, primitive arrays, string[][], i64[][], arrays of generated classes, string-keyed primitive maps, string-keyed generated-class maps, ProgramStateView, GameStateView, and nested @msgpackView/@msgpackArgs classes.`
  );
}

function encodeValueLine(encoder, expr, itemType) {
  if (itemType === "bool") return `${encoder}.encodeBool(${expr});`;
  if (itemType === "i32") return `${encoder}.encodeI32(${expr});`;
  if (itemType === "i64") return `${encoder}.encodeI64(${expr});`;
  if (itemType === "f64") return `${encoder}.encodeF64(${expr});`;
  if (itemType === "string") return `${encoder}.encodeString(${expr});`;
  if (itemType === "bin") return `${encoder}.encodeBin(${expr});`;
  if (itemType === "nestedView") return `${expr}.encodeToMsgpack(${encoder});`;
  throw new Error(`Unhandled value encode type ${itemType}`);
}

function generateEncodeField(field, category) {
  const value = `this.${field.name}`;
  if (typeof category === "object" && category.kind === "array") {
    const lines = [
      `    encoder.encodeArrayStart(${value}.length);`,
      `    for (let i = 0; i < ${value}.length; i++) ${encodeValueLine("encoder", `${value}[i]`, category.itemType)}`,
    ];
    return lines.join("\n");
  }
  if (typeof category === "object" && category.kind === "map") {
    const keyLocal = `__arcana_${field.name}_keys`;
    const itemLocal = `__arcana_${field.name}_key`;
    return [
      `    const ${keyLocal} = ${value}.keys();`,
      `    encoder.encodeMapStart(${keyLocal}.length);`,
      `    for (let i = 0; i < ${keyLocal}.length; i++) {`,
      `      const ${itemLocal} = ${keyLocal}[i];`,
      `      encoder.encodeString(${itemLocal});`,
      `      ${encodeValueLine("encoder", `${value}.get(${itemLocal})`, category.valueType)}`,
      `    }`,
    ].join("\n");
  }
  if (category === "bool") return `    encoder.encodeBool(${value});`;
  if (category === "i32") return `    encoder.encodeI32(${value});`;
  if (category === "i64") return `    encoder.encodeI64(${value});`;
  if (category === "f64") return `    encoder.encodeF64(${value});`;
  if (category === "string") return `    encoder.encodeString(${value});`;
  if (category === "bin") return `    encoder.encodeBin(${value});`;
  if (category === "baseView" || category === "nestedView") return `    ${value}.encodeToMsgpack(encoder);`;
  if (typeof category === "object" && category.kind === "nullableNestedView") {
    const local = `__arcana_${field.name}`;
    return [
      `    const ${local} = ${value};`,
      `    if (${local} === null) {`,
      `      encoder.encodeNil();`,
      `    } else {`,
      `      ${local}.encodeToMsgpack(encoder);`,
      `    }`,
    ].join("\n");
  }
  if (category === "nullableBool") {
    const local = `__arcana_${field.name}`;
    return [`    const ${local} = ${value};`, `    if (${local} === null) encoder.encodeNil(); else encoder.encodeBool(${local});`].join("\n");
  }
  if (category === "nullableI32") {
    const local = `__arcana_${field.name}`;
    return [`    const ${local} = ${value};`, `    if (${local} === null) encoder.encodeNil(); else encoder.encodeI32(${local});`].join("\n");
  }
  if (category === "nullableI64") {
    const local = `__arcana_${field.name}`;
    return [`    const ${local} = ${value};`, `    if (${local} === null) encoder.encodeNil(); else encoder.encodeI64(${local});`].join("\n");
  }
  if (category === "nullableF64") {
    const local = `__arcana_${field.name}`;
    return [`    const ${local} = ${value};`, `    if (${local} === null) encoder.encodeNil(); else encoder.encodeF64(${local});`].join("\n");
  }
  if (category === "nullableString") {
    const local = `__arcana_${field.name}`;
    return [`    const ${local} = ${value};`, `    if (${local} === null) encoder.encodeNil(); else encoder.encodeString(${local});`].join("\n");
  }
  if (category === "nullableBin") {
    const local = `__arcana_${field.name}`;
    return [`    const ${local} = ${value};`, `    if (${local} === null) encoder.encodeNil(); else encoder.encodeBin(${local});`].join("\n");
  }
  if (category === "i64Matrix") {
    return [
      `    encoder.encodeArrayStart(${value}.length);`,
      `    for (let i = 0; i < ${value}.length; i++) {`,
      `      const row = ${value}[i];`,
      `      encoder.encodeArrayStart(row.length);`,
      `      for (let j = 0; j < row.length; j++) encoder.encodeI64(row[j]);`,
      `    }`,
    ].join("\n");
  }
  if (category === "stringMatrix") {
    return [
      `    encoder.encodeArrayStart(${value}.length);`,
      `    for (let i = 0; i < ${value}.length; i++) {`,
      `      const row = ${value}[i];`,
      `      encoder.encodeArrayStart(row.length);`,
      `      for (let j = 0; j < row.length; j++) encoder.encodeString(row[j]);`,
      `    }`,
    ].join("\n");
  }
  throw new Error(`Unhandled encode category ${category}`);
}

function requireArrayHelperFor(itemType) {
  if (itemType === "bool") return "requireBoolArrayValue";
  if (itemType === "i32") return "requireI32ArrayValue";
  if (itemType === "i64") return "requireI64ArrayValue";
  if (itemType === "f64") return "requireF64ArrayValue";
  if (itemType === "string") return "requireStringArrayValue";
  if (itemType === "bin") return "requireBinArrayValue";
  return "";
}

function requireMapHelperFor(valueType) {
  if (valueType === "bool") return "requireStringBoolMapValue";
  if (valueType === "i32") return "requireStringI32MapValue";
  if (valueType === "i64") return "requireStringI64MapValue";
  if (valueType === "f64") return "requireStringF64MapValue";
  if (valueType === "string") return "requireStringStringMapValue";
  if (valueType === "bin") return "requireStringBinMapValue";
  return "";
}

function generateDecodeField(className, field, category, targetName) {
  const idx = field.index;
  const quotedClass = JSON.stringify(className);
  const quotedField = JSON.stringify(field.name);
  const slot = `arr, ${idx}, ${quotedClass}, ${quotedField}`;
  if (typeof category === "object" && category.kind === "array") {
    if (category.itemType !== "nestedView") {
      return `    ${targetName}.${field.name} = ${requireArrayHelperFor(category.itemType)}(requireArrayItem(${slot}), ${quotedClass}, ${quotedField}, ${idx});`;
    }
    const local = `__arcana_${field.name}`;
    const item = `__arcana_${field.name}_item`;
    return [
      `    const ${local} = requireArrayItem(${slot});`,
      `    if (${local}.kind != MsgpackKind.Array) {`,
      `      throw new Error(${quotedClass} + ".${field.name} at index ${idx} expected ${category.typeName}[], got " + msgpackKindName(${local}.kind));`,
      `    }`,
      `    ${targetName}.${field.name} = new Array<${category.typeName}>(${local}.arr.length);`,
      `    for (let i = 0; i < ${local}.arr.length; i++) {`,
      `      const ${item} = ${local}.arr[i];`,
      `      if (${item}.kind != MsgpackKind.Array) throw new Error(${quotedClass} + ".${field.name}[" + i.toString() + "] expected array, got " + msgpackKindName(${item}.kind));`,
      `      ${targetName}.${field.name}[i] = ${category.typeName}.fromMsgpackArray(${item}.arr);`,
      `    }`,
    ].join("\n");
  }
  if (typeof category === "object" && category.kind === "map") {
    if (category.valueType !== "nestedView") {
      return `    ${targetName}.${field.name} = ${requireMapHelperFor(category.valueType)}(requireArrayItem(${slot}), ${quotedClass}, ${quotedField}, ${idx});`;
    }
    const local = `__arcana_${field.name}`;
    const keys = `__arcana_${field.name}_keys`;
    const key = `__arcana_${field.name}_key`;
    const item = `__arcana_${field.name}_item`;
    return [
      `    const ${local} = requireArrayItem(${slot});`,
      `    if (${local}.kind != MsgpackKind.Map) {`,
      `      throw new Error(${quotedClass} + ".${field.name} at index ${idx} expected Map<string,${category.typeName}>, got " + msgpackKindName(${local}.kind));`,
      `    }`,
      `    ${targetName}.${field.name} = new Map<string, ${category.typeName}>();`,
      `    const ${keys} = ${local}.map.keys();`,
      `    for (let i = 0; i < ${keys}.length; i++) {`,
      `      const ${key} = ${keys}[i];`,
      `      const ${item} = ${local}.map.get(${key});`,
      `      if (${item}.kind != MsgpackKind.Array) throw new Error(${quotedClass} + ".${field.name}[\\"" + ${key} + "\\"] expected array, got " + msgpackKindName(${item}.kind));`,
      `      ${targetName}.${field.name}.set(${key}, ${category.typeName}.fromMsgpackArray(${item}.arr));`,
      `    }`,
    ].join("\n");
  }
  if (category === "bool") return `    ${targetName}.${field.name} = requireArrayBool(${slot});`;
  if (category === "i32") return `    ${targetName}.${field.name} = requireArrayI32(${slot});`;
  if (category === "i64") return `    ${targetName}.${field.name} = requireArrayI64(${slot});`;
  if (category === "f64") return `    ${targetName}.${field.name} = requireArrayF64(${slot});`;
  if (category === "string") return `    ${targetName}.${field.name} = requireArrayStringStrict(${slot});`;
  if (category === "bin") return `    ${targetName}.${field.name} = requireArrayBin(${slot});`;
  if (category === "i64Matrix") {
    return `    ${targetName}.${field.name} = requireI64MatrixValue(requireArrayItem(${slot}), ${quotedClass}, ${quotedField}, ${idx});`;
  }
  if (category === "stringMatrix") {
    return `    ${targetName}.${field.name} = requireStringMatrixValue(requireArrayItem(${slot}), ${quotedClass}, ${quotedField}, ${idx});`;
  }
  if (category === "nullableBool" || category === "nullableI32" || category === "nullableI64" || category === "nullableF64" || category === "nullableString" || category === "nullableBin") {
    const local = `__arcana_${field.name}`;
    const expected =
      category === "nullableBool" ? "bool|null" :
      category === "nullableI32" ? "i32|null" :
      category === "nullableI64" ? "i64|null" :
      category === "nullableF64" ? "f64|null" :
      category === "nullableString" ? "string|null" :
      "Uint8Array|null";
    const kind =
      category === "nullableBool" ? "MsgpackKind.Bool" :
      category === "nullableI32" || category === "nullableI64" ? "MsgpackKind.I64" :
      category === "nullableF64" ? "MsgpackKind.F64" :
      category === "nullableString" ? "MsgpackKind.String" :
      "MsgpackKind.Binary";
    const value =
      category === "nullableBool" ? `${local}.b` :
      category === "nullableI32" ? `i32(${local}.i)` :
      category === "nullableI64" ? `${local}.i` :
      category === "nullableF64" ? `${local}.f` :
      category === "nullableString" ? `${local}.s` :
      `${local}.bin`;
    return [
      `    const ${local} = requireArrayItem(${slot});`,
      `    if (${local}.kind == MsgpackKind.Null) {`,
      `      ${targetName}.${field.name} = null;`,
      `    } else if (${local}.kind == ${kind}) {`,
      `      ${targetName}.${field.name} = ${value};`,
      `    } else {`,
      `      throw new Error(${quotedClass} + ".${field.name} at index ${idx} expected ${expected}, got " + msgpackKindName(${local}.kind));`,
      `    }`,
    ].join("\n");
  }
  if (typeof category === "object" && category.kind === "nullableNestedView") {
    const local = `__arcana_${field.name}`;
    return [
      `    const ${local} = requireArrayItem(${slot});`,
      `    if (${local}.kind == MsgpackKind.Null) {`,
      `      ${targetName}.${field.name} = null;`,
      `    } else if (${local}.kind == MsgpackKind.Array) {`,
      `      ${targetName}.${field.name} = ${category.typeName}.fromMsgpackArray(${local}.arr);`,
      `    } else {`,
      `      throw new Error(${quotedClass} + ".${field.name} at index ${idx} expected ${category.typeName}|null, got " + msgpackKindName(${local}.kind));`,
      `    }`,
    ].join("\n");
  }
  if (category === "nestedView") {
    const local = `__arcana_${field.name}`;
    return [
      `    const ${local} = requireArrayItem(${slot});`,
      `    if (${local}.kind != MsgpackKind.Array) {`,
      `      throw new Error(${quotedClass} + ".${field.name} at index ${idx} expected array, got " + msgpackKindName(${local}.kind));`,
      `    }`,
      `    ${targetName}.${field.name} = ${field.typeName}.fromMsgpackArray(${local}.arr);`,
    ].join("\n");
  }
  if (category === "baseView") {
    const local = `__arcana_${field.name}`;
    return [
      `    const ${local} = requireArrayItem(${slot});`,
      `    if (${local}.kind == MsgpackKind.Array) {`,
      `      ${targetName}.${field.name} = ${field.typeName}.fromMsgpackArray(${local}.arr);`,
      `    } else if (${local}.kind == MsgpackKind.Map) {`,
      `      ${targetName}.${field.name} = ${field.typeName}.fromMsgpackMap(${local}.map);`,
      `    } else {`,
      `      throw new Error(${quotedClass} + ".${field.name} at index ${idx} expected array or map, got " + msgpackKindName(${local}.kind));`,
      `    }`,
    ].join("\n");
  }
  throw new Error(`Unhandled decode category ${category}`);
}

function generateMsgpackMembers(info, generatedClassNames) {
  const categories = info.fields.map(field => fieldCategory(field, generatedClassNames));
  const encodeLines = [
    `encodeToMsgpack(encoder: MessagePackEncoder): void {`,
    `    encoder.encodeArrayStart(${info.fields.length});`,
  ];
  for (let i = 0; i < info.fields.length; i++) {
    encodeLines.push(generateEncodeField(info.fields[i], categories[i]));
  }
  encodeLines.push(`  }`);

  const fromArrayLines = [
    `static fromMsgpackArray(arr: Array<MsgpackValue>): ${info.name} {`,
    `    requireArrayLength(arr, ${info.fields.length}, ${JSON.stringify(info.name)});`,
    `    const out = new ${info.name}();`,
  ];
  for (let i = 0; i < info.fields.length; i++) {
    fromArrayLines.push(generateDecodeField(info.name, info.fields[i], categories[i], "out"));
  }
  fromArrayLines.push(`    return out;`);
  fromArrayLines.push(`  }`);

  const members = [encodeLines.join("\n"), fromArrayLines.join("\n")];
  const toBytesLines = [
    `toBytes(): Uint8Array {`,
    `    const encoder = new MessagePackEncoder();`,
    `    this.encodeToMsgpack(encoder);`,
    `    const len = encoder.getLength();`,
    `    const out = new Uint8Array(len);`,
    `    memory.copy(out.dataStart, encoder.getBufferPtr(), len);`,
    `    return out;`,
    `  }`,
  ];
  members.push(toBytesLines.join("\n"));
  if (info.kind === "args") {
    const fromBytesLines = [
      `static fromBytes(bytes: Uint8Array): ${info.name} {`,
      `    return ${info.name}.fromMsgpackArray(decodeArgsArray(bytes));`,
      `  }`,
    ];
    members.push(fromBytesLines.join("\n"));
  }
  return members;
}

// ============================================================
// Typed Event Class Generation
// ============================================================

function getEventClassType(node) {
  if (!node.decorators?.some(d => d.name?.text === "arcanaEvent")) return null;
  return getDecoratorRawStringArg(node, "arcanaEvent");
}

function eventFieldCategory(field) {
  const typeName = field.typeName;
  const arrayMatch = typeName.match(/^(.+)\[\]$/);
  if (arrayMatch) {
    const itemType = arrayMatch[1];
    if (itemType === "bool") return { kind: "array", itemType: "bool" };
    if (itemType === "i32") return { kind: "array", itemType: "i32" };
    if (itemType === "i64") return { kind: "array", itemType: "i64" };
    if (itemType === "f64") return { kind: "array", itemType: "f64" };
    if (itemType === "string") return { kind: "array", itemType: "string" };
    if (itemType === "Uint8Array") return { kind: "array", itemType: "bin" };
  }
  if (typeName === "bool") return "bool";
  if (typeName === "i32") return "i32";
  if (typeName === "i64") return "i64";
  if (typeName === "f64") return "f64";
  if (typeName === "string") return "string";
  if (typeName === "Uint8Array") return "bin";
  if (typeName === "i64[][]") return "i64Matrix";
  if (typeName === "bool|null") return "nullableBool";
  if (typeName === "i32|null") return "nullableI32";
  if (typeName === "i64|null") return "nullableI64";
  if (typeName === "f64|null") return "nullableF64";
  if (typeName === "string|null") return "nullableString";
  throw new Error(
    `@arcanaEvent unsupported field type ${typeName} for ${field.name}. ` +
    `Supported event payload types are bool, i32, i64, f64, string, Uint8Array, primitive arrays, i64[][], and nullable primitives.`
  );
}

function validateEventTopics(info, categories) {
  let count = 0;
  for (let i = 0; i < info.fields.length; i++) {
    const field = info.fields[i];
    if (!field.isTopic) continue;
    count++;
    const category = categories[i];
    const supported = category === "bool" ||
      category === "i32" ||
      category === "i64" ||
      category === "f64" ||
      category === "string" ||
      category === "nullableBool" ||
      category === "nullableI32" ||
      category === "nullableI64" ||
      category === "nullableF64" ||
      category === "nullableString";
    if (!supported) {
      throw new Error(`@arcanaEvent ${info.name}.${field.name} is marked @topic but has unsupported topic type ${field.typeName}. Topics support primitive scalar fields only.`);
    }
  }
  if (count > 4) {
    throw new Error(`@arcanaEvent ${info.name} marks ${count} topics; at most 4 topics are supported`);
  }
}

function generateEventEncodeField(field, category) {
  const value = `this.${field.name}`;
  if (typeof category === "object" && category.kind === "array") {
    return [
      `    encoder.encodeArrayStart(${value}.length);`,
      `    for (let i = 0; i < ${value}.length; i++) ${encodeValueLine("encoder", `${value}[i]`, category.itemType)}`,
    ].join("\n");
  }
  if (category === "bool") return `    encoder.encodeBool(${value});`;
  if (category === "i32") return `    encoder.encodeI32(${value});`;
  if (category === "i64") return `    encoder.encodeI64(${value});`;
  if (category === "f64") return `    encoder.encodeF64(${value});`;
  if (category === "string") return `    encoder.encodeString(${value});`;
  if (category === "bin") return `    encoder.encodeBin(${value});`;
  if (category === "i64Matrix") {
    return [
      `    encoder.encodeArrayStart(${value}.length);`,
      `    for (let i = 0; i < ${value}.length; i++) {`,
      `      const row = ${value}[i];`,
      `      encoder.encodeArrayStart(row.length);`,
      `      for (let j = 0; j < row.length; j++) encoder.encodeI64(row[j]);`,
      `    }`,
    ].join("\n");
  }
  if (category === "nullableString") {
    const local = `__arcana_${field.name}`;
    return [
      `    const ${local} = ${value};`,
      `    if (${local} !== null) {`,
      `      encoder.encodeString(${local});`,
      `    } else {`,
      `      encoder.encodeNil();`,
      `    }`,
    ].join("\n");
  }
  if (category === "nullableBool") {
    const local = `__arcana_${field.name}`;
    return [
      `    const ${local} = ${value};`,
      `    if (${local} !== null) {`,
      `      encoder.encodeBool(${local});`,
      `    } else {`,
      `      encoder.encodeNil();`,
      `    }`,
    ].join("\n");
  }
  if (category === "nullableI32") {
    const local = `__arcana_${field.name}`;
    return [
      `    const ${local} = ${value};`,
      `    if (${local} !== null) {`,
      `      encoder.encodeI32(${local});`,
      `    } else {`,
      `      encoder.encodeNil();`,
      `    }`,
    ].join("\n");
  }
  if (category === "nullableI64") {
    const local = `__arcana_${field.name}`;
    return [
      `    const ${local} = ${value};`,
      `    if (${local} !== null) {`,
      `      encoder.encodeI64(${local});`,
      `    } else {`,
      `      encoder.encodeNil();`,
      `    }`,
    ].join("\n");
  }
  if (category === "nullableF64") {
    const local = `__arcana_${field.name}`;
    return [
      `    const ${local} = ${value};`,
      `    if (${local} !== null) {`,
      `      encoder.encodeF64(${local});`,
      `    } else {`,
      `      encoder.encodeNil();`,
      `    }`,
    ].join("\n");
  }
  throw new Error(`Unhandled event encode category ${category}`);
}

function generateTopicPush(field, category) {
  const value = `this.${field.name}`;
  if (category === "string") return `    topics.push(${value});`;
  if (category === "bool") return `    topics.push(${value} ? "true" : "false");`;
  if (category === "i32" || category === "i64" || category === "f64") return `    topics.push(${value}.toString());`;
  if (category === "nullableString") {
    const local = `__arcana_${field.name}_topic`;
    return [
      `    const ${local} = ${value};`,
      `    if (${local} !== null) topics.push(${local});`,
    ].join("\n");
  }
  if (category === "nullableBool") {
    const local = `__arcana_${field.name}_topic`;
    return [
      `    const ${local} = ${value};`,
      `    if (${local} !== null) topics.push(${local} ? "true" : "false");`,
    ].join("\n");
  }
  if (category === "nullableI32" || category === "nullableI64" || category === "nullableF64") {
    const local = `__arcana_${field.name}_topic`;
    return [
      `    const ${local} = ${value};`,
      `    if (${local} !== null) topics.push(${local}.toString());`,
    ].join("\n");
  }
  throw new Error(`Unhandled event topic category ${category}`);
}

function generateEventTopicsMember(info, categories) {
  const lines = [
    `toTopics(): Array<string> {`,
    `    const topics = new Array<string>();`,
  ];
  for (let i = 0; i < info.fields.length; i++) {
    if (info.fields[i].isTopic) {
      lines.push(generateTopicPush(info.fields[i], categories[i]));
    }
  }
  lines.push(`    return topics;`);
  lines.push(`  }`);
  return lines.join("\n");
}

function generateEventMembers(info) {
  const categories = info.fields.map(eventFieldCategory);
  validateEventTopics(info, categories);
  const typeLiteral = JSON.stringify(info.type);
  const encodeLines = [
    `encodeToMsgpack(encoder: MessagePackEncoder): void {`,
    `    encoder.encodeArrayStart(${info.fields.length});`,
  ];
  for (let i = 0; i < info.fields.length; i++) {
    encodeLines.push(generateEventEncodeField(info.fields[i], categories[i]));
  }
  encodeLines.push(`  }`);

  return [
    `static eventType(): string { return ${typeLiteral}; }`,
    `eventType(): string { return ${typeLiteral}; }`,
    generateEventTopicsMember(info, categories),
    encodeLines.join("\n"),
    `toEvent(): ContractEvent { return new ContractEvent(${typeLiteral}, null, this.toTopics(), changetype<MsgpackEncodable>(this)); }`,
    `toEventWithTopics(topics: Array<string>): ContractEvent { return new ContractEvent(${typeLiteral}, null, topics, changetype<MsgpackEncodable>(this)); }`,
  ];
}

// ============================================================
// Arcana State Generation
// ============================================================

function hasClassDecorator(node, name) {
  return node.decorators?.some(d => d.name?.text === name) ?? false;
}

function stateViewNameFor(stateName) {
  return `${stateName}View`;
}

function isBaseViewField(field) {
  return field.typeName === "ProgramStateView" || field.typeName === "GameStateView";
}

function stateFieldMap(fields) {
  const out = new Map();
  for (const field of fields) out.set(field.name, field);
  return out;
}

function stateBaseApplyLine(stateVar, viewVar, baseField) {
  if (baseField.typeName === "GameStateView") {
    return `    applyProgramStateView(${stateVar}, ${viewVar}.${baseField.name});`;
  }
  return `    applyProgramStateView(${stateVar}, ${viewVar}.${baseField.name});`;
}

function stateBaseToViewLine(viewVar, stateVar, baseField) {
  if (baseField.typeName === "GameStateView") {
    return `    ${viewVar}.${baseField.name} = gameStateToView(${stateVar});`;
  }
  return `    ${viewVar}.${baseField.name} = programStateToView(${stateVar});`;
}

function copyExprForStateField(expr, typeName) {
  if (typeName === "string[]") return `copyStringArray(${expr})`;
  if (typeName === "string[][]") return `copyStringMatrix(${expr})`;
  if (typeName === "i64[][]") return `copyI64Matrix(${expr})`;
  return expr;
}

function validateMirrorState(info) {
  const stateFields = stateFieldMap(info.fields);
  const baseFields = info.viewInfo.fields.filter(isBaseViewField);
  if (baseFields.length > 1) {
    throw new Error(`@arcanaState ${info.name} expected ${info.viewName} to contain at most one ProgramStateView or GameStateView base field`);
  }
  for (const viewField of info.viewInfo.fields) {
    if (isBaseViewField(viewField)) continue;
    const stateField = stateFields.get(viewField.name);
    if (!stateField) {
      throw new Error(`@arcanaState ${info.name} is missing field ${viewField.name} required by ${info.viewName}`);
    }
    if (stateField.typeName !== viewField.typeName) {
      throw new Error(`@arcanaState ${info.name}.${viewField.name} type ${stateField.typeName} does not match ${info.viewName}.${viewField.name} type ${viewField.typeName}`);
    }
  }
  for (const stateField of info.fields) {
    const viewField = info.viewInfo.fields.find(f => f.name === stateField.name);
    if (!viewField) {
      throw new Error(`@arcanaState ${info.name}.${stateField.name} has no matching field in ${info.viewName}; keep this state manual or add the field to the view`);
    }
  }
}

function generateArcanaStateMembers(info) {
  validateMirrorState(info);
  const baseField = info.viewInfo.fields.find(isBaseViewField);
  const dataFields = info.viewInfo.fields.filter(f => !isBaseViewField(f));

  const fromBytesLines = [
    `static fromBytes(bytes: Uint8Array): ${info.name} {`,
    `    if (bytes.length == 0) return new ${info.name}();`,
    `    return ${info.name}.fromView(${info.viewName}.fromMsgpackArray(decodeStateArray(bytes)));`,
    `  }`,
  ];

  const fromViewLines = [
    `static fromView(view: ${info.viewName}): ${info.name} {`,
    `    const state = new ${info.name}();`,
  ];
  if (baseField) fromViewLines.push(stateBaseApplyLine("state", "view", baseField));
  for (const field of dataFields) {
    fromViewLines.push(`    state.${field.name} = ${copyExprForStateField(`view.${field.name}`, field.typeName)};`);
  }
  fromViewLines.push(`    return state;`);
  fromViewLines.push(`  }`);

  const toViewLines = [
    `toView(): ${info.viewName} {`,
    `    const view = new ${info.viewName}();`,
  ];
  if (baseField) toViewLines.push(stateBaseToViewLine("view", "this", baseField));
  for (const field of dataFields) {
    toViewLines.push(`    view.${field.name} = ${copyExprForStateField(`this.${field.name}`, field.typeName)};`);
  }
  toViewLines.push(`    return view;`);
  toViewLines.push(`  }`);

  const toBytesLines = [
    `toBytes(): Uint8Array {`,
    `    return this.toView().toBytes();`,
    `  }`,
  ];

  return [fromBytesLines.join("\n"), fromViewLines.join("\n"), toViewLines.join("\n"), toBytesLines.join("\n")];
}

// ============================================================
// Transform
// ============================================================

export default class DecoratorTransform extends Transform {
  afterParse(parser) {
    const entries = [];
    this.generateMsgpackSerialization(parser);
    this.generateArcanaStates(parser);
    this.generateTypedEvents(parser);
    let userModulePath = null;
    let userImportSources = new Map();

    for (const src of parser.sources) {
      const srcPath = src.internalPath;

      for (const st of src.statements ?? []) {
        if (st.kind !== NodeKind.FunctionDeclaration) continue;

        const name = fnName(st);
        if (!name) continue;

        const kind = this.getEntryKind(st);
        if (!kind) continue;

        userModulePath = (srcPath ?? src.normalizedPath ?? "assembly/index").replace(/\.ts$/, "");
        userImportSources = collectNamedImportSources(st.range?.source?.text ?? "");
        const ret = returnType(st);

        if (kind === "constructor") {
          this.collectConstructor(entries, st, name, ret);
        } else if (kind === "action") {
          this.collectAction(entries, st, name, ret);
        } else {
          this.collectView(entries, st, name, ret);
        }
      }
    }

    if (!entries.length) return;
    if (!userModulePath) throw new Error("Failed to resolve user module path");

    const filename = userModulePath.split("/").pop();
    const genPath = userModulePath.replace(/[^/]+$/, "contract.generated.ts");
    const genSource = this.generateCode(entries, `"./${filename}"`, userImportSources);

    parser.parseFile(genSource, genPath, true);
  }

  generateMsgpackSerialization(parser) {
    const classes = [];
    const generatedClassNames = new Set();

    for (const src of parser.sources) {
      for (const st of src.statements ?? []) {
        if (st.kind !== NodeKind.ClassDeclaration) continue;
        const kind = getMsgpackClassKind(st);
        if (!kind) continue;
        const name = st.name?.text ?? "";
        if (!name) throw new Error("@msgpack class is missing a name");
        generatedClassNames.add(name);
        classes.push({ source: src, node: st, info: new MsgpackClassInfo(kind, name, collectMsgpackFields(st)) });
      }
    }

    if (!classes.length) return;

    for (const entry of classes) {
      const existingMembers = new Set((entry.node.members ?? []).map(member => member.name?.text ?? ""));
      const generatedMembers = generateMsgpackMembers(entry.info, generatedClassNames);
      for (const memberText of generatedMembers) {
        const nameMatch = memberText.match(/(?:static\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
        const memberName = nameMatch?.[1] ?? "";
        if (memberName && existingMembers.has(memberName)) {
          throw new Error(`@${entry.info.kind === "view" ? "msgpackView" : "msgpackArgs"} ${entry.info.name} already defines ${memberName}; remove the manual method or the decorator`);
        }
        entry.node.members.push(SimpleParser.parseClassMember(memberText, entry.node));
      }
    }
  }

  generateArcanaStates(parser) {
    const msgpackInfos = new Map();
    const stateClasses = [];

    for (const src of parser.sources) {
      for (const st of src.statements ?? []) {
        if (st.kind !== NodeKind.ClassDeclaration) continue;

        const msgpackKind = getMsgpackClassKind(st);
        const name = st.name?.text ?? "";
        if (msgpackKind && name) {
          msgpackInfos.set(name, new MsgpackClassInfo(msgpackKind, name, collectMsgpackFields(st)));
        }

        if (hasClassDecorator(st, "arcanaState")) {
          if (!name) throw new Error("@arcanaState class is missing a name");
          stateClasses.push({ source: src, node: st, name, fields: collectDataFields(st, "arcanaState") });
        }
      }
    }

    if (!stateClasses.length) return;

    for (const entry of stateClasses) {
      const viewName = stateViewNameFor(entry.name);
      const viewInfo = msgpackInfos.get(viewName);
      if (!viewInfo || viewInfo.kind !== "view") {
        throw new Error(`@arcanaState ${entry.name} expected matching @msgpackView class ${viewName}`);
      }
      const info = new ArcanaStateInfo(entry.name, viewName, entry.fields, viewInfo);
      const existingMembers = new Set((entry.node.members ?? []).map(member => member.name?.text ?? ""));
      const generatedMembers = generateArcanaStateMembers(info);
      for (const memberText of generatedMembers) {
        const nameMatch = memberText.match(/(?:static\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
        const memberName = nameMatch?.[1] ?? "";
        if (memberName && existingMembers.has(memberName)) {
          throw new Error(`@arcanaState ${entry.name} already defines ${memberName}; remove the manual method or the decorator`);
        }
        entry.node.members.push(SimpleParser.parseClassMember(memberText, entry.node));
      }
    }
  }

  generateTypedEvents(parser) {
    const classes = [];

    for (const src of parser.sources) {
      for (const st of src.statements ?? []) {
        if (st.kind !== NodeKind.ClassDeclaration) continue;
        const eventType = getEventClassType(st);
        if (eventType === null) continue;
        const name = st.name?.text ?? "";
        if (!name) throw new Error("@arcanaEvent class is missing a name");
        classes.push({ source: src, node: st, info: new EventClassInfo(name, eventType, collectDataFields(st, "arcanaEvent")) });
      }
    }

    if (!classes.length) return;

    for (const entry of classes) {
      const existingMembers = new Set((entry.node.members ?? []).map(member => member.name?.text ?? ""));
      const generatedMembers = generateEventMembers(entry.info);
      for (const memberText of generatedMembers) {
        const nameMatch = memberText.match(/(?:static\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
        const memberName = nameMatch?.[1] ?? "";
        if (memberName && existingMembers.has(memberName)) {
          throw new Error(`@arcanaEvent ${entry.info.name} already defines ${memberName}; remove the manual method or the decorator`);
        }
        entry.node.members.push(SimpleParser.parseClassMember(memberText, entry.node));
      }
    }
  }

  getEntryKind(fn) {
    if (hasDecorator(fn, "constructor")) return "constructor";
    if (hasDecorator(fn, "action")) return "action";
    if (hasDecorator(fn, "view") || hasDecorator(fn, "viewDecorator")) return "view";
    return null;
  }

  // ============================================================
  // Entry Collectors
  // ============================================================

  collectConstructor(out, fn, name, ret) {
    if (fn.signature.parameters.length !== 2) {
      throw new Error(`@constructor ${name} must have (context, args)`);
    }
    const argsT = paramType(fn.signature.parameters[1]);
    if (!argsT) throw new Error(`@constructor ${name} missing args type`);
    out.push(new EntryInfo("constructor", name, name, "", argsT, ret));
  }

  collectAction(out, fn, name, ret) {
    const paramCount = fn.signature.parameters.length;
    if (paramCount !== 2 && paramCount !== 3) {
      throw new Error(`@action ${name} must have (context, state[, args])`);
    }
    const blockedPrecompileCalls = findBlockedActionPrecompileCallsInFunction(fn);
    if (blockedPrecompileCalls.length > 0) {
      throw new Error(
        `@action ${name} uses ${blockedPrecompileCalls.join(", ")}. kvGet* precompiles are view-only; move this read into a @view entrypoint.`
      );
    }
    const stateT = paramType(fn.signature.parameters[1]);
    if (!stateT) throw new Error(`@action ${name} missing state type`);
    const argsT = paramCount === 3 ? paramType(fn.signature.parameters[2]) : "";
    out.push(new EntryInfo("action", name, name, stateT, argsT, ret));
  }

  collectView(out, fn, name, ret) {
    const paramCount = fn.signature.parameters.length;
    if (paramCount !== 2 && paramCount !== 3) {
      throw new Error(`@view ${name} must have (context, state[, args])`);
    }

    const stateT = paramType(fn.signature.parameters[1]);
    if (!stateT) throw new Error(`@view ${name} missing state type`);

    const argsT = paramCount === 3 ? paramType(fn.signature.parameters[2]) : "";
    const regName = getDecoratorStringArg(fn, "view") ?? getDecoratorStringArg(fn, "viewDecorator") ?? "view";

    if (!ret) {
      throw new Error(`@view ${name}: failed to extract return type`);
    }
    if (ret.startsWith("ContractResponse")) {
      throw new Error(`@view ${name}: views must not return ContractResponse`);
    }

    out.push(new EntryInfo("view", regName, name, stateT, argsT, ret));
  }

  // ============================================================
  // Code Generation
  // ============================================================

  generateCode(entries, userModulePath, userImportSources = new Map()) {
    const lines = [
      // Core imports
      `import { ContractContext } from "@arcanahq/core/assembly/core/context";`,
      `import { EntrypointRegistry } from "@arcanahq/core/assembly/core/registry";`,
      `import { handleWithRegistries } from "@arcanahq/core/assembly/core/entrypoint";`,
      `import { ARCANA_WASM_ABI_VERSION } from "@arcanahq/core/assembly/core/abi";`,
      `import { getCurrentArgsBytes, getCurrentStateBytes } from "@arcanahq/core/assembly/core/args";`,
      `import { ContractResponse, ViewResponse, ContractError, encodeContractResponseMsgpack, encodeContractResponseMsgpackWithStateBytes, encodeViewResponseMsgpack, encodeViewStringResponseMsgpack, encodeViewBoolResponseMsgpack, encodeViewI32ResponseMsgpack, encodeViewI64ResponseMsgpack, encodeViewF64ResponseMsgpack } from "@arcanahq/core/assembly/core/response";`,
      `import { scratch_alloc as _scratch_alloc, init_scratch_base as _init_scratch_base } from "@arcanahq/core/assembly/core/wasm";`,
      ``,
    ];

    // Collect user imports. Entrypoint functions come from index.ts; imported
    // state/args/view classes come from their original modules so index.ts does
    // not need to re-export classes and trigger AS235.
    const entrypointImports = new Set();
    const localTypeImports = new Set();
    const moduleTypeImports = new Map();
    const addTypeImport = (name) => {
      if (!name || isPrimitiveReturnType(name) || name === "ViewResponse") return;
      const source = userImportSources.get(name);
      if (source) {
        if (!moduleTypeImports.has(source)) moduleTypeImports.set(source, new Set());
        moduleTypeImports.get(source).add(name);
      } else {
        localTypeImports.add(name);
      }
    };

    for (const e of entries) {
      addTypeImport(e.stateType);
      addTypeImport(e.argsType);
      entrypointImports.add(e.userFnName);
      
      if (e.kind === "view" && e.retTypeName) {
        if (e.retTypeName.startsWith("ViewResponse")) {
          const inner = extractInnerType(e.retTypeName);
          if (inner !== e.retTypeName && inner !== "ViewResponse") addTypeImport(inner);
        } else {
          addTypeImport(e.retTypeName);
        }
      }
    }

    pushImport(lines, entrypointImports, userModulePath);
    pushImport(lines, localTypeImports, userModulePath);
    for (const [source, names] of moduleTypeImports) {
      pushImport(lines, names, `"${source}"`);
    }
    lines.push(``);

    // Generate wrappers and handle function
    for (const e of entries) {
      lines.push(this.generateWrapper(e));
    }
    lines.push(this.generateHandleFunction(entries));

    return lines.join("\n");
  }

  generateWrapper(e) {
    const wrapper = `__ce_wrap_${e.userFnName}`;
    const resType = e.retTypeName || "auto";
    const lines = [`export function ${wrapper}(context: ContractContext, stateBytes: Uint8Array, argsBytes: Uint8Array): i64 {`];

    // Parse state (not needed for constructor)
    if (e.kind !== "constructor") {
      lines.push(`  const state = ${e.stateType}.fromBytes(getCurrentStateBytes());`);
    }

    // Parse args if present
    if (e.argsType) {
      if (isRawBytesArgType(e.argsType)) {
        if (e.argsType === "ArrayBuffer") {
          lines.push(`  const args = getCurrentArgsBytes().buffer;`);
        } else {
          lines.push(`  const args = getCurrentArgsBytes();`);
        }
      } else {
        lines.push(`  const args = ${e.argsType}.fromBytes(getCurrentArgsBytes());`);
      }
    }

    // Call user function
    const callArgs = e.kind === "constructor" 
      ? "context, args"
      : e.argsType ? "context, state, args" : "context, state";
    lines.push(`  const res: ${resType} = ${e.userFnName}(${callArgs});`);

    // Encode and return
    lines.push(`  return ${this.encodeReturn(e, "res")};`);
    lines.push(`}`, ``);

    return lines.join("\n");
  }

  encodeReturn(e, expr) {
    if (e.kind === "view") {
      if (e.retTypeName.startsWith("ViewResponse")) {
        const inner = extractInnerType(e.retTypeName);
        return `(${expr}.view === null) ? encodeViewResponseMsgpack<${inner}>(changetype<${inner}>(${expr}.view)) : encodeViewResponseMsgpack<${inner}>(changetype<${inner}>(${expr}.view))`;
      }
      if (e.retTypeName === "string") return `encodeViewStringResponseMsgpack(${expr})`;
      if (e.retTypeName === "bool") return `encodeViewBoolResponseMsgpack(${expr})`;
      if (e.retTypeName === "i32") return `encodeViewI32ResponseMsgpack(${expr})`;
      if (e.retTypeName === "i64") return `encodeViewI64ResponseMsgpack(${expr})`;
      if (e.retTypeName === "f64") return `encodeViewF64ResponseMsgpack(${expr})`;
      return `encodeViewResponseMsgpack<${e.retTypeName}>(${expr})`;
    }

    // Constructor/Action with ContractResponse
    if (e.retTypeName?.startsWith("ContractResponse")) {
      let stateType = e.stateType;
      if (e.kind === "constructor" && !stateType) {
        stateType = extractInnerType(e.retTypeName);
      }

      if (stateType && !isRawBytesStateType(stateType)) {
        return `encodeContractResponseMsgpackWithStateBytes(${expr}, ${expr}.state.toBytes())`;
      }
      return `encodeContractResponseMsgpack(${expr})`;
    }

    // Plain state return (wrap in ContractResponse format)
    const stateExpr = e.stateType
      ? `changetype<${e.stateType}>(${expr})`
      : `${expr}`;
    if (e.stateType && !isRawBytesStateType(e.stateType)) {
      return `encodeContractResponseMsgpackWithStateBytes(ContractResponse.withState(${stateExpr}), ${stateExpr}.toBytes())`;
    }
    return `encodeContractResponseMsgpack(ContractResponse.withState(${stateExpr}))`;
  }

  generateHandleFunction(entries) {
    const viewEntries = entries.filter(e => e.kind === "view");
    const viewNames = viewEntries.map(e => `"${e.regName}"`).join(", ");

    const lines = [
      `export function handle_bytes(`,
      `  contextPtr: i32, contextLen: i32,`,
      `  entrypointPtr: i32, entrypointLen: i32,`,
      `  argsPtr: i32, argsLen: i32,`,
      `  statePtr: i32, stateLen: i32,`,
      `  operationMode: i32`,
      `): i64 {`,
      `  const actions = new EntrypointRegistry<ContractContext>();`,
      `  const views = new EntrypointRegistry<ContractContext>();`,
    ];

    for (const e of entries) {
      const wrapper = `__ce_wrap_${e.userFnName}`;
      const registry = e.kind === "view" ? "views" : "actions";
      lines.push(`  ${registry}.add("${e.regName}", ${wrapper});`);
    }

    lines.push(
      `  return handleWithRegistries(`,
      `    contextPtr, contextLen,`,
      `    entrypointPtr, entrypointLen,`,
      `    argsPtr, argsLen,`,
      `    statePtr, stateLen,`,
      `    operationMode,`,
      `    actions, views`,
      `  );`,
      `}`,
      ``,
      ``,
      `// WASM runtime exports - re-export with aliases to ensure they're available`,
      `export function scratch_alloc(size: i32): i32 {`,
      `  return _scratch_alloc(size);`,
      `}`,
      `export function init_scratch_base(base: i32): void {`,
      `  _init_scratch_base(base);`,
      `}`,
      ``,
      `// Required by Arcana host to validate ABI compatibility across language toolchains.`,
      `export function arcana_abi_version(): i32 {`,
      `  return ARCANA_WASM_ABI_VERSION;`,
      `}`,
    );

    return lines.join("\n");
  }
}
