// @ts-nocheck
/**
 * ContractResponse - typed envelope for contract return values
 * Supports state, view, events, effects, and errors
 */

import { MessagePackEncoder } from "../primitives/msgpack";
import { decodeMsgpack, MsgpackKind, MsgpackValue } from "../primitives/msgpack_decode";
import { packPtrLen } from "./wasm";

export interface MsgpackEncodable {
  encodeToMsgpack(encoder: MessagePackEncoder): void;
}

export class ContractError {
  code: string;
  message: string;
  dataJson: string | null; // embedded JSON, not a quoted JSON string

  constructor(code: string, message: string, dataJson: string | null = null) {
    this.code = code;
    this.message = message;
    this.dataJson = dataJson;
  }
}

export class ContractEvent {
  type: string;
  payload: Map<string, string> | null;
  topics: Array<string>;
  data: MsgpackEncodable | null;

  constructor(
    type: string,
    payload: Map<string, string> | null = null,
    topics: Array<string> | null = null,
    data: MsgpackEncodable | null = null,
  ) {
    this.type = type;
    this.payload = payload;
    this.topics = topics === null ? new Array<string>() : topics;
    this.data = data;
  }
}

export class EventPayload {
  private values: Map<string, string>;

  constructor() {
    this.values = new Map<string, string>();
  }

  set(key: string, value: string): EventPayload {
    this.values.set(key, value);
    return this;
  }

  string(key: string, value: string): EventPayload {
    return this.set(key, value);
  }

  i32(key: string, value: i32): EventPayload {
    return this.set(key, value.toString());
  }

  i64(key: string, value: i64): EventPayload {
    return this.set(key, value.toString());
  }

  f64(key: string, value: f64): EventPayload {
    return this.set(key, value.toString());
  }

  bool(key: string, value: bool): EventPayload {
    return this.set(key, value ? "true" : "false");
  }

  build(): Map<string, string> {
    return this.values;
  }
}

export class EventBuilder {
  private eventType: string;
  private payload: EventPayload;

  constructor(eventType: string) {
    this.eventType = eventType;
    this.payload = new EventPayload();
  }

  with(key: string, value: string): EventBuilder {
    this.payload.set(key, value);
    return this;
  }

  withString(key: string, value: string): EventBuilder {
    this.payload.string(key, value);
    return this;
  }

  withI32(key: string, value: i32): EventBuilder {
    this.payload.i32(key, value);
    return this;
  }

  withI64(key: string, value: i64): EventBuilder {
    this.payload.i64(key, value);
    return this;
  }

  withF64(key: string, value: f64): EventBuilder {
    this.payload.f64(key, value);
    return this;
  }

  withBool(key: string, value: bool): EventBuilder {
    this.payload.bool(key, value);
    return this;
  }

  build(): ContractEvent {
    return new ContractEvent(this.eventType, this.payload.build());
  }
}

export class Event {
  static named(type: string): EventBuilder {
    return new EventBuilder(type);
  }

  static payload(): EventPayload {
    return new EventPayload();
  }

  static of(type: string, payload: Map<string, string> | null = null): ContractEvent {
    return new ContractEvent(type, payload);
  }
}

export class ContractTask {
  name: string;
  args: Map<string, string> | null;

  constructor(name: string, args: Map<string, string> | null = null) {
    this.name = name;
    this.args = args;
  }
}

// Program-facing aliases. The runtime still serializes the same wire format,
// but generated AssemblyScript should use program vocabulary.
export class ProgramTask extends ContractTask {
  constructor(name: string, args: Map<string, string> | null = null) {
    super(name, args);
  }
}

export class TaskArgs {
  private values: Map<string, string>;

  constructor() {
    this.values = new Map<string, string>();
  }

  set(key: string, value: string): TaskArgs {
    this.values.set(key, value);
    return this;
  }

  string(key: string, value: string): TaskArgs {
    return this.set(key, value);
  }

  i32(key: string, value: i32): TaskArgs {
    return this.set(key, value.toString());
  }

  i64(key: string, value: i64): TaskArgs {
    return this.set(key, value.toString());
  }

