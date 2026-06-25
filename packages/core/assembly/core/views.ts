// @ts-nocheck
/**
 * View classes for serialization
 *
 * These are pure data containers used for serialization only.
 */

import { MessagePackEncoder } from "../primitives/msgpack";
import { getArrayBool, getArrayI32, getArrayI64, getArrayItem, getArrayString, getArrayStringArray, getI32Field, getI64Field, getMapField, getStringField, MsgpackKind, MsgpackValue } from "../primitives/msgpack_decode";
import { MsgpackEncodable } from "./response";
import { ContractStatus, Environment } from "./state";

/**
 * View class for RandomSeedFields
 * No methods, just data fields.
 *
 * The raw random seed is host-managed (committed at instance creation, injected
 * per call via ContractContext.serverSeed, and revealed only after finalization).
 * It is deliberately NOT part of program state or any view, so it can never leak
 * to clients through an action or view response. Only the per-call draw index
 * lives in program state.
 */
export class RandomSeedFieldsView implements MsgpackEncodable {
  randomSeedIndex: i32 = 0;

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    // [randomSeedIndex]
    encoder.encodeArrayStart(1);
    encoder.encodeI32(this.randomSeedIndex);
  }

  static fromMsgpackMap(map: Map<string, MsgpackValue>): RandomSeedFieldsView {
    const v = new RandomSeedFieldsView();
    v.randomSeedIndex = getI32Field(map, "randomSeedIndex", 0);
    return v;
  }

  static fromMsgpackArray(arr: Array<MsgpackValue>): RandomSeedFieldsView {
    const v = new RandomSeedFieldsView();
    v.randomSeedIndex = getArrayI32(arr, 0, 0);
    return v;
  }
}

/**
 * View class for ProgramState
 * No methods, just data fields.
 */
export class ProgramStateView implements MsgpackEncodable {
  randomSeedFields: RandomSeedFieldsView = new RandomSeedFieldsView();
  status: string = ContractStatus.PENDING;
  environment: string = Environment.TESTING;
  createdAt: i64 = 0;

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    // [randomSeedFields, status, environment, createdAt]
    encoder.encodeArrayStart(4);
    this.randomSeedFields.encodeToMsgpack(encoder);
    encoder.encodeString(this.status);
    encoder.encodeString(this.environment);
    encoder.encodeI64(this.createdAt);
  }

  static fromMsgpackMap(map: Map<string, MsgpackValue>): ProgramStateView {
    const v = new ProgramStateView();
    const rs = getMapField(map, "randomSeedFields");
    if (rs !== null && rs.kind == MsgpackKind.Map) {
      v.randomSeedFields = RandomSeedFieldsView.fromMsgpackMap(rs.map);
    }
    v.status = getStringField(map, "status", v.status);
    v.environment = getStringField(map, "environment", v.environment);
    v.createdAt = getI64Field(map, "createdAt", 0);
    return v;
  }

  static fromMsgpackArray(arr: Array<MsgpackValue>): ProgramStateView {
    const v = new ProgramStateView();
    const rs = getArrayItem(arr, 0);
    if (rs !== null) {
      if (rs.kind == MsgpackKind.Array) {
        v.randomSeedFields = RandomSeedFieldsView.fromMsgpackArray(rs.arr);
      } else if (rs.kind == MsgpackKind.Map) {
        v.randomSeedFields = RandomSeedFieldsView.fromMsgpackMap(rs.map);
      }
    }
    v.status = getArrayString(arr, 1, v.status);
    v.environment = getArrayString(arr, 2, v.environment);
    v.createdAt = getArrayI64(arr, 3, 0);
    return v;
  }
}

/**
 * @deprecated Use ProgramStateView for new programs.
 */
export class GameStateView extends ProgramStateView {
  static fromMsgpackMap(map: Map<string, MsgpackValue>): GameStateView {
    const base = ProgramStateView.fromMsgpackMap(map);
    const v = new GameStateView();
    v.randomSeedFields = base.randomSeedFields;
    v.status = base.status;
    v.environment = base.environment;
    v.createdAt = base.createdAt;
    return v;
  }

  static fromMsgpackArray(arr: Array<MsgpackValue>): GameStateView {
    const base = ProgramStateView.fromMsgpackArray(arr);
    const v = new GameStateView();
    v.randomSeedFields = base.randomSeedFields;
    v.status = base.status;
    v.environment = base.environment;
    v.createdAt = base.createdAt;
    return v;
  }
}

/**
 * View class for ContractContext
 * No methods, just data fields.
 */
export class ContractContextView implements MsgpackEncodable {
  contractId: string = "";
  callerId: string = "";
  nowMs: i64 = 0;
  serverSeed: string = "";
  scopeId: string | null = null; // Optional scope ID if contract is bound to a scope

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    // [contractId, callerId, nowMs, serverSeed, scopeId]
    encoder.encodeArrayStart(5);
    encoder.encodeString(this.contractId);
    encoder.encodeString(this.callerId);
    encoder.encodeI64(this.nowMs);
    encoder.encodeString(this.serverSeed);
    this.scopeId === null ? encoder.encodeNil() : encoder.encodeString(this.scopeId as string);
  }

  static fromMsgpackArray(arr: Array<MsgpackValue>): ContractContextView {
    const v = new ContractContextView();
    v.contractId = getArrayString(arr, 0, "");
    v.callerId = getArrayString(arr, 1, "");
    v.nowMs = getArrayI64(arr, 2, 0);
    v.serverSeed = getArrayString(arr, 3, "");
    const scope = getArrayString(arr, 4, "");
    v.scopeId = scope.length == 0 ? null : scope;
    return v;
  }
}
