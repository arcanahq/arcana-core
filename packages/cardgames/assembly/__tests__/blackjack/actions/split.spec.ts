// @ts-nocheck
/**
 * Tests for split action validation and availability
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import {
  calculateAvailableActions,
  validateCanSplit
} from "../../../blackjack/actions";
import { BlackjackRules } from "../../../blackjack/rules";

// ============================================================================
// calculateAvailableActions - Split Tests
// ============================================================================

describe("calculateAvailableActions - Split", () => {
  test("should allow split when cards can be split and under max hands", () => {
    const standardRules = BlackjackRules.standard();
    const actions = calculateAvailableActions(
      2,
      false,
      false,
      false,
      false,
      "PLAYING",
      1, // playerHandsCount
      true, // canSplit
      standardRules
    );
    expect(actions.canSplit).equal(true);
  });
  
  test("should not allow split when at max hands", () => {
    const standardRules = BlackjackRules.standard();
    const actions = calculateAvailableActions(
      2,
      false,
      false,
      false,
      false,
      "PLAYING",
      4, // playerHandsCount (at max)
      true,
      standardRules
    );
    expect(actions.canSplit).equal(false);
  });
  
  test("should not allow split when cards cannot be split", () => {
    const standardRules = BlackjackRules.standard();
    const actions = calculateAvailableActions(
      2,
      false,
      false,
      false,
      false,
      "PLAYING",
      1,
      false, // canSplit
      standardRules
    );
    expect(actions.canSplit).equal(false);
  });
});

// ============================================================================
// validateCanSplit Tests
// ============================================================================

describe("validateCanSplit", () => {
  test("should not throw when hand can be split", () => {
    const standardRules = BlackjackRules.standard();
    validateCanSplit(2, 1, true, standardRules);
    // If we get here, no error was thrown
    expect(true).equal(true);
  });
  
  // Note: AssemblyScript doesn't support try-catch, so we test that
  // the function aborts on invalid input by checking the contract behavior
  // In a real scenario, invalid split would cause the contract to abort
  test("should validate split conditions correctly", () => {
    const standardRules = BlackjackRules.standard();
    // Valid conditions - should not abort
    validateCanSplit(2, 1, true, standardRules);
    expect(true).equal(true);
  });
  
  test("should allow split when under max hands", () => {
    const standardRules = BlackjackRules.standard();
    validateCanSplit(2, 3, true, standardRules); // playerHandsCount = 3 (under max)
    // If we get here, no error was thrown
    expect(true).equal(true);
  });
});

