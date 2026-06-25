// @ts-nocheck

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import { arcanaEvent, arcanaState, msgpackArgs, msgpackView, topic } from "../core/decorators";
import { ContractArgs, ContractStatus, ProgramState, ProgramStateView, ViewSerializable } from "../index";
import { applyProgramStateView, copyI64Matrix, copyStringArray, copyStringMatrix, programStateToView } from "../index";
import { decodeArgsArray, decodeStateArray } from "../core/args";
import { ContractEvent, MsgpackEncodable } from "../core/response";
import { MessagePackEncoder } from "../primitives/msgpack";
import {
  decodeMsgpack,
  MsgpackKind,
  MsgpackValue,
  msgpackKindName,
  requireArrayBool,
  requireArrayI32,
  requireArrayI64,
  requireArrayItem,
  requireArrayLength,
  requireArrayStringStrict,
  requireBinArrayValue,
  requireBoolArrayValue,
  requireF64ArrayValue,
  requireI64ArrayValue,
  requireI64MatrixValue,
  requireStringMatrixValue,
  requireStringBoolMapValue,
  requireStringF64MapValue,
  requireStringI64MapValue,
  requireStringStringMapValue,
  requireStringArrayValue,
} from "../primitives/msgpack_decode";
import { encodeMsgpackToBytes } from "../primitives/msgpack_utils";

@msgpackView()
class GeneratedNestedView implements MsgpackEncodable {
  value: i32 = 0;
}

@msgpackView()
class GeneratedStateView implements MsgpackEncodable {
  programState: ProgramStateView = new ProgramStateView();
  count: i64 = 0;
  label: string = "";
  enabled: bool = false;
  players: string[] = [];
  scores: i64[] = [];
  switches: bool[] = [];
  ratios: f64[] = [];
  grid: i64[][] = [];
  stringGrid: string[][] = [];
  nested: GeneratedNestedView = new GeneratedNestedView();
  optionalNested: GeneratedNestedView | null = null;
  optionalLabel: string | null = null;
  nestedList: GeneratedNestedView[] = [];
  labels: Map<string, string> = new Map<string, string>();
  counters: Map<string, i64> = new Map<string, i64>();
  flags: Map<string, bool> = new Map<string, bool>();
  weights: Map<string, f64> = new Map<string, f64>();
  nestedById: Map<string, GeneratedNestedView> = new Map<string, GeneratedNestedView>();
}

@arcanaState()
class GeneratedState extends ProgramState implements ViewSerializable<GeneratedStateView> {
  count: i64 = 0;
  label: string = "";
  enabled: bool = false;
  players: string[] = [];
  scores: i64[] = [];
  switches: bool[] = [];
  ratios: f64[] = [];
  grid: i64[][] = [];
  stringGrid: string[][] = [];
  nested: GeneratedNestedView = new GeneratedNestedView();
  optionalNested: GeneratedNestedView | null = null;
  optionalLabel: string | null = null;
  nestedList: GeneratedNestedView[] = [];
  labels: Map<string, string> = new Map<string, string>();
  counters: Map<string, i64> = new Map<string, i64>();
  flags: Map<string, bool> = new Map<string, bool>();
  weights: Map<string, f64> = new Map<string, f64>();
  nestedById: Map<string, GeneratedNestedView> = new Map<string, GeneratedNestedView>();
}

@msgpackArgs()
class GeneratedArgs extends ContractArgs {
  deltaBps: i64 = 0;
  source: string = "";
}

@arcanaEvent("shot_fired")
class ShotFiredEvent {
  @topic()
  playerId: string = "";
  @topic()
  row: i64 = 0;
  column: i64 = 0;
  hit: bool = false;
  shipSunk: bool = false;
  sunkShipName: string | null = null;
}

function encoderToBytes(encoder: MessagePackEncoder): Uint8Array {
  const len = encoder.getLength();
  const out = new Uint8Array(len);
  memory.copy(out.dataStart, encoder.getBufferPtr(), len);
  return out;
}

