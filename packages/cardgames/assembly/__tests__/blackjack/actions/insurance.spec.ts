// @ts-nocheck
/**
 * Tests for insurance offer validation
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import {
  shouldOfferInsurance
} from "../../../blackjack/actions";
import { BlackjackRules } from "../../../blackjack/rules";

// ============================================================================
// shouldOfferInsurance Tests
// ============================================================================

describe("shouldOfferInsurance", () => {
  test("should offer insurance when dealer shows ace and insurance is enabled", () => {
    const standardRules = BlackjackRules.standard();
    expect(shouldOfferInsurance("A", standardRules)).equal(true);
  });
  
  test("should not offer insurance when dealer does not show ace", () => {
    const standardRules = BlackjackRules.standard();
    expect(shouldOfferInsurance("K", standardRules)).equal(false);
    expect(shouldOfferInsurance("10", standardRules)).equal(false);
    expect(shouldOfferInsurance("5", standardRules)).equal(false);
  });
  
  test("should not offer insurance when insurance is disabled", () => {
    const rules = new BlackjackRules(17, false, 4, false, true, false, false); // insuranceOffered = false
    expect(shouldOfferInsurance("A", rules)).equal(false);
  });
  
  test("should not offer insurance when dealer shows ace but insurance disabled", () => {
    const rules = new BlackjackRules(17, false, 4, false, true, false, false); // insuranceOffered = false
    expect(shouldOfferInsurance("A", rules)).equal(false);
  });
});