  f64(key: string, value: f64): TaskArgs {
    return this.set(key, value.toString());
  }

  bool(key: string, value: bool): TaskArgs {
    return this.set(key, value ? "true" : "false");
  }

  build(): Map<string, string> {
    return this.values;
  }
}

export class TaskBuilder {
  private taskName: string;
  private args: TaskArgs;

  constructor(taskName: string) {
    this.taskName = taskName;
    this.args = new TaskArgs();
  }

  with(key: string, value: string): TaskBuilder {
    this.args.set(key, value);
    return this;
  }

  withString(key: string, value: string): TaskBuilder {
    this.args.string(key, value);
    return this;
  }

  withI32(key: string, value: i32): TaskBuilder {
    this.args.i32(key, value);
    return this;
  }

  withI64(key: string, value: i64): TaskBuilder {
    this.args.i64(key, value);
    return this;
  }

  withF64(key: string, value: f64): TaskBuilder {
    this.args.f64(key, value);
    return this;
  }

  withBool(key: string, value: bool): TaskBuilder {
    this.args.bool(key, value);
    return this;
  }

  build(): ContractTask {
    return new ContractTask(this.taskName, this.args.build());
  }
}

export class Task {
  static named(name: string): TaskBuilder {
    return new TaskBuilder(name);
  }

  static args(): TaskArgs {
    return new TaskArgs();
  }

  static of(name: string, args: Map<string, string> | null = null): ContractTask {
    return new ContractTask(name, args);
  }
}

// ContractEffect - base class for contract effects
// Similar to EVM events: type + 4 indexed fields (like topics) + data field
// This provides a flexible but structured format for effects
export class ContractEffect implements MsgpackEncodable {
  type: string; // Effect type identifier (e.g., "IncrementBalance", "Log")

  constructor(type: string) {
    this.type = type;
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    // Base effect encoding: explicit type only.
    // Subclasses should override and provide typed fields/bytes.
    encoder.encodeMapStart(1);
    encoder.encodeString("type");
    encoder.encodeString(this.type);
  }
}

// Program-facing alias for generated AssemblyScript helpers.
export class ProgramEffect extends ContractEffect {
  constructor(type: string) {
    super(type);
  }
}

// IncrementBalanceEffect - specific implementation for balance increments
export class IncrementBalanceEffect extends ContractEffect {
  private _userId: string;
  private _token: string;
  private _amount: string;
  private _failOnError: bool;

  constructor(userId: string, token: string, amount: string, failOnError: bool = true) {
    super("IncrementBalance");
    this._userId = userId;
    this._token = token;
    this._amount = amount;
    this._failOnError = failOnError;
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(5);
    encoder.encodeString("type");
    encoder.encodeString("IncrementBalance");
    encoder.encodeString("user_id");
    encoder.encodeString(this._userId);
    encoder.encodeString("token");
    encoder.encodeString(this._token);
    encoder.encodeString("amount");
    encoder.encodeString(this._amount);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(this._failOnError);
  }
}

// DecrementBalanceEffect - specific implementation for balance decrements
export class DecrementBalanceEffect extends ContractEffect {
  private _userId: string;
  private _token: string;
  private _amount: string;
  private _failOnError: bool;

  constructor(userId: string, token: string, amount: string, failOnError: bool = true) {
    super("DecrementBalance");
    this._userId = userId;
    this._token = token;
    this._amount = amount;
    this._failOnError = failOnError;
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(5);
    encoder.encodeString("type");
    encoder.encodeString("DecrementBalance");
    encoder.encodeString("user_id");
    encoder.encodeString(this._userId);
    encoder.encodeString("token");
    encoder.encodeString(this._token);
    encoder.encodeString("amount");
    encoder.encodeString(this._amount);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(this._failOnError);
  }
}

// LogEffect - specific implementation for logging
export class LogEffect extends ContractEffect {
  private _message: string;
  private _failOnError: bool;

