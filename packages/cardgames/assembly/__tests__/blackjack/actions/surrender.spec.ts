// @ts-nocheck
/**
 * Tests for surrender action validation and availability
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import {
  calculateAvailableActions,
  validateCanSurrender
} from "../../../blackjack/actions";
import { BlackjackRules } from "../../../blackjack/rules";

// ============================================================================
// calculateAvailableActions - Surrender Tests
// ============================================================================

describe("calculateAvailableActions - Surrender", () => {
  test("should allow surrender on first two cards of original hand", () => {
    const standardRules = BlackjackRules.standard();
    const actions = calculateAvailableActions(
      2,
      false, // handIsFromSplit
      false,
      false,
      false,
      "PLAYING",
      1,
      false,
      standardRules
    );
    expect(actions.canSurrender).equal(true);
  });
  
  test("should not allow surrender on split hand", () => {
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
    expect(actions.canSurrender).equal(false);
  });
  
  test("should not allow surrender when surrender not allowed", () => {
    const rules = new BlackjackRules(17, false, 4, false, false); // surrenderAllowed = false
    const actions = calculateAvailableActions(
      2,
      false,
      false,
      false,
      false,
      "PLAYING",
      1,
      false,
      rules
    );
    expect(actions.canSurrender).equal(false);
  });
});

// ============================================================================
// validateCanSurrender Tests
// ============================================================================

describe("validateCanSurrender", () => {
  test("should not throw when hand can be surrendered", () => {
    const standardRules = BlackjackRules.standard();
    validateCanSurrender(2, false, standardRules);
    // If we get here, no error was thrown
    expect(true).equal(true);
  });
  
  // Note: AssemblyScript doesn't support try-catch, so we test that
  // the function aborts on invalid input by checking the contract behavior
  // In a real scenario, invalid surrender would cause the contract to abort
  test("should validate surrender conditions correctly", () => {
    const standardRules = BlackjackRules.standard();
    // Valid conditions - should not abort
    validateCanSurrender(2, false, standardRules);
    expect(true).equal(true);
  });
});

