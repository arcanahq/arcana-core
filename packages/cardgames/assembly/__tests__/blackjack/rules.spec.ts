// @ts-nocheck
/**
 * Comprehensive tests for blackjack rules configuration
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import { BlackjackRules } from "../../blackjack/rules";
import { dealerShouldHit, isSoftHand, calculateBlackjackHandValue } from "../../blackjack/blackjack";
import { Card } from "../../cards";

// ============================================================================
// BlackjackRules Class Tests
// ============================================================================

describe("BlackjackRules", () => {
  test("should create standard rules with correct defaults", () => {
    const rules = BlackjackRules.standard();
    expect(rules.dealerStandValue).equal(17);
    expect(rules.hitOnSoft17).equal(false);
    expect(rules.maxSplitHands).equal(4);
    expect(rules.doubleAfterSplit).equal(false);
    expect(rules.surrenderAllowed).equal(true);
    expect(rules.insuranceOffered).equal(true);
    expect(rules.isSpanish21).equal(false);
    expect(rules.deckSize).equal(52);
    expect(rules.blackjackValue).equal(21);
    expect(rules.bustValue).equal(22);
  });
  
  test("should create Spanish 21 rules correctly", () => {
    const rules = BlackjackRules.spanish21();
    expect(rules.dealerStandValue).equal(17);
    expect(rules.hitOnSoft17).equal(true);
    expect(rules.maxSplitHands).equal(4);
    expect(rules.doubleAfterSplit).equal(true);
    expect(rules.surrenderAllowed).equal(true);
    expect(rules.insuranceOffered).equal(false);
    expect(rules.isSpanish21).equal(true);
    expect(rules.deckSize).equal(48);
  });
  
  test("should create rules with dealer hitting on soft 17", () => {
    const rules = BlackjackRules.dealerHitsSoft17();
    expect(rules.dealerStandValue).equal(17);
    expect(rules.hitOnSoft17).equal(true);
  });
  
  test("should create rules allowing double after split", () => {
    const rules = BlackjackRules.allowDoubleAfterSplit();
    expect(rules.doubleAfterSplit).equal(true);
  });
  
  test("should allow custom rule configuration", () => {
    const rules = new BlackjackRules(
      18, // dealerStandValue
      true, // hitOnSoft17
      3, // maxSplitHands
      true, // doubleAfterSplit
      false, // surrenderAllowed
      false, // lateSurrender
      false, // insuranceOffered
      false // isSpanish21
    );
    expect(rules.dealerStandValue).equal(18);
    expect(rules.hitOnSoft17).equal(true);
    expect(rules.maxSplitHands).equal(3);
    expect(rules.doubleAfterSplit).equal(true);
    expect(rules.surrenderAllowed).equal(false);
    expect(rules.insuranceOffered).equal(false);
  });
  
  test("should set deck size to 48 for Spanish 21", () => {
    const rules = new BlackjackRules(17, false, 4, false, true, false, true, true);
    expect(rules.isSpanish21).equal(true);
    expect(rules.deckSize).equal(48);
  });
  
  test("should set deck size to 52 for standard blackjack", () => {
    const rules = new BlackjackRules(17, false, 4, false, true, false, true, false);
    expect(rules.isSpanish21).equal(false);
    expect(rules.deckSize).equal(52);
  });
  
  test("should have correct payout defaults", () => {
    const rules = BlackjackRules.standard();
    expect(rules.payoutBlackjack).equal(1.5);
    expect(rules.payoutWin).equal(1.0);
    expect(rules.payoutPush).equal(1.0);
    expect(rules.payoutLose).equal(0.0);
    expect(rules.payoutSurrender).equal(0.5);
    expect(rules.payoutInsurance).equal(2.0);
  });
  
  test("should allow custom payouts", () => {
    const rules = new BlackjackRules(
      17, false, 4, false, true, false, true, false,
      2.0, // payoutBlackjack (6:5 instead of 3:2)
      1.0, // payoutWin
      1.0, // payoutPush
      0.0, // payoutLose
      0.5, // payoutSurrender
      2.0  // payoutInsurance
    );
    expect(rules.payoutBlackjack).equal(2.0);
  });
});

// ============================================================================
// dealerShouldHit Tests (from core)
// ============================================================================

describe("dealerShouldHit (from core)", () => {
  test("should hit when below stand value", () => {
    const cards: Card[] = [];
    cards.push(new Card("Hearts", "5"));
    cards.push(new Card("Diamonds", "6"));
    const rules = BlackjackRules.standard();
    expect(dealerShouldHit(cards, rules)).equal(true);
  });
  
  test("should not hit when at or above stand value", () => {
    const cards: Card[] = [];
    cards.push(new Card("Hearts", "10"));
    cards.push(new Card("Diamonds", "7"));
    const rules = BlackjackRules.standard();
    expect(dealerShouldHit(cards, rules)).equal(false);
  });
  
  test("should hit on soft 17 when hitOnSoft17 is true", () => {
    const cards: Card[] = [];
    cards.push(new Card("Hearts", "A"));
    cards.push(new Card("Diamonds", "6"));
    const rules = BlackjackRules.dealerHitsSoft17();
    expect(dealerShouldHit(cards, rules)).equal(true);
  });
  
  test("should not hit on soft 17 when hitOnSoft17 is false", () => {
    const cards: Card[] = [];
    cards.push(new Card("Hearts", "A"));
    cards.push(new Card("Diamonds", "6"));
    const rules = BlackjackRules.standard();
    expect(dealerShouldHit(cards, rules)).equal(false);
  });
});

// ============================================================================
// isSoftHand Tests (from core)
// ============================================================================

describe("isSoftHand (from core)", () => {
  test("should identify soft hand with ace", () => {
    const cards: Card[] = [];
    cards.push(new Card("Hearts", "A"));
    cards.push(new Card("Diamonds", "6"));
    expect(isSoftHand(cards)).equal(true);
  });
  
  test("should identify hard hand without ace", () => {
    const cards: Card[] = [];
    cards.push(new Card("Hearts", "10"));
    cards.push(new Card("Diamonds", "7"));
    expect(isSoftHand(cards)).equal(false);
  });
  
  test("should identify hard hand with ace used as 1", () => {
    const cards: Card[] = [];
    cards.push(new Card("Hearts", "A"));
    cards.push(new Card("Diamonds", "10"));
    cards.push(new Card("Clubs", "10"));
    expect(isSoftHand(cards)).equal(false);
  });
  
  test("should identify soft hand with multiple aces", () => {
    const cards: Card[] = [];
    cards.push(new Card("Hearts", "A"));
    cards.push(new Card("Diamonds", "A"));
    cards.push(new Card("Clubs", "5"));
    expect(isSoftHand(cards)).equal(true);
  });
});

// ============================================================================
// calculateBlackjackHandValue Tests (from core)
// ============================================================================

describe("calculateBlackjackHandValue (from core)", () => {
  test("should calculate value for number cards", () => {
    const cards: Card[] = [];
    cards.push(new Card("Hearts", "5"));
    cards.push(new Card("Diamonds", "7"));
    expect(calculateBlackjackHandValue(cards)).equal(12);
  });
  
  test("should calculate value for face cards", () => {
    const cards: Card[] = [];
    cards.push(new Card("Hearts", "K"));
    cards.push(new Card("Diamonds", "Q"));
    expect(calculateBlackjackHandValue(cards)).equal(20);
  });
  
  test("should calculate value with ace as 11", () => {
    const cards: Card[] = [];
    cards.push(new Card("Hearts", "A"));
    cards.push(new Card("Diamonds", "6"));
    expect(calculateBlackjackHandValue(cards)).equal(17);
  });
  
  test("should calculate value with ace as 1 when needed", () => {
    const cards: Card[] = [];
    cards.push(new Card("Hearts", "A"));
    cards.push(new Card("Diamonds", "10"));
    cards.push(new Card("Clubs", "10"));
    expect(calculateBlackjackHandValue(cards)).equal(21);
  });
  
  test("should calculate blackjack correctly", () => {
    const cards: Card[] = [];
    cards.push(new Card("Hearts", "A"));
    cards.push(new Card("Diamonds", "K"));
    expect(calculateBlackjackHandValue(cards)).equal(21);
  });
  
  test("should handle multiple aces correctly", () => {
    const cards: Card[] = [];
    cards.push(new Card("Hearts", "A"));
    cards.push(new Card("Diamonds", "A"));
    cards.push(new Card("Clubs", "5"));
    expect(calculateBlackjackHandValue(cards)).equal(17);
  });
});

