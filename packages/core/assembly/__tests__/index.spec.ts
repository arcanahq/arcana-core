// @ts-nocheck
/**
 * Tests for core library functions
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import {
  getNumber,
  getString,
  getBoolean,
  getObject,
  getArray,
  numberToJSON,
  stringToJSON,
  booleanToJSON,
  nowMs,
  createEvent,
  createEventPayload,
  createErrorEvent,
  createEventsArray,
  createEffectsArray
} from "../index";

describe("Core Library - JSON Helpers", () => {
  test("getNumber should extract number from Map", () => {
    const obj = new Map<string, string>();
    obj.set("value", "42");
    
    expect(getNumber(obj, "value", 0)).equal(42);
  });

  test("getNumber should return default when key missing", () => {
    const obj = new Map<string, string>();
    
    expect(getNumber(obj, "missing", 99)).equal(99);
  });

  test("getString should extract string from Map", () => {
    const obj = new Map<string, string>();
    obj.set("name", '"test"');
    
    expect(getString(obj, "name", "")).equal("test");
  });

  test("getString should return default when key missing", () => {
    const obj = new Map<string, string>();
    
    expect(getString(obj, "missing", "default")).equal("default");
  });

  test("getBoolean should extract boolean from Map", () => {
    const obj = new Map<string, string>();
    obj.set("active", "true");
    
    expect(getBoolean(obj, "active", false)).equal(true);
  });

  test("getBoolean should return default when key missing", () => {
    const obj = new Map<string, string>();
    
    expect(getBoolean(obj, "missing", true)).equal(true);
  });
});

describe("Core Library - JSON Creation Helpers", () => {
  test("numberToJSON should create JSON string", () => {
    const value = numberToJSON(123);
    expect(typeof value === "string").equal(true);
    expect(value).equal("123");
  });

  test("stringToJSON should create JSON string", () => {
    const value = stringToJSON("hello");
    expect(typeof value === "string").equal(true);
    expect(value).equal('"hello"');
  });

  test("booleanToJSON should create JSON string", () => {
    const value = booleanToJSON(true);
    expect(typeof value === "string").equal(true);
    expect(value).equal("true");
  });
});

describe("Core Library - Precompiles", () => {
  test("nowMs should return the mocked host time in tests", () => {
    const t: i64 = nowMs();
    const expected: i64 = 1700000000000;
    expect(t).equal(expected);
  });
});

describe("Core Library - Event Helpers", () => {
  test("createEvent should create event with type", () => {
    const event = createEvent("CounterIncremented");
    expect(event.type).equal("CounterIncremented");
  });

  test("createEvent should include payload when provided", () => {
    const payload = createEventPayload();
    payload.set("amount", "5");
    const event = createEvent("TestEvent", payload);
    expect(event.payload !== null).equal(true);
    expect(event.payload !== null && (event.payload as Map<string, string>).has("amount")).equal(true);
  });

  test("createErrorEvent should create error event with message", () => {
    const event = createErrorEvent("Something went wrong");
    expect(event.type).equal("error");
    const payload = event.payload as Map<string, string>;
    expect(payload.get("message")).equal("Something went wrong");
  });
});