function encodeGeneratedArgs(deltaBps: i64, source: string): Uint8Array {
  const encoder = new MessagePackEncoder();
  encoder.encodeArrayStart(2);
  encoder.encodeI64(deltaBps);
  encoder.encodeString(source);
  return encoderToBytes(encoder);
}

function decodeArray(bytes: Uint8Array): Array<MsgpackValue> {
  const decoded = decodeMsgpack(bytes);
  if (decoded.kind != MsgpackKind.Array) return new Array<MsgpackValue>(0);
  return decoded.arr;
}

describe("MessagePack codegen", () => {
  test("round-trips generated view classes", () => {
    const view = new GeneratedStateView();
    view.programState.status = ContractStatus.ACTIVE;
    view.count = 42;
    view.label = "price";
    view.enabled = true;
    view.players = new Array<string>(2);
    view.players[0] = "alice";
    view.players[1] = "bob";
    view.scores = new Array<i64>(2);
    view.scores[0] = 7;
    view.scores[1] = 9;
    view.switches = new Array<bool>(2);
    view.switches[0] = true;
    view.switches[1] = false;
    view.ratios = new Array<f64>(2);
    view.ratios[0] = 1.5;
    view.ratios[1] = 2.5;
    view.grid = new Array<i64[]>(2);
    view.grid[0] = new Array<i64>(2);
    view.grid[0][0] = 1;
    view.grid[0][1] = 2;
    view.grid[1] = new Array<i64>(2);
    view.grid[1][0] = 3;
    view.grid[1][1] = 4;
    view.stringGrid = new Array<string[]>(1);
    view.stringGrid[0] = new Array<string>(2);
    view.stringGrid[0][0] = "x";
    view.stringGrid[0][1] = "o";
    view.nested.value = 11;
    view.optionalNested = new GeneratedNestedView();
    changetype<GeneratedNestedView>(view.optionalNested).value = 15;
    view.optionalLabel = "maybe";
    const nestedItem = new GeneratedNestedView();
    nestedItem.value = 12;
    view.nestedList = new Array<GeneratedNestedView>(1);
    view.nestedList[0] = nestedItem;
    view.labels.set("market", "price");
    view.counters.set("ticks", 101);
    view.flags.set("enabled", true);
    view.weights.set("risk", 3.25);
    const nestedMapItem = new GeneratedNestedView();
    nestedMapItem.value = 13;
    view.nestedById.set("primary", nestedMapItem);

    const bytes = encodeMsgpackToBytes(view);
    const decoded = GeneratedStateView.fromMsgpackArray(decodeArray(bytes));

    expect(decoded.programState.status).equal(ContractStatus.ACTIVE);
    expect(decoded.count).equal(42);
    expect(decoded.label).equal("price");
    expect(decoded.enabled).equal(true);
    expect(decoded.players.length).equal(2);
    expect(decoded.players[1]).equal("bob");
    expect(decoded.scores[0]).equal(7);
    expect(decoded.switches[0]).equal(true);
    expect(decoded.ratios[1]).equal(2.5);
    expect(decoded.grid[1][0]).equal(3);
    expect(decoded.stringGrid[0][1]).equal("o");
    expect(decoded.nested.value).equal(11);
    expect(decoded.optionalNested !== null).equal(true);
    expect(changetype<GeneratedNestedView>(decoded.optionalNested).value).equal(15);
    expect(decoded.optionalLabel).equal("maybe");
    expect(decoded.nestedList[0].value).equal(12);
    expect(decoded.labels.get("market")).equal("price");
    expect(decoded.counters.get("ticks")).equal(101);
    expect(decoded.flags.get("enabled")).equal(true);
    expect(decoded.weights.get("risk")).equal(3.25);
    expect(decoded.nestedById.get("primary").value).equal(13);
  });

  test("decodes generated args from bytes", () => {
    const args = GeneratedArgs.fromBytes(encodeGeneratedArgs(250, "sim"));
    expect(args.deltaBps).equal(250);
    expect(args.source).equal("sim");
  });

  test("strict helpers are linked into generated decoders", () => {
    const encoder = new MessagePackEncoder();
    encoder.encodeArrayStart(19);
    const base = new ProgramStateView();
    base.encodeToMsgpack(encoder);
    encoder.encodeI64(1);
    encoder.encodeString("label");
    encoder.encodeBool(true);
    encoder.encodeArrayStart(0);
    encoder.encodeArrayStart(0);
    encoder.encodeArrayStart(0);
    encoder.encodeArrayStart(0);
    encoder.encodeArrayStart(0);
    encoder.encodeArrayStart(0);
    const nested = new GeneratedNestedView();
    nested.encodeToMsgpack(encoder);
    encoder.encodeNil();
    encoder.encodeNil();
    encoder.encodeArrayStart(0);
    encoder.encodeMapStart(0);
    encoder.encodeMapStart(0);
    encoder.encodeMapStart(0);
    encoder.encodeMapStart(0);
    encoder.encodeMapStart(0);

    const decoded = GeneratedStateView.fromMsgpackArray(decodeArray(encoderToBytes(encoder)));
    expect(decoded.count).equal(1);
  });

  test("generates mirror state conversion helpers", () => {
    const view = new GeneratedStateView();
    view.programState.status = ContractStatus.ACTIVE;
    view.count = 77;
    view.label = "state";
    view.players = new Array<string>(1);
    view.players[0] = "alice";
    view.stringGrid = new Array<string[]>(1);
    view.stringGrid[0] = new Array<string>(1);
    view.stringGrid[0][0] = "x";

    const state = GeneratedState.fromView(view);
    expect(state.status).equal(ContractStatus.ACTIVE);
    expect(state.count).equal(77);
    expect(state.players[0]).equal("alice");
    expect(state.stringGrid[0][0]).equal("x");

    state.players[0] = "changed";
    expect(view.players[0]).equal("alice");

    const nextView = state.toView();
    expect(nextView.count).equal(77);
    expect(nextView.players[0]).equal("changed");

    const fromBytes = GeneratedState.fromBytes(state.toBytes());
    expect(fromBytes.count).equal(77);
    expect(fromBytes.players[0]).equal("changed");
    expect(fromBytes.stringGrid[0][0]).equal("x");
  });

  test("generates typed event data objects", () => {
    const event = new ShotFiredEvent();
    event.playerId = "alice";
    event.row = 2;
    event.column = 3;
    event.hit = true;
    event.shipSunk = true;
    event.sunkShipName = "Carrier";

    const contractEvent = event.toEvent();

    expect(ShotFiredEvent.eventType()).equal("shot_fired");
    expect(event.eventType()).equal("shot_fired");
    expect(contractEvent.type).equal("shot_fired");
    expect(contractEvent.payload === null).equal(true);
    expect(contractEvent.data !== null).equal(true);
    expect(contractEvent.topics.length).equal(2);
    expect(contractEvent.topics[0]).equal("alice");
    expect(contractEvent.topics[1]).equal("2");

    const topics = new Array<string>(2);
    topics[0] = "alice";
    topics[1] = "hit";
    const withTopics = event.toEventWithTopics(topics);
    expect(withTopics.topics.length).equal(2);
    expect(withTopics.topics[0]).equal("alice");
  });

  test("encodes nullable typed event fields as nil", () => {
    const event = new ShotFiredEvent();
    const encoder = new MessagePackEncoder();
    event.encodeToMsgpack(encoder);
    const decoded = decodeMsgpack(encoderToBytes(encoder));

    expect(decoded.kind).equal(MsgpackKind.Array);
    expect(decoded.arr[5].kind).equal(MsgpackKind.Null);
  });
});
