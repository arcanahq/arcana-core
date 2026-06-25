// @ts-nocheck
/**
 * Contract result helpers for creating events and effects.
 * MessagePack-only runtime: JSON result helpers have been removed.
 */

import {
  ContractEffect,
  ContractEvent,
  ContractTask,
  MsgpackEncodable,
  createIncrementBalanceEffect,
  createDecrementBalanceEffect,
  createLogEffect,
  createPrintStatusEffect,
} from "../core/response";

export interface ViewSerializable<T> {
  /**
   * Return the persisted storage projection, not a privacy-filtered public view.
   */
  toView(): T;
  toBytes(): Uint8Array;
}

// Helper to create an event object
export function createEvent(type: string, payload: Map<string, string> | null = null): ContractEvent {
  return new ContractEvent(type, payload);
}

export function createTypedEvent(type: string, data: MsgpackEncodable | null = null): ContractEvent {
  return new ContractEvent(type, null, null, data);
}

export function createTask(name: string, args: Map<string, string> | null = null): ContractTask {
  return new ContractTask(name, args);
}

// Helper to create an event payload object
export function createEventPayload(): Map<string, string> {
  return new Map<string, string>();
}

// Helper to create an error event
export function createErrorEvent(message: string): ContractEvent {
  const payload = createEventPayload();
  payload.set("message", message);
  return createEvent("error", payload);
}

// Helper to create an empty events array
export function createEventsArray(): ContractEvent[] {
  return [];
}

// Helper to create an empty effects array
export function createEffectsArray(): ContractEffect[] {
  return new Array<ContractEffect>();
}

// Helper to create an IncrementBalance effect with u64 amount
export function createIncrementBalanceEffectU64(userId: string, token: string, amount: u64, failOnError: bool = true): ContractEffect {
  return createIncrementBalanceEffect(userId, token, amount.toString(), failOnError);
}

// Helper to create a DecrementBalance effect with u64 amount
export function createDecrementBalanceEffectU64(userId: string, token: string, amount: u64, failOnError: bool = true): ContractEffect {
  return createDecrementBalanceEffect(userId, token, amount.toString(), failOnError);
}

// Helper to safely push an effect to an effects array
export function pushEffect(effects: ContractEffect[], effect: ContractEffect): void {
  effects.push(effect);
}

/**
 * EffectsBuilder - A class to build effects arrays with fluent methods
 */
export class EffectsBuilder {
  private effects: ContractEffect[];

  constructor() {
    this.effects = [];
  }

  addPrintStatus(status: string, failOnError: bool = false): EffectsBuilder {
    this.effects.push(createPrintStatusEffect(status, failOnError));
    return this;
  }

  addLog(message: string, failOnError: bool = false): EffectsBuilder {
    this.effects.push(createLogEffect(message, failOnError));
    return this;
  }

  addIncrementBalance(userId: string, token: string, amount: string, failOnError: bool = true): EffectsBuilder {
    this.effects.push(createIncrementBalanceEffect(userId, token, amount, failOnError));
    return this;
  }

  addIncrementBalanceU64(userId: string, token: string, amount: u64, failOnError: bool = true): EffectsBuilder {
    this.effects.push(createIncrementBalanceEffectU64(userId, token, amount, failOnError));
    return this;
  }

  addDecrementBalance(userId: string, token: string, amount: string, failOnError: bool = true): EffectsBuilder {
    this.effects.push(createDecrementBalanceEffect(userId, token, amount, failOnError));
    return this;
  }

  addDecrementBalanceU64(userId: string, token: string, amount: u64, failOnError: bool = true): EffectsBuilder {
    this.effects.push(createDecrementBalanceEffectU64(userId, token, amount, failOnError));
    return this;
  }

  add(effect: ContractEffect): EffectsBuilder {
    this.effects.push(effect);
    return this;
  }

  build(): ContractEffect[] {
    return this.effects;
  }
}

/**
 * EventPayloadBuilder - A class to build event payloads with fluent methods
 */
export class EventPayloadBuilder {
  private payload: Map<string, string>;

  constructor() {
    this.payload = new Map<string, string>();
  }

  setAmount(amount: i64): EventPayloadBuilder {
    this.payload.set("amount", amount.toString());
    return this;
  }

  setAmountI32(amount: i32): EventPayloadBuilder {
    this.payload.set("amount", amount.toString());
    return this;
  }

  setAmountF64(amount: f64): EventPayloadBuilder {
    this.payload.set("amount", amount.toString());
    return this;
  }

  setAmountString(amount: string): EventPayloadBuilder {
    this.payload.set("amount", amount);
    return this;
  }

  setValue(value: i64): EventPayloadBuilder {
    this.payload.set("newValue", value.toString());
    return this;
  }

  setValueI32(value: i32): EventPayloadBuilder {
    this.payload.set("newValue", value.toString());
    return this;
  }

  setValueF64(value: f64): EventPayloadBuilder {
    this.payload.set("newValue", value.toString());
    return this;
  }

  setValueString(value: string): EventPayloadBuilder {
    this.payload.set("newValue", value);
    return this;
  }

  setString(key: string, value: string): EventPayloadBuilder {
    this.payload.set(key, value);
    return this;
  }

  setNumber(key: string, value: i32): EventPayloadBuilder {
    this.payload.set(key, value.toString());
    return this;
  }

  setNumberF64(key: string, value: f64): EventPayloadBuilder {
    this.payload.set(key, value.toString());
    return this;
  }

  set(key: string, value: string): EventPayloadBuilder {
    this.payload.set(key, value);
    return this;
  }

  build(): Map<string, string> {
    return this.payload;
  }
}

/**
 * EventBuilder - A class to build complete events with type and payload
 */
export class EventBuilder {
  private eventType: string;
  private payload: Map<string, string>;

  constructor(eventType: string) {
    this.eventType = eventType;
    this.payload = new Map<string, string>();
  }

  setAmount(amount: i64): EventBuilder {
    this.payload.set("amount", amount.toString());
    return this;
  }

  setAmountI32(amount: i32): EventBuilder {
    this.payload.set("amount", amount.toString());
    return this;
  }

  setAmountF64(amount: f64): EventBuilder {
    this.payload.set("amount", amount.toString());
    return this;
  }

  setAmountString(amount: string): EventBuilder {
    this.payload.set("amount", amount);
    return this;
  }

  setValue(value: i64): EventBuilder {
    this.payload.set("newValue", value.toString());
    return this;
  }

  setValueI32(value: i32): EventBuilder {
    this.payload.set("newValue", value.toString());
    return this;
  }

  setValueF64(value: f64): EventBuilder {
    this.payload.set("newValue", value.toString());
    return this;
  }

  setValueString(value: string): EventBuilder {
    this.payload.set("newValue", value);
    return this;
  }

  setString(key: string, value: string): EventBuilder {
    this.payload.set(key, value);
    return this;
  }

  setNumber(key: string, value: i32): EventBuilder {
    this.payload.set(key, value.toString());
    return this;
  }

  setNumberF64(key: string, value: f64): EventBuilder {
    this.payload.set(key, value.toString());
    return this;
  }

  set(key: string, value: string): EventBuilder {
    this.payload.set(key, value);
    return this;
  }

  build(): ContractEvent {
    return createEvent(this.eventType, this.payload);
  }
}
