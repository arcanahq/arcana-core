// @ts-nocheck
/**
 * Entrypoint routing - returns MessagePack bytes
 * Routes to entrypoints that return MessagePack-encoded responses.
 */

import { ContractContext } from "./context";
import { readBytes, readString, scratch_reset } from "./wasm";
import { EntrypointRegistry, BytesEntrypoint } from "./registry";
import { __setCurrentArgsBytes, __setCurrentStateBytes } from "./args";
import { encodeErrorEnvelopeMsgpack } from "./response";
import { OPERATION_MODE_ACTION, OPERATION_MODE_VIEW } from "./abi";
function defaultEnvelope(entrypointStr: string, isView: bool): i64 {
  // If no handler found, return an error
  const entrypointType = isView ? "view" : "action";
  const errorMessage = `Entrypoint '${entrypointStr}' not found. Available ${entrypointType} entrypoints may not include this name, or the contract may not have been built with the decorator transform.`;
  return encodeErrorEnvelopeMsgpack("ENTRYPOINT_NOT_FOUND", errorMessage);
}

export function handleWithRegistries(
  contextPtr: i32,
  contextLen: i32,
  entrypointPtr: i32,
  entrypointLen: i32,
  argsPtr: i32,
  argsLen: i32,
  statePtr: i32,
  stateLen: i32,
  operationMode: i32,
  actions: EntrypointRegistry<ContractContext> | null,
  views: EntrypointRegistry<ContractContext> | null
): i64 {
  // CRITICAL: Read input strings BEFORE calling scratch_reset()
  // The host writes data to scratch buffers using scratch_alloc(), and we must
  // read them before resetting. scratch_reset() moves the scratch pointer but
  // shouldn't overwrite memory, but reading first is safer.
  
  if (contextLen < 0 || contextLen > 10000) {
    return encodeErrorEnvelopeMsgpack("BAD_INPUT", "Invalid contextLen: " + contextLen.toString());
  }

  // Read context bytes (MessagePack)
  const contextBytes = readBytes(contextPtr, contextLen);
  
  
  const entrypointStr = readString(entrypointPtr, entrypointLen);
  const argsBytes = readBytes(argsPtr, argsLen);
  __setCurrentArgsBytes(argsBytes);

  const stateBytes = stateLen > 0 ? readBytes(statePtr, stateLen) : new Uint8Array(0);
  __setCurrentStateBytes(stateBytes);

  // Now reset scratch to reclaim input buffers and prepare for output allocations
  scratch_reset();

  const context = ContractContext.fromBytes(contextBytes);

  // Resolve handler based on the call mode. This enforces strict separation:
  // view calls can only hit @view entrypoints, action calls can only hit @action/@constructor.
  const isView = operationMode === OPERATION_MODE_VIEW;
  const useActions = operationMode === OPERATION_MODE_ACTION;
  // AssemblyScript stores functions in Array as usize; cast on retrieve so we can invoke.
  type HandlerFn = BytesEntrypoint<ContractContext>;
  let handler: HandlerFn | null = null;
  if (isView) {
    const fnPtr = changetype<usize>(views !== null ? views.get(entrypointStr) : null);
    handler = fnPtr !== 0 ? changetype<HandlerFn>(fnPtr) : null;
  } else if (useActions) {
    const fnPtr = changetype<usize>(actions !== null ? actions.get(entrypointStr) : null);
    handler = fnPtr !== 0 ? changetype<HandlerFn>(fnPtr) : null;
  } else {
    return encodeErrorEnvelopeMsgpack("BAD_INPUT", "Invalid operation mode: " + operationMode.toString());
  }

  const outMsgpack = handler !== null
    ? handler(context, stateBytes, argsBytes)
    : defaultEnvelope(entrypointStr, isView);

  return outMsgpack;
}
