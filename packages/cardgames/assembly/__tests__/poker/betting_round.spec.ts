// @ts-nocheck
/**
 * Tests for BettingRoundState class
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import { BettingRoundState } from "../../poker/poker_game_types";

// ============================================================================
// BettingRoundState Tests
// ============================================================================

describe("BettingRoundState", () => {
  test("should initialize with empty contributions", () => {
    const state = new BettingRoundState();
    
    expect(state.getContributionThisRound(0)).equal(0);
    expect(state.getTotalContribution(0)).equal(0);
    expect(state.currentBetToMatch).equal(0);
    expect(state.actingSeatId).equal(-1);
  });

  test("should track contributions this round", () => {
    const state = new BettingRoundState();
    
    state.contribThisRound.set(0, 50);
    state.contribThisRound.set(1, 100);
    
    expect(state.getContributionThisRound(0)).equal(50);
    expect(state.getContributionThisRound(1)).equal(100);
    expect(state.getContributionThisRound(2)).equal(0); // Not set
  });

  test("should track total contributions", () => {
    const state = new BettingRoundState();
    
    state.contribTotal.set(0, 150);
    state.contribTotal.set(1, 200);
    
    expect(state.getTotalContribution(0)).equal(150);
    expect(state.getTotalContribution(1)).equal(200);
  });

  test("should calculate amount to call", () => {
    const state = new BettingRoundState();
    state.currentBetToMatch = 100;
    state.contribThisRound.set(0, 50);
    state.contribThisRound.set(1, 100);
    
    expect(state.calculateToCall(0)).equal(50); // 100 - 50
    expect(state.calculateToCall(1)).equal(0); // Already matched
    expect(state.calculateToCall(2)).equal(100); // Hasn't contributed
  });

  test("should reset round state", () => {
    const state = new BettingRoundState();
    state.currentBetToMatch = 100;
    state.lastFullRaiseSize = 50;
    state.lastAggressorSeatId = 2;
    state.actingSeatId = 1;
    state.contribThisRound.set(0, 50);
    state.contribThisRound.set(1, 100);
    // Set total contributions to verify they remain after reset
    state.contribTotal.set(0, 50);
    state.contribTotal.set(1, 100);
    
    state.resetRound();
    
    expect(state.currentBetToMatch).equal(0);
    expect(state.lastFullRaiseSize).equal(0);
    expect(state.lastAggressorSeatId).equal(-1);
    expect(state.actingSeatId).equal(-1);
    expect(state.getContributionThisRound(0)).equal(0);
    expect(state.getContributionThisRound(1)).equal(0);
    // Total contributions should remain (not cleared by resetRound)
    expect(state.getTotalContribution(0)).equal(50);
    expect(state.getTotalContribution(1)).equal(100);
  });

  test("should clone correctly", () => {
    const state = new BettingRoundState();
    state.currentBetToMatch = 100;
    state.lastFullRaiseSize = 50;
    state.lastAggressorSeatId = 2;
    state.actingSeatId = 1;
    state.contribThisRound.set(0, 50);
    state.contribTotal.set(0, 150);
    
    const cloned = state.clone();
    
    expect(cloned.currentBetToMatch).equal(100);
    expect(cloned.lastFullRaiseSize).equal(50);
    expect(cloned.lastAggressorSeatId).equal(2);
    expect(cloned.actingSeatId).equal(1);
    expect(cloned.getContributionThisRound(0)).equal(50);
    expect(cloned.getTotalContribution(0)).equal(150);
    
    // Modifying clone shouldn't affect original
    cloned.currentBetToMatch = 200;
    expect(state.currentBetToMatch).equal(100);
  });
});

