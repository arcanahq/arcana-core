// @ts-nocheck
/**
 * Contract context - information about the execution environment
 * 
 * Working class with methods for logic
 */

import { decodeMsgpack, getArrayI64, getArrayString, getI64Field, getStringField, MsgpackKind } from "../primitives/msgpack_decode";
import { ContractContextView } from "./views";

/**
 * Working ContractContext class
 * Loads from view class for parsing, converts to view for serialization
 */
export class ContractContext {
  contractId: string = "";
  callerId: string = "";
  nowMs: i64 = 0;
  serverSeed: string = "";
  scopeId: string | null = null; // Optional scope ID if contract is bound to a scope

  constructor(
    contractId: string = "",
    callerId: string = "",
    nowMs: i64 = 0,
    serverSeed: string = "",
    scopeId: string | null = null
  ) {
    this.contractId = contractId;
    this.callerId = callerId;
    this.nowMs = nowMs;
    this.serverSeed = serverSeed;
    this.scopeId = scopeId;
  }

  /**
   * Load from view class (after MessagePack decode)
   */
  static fromView(view: ContractContextView): ContractContext {
    const ctx = new ContractContext();
    ctx.contractId = view.contractId;
    ctx.callerId = view.callerId;
    ctx.nowMs = view.nowMs;
    ctx.serverSeed = view.serverSeed;
    ctx.scopeId = view.scopeId;
    return ctx;
  }

  /**
   * Convert to view class (for MessagePack encode)
   */
  toView(): ContractContextView {
    const view = new ContractContextView();
    view.contractId = this.contractId;
    view.callerId = this.callerId;
    view.nowMs = this.nowMs;
    view.serverSeed = this.serverSeed;
    view.scopeId = this.scopeId;
    return view;
  }

  /**
   * Parse ContractContext from MessagePack bytes
   */
  static fromBytes(bytes: Uint8Array): ContractContext {
    if (bytes.length == 0) {
      return new ContractContext();
    }
    const decoded = decodeMsgpack(bytes);
    const map = decoded.map;
    const ctx = new ContractContext();
    if (decoded.kind == MsgpackKind.Array) {
      ctx.contractId = getArrayString(decoded.arr, 0, "");
      ctx.callerId = getArrayString(decoded.arr, 1, "");
      ctx.nowMs = getArrayI64(decoded.arr, 2, 0);
      ctx.serverSeed = getArrayString(decoded.arr, 3, "");
      ctx.scopeId = getArrayString(decoded.arr, 4, "");
    } else if (decoded.kind == MsgpackKind.Map) {
      ctx.contractId = getStringField(map, "contractId", "");
      ctx.callerId = getStringField(map, "callerId", "");
      ctx.nowMs = getI64Field(map, "nowMs", 0);
      ctx.serverSeed = getStringField(map, "serverSeed", "");
      ctx.scopeId = getStringField(map, "scopeId", "");
    } else {
      return ctx;
    }
    if (ctx.scopeId !== null && (ctx.scopeId as string).length == 0) ctx.scopeId = null;
    return ctx;
  }
}
