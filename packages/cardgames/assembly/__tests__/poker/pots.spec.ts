// @ts-nocheck
/**
 * Tests for pot management utilities
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import { Pot, PokerRakeConfig } from "../../poker/poker_game_types";
import {
  constructSidePots,
  calculatePokerRake,
  calculateRakeSimple,
  distributePot,
  distributePotSimple,
  splitPotForRuns,
  splitAllPotsForRuns,
  lockPots,
  getTotalPotAmount
} from "../../poker/poker_game_utils";

// ============================================================================
// constructSidePots Tests
// ============================================================================

describe("constructSidePots", () => {
  test("should create single pot when all contributions equal", () => {
    const contributions = new Map<i32, i64>();
    contributions.set(0, 100);
    contributions.set(1, 100);
    contributions.set(2, 100);
    
    const pots = constructSidePots(contributions, 0);
    
    expect(pots.length).equal(1);
    expect(pots[0].amount).equal(300);
    expect(pots[0].eligibleSeats.length).equal(3);
  });

  test("should create side pots for all-in scenarios", () => {
    const contributions = new Map<i32, i64>();
    contributions.set(0, 100);
    contributions.set(1, 200); // All-in
    contributions.set(2, 100);
    
    const pots = constructSidePots(contributions, 0);
    
    expect(pots.length).equal(2);
    // First pot: all players contribute 100
    expect(pots[0].amount).equal(300); // 3 players * 100
    expect(pots[0].eligibleSeats.length).equal(3);
    // Second pot: only player 1 contributes additional 100
    expect(pots[1].amount).equal(100);
    expect(pots[1].eligibleSeats.length).equal(1);
    expect(pots[1].eligibleSeats[0]).equal(1);
  });

  test("should handle multiple all-in levels", () => {
    const contributions = new Map<i32, i64>();
    contributions.set(0, 50);
    contributions.set(1, 100);
    contributions.set(2, 200);
    
    const pots = constructSidePots(contributions, 0);
    
    expect(pots.length).equal(3);
    // Pot 1: all contribute 50
    expect(pots[0].amount).equal(150);
    expect(pots[0].eligibleSeats.length).equal(3);
    // Pot 2: players 1 and 2 contribute additional 50
    expect(pots[1].amount).equal(100);
    expect(pots[1].eligibleSeats.length).equal(2);
    // Pot 3: only player 2 contributes additional 100
    expect(pots[2].amount).equal(100);
    expect(pots[2].eligibleSeats.length).equal(1);
  });

  test("should return empty array for no contributions", () => {
    const contributions = new Map<i32, i64>();
    const pots = constructSidePots(contributions, 0);
    expect(pots.length).equal(0);
  });
});

// ============================================================================
// calculatePokerRake Tests
// ============================================================================

describe("calculatePokerRake", () => {
  test("should calculate rake as percentage", () => {
    const rakeConfig = new PokerRakeConfig(5.0, 0); // 5% rake, no cap
    const rake = calculatePokerRake(100, rakeConfig);
    expect(rake).equal(5); // 5% of 100
  });

  test("should apply rake cap", () => {
    const rakeConfig = new PokerRakeConfig(10.0, 5); // 10% rake, cap at 5
    const rake = calculatePokerRake(100, rakeConfig);
    expect(rake).equal(5); // Capped at 5, not 10
  });

  test("should return 0 for zero percentage", () => {
    const rakeConfig = new PokerRakeConfig(0.0, 0);
    const rake = calculatePokerRake(100, rakeConfig);
    expect(rake).equal(0);
  });

  test("should handle fractional rake", () => {
    const rakeConfig = new PokerRakeConfig(2.5, 0); // 2.5% rake
    const rake = calculatePokerRake(100, rakeConfig);
    expect(rake).equal(2); // Rounded down
  });
});

// ============================================================================
// calculateRakeSimple Tests
// ============================================================================

describe("calculateRakeSimple", () => {
  test("should calculate rake with percentage and cap", () => {
    const rake = calculateRakeSimple(100, 5.0, 10);
    expect(rake).equal(5);
  });

  test("should apply cap", () => {
    const rake = calculateRakeSimple(1000, 10.0, 50); // 10% = 100, capped at 50
    expect(rake).equal(50);
  });
});

// ============================================================================
// splitPotForRuns Tests
// ============================================================================

describe("splitPotForRuns", () => {
  test("should split pot evenly for 2 runs", () => {
    const pot = new Pot(0, 100, new Array<i32>(0), false, 1, new Array<i64>(0));
    const splitPot = splitPotForRuns(pot, 2);
    
    expect(splitPot.runCountForPot).equal(2);
    expect(splitPot.splitAmountsPerRun.length).equal(2);
    expect(splitPot.splitAmountsPerRun[0] + splitPot.splitAmountsPerRun[1]).equal(100);
  });

  test("should handle remainder for odd splits", () => {
    const pot = new Pot(0, 100, new Array<i32>(0), false, 1, new Array<i64>(0));
    const splitPot = splitPotForRuns(pot, 3);
    
    expect(splitPot.runCountForPot).equal(3);
    expect(splitPot.splitAmountsPerRun.length).equal(3);
    // 100 / 3 = 33 remainder 1, so first run gets extra chip
    const total = splitPot.splitAmountsPerRun[0] + splitPot.splitAmountsPerRun[1] + splitPot.splitAmountsPerRun[2];
    expect(total).equal(100);
  });

  test("should not split for runCount <= 1", () => {
    const pot = new Pot(0, 100, new Array<i32>(0), false, 1, new Array<i64>(0));
    const splitPot = splitPotForRuns(pot, 1);
    
    expect(splitPot.runCountForPot).equal(1);
    expect(splitPot.splitAmountsPerRun.length).equal(1);
    expect(splitPot.splitAmountsPerRun[0]).equal(100);
  });
});

// ============================================================================
// distributePot Tests
// ============================================================================

describe("distributePot", () => {
  test("should distribute pot to single winner", () => {
    const pot = new Pot(0, 100, new Array<i32>(0), false, 1, new Array<i64>(1));
    pot.splitAmountsPerRun[0] = 100;
    const winners = new Array<i32>(1);
    winners[0] = 0;
    const rakeConfig = new PokerRakeConfig(5.0, 0);
    
    const result = distributePot(pot, winners, 0, 0, rakeConfig);
    
    expect(result.rake).equal(5); // 5% of 100
    expect(result.payouts.has(0)).equal(true);
    expect(result.payouts.get(0)).equal(95); // 100 - 5 rake
  });

  test("should distribute pot to multiple winners", () => {
    const pot = new Pot(0, 100, new Array<i32>(0), false, 1, new Array<i64>(1));
    pot.splitAmountsPerRun[0] = 100;
    const winners = new Array<i32>(2);
    winners[0] = 0;
    winners[1] = 1;
    const rakeConfig = new PokerRakeConfig(0.0, 0); // No rake
    
    const result = distributePot(pot, winners, 0, 0, rakeConfig);
    
    expect(result.rake).equal(0);
    expect(result.payouts.has(0)).equal(true);
    expect(result.payouts.has(1)).equal(true);
    // Each gets 50 (100 / 2)
    expect(result.payouts.get(0) + result.payouts.get(1)).equal(100);
  });

  test("should handle odd chips", () => {
    const pot = new Pot(0, 101, new Array<i32>(0), false, 1, new Array<i64>(1));
    pot.splitAmountsPerRun[0] = 101;
    const winners = new Array<i32>(2);
    winners[0] = 0;
    winners[1] = 1;
    const rakeConfig = new PokerRakeConfig(0.0, 0);
    
    const result = distributePot(pot, winners, 0, 0, rakeConfig);
    
    // 101 / 2 = 50 remainder 1, first winner gets extra chip
    const total = result.payouts.get(0) + result.payouts.get(1);
    expect(total).equal(101);
  });
});

// ============================================================================
// lockPots Tests
// ============================================================================

describe("lockPots", () => {
  test("should lock all pots", () => {
    const pots = new Array<Pot>(2);
    pots[0] = new Pot(0, 100, new Array<i32>(0), false, 1, new Array<i64>(0));
    pots[1] = new Pot(1, 50, new Array<i32>(0), false, 1, new Array<i64>(0));
    
    const lockedPots = lockPots(pots);
    
    expect(lockedPots.length).equal(2);
    expect(lockedPots[0].locked).equal(true);
    expect(lockedPots[1].locked).equal(true);
  });
});

// ============================================================================
// getTotalPotAmount Tests
// ============================================================================

describe("getTotalPotAmount", () => {
  test("should sum all pot amounts", () => {
    const pots = new Array<Pot>(3);
    pots[0] = new Pot(0, 100, new Array<i32>(0), false, 1, new Array<i64>(0));
    pots[1] = new Pot(1, 50, new Array<i32>(0), false, 1, new Array<i64>(0));
    pots[2] = new Pot(2, 25, new Array<i32>(0), false, 1, new Array<i64>(0));
    
    const total = getTotalPotAmount(pots);
    expect(total).equal(175); // 100 + 50 + 25
  });

  test("should return 0 for empty array", () => {
    const pots = new Array<Pot>(0);
    const total = getTotalPotAmount(pots);
    expect(total).equal(0);
  });
});

