/**
 * Core types and interfaces for AssemblyScript contracts
 * Legacy compatibility only. Prefer core/context, core/state, and core/registry.
 */

import { escapeJsonStr } from "../primitives/utils";
import { RandomSeedFields } from "./state";

// Contract context structure
export class ContractContext {
  contractId: string = "";
  callerId: string = "";
  nowMs: i64 = 0;
  serverSeed: string = "";
}

// Contract arguments - base class for typed args
export class ContractArgsBase {
  // Base class - subclasses will add specific fields
}

// Contract state - base class for typed state
// Note: This is a generic structure, actual state will be in subclasses
export class ContractStateBase {
  randomSeedFields: RandomSeedFields = new RandomSeedFields();
  players: string[] = [];
  status: string = "pending";
  environment: string = "TESTING";
}

// Contract result structure
export class ContractResult {
  newState: ContractStateBase = new ContractStateBase();
  events: ContractEvent[] = [];
  effects: ContractEffect[] = [];
}

// Contract event structure
export class ContractEvent {
  type: string = "";
  payload: string = ""; // JSON string of payload
}

// Contract effect structure
export class ContractEffect {
  type: string = "";
  data: string = ""; // JSON string of effect-specific data
}

// For backward compatibility, we use Map<string, string> for internal operations
export type JSONObject = Map<string, string>;

// GameContext interface (represented as JSON string)
export type GameContext = string;

// GameEvent interface
export class GameEvent {
  type: string;
  payload: string | null; // JSON string

  constructor(type: string, payload: string | null) {
    this.type = type;
    this.payload = payload;
  }
}

// EngineResult interface
export class EngineResult {
  newState: string; // JSON string
  events: GameEvent[];

  constructor(newState: string, events: GameEvent[]) {
    this.newState = newState;
    this.events = events;
  }
}

// Entrypoint handler type
export type EntrypointHandler = (
  stateJson: string,         // full game state as JSON string
  context: ContractContext,  // typed context from Rust
  argsJson: string           // action/args as JSON string
) => string;                 // returns new state as JSON string

// Entrypoint registry - maps entrypoint names to handler functions
export class EntrypointRegistry {
  private handlers: Map<string, EntrypointHandler> = new Map<string, EntrypointHandler>();

  register(name: string, handler: EntrypointHandler): void {
    this.handlers.set(name, handler);
  }

  get(name: string): EntrypointHandler | null {
    return this.handlers.has(name) ? this.handlers.get(name)! : null;
  }

  getEntrypoints(): string[] {
    const names: string[] = [];
    const keys = this.handlers.keys();
    for (let i = 0; i < keys.length; i++) {
      names.push(keys[i]);
    }
    return names;
  }

  has(name: string): bool {
    return this.handlers.has(name);
  }
}

let globalRegistry: EntrypointRegistry | null = null;

export function getRegistry(): EntrypointRegistry {
  if (globalRegistry === null) {
    globalRegistry = new EntrypointRegistry();
  }
  return globalRegistry!;
}

export function Entrypoint(name: string, handler: EntrypointHandler): EntrypointHandler {
  getRegistry().register(name, handler);
  return handler;
}

export function registerEntrypoint(name: string, handler: EntrypointHandler): void {
  getRegistry().register(name, handler);
}

export function getEntrypointsJSON(): string {
  const entrypoints = getRegistry().getEntrypoints();
  let out = "[";
  for (let i = 0; i < entrypoints.length; i++) {
    if (i > 0) out += ",";
    out += escapeJsonStr(entrypoints[i]);
  }
  out += "]";
  return out;
}