  constructor(message: string, failOnError: bool = false) {
    super("Log");
    this._message = message;
    this._failOnError = failOnError;
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(3);
    encoder.encodeString("type");
    encoder.encodeString("Log");
    encoder.encodeString("message");
    encoder.encodeString(this._message);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(this._failOnError);
  }
}

// PrintStatusEffect - specific implementation for status printing
export class PrintStatusEffect extends ContractEffect {
  private _status: string;
  private _failOnError: bool;

  constructor(status: string, failOnError: bool = false) {
    super("PrintStatus");
    this._status = status;
    this._failOnError = failOnError;
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(3);
    encoder.encodeString("type");
    encoder.encodeString("PrintStatus");
    encoder.encodeString("status");
    encoder.encodeString(this._status);
    encoder.encodeString("fail_on_error");
    encoder.encodeBool(this._failOnError);
  }
}

// Factory functions for convenience (maintain backward compatibility)
export function createIncrementBalanceEffect(userId: string, token: string, amount: string, failOnError: bool = true): ContractEffect {
  return new IncrementBalanceEffect(userId, token, amount, failOnError);
}

export function createDecrementBalanceEffect(userId: string, token: string, amount: string, failOnError: bool = true): ContractEffect {
  return new DecrementBalanceEffect(userId, token, amount, failOnError);
}

export function createLogEffect(message: string, failOnError: bool = false): ContractEffect {
  return new LogEffect(message, failOnError);
}

export function createPrintStatusEffect(status: string, failOnError: bool = false): ContractEffect {
  return new PrintStatusEffect(status, failOnError);
}

function borshPushU32LE(out: Array<u8>, value: u32): void {
  out.push(<u8>(value & 0xff));
  out.push(<u8>((value >> 8) & 0xff));
  out.push(<u8>((value >> 16) & 0xff));
  out.push(<u8>((value >> 24) & 0xff));
}

function borshPushU64LE(out: Array<u8>, value: u64): void {
  for (let i = 0; i < 8; i++) {
    out.push(<u8>((value >> <u64>(i * 8)) & <u64>0xff));
  }
}

function borshPushI64LE(out: Array<u8>, value: i64): void {
  borshPushU64LE(out, value as u64);
}

function borshPushBool(out: Array<u8>, value: bool): void {
  out.push(value ? 1 : 0);
}

function borshPushString(out: Array<u8>, value: string): void {
  const raw = String.UTF8.encode(value, false);
  const bytes = Uint8Array.wrap(raw);
  borshPushU32LE(out, bytes.length as u32);
  for (let i = 0; i < bytes.length; i++) out.push(bytes[i]);
}

function borshPushOptionString(out: Array<u8>, value: string | null): void {
  if (value === null) {
    out.push(0);
    return;
  }
  out.push(1);
  borshPushString(out, value as string);
}

function borshPushF64LE(out: Array<u8>, value: f64): void {
  const bits = reinterpret<u64>(value);
  borshPushU64LE(out, bits);
}

function borshPushBytes(out: Array<u8>, value: Uint8Array): void {
  borshPushU32LE(out, value.length as u32);
  for (let i = 0; i < value.length; i++) out.push(value[i]);
}

function borshToBytes(out: Array<u8>): Uint8Array {
  const result = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) result[i] = out[i];
  return result;
}

// Generic Borsh value encoding for effect payloads.
// Tags:
// 0=null, 1=bool, 2=i64, 3=f64, 4=string, 5=bytes, 6=array, 7=map
function borshEncodeMsgpackValue(out: Array<u8>, value: MsgpackValue): void {
  switch (value.kind) {
    case MsgpackKind.Null:
      out.push(0);
      return;
    case MsgpackKind.Bool:
      out.push(1);
      borshPushBool(out, value.b);
      return;
    case MsgpackKind.I64:
      out.push(2);
      borshPushI64LE(out, value.i);
      return;
    case MsgpackKind.F64:
      out.push(3);
      borshPushF64LE(out, value.f);
      return;
    case MsgpackKind.String:
      out.push(4);
      borshPushString(out, value.s);
      return;
    case MsgpackKind.Binary:
      out.push(5);
      borshPushBytes(out, value.bin);
      return;
    case MsgpackKind.Array: {
      out.push(6);
      borshPushU32LE(out, value.arr.length as u32);
      for (let i = 0; i < value.arr.length; i++) {
        borshEncodeMsgpackValue(out, value.arr[i]);
      }
      return;
    }
    case MsgpackKind.Map: {
      out.push(7);
      const keys = value.map.keys();
      borshPushU32LE(out, keys.length as u32);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key === null) continue;
        borshPushString(out, key);
        const child = value.map.get(key);
        if (child === null) {
          out.push(0); // null
        } else {
          borshEncodeMsgpackValue(out, child as MsgpackValue);
        }
      }
      return;
    }
    default:
      out.push(0);
      return;
  }
}

