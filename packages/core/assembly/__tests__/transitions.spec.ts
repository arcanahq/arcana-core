// @ts-nocheck
/**
 * Tests for state transition helpers
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import { ContractStatus } from "../core/state";
import {
  StateTransition,
  isTransitionAllowed,
  validateTransition,
  createStandardGameTransitions,
  isTerminalStatus,
  getAllowedTransitions,
  TransitionManager,
  createStandardTransitionManager
} from "../game/transitions";

describe("StateTransition", () => {
  test("valid should create valid transition", () => {
    const transition = StateTransition.valid("pending", "active");
    
    expect(transition.isValid).toBe(true);
    expect(transition.fromStatus).toBe("pending");
    expect(transition.toStatus).toBe("active");
    expect(transition.errorMessage).toBe("");
  });

  test("invalid should create invalid transition with message", () => {
    const transition = StateTransition.invalid("pending", "finished", "Cannot finish from pending");
    
    expect(transition.isValid).toBe(false);
    expect(transition.fromStatus).toBe("pending");
    expect(transition.toStatus).toBe("finished");
    expect(transition.errorMessage).toBe("Cannot finish from pending");
  });
});

describe("isTransitionAllowed", () => {
  test("should return true for allowed transition", () => {
    const transitions = new Map<string, string[]>();
    transitions.set("pending", ["active", "finished"]);
    
    expect(isTransitionAllowed("pending", "active", transitions)).toBe(true);
  });

  test("should return false for disallowed transition", () => {
    const transitions = new Map<string, string[]>();
    transitions.set("pending", ["active"]);
    
    expect(isTransitionAllowed("pending", "finished", transitions)).toBe(false);
  });

  test("should return false when from status has no transitions", () => {
    const transitions = new Map<string, string[]>();
    
    expect(isTransitionAllowed("pending", "active", transitions)).toBe(false);
  });

  test("should return false when from status transitions to empty array", () => {
    const transitions = new Map<string, string[]>();
    transitions.set("finished", []);
    
    expect(isTransitionAllowed("finished", "active", transitions)).toBe(false);
  });
});

describe("validateTransition", () => {
  test("should return valid for allowed transition", () => {
    const transitions = new Map<string, string[]>();
    transitions.set("pending", ["active"]);
    
    const result = validateTransition("pending", "active", transitions);
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid for disallowed transition", () => {
    const transitions = new Map<string, string[]>();
    transitions.set("pending", ["active"]);
    
    const result = validateTransition("pending", "finished", transitions);
    
    expect(result.isValid).toBe(false);
    expect(result.errorMessage.length > 0).toBe(true);
  });
});

describe("createStandardGameTransitions", () => {
  test("should create standard transitions map", () => {
    const transitions = createStandardGameTransitions();
    
    expect(transitions !== null).toBe(true);
  });

  test("should allow pending -> active", () => {
    const transitions = createStandardGameTransitions();
    
    expect(isTransitionAllowed(ContractStatus.PENDING, ContractStatus.ACTIVE, transitions)).toBe(true);
  });

  test("should allow pending -> finished", () => {
    const transitions = createStandardGameTransitions();
    
    expect(isTransitionAllowed(ContractStatus.PENDING, ContractStatus.FINISHED, transitions)).toBe(true);
  });

  test("should allow active -> running", () => {
    const transitions = createStandardGameTransitions();
    
    expect(isTransitionAllowed(ContractStatus.ACTIVE, ContractStatus.RUNNING, transitions)).toBe(true);
  });

  test("should allow active -> finished", () => {
    const transitions = createStandardGameTransitions();
    
    expect(isTransitionAllowed(ContractStatus.ACTIVE, ContractStatus.FINISHED, transitions)).toBe(true);
  });

  test("should allow running -> active", () => {
    const transitions = createStandardGameTransitions();
    
    expect(isTransitionAllowed(ContractStatus.RUNNING, ContractStatus.ACTIVE, transitions)).toBe(true);
  });

  test("should allow running -> finished", () => {
    const transitions = createStandardGameTransitions();
    
    expect(isTransitionAllowed(ContractStatus.RUNNING, ContractStatus.FINISHED, transitions)).toBe(true);
  });

  test("should not allow transitions from finished", () => {
    const transitions = createStandardGameTransitions();
    
    expect(isTransitionAllowed(ContractStatus.FINISHED, ContractStatus.ACTIVE, transitions)).toBe(false);
    expect(isTransitionAllowed(ContractStatus.FINISHED, ContractStatus.PENDING, transitions)).toBe(false);
  });

  test("should not allow invalid transitions", () => {
    const transitions = createStandardGameTransitions();
    
    expect(isTransitionAllowed(ContractStatus.ACTIVE, ContractStatus.PENDING, transitions)).toBe(false);
    expect(isTransitionAllowed(ContractStatus.RUNNING, ContractStatus.PENDING, transitions)).toBe(false);
  });
});

describe("isTerminalStatus", () => {
  test("should return true for terminal status", () => {
    const transitions = createStandardGameTransitions();
    
    expect(isTerminalStatus(ContractStatus.FINISHED, transitions)).toBe(true);
  });

  test("should return false for non-terminal status", () => {
    const transitions = createStandardGameTransitions();
    
    expect(isTerminalStatus(ContractStatus.PENDING, transitions)).toBe(false);
    expect(isTerminalStatus(ContractStatus.ACTIVE, transitions)).toBe(false);
    expect(isTerminalStatus(ContractStatus.RUNNING, transitions)).toBe(false);
  });

  test("should return true for status with no transitions", () => {
    const transitions = new Map<string, string[]>();
    transitions.set("terminal", []);
    
    expect(isTerminalStatus("terminal", transitions)).toBe(true);
  });
});

describe("getAllowedTransitions", () => {
  test("should return allowed transitions for status", () => {
    const transitions = createStandardGameTransitions();
    const allowed = getAllowedTransitions(ContractStatus.PENDING, transitions);
    
    expect(allowed.length).toBe(2);
    expect(allowed.includes(ContractStatus.ACTIVE)).toBe(true);
    expect(allowed.includes(ContractStatus.FINISHED)).toBe(true);
  });

  test("should return empty array for terminal status", () => {
    const transitions = createStandardGameTransitions();
    const allowed = getAllowedTransitions(ContractStatus.FINISHED, transitions);
    
    expect(allowed.length).toBe(0);
  });

  test("should return empty array for unknown status", () => {
    const transitions = createStandardGameTransitions();
    const allowed = getAllowedTransitions("unknown", transitions);
    
    expect(allowed.length).toBe(0);
  });

  test("should return copy of transitions array", () => {
    const transitions = new Map<string, string[]>();
    const original = ["active", "finished"];
    transitions.set("pending", original);
    
    const allowed = getAllowedTransitions("pending", transitions);
    
    // Modifying returned array should not affect original
    allowed.push("extra");
    expect(original.length).toBe(2);
  });
});

describe("TransitionManager", () => {
  test("should create manager with transitions", () => {
    const transitions = createStandardGameTransitions();
    const manager = new TransitionManager(transitions);
    
    expect(manager.canTransition(ContractStatus.PENDING, ContractStatus.ACTIVE)).toBe(true);
  });

  test("canTransition should check if transition is allowed", () => {
    const transitions = createStandardGameTransitions();
    const manager = new TransitionManager(transitions);
    
    expect(manager.canTransition(ContractStatus.PENDING, ContractStatus.ACTIVE)).toBe(true);
    expect(manager.canTransition(ContractStatus.PENDING, ContractStatus.RUNNING)).toBe(false);
  });

  test("validateTransition should return StateTransition", () => {
    const transitions = createStandardGameTransitions();
    const manager = new TransitionManager(transitions);
    
    const result = manager.validateTransition(ContractStatus.PENDING, ContractStatus.ACTIVE);
    
    expect(result.isValid).toBe(true);
    expect(result instanceof StateTransition).toBe(true);
  });

  test("getAllowedTransitions should return allowed transitions", () => {
    const transitions = createStandardGameTransitions();
    const manager = new TransitionManager(transitions);
    
    const allowed = manager.getAllowedTransitions(ContractStatus.PENDING);
    
    expect(allowed.length).toBe(2);
  });

  test("isTerminal should check if status is terminal", () => {
    const transitions = createStandardGameTransitions();
    const manager = new TransitionManager(transitions);
    
    expect(manager.isTerminal(ContractStatus.FINISHED)).toBe(true);
    expect(manager.isTerminal(ContractStatus.PENDING)).toBe(false);
  });
});

describe("createStandardTransitionManager", () => {
  test("should create manager with standard transitions", () => {
    const manager = createStandardTransitionManager();
    
    expect(manager.canTransition(ContractStatus.PENDING, ContractStatus.ACTIVE)).toBe(true);
    expect(manager.isTerminal(ContractStatus.FINISHED)).toBe(true);
  });
});

describe("State Transition Integration", () => {
  test("should handle complete game flow", () => {
    const transitions = createStandardGameTransitions();
    const manager = new TransitionManager(transitions);
    
    // Pending -> Active
    expect(manager.canTransition(ContractStatus.PENDING, ContractStatus.ACTIVE)).toBe(true);
    let result = manager.validateTransition(ContractStatus.PENDING, ContractStatus.ACTIVE);
    expect(result.isValid).toBe(true);
    
    // Active -> Running
    expect(manager.canTransition(ContractStatus.ACTIVE, ContractStatus.RUNNING)).toBe(true);
    
    // Running -> Finished
    expect(manager.canTransition(ContractStatus.RUNNING, ContractStatus.FINISHED)).toBe(true);
    result = manager.validateTransition(ContractStatus.RUNNING, ContractStatus.FINISHED);
    expect(result.isValid).toBe(true);
    
    // Finished is terminal
    expect(manager.isTerminal(ContractStatus.FINISHED)).toBe(true);
    expect(manager.canTransition(ContractStatus.FINISHED, ContractStatus.ACTIVE)).toBe(false);
  });

  test("should prevent invalid transitions", () => {
    const transitions = createStandardGameTransitions();
    const manager = new TransitionManager(transitions);
    
    // Cannot go backwards
    expect(manager.canTransition(ContractStatus.ACTIVE, ContractStatus.PENDING)).toBe(false);
    expect(manager.canTransition(ContractStatus.RUNNING, ContractStatus.PENDING)).toBe(false);
    
    // Cannot transition from terminal
    expect(manager.canTransition(ContractStatus.FINISHED, ContractStatus.ACTIVE)).toBe(false);
  });
});


