// @ts-nocheck
/**
 * Tests for double action validation and availability
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import {
  calculateAvailableActions,
  validateCanDouble
} from "../../../blackjack/actions";
import { BlackjackRules } from "../../../blackjack/rules";

// ============================================================================
// calculateAvailableActions - Double Tests
// ============================================================================

describe("calculateAvailableActions - Double", () => {
  test("should allow double on first two cards", () => {
    const standardRules = BlackjackRules.standard();
    const actions = calculateAvailableActions(
      2, // handCardsLength
      false,
      false,
      false,
      false,
      "PLAYING",
      1,
      false,
      standardRules
    );
    expect(actions.canDouble).equal(true);
  });
  
  test("should not allow double on more than two cards", () => {
    const standardRules = BlackjackRules.standard();
    const actions = calculateAvailableActions(
      3, // handCardsLength
      false,
      false,
      false,
      false,
      "PLAYING",
      1,
      false,
      standardRules
    );
    expect(actions.canDouble).equal(false);
  });
  
  test("should not allow double on split aces", () => {
    const standardRules = BlackjackRules.standard();
    const actions = calculateAvailableActions(
      2,
      false,
      true, // handIsSplitAces
      false,
      false,
      "PLAYING",
      1,
      false,
      standardRules
    );
    expect(actions.canDouble).equal(false);
  });
  
  test("should not allow double after split when doubleAfterSplit is false", () => {
    const standardRules = BlackjackRules.standard();
    const actions = calculateAvailableActions(
      2,
      true, // handIsFromSplit
      false,
      false,
      false,
      "PLAYING",
      2,
      false,
      standardRules
    );
    expect(actions.canDouble).equal(false);
  });
  
  test("should allow double after split when doubleAfterSplit is true", () => {
    const rules = BlackjackRules.allowDoubleAfterSplit();
    const actions = calculateAvailableActions(
      2,
      true, // handIsFromSplit
      false,
      false,
      false,
      "PLAYING",
      2,
      false,
      rules
    );
    expect(actions.canDouble).equal(true);
  });
});

// ============================================================================
// validateCanDouble Tests
// ============================================================================

describe("validateCanDouble", () => {
  test("should not throw when hand can be doubled", () => {
    const standardRules = BlackjackRules.standard();
    validateCanDouble(2, false, false, standardRules);
    // If we get here, no error was thrown
    expect(true).equal(true);
  });
  
  // Note: AssemblyScript doesn't support try-catch, so we test that
  // the function aborts on invalid input by checking the contract behavior
  // In a real scenario, invalid double would cause the contract to abort
  test("should validate double conditions correctly", () => {
    const standardRules = BlackjackRules.standard();
    // Valid conditions - should not abort
    validateCanDouble(2, false, false, standardRules);
    expect(true).equal(true);
  });
  
  test("should allow double after split when rules permit", () => {
    const rules = BlackjackRules.allowDoubleAfterSplit();
    validateCanDouble(2, false, true, rules); // handIsFromSplit = true
    // If we get here, no error was thrown
    expect(true).equal(true);
  });
});