// MeasureEventCreateEffect - creates a measure event
export class MeasureEventCreateEffect extends ContractEffect {
  private _eventId: string;
  private _eventName: string;
  private _eventType: string;
  private _startTime: string;
  private _endTime: string | null;
  private _failOnError: bool;

  constructor(eventId: string, eventName: string, eventType: string, startTime: string, endTime: string | null = null, failOnError: bool = true) {
    super("MEASURE_EVENT_CREATE");
    this._eventId = eventId;
    this._eventName = eventName;
    this._eventType = eventType;
    this._startTime = startTime;
    this._endTime = endTime;
    this._failOnError = failOnError;
  }

  private toBorshBytes(): Uint8Array {
    const out = new Array<u8>();
    borshPushString(out, this._eventId);
    borshPushString(out, this._eventName);
    borshPushString(out, this._eventType);
    borshPushString(out, this._startTime);
    borshPushOptionString(out, this._endTime);
    borshPushBool(out, this._failOnError);
    return borshToBytes(out);
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(2);
    encoder.encodeString("type");
    encoder.encodeString("MEASURE_EVENT_CREATE");
    encoder.encodeString("data_bytes");
    encoder.encodeBin(this.toBorshBytes());
  }
}

// MeasureAddEffect - adds/updates a measure
export class MeasureAddEffect extends ContractEffect {
  private _eventId: string;
  private _userId: string | null;
  private _metricName: string;
  private _metricValue: f64;
  private _updateMode: string;
  private _failOnError: bool;

  constructor(eventId: string, userId: string | null, metricName: string, metricValue: f64, updateMode: string = "increment", failOnError: bool = true) {
    super("MEASURE_ADD");
    this._eventId = eventId;
    this._userId = userId;
    this._metricName = metricName;
    this._metricValue = metricValue;
    this._updateMode = updateMode;
    this._failOnError = failOnError;
  }

  private toBorshBytes(): Uint8Array {
    const out = new Array<u8>();
    borshPushString(out, this._eventId);
    borshPushOptionString(out, this._userId);
    borshPushString(out, this._metricName);
    borshPushF64LE(out, this._metricValue);
    borshPushString(out, this._updateMode);
    borshPushBool(out, this._failOnError);
    return borshToBytes(out);
  }

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    encoder.encodeMapStart(2);
    encoder.encodeString("type");
    encoder.encodeString("MEASURE_ADD");
    encoder.encodeString("data_bytes");
    encoder.encodeBin(this.toBorshBytes());
  }
}

export function createMeasureEventEffect(eventId: string, eventName: string, eventType: string, startTime: string, endTime: string | null = null, failOnError: bool = true): ContractEffect {
  return new MeasureEventCreateEffect(eventId, eventName, eventType, startTime, endTime, failOnError);
}

export function createMeasureAddEffect(eventId: string, metricName: string, metricValue: f64, updateMode: string = "increment", userId: string | null = null, failOnError: bool = true): ContractEffect {
  return new MeasureAddEffect(eventId, userId, metricName, metricValue, updateMode, failOnError);
}

// ContractResponse - for actions and constructors
// Events may use legacy Map<string, string> payloads or typed MessagePack payloads.
// Effects are ContractEffect (type-safe effect representation)
// Metadata is optional JSON value for table metadata (computed deterministically by state machine)
export class ContractResponse<TState> {
  state: TState;
  events: Array<ContractEvent> = new Array<ContractEvent>();
  effects: Array<ContractEffect> = new Array<ContractEffect>();
  tasks: Array<ContractTask> = new Array<ContractTask>();
  error: ContractError | null = null;
  metadata: MsgpackEncodable | null = null;

  constructor(state: TState) {
    this.state = state;
  }

  static withState<TState>(state: TState): ContractResponse<TState> {
    return new ContractResponse<TState>(state);
  }

  static withError<TState>(state: TState, code: string, message: string, dataJson: string | null = null): ContractResponse<TState> {
    const r = new ContractResponse<TState>(state);
    r.error = new ContractError(code, message, dataJson);
    return r;
  }

  emit(e: ContractEvent): ContractResponse<TState> {
    this.events.push(e);
    return this;
  }

  event(type: string, payload: Map<string, string> | null = null): ContractResponse<TState> {
    this.events.push(new ContractEvent(type, payload));
    return this;
  }

  eventsAll(events: Array<ContractEvent>): ContractResponse<TState> {
    for (let i = 0; i < events.length; i++) {
      this.events.push(events[i]);
    }
    return this;
  }

  effect(fx: ContractEffect): ContractResponse<TState> {
    this.effects.push(fx);
    return this;
  }

  effectsAll(effects: Array<ContractEffect>): ContractResponse<TState> {
    for (let i = 0; i < effects.length; i++) {
      this.effects.push(effects[i]);
    }
    return this;
  }

  task(t: ContractTask): ContractResponse<TState> {
    this.tasks.push(t);
    return this;
  }

  taskNamed(name: string, args: Map<string, string> | null = null): ContractResponse<TState> {
    this.tasks.push(new ContractTask(name, args));
    return this;
  }

  tasksAll(tasks: Array<ContractTask>): ContractResponse<TState> {
    for (let i = 0; i < tasks.length; i++) {
      this.tasks.push(tasks[i]);
    }
    return this;
  }

  withMetadata(meta: MsgpackEncodable): ContractResponse<TState> {
    this.metadata = meta;
    return this;
  }

  fail(code: string, message: string, dataJson: string | null = null): this {
    this.error = new ContractError(code, message, dataJson);
    return this;
  }
}

// ViewResponse - for views
export class ViewResponse<TView> {
  view: TView | null = null;
  error: ContractError | null = null;

  static withView<TView>(view: TView): ViewResponse<TView> {
    const r = new ViewResponse<TView>();
    r.view = view;
    return r;
  }

  fail(code: string, message: string, dataJson: string | null = null): this {
    this.error = new ContractError(code, message, dataJson);
    return this;
  }
}

function encodeStringMap(encoder: MessagePackEncoder, map: Map<string, string>): void {
  const keys = map.keys();
  encoder.encodeMapStart(keys.length);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key === null) continue;
    encoder.encodeString(key);
    const value = map.get(key);
    if (value === null) {
      encoder.encodeNil();
    } else {
      encoder.encodeString(value);
    }
  }
}

function encodeEvents(encoder: MessagePackEncoder, events: Array<ContractEvent>): void {
  encoder.encodeArrayStart(events.length);
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const hasData = ev.data !== null;
    const hasTopics = ev.topics.length > 0;
    encoder.encodeMapStart(2 + (hasData || hasTopics ? 1 : 0) + (hasData ? 1 : 0));
    encoder.encodeString("type");
    encoder.encodeString(ev.type);
    if (hasTopics || hasData) {
      encoder.encodeString("topics");
      encoder.encodeArrayStart(ev.topics.length);
      for (let j = 0; j < ev.topics.length; j++) {
        encoder.encodeString(ev.topics[j]);
      }
    }
    encoder.encodeString("payload");
    if (ev.payload === null) {
      encoder.encodeNil();
    } else {
      encodeStringMap(encoder, ev.payload as Map<string, string>);
    }
    if (hasData) {
      const data = ev.data;
      if (data !== null) {
        const dataEncoder = new MessagePackEncoder(1024);
        data.encodeToMsgpack(dataEncoder);
        const len = dataEncoder.getLength();
        const dataBytes = new Uint8Array(len);
        memory.copy(dataBytes.dataStart, dataEncoder.getBufferPtr(), len);
        encoder.encodeString("data");
        encoder.encodeBin(dataBytes);
      }
    }
  }
}

function encodeEffects(encoder: MessagePackEncoder, effects: Array<ContractEffect>): void {
  encoder.encodeArrayStart(effects.length);
  for (let i = 0; i < effects.length; i++) {
    const fx = effects[i];
    const inner = new MessagePackEncoder(8192);
    fx.encodeToMsgpack(inner);
    const len = inner.getLength();
    const payloadMsgpack = new Uint8Array(len);
    memory.copy(payloadMsgpack.dataStart, inner.getBufferPtr(), len);

    const payloadBorshOut = new Array<u8>();
    const payloadDecoded = decodeMsgpack(payloadMsgpack);
    borshEncodeMsgpackValue(payloadBorshOut, payloadDecoded);
    const payload = borshToBytes(payloadBorshOut);

    // Compact effect envelope (binary):
    // [version:u8][effect_type_len:u16_le][effect_type_utf8][data_len:u32_le][data_bytes]
    const typeRaw = String.UTF8.encode(fx.type, false);
    const typeBytes = Uint8Array.wrap(typeRaw);
    const typeLen = typeBytes.length;
    const dataLen = payload.length;
    const totalLen = 1 + 2 + typeLen + 4 + dataLen;
    const envelope = new Uint8Array(totalLen);

    let p = 0;
    envelope[p++] = 1; // version (borsh payload)
    envelope[p++] = <u8>(typeLen & 0xff);
    envelope[p++] = <u8>((typeLen >> 8) & 0xff);
    memory.copy(envelope.dataStart + p, typeBytes.dataStart, typeLen);
    p += typeLen;
    envelope[p++] = <u8>(dataLen & 0xff);
    envelope[p++] = <u8>((dataLen >> 8) & 0xff);
    envelope[p++] = <u8>((dataLen >> 16) & 0xff);
    envelope[p++] = <u8>((dataLen >> 24) & 0xff);
    memory.copy(envelope.dataStart + p, payload.dataStart, dataLen);

    encoder.encodeBin(envelope);
  }
}

function encodeTasks(encoder: MessagePackEncoder, tasks: Array<ContractTask>): void {
  encoder.encodeArrayStart(tasks.length);
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    encoder.encodeMapStart(2);
    encoder.encodeString("name");
    encoder.encodeString(task.name);
    encoder.encodeString("args");
    if (task.args === null) {
      encoder.encodeNil();
    } else {
      encodeStringMap(encoder, task.args as Map<string, string>);
    }
  }
}

function encodeError(encoder: MessagePackEncoder, err: ContractError | null): void {
  if (err === null) {
    encoder.encodeNil();
    return;
  }
  encoder.encodeArrayStart(3);
  encoder.encodeString(err.code);
  encoder.encodeString(err.message);
  err.dataJson === null ? encoder.encodeNil() : encoder.encodeString(err.dataJson as string);
}

export function encodeContractResponseMsgpackWithState<TState>(
  resp: ContractResponse<TState>,
  stateEncoded: MsgpackEncodable
): i64 {
  const encoder = new MessagePackEncoder(4096);
  // Array-based envelope for compact typed struct:
  // [newState, events, effects, metadata, error, tasks]
  encoder.encodeArrayStart(6);
  changetype<MsgpackEncodable>(stateEncoded).encodeToMsgpack(encoder);
  encodeEvents(encoder, resp.events);
  encodeEffects(encoder, resp.effects);
  const metadata = resp.metadata;
  if (metadata === null) {
    encoder.encodeNil();
  } else {
    metadata.encodeToMsgpack(encoder);
  }
  encodeError(encoder, resp.error);
  encodeTasks(encoder, resp.tasks);
  return packPtrLen(encoder.getBuffer(), encoder.getLength());
}

export function encodeContractResponseMsgpackWithStateBytes<TState>(
  resp: ContractResponse<TState>,
  stateBytes: Uint8Array
): i64 {
  const encoder = new MessagePackEncoder(4096);
  // Array-based envelope for compact typed struct:
  // [newState, events, effects, metadata, error, tasks]
  encoder.encodeArrayStart(6);
  encoder.encodeBin(stateBytes);
  encodeEvents(encoder, resp.events);
  encodeEffects(encoder, resp.effects);
  const metadata = resp.metadata;
  if (metadata === null) {
    encoder.encodeNil();
  } else {
    metadata.encodeToMsgpack(encoder);
  }
  encodeError(encoder, resp.error);
  encodeTasks(encoder, resp.tasks);
  return packPtrLen(encoder.getBuffer(), encoder.getLength());
}

export function encodeContractResponseMsgpack<TState>(
  resp: ContractResponse<TState>
): i64 {
  const stateAny = resp.state;
  if (stateAny instanceof Uint8Array) {
    return encodeContractResponseMsgpackWithStateBytes(resp, stateAny as Uint8Array);
  }
  if (stateAny instanceof ArrayBuffer) {
    return encodeContractResponseMsgpackWithStateBytes(resp, Uint8Array.wrap(changetype<ArrayBuffer>(stateAny)));
  }
  return encodeContractResponseMsgpackWithState(resp, changetype<MsgpackEncodable>(stateAny));
}

export function encodeViewResponseMsgpack<TView>(view: TView): i64 {
  const encoder = new MessagePackEncoder(2048);
  const viewAny = view;
  if (viewAny instanceof Uint8Array) {
    encoder.encodeBin(viewAny as Uint8Array);
  } else if (viewAny instanceof ArrayBuffer) {
    encoder.encodeBin(Uint8Array.wrap(changetype<ArrayBuffer>(viewAny)));
  } else {
    changetype<MsgpackEncodable>(viewAny).encodeToMsgpack(encoder);
  }
  return packPtrLen(encoder.getBuffer(), encoder.getLength());
}

export function encodeViewStringResponseMsgpack(view: string): i64 {
  const encoder = new MessagePackEncoder(2048);
  encoder.encodeString(view);
  return packPtrLen(encoder.getBuffer(), encoder.getLength());
}

export function encodeViewBoolResponseMsgpack(view: bool): i64 {
  const encoder = new MessagePackEncoder(32);
  encoder.encodeBool(view);
  return packPtrLen(encoder.getBuffer(), encoder.getLength());
}

export function encodeViewI32ResponseMsgpack(view: i32): i64 {
  const encoder = new MessagePackEncoder(32);
  encoder.encodeI32(view);
  return packPtrLen(encoder.getBuffer(), encoder.getLength());
}

export function encodeViewI64ResponseMsgpack(view: i64): i64 {
  const encoder = new MessagePackEncoder(32);
  encoder.encodeI64(view);
  return packPtrLen(encoder.getBuffer(), encoder.getLength());
}

export function encodeViewF64ResponseMsgpack(view: f64): i64 {
  const encoder = new MessagePackEncoder(32);
  encoder.encodeF64(view);
  return packPtrLen(encoder.getBuffer(), encoder.getLength());
}

export function encodeErrorEnvelopeMsgpack(code: string, message: string): i64 {
  const encoder = new MessagePackEncoder(512);
  encoder.encodeArrayStart(5);
  encoder.encodeNil();
  encoder.encodeArrayStart(0);
  encoder.encodeArrayStart(0);
  encoder.encodeNil();
  const err = new ContractError(code, message, null);
  encodeError(encoder, err);
  return packPtrLen(encoder.getBuffer(), encoder.getLength());
}

/**
 * Escape a string for JSON serialization.
 * Kept for compatibility with metadata helpers that still build JSON text.
 */
export function escapeJsonString(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c == 34) out += '\\"';
    else if (c == 92) out += "\\\\";
    else if (c == 10) out += "\\n";
    else if (c == 13) out += "\\r";
    else if (c == 9) out += "\\t";
    else out += String.fromCharCode(c);
  }
  out += '"';
  return out;
}
