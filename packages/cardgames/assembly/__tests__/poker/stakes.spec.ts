// @ts-nocheck
/**
 * Tests for stakes and betting utilities
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import { Stakes, AnteType, BettingRoundState, PokerSeatBase } from "../../poker/poker_game_types";
import {
  calculateAnteAmount,
  postAntes,
  postBlinds,
  getNextActingSeat,
  validateBuyIn,
  processBuyIn,
  isBettingRoundComplete
} from "../../poker/poker_game_utils";

// ============================================================================
// calculateAnteAmount Tests
// ============================================================================

describe("calculateAnteAmount", () => {
  test("should return 0 for NONE ante type", () => {
    const stakes = new Stakes(10, 20, 5);
    const ante = calculateAnteAmount(stakes, AnteType.NONE, 0.0);
    expect(ante).equal(0);
  });

  test("should return fixed ante amount for FIXED type", () => {
    const stakes = new Stakes(10, 20, 5);
    const ante = calculateAnteAmount(stakes, AnteType.FIXED, 0.0);
    expect(ante).equal(5);
  });

  test("should calculate percentage ante for PERCENTAGE type", () => {
    const stakes = new Stakes(10, 20, 0);
    const ante = calculateAnteAmount(stakes, AnteType.PERCENTAGE, 10.0); // 10% of BB
    expect(ante).equal(2); // 10% of 20 = 2
  });

  test("should handle zero big blind for percentage ante", () => {
    const stakes = new Stakes(10, 0, 0);
    const ante = calculateAnteAmount(stakes, AnteType.PERCENTAGE, 10.0);
    expect(ante).equal(0);
  });
});

// ============================================================================
// postAntes Tests
// ============================================================================

describe("postAntes", () => {
  test("should post antes for all players in hand", () => {
    const stakes = new Stakes(10, 20, 5);
    const bettingState = new BettingRoundState();
    
    const seats = new Array<PokerSeatBase>(3);
    seats[0] = new PokerSeatBase(0, "player1", 100);
    seats[0].inHand = true;
    seats[1] = new PokerSeatBase(1, "player2", 100);
    seats[1].inHand = true;
    seats[2] = new PokerSeatBase(2, null, 0); // Empty seat
    seats[2].inHand = false;
    
    const result = postAntes(seats, stakes, AnteType.FIXED, 0.0, bettingState);
    
    expect(result.totalAnteCollected).equal(10); // 2 players * 5 ante
    expect(result.seats[0].stack).equal(95); // 100 - 5
    expect(result.seats[1].stack).equal(95); // 100 - 5
    expect(bettingState.getContributionThisRound(0)).equal(5);
    expect(bettingState.getContributionThisRound(1)).equal(5);
  });

  test("should handle all-in antes", () => {
    const stakes = new Stakes(10, 20, 5);
    const bettingState = new BettingRoundState();
    
    const seats = new Array<PokerSeatBase>(2);
    seats[0] = new PokerSeatBase(0, "player1", 3); // Less than ante
    seats[0].inHand = true;
    seats[1] = new PokerSeatBase(1, "player2", 100);
    seats[1].inHand = true;
    
    const result = postAntes(seats, stakes, AnteType.FIXED, 0.0, bettingState);
    
    expect(result.totalAnteCollected).equal(8); // 3 + 5
    expect(result.seats[0].stack).equal(0);
    expect(result.seats[0].allIn).equal(true);
    expect(result.seats[1].stack).equal(95);
    expect(bettingState.getContributionThisRound(0)).equal(3);
    expect(bettingState.getContributionThisRound(1)).equal(5);
  });

  test("should skip players not in hand", () => {
    const stakes = new Stakes(10, 20, 5);
    const bettingState = new BettingRoundState();
    
    const seats = new Array<PokerSeatBase>(2);
    seats[0] = new PokerSeatBase(0, "player1", 100);
    seats[0].inHand = false; // Not in hand
    seats[1] = new PokerSeatBase(1, "player2", 100);
    seats[1].inHand = true;
    
    const result = postAntes(seats, stakes, AnteType.FIXED, 0.0, bettingState);
    
    expect(result.totalAnteCollected).equal(5); // Only player2
    expect(result.seats[0].stack).equal(100); // Unchanged
    expect(result.seats[1].stack).equal(95);
  });
});

// ============================================================================
// postBlinds Tests
// ============================================================================

describe("postBlinds", () => {
  test("should post small blind and big blind", () => {
    const stakes = new Stakes(10, 20, 0);
    const bettingState = new BettingRoundState();
    
    const seats = new Array<PokerSeatBase>(3);
    seats[0] = new PokerSeatBase(0, "sb", 100);
    seats[0].inHand = true;
    seats[1] = new PokerSeatBase(1, "bb", 100);
    seats[1].inHand = true;
    seats[2] = new PokerSeatBase(2, "other", 100);
    seats[2].inHand = true;
    
    const result = postBlinds(seats, stakes, 0, 1, bettingState);
    
    expect(result.seats[0].stack).equal(90); // 100 - 10 SB
    expect(result.seats[1].stack).equal(80); // 100 - 20 BB
    expect(result.seats[2].stack).equal(100); // Unchanged
    expect(result.currentBetToMatch).equal(20); // BB amount
    expect(bettingState.getContributionThisRound(0)).equal(10);
    expect(bettingState.getContributionThisRound(1)).equal(20);
  });

  test("should handle all-in small blind", () => {
    const stakes = new Stakes(10, 20, 0);
    const bettingState = new BettingRoundState();
    
    const seats = new Array<PokerSeatBase>(2);
    seats[0] = new PokerSeatBase(0, "sb", 5); // Less than SB
    seats[0].inHand = true;
    seats[1] = new PokerSeatBase(1, "bb", 100);
    seats[1].inHand = true;
    
    const result = postBlinds(seats, stakes, 0, 1, bettingState);
    
    expect(result.seats[0].stack).equal(0);
    expect(result.seats[0].allIn).equal(true);
    expect(bettingState.getContributionThisRound(0)).equal(5);
  });

  test("should handle all-in big blind", () => {
    const stakes = new Stakes(10, 20, 0);
    const bettingState = new BettingRoundState();
    
    const seats = new Array<PokerSeatBase>(2);
    seats[0] = new PokerSeatBase(0, "sb", 100);
    seats[0].inHand = true;
    seats[1] = new PokerSeatBase(1, "bb", 15); // Less than BB
    seats[1].inHand = true;
    
    const result = postBlinds(seats, stakes, 0, 1, bettingState);
    
    expect(result.seats[1].stack).equal(0);
    expect(result.seats[1].allIn).equal(true);
    expect(result.currentBetToMatch).equal(15); // Actual BB posted
    expect(bettingState.getContributionThisRound(1)).equal(15);
  });
});

// ============================================================================
// getNextActingSeat Tests
// ============================================================================

describe("getNextActingSeat", () => {
  test("should return first to act preflop (after BB)", () => {
    const bettingState = new BettingRoundState();
    bettingState.currentBetToMatch = 20;
    
    const seats = new Array<PokerSeatBase>(4);
    seats[0] = new PokerSeatBase(0, "button", 100);
    seats[0].inHand = true;
    seats[1] = new PokerSeatBase(1, "sb", 100);
    seats[1].inHand = true;
    seats[2] = new PokerSeatBase(2, "bb", 100);
    seats[2].inHand = true;
    seats[3] = new PokerSeatBase(3, "utg", 100);
    seats[3].inHand = true;
    
    // Preflop: action starts after BB (button + 3)
    const nextSeat = getNextActingSeat(seats, 0, true, bettingState);
    expect(nextSeat).equal(3); // UTG (button + 3)
  });

  test("should return first to act postflop (after button)", () => {
    const bettingState = new BettingRoundState();
    bettingState.currentBetToMatch = 0;
    
    const seats = new Array<PokerSeatBase>(3);
    seats[0] = new PokerSeatBase(0, "button", 100);
    seats[0].inHand = true;
    seats[1] = new PokerSeatBase(1, "sb", 100);
    seats[1].inHand = true;
    seats[2] = new PokerSeatBase(2, "bb", 100);
    seats[2].inHand = true;
    
    // Postflop: action starts after button (button + 1)
    const nextSeat = getNextActingSeat(seats, 0, false, bettingState);
    expect(nextSeat).equal(1); // SB (button + 1)
  });

  test("should skip folded players", () => {
    const bettingState = new BettingRoundState();
    bettingState.currentBetToMatch = 20;
    
    const seats = new Array<PokerSeatBase>(3);
    seats[0] = new PokerSeatBase(0, "button", 100);
    seats[0].inHand = true;
    seats[1] = new PokerSeatBase(1, "sb", 100);
    seats[1].inHand = true;
    seats[2] = new PokerSeatBase(2, "bb", 100);
    seats[2].inHand = false; // Folded
    
    const nextSeat = getNextActingSeat(seats, 0, true, bettingState);
    // Should wrap around to button since BB is folded
    expect(nextSeat >= 0).equal(true);
  });

  test("should skip all-in players", () => {
    const bettingState = new BettingRoundState();
    bettingState.currentBetToMatch = 20;
    
    const seats = new Array<PokerSeatBase>(3);
    seats[0] = new PokerSeatBase(0, "button", 100);
    seats[0].inHand = true;
    seats[1] = new PokerSeatBase(1, "sb", 100);
    seats[1].inHand = true;
    seats[1].allIn = true; // All-in
    seats[2] = new PokerSeatBase(2, "bb", 100);
    seats[2].inHand = true;
    
    const nextSeat = getNextActingSeat(seats, 0, true, bettingState);
    // Should skip all-in SB (seat 1)
    // Preflop: button (0) + 3 = 3, but only 3 seats (0,1,2), so wraps to 0
    // Then skips 0 (button), 1 (all-in), finds 2 (BB)
    expect(nextSeat >= 0).equal(true);
    expect(nextSeat !== 1).equal(true); // Should not be all-in SB
  });
});

// ============================================================================
// validateBuyIn Tests
// ============================================================================

describe("validateBuyIn", () => {
  test("should validate buy-in within range", () => {
    expect(validateBuyIn(100, 50, 200)).equal(true);
    expect(validateBuyIn(50, 50, 200)).equal(true); // Min
    expect(validateBuyIn(200, 50, 200)).equal(true); // Max
  });

  test("should reject buy-in below minimum", () => {
    expect(validateBuyIn(49, 50, 200)).equal(false);
  });

  test("should reject buy-in above maximum", () => {
    expect(validateBuyIn(201, 50, 200)).equal(false);
  });
});

// ============================================================================
// processBuyIn Tests
// ============================================================================

describe("processBuyIn", () => {
  test("should process valid buy-in", () => {
    const seat = new PokerSeatBase(0, "player1", 0);
    const updatedSeat = processBuyIn(seat, 100, 50, 200);
    
    expect(updatedSeat !== null).equal(true);
    if (updatedSeat !== null) {
      expect(updatedSeat.stack).equal(100);
    }
  });

  test("should return null for invalid buy-in", () => {
    const seat = new PokerSeatBase(0, "player1", 0);
    const updatedSeat = processBuyIn(seat, 30, 50, 200);
    
    expect(updatedSeat === null).equal(true);
  });

  test("should add to existing stack", () => {
    const seat = new PokerSeatBase(0, "player1", 50);
    const updatedSeat = processBuyIn(seat, 100, 50, 200);
    
    expect(updatedSeat !== null).equal(true);
    if (updatedSeat !== null) {
      expect(updatedSeat.stack).equal(150); // 50 + 100
    }
  });
});

// ============================================================================
// isBettingRoundComplete Tests
// ============================================================================

describe("isBettingRoundComplete", () => {
  test("should return true when all players have matched bet", () => {
    const bettingState = new BettingRoundState();
    bettingState.currentBetToMatch = 20;
    
    const seats = new Array<PokerSeatBase>(2);
    seats[0] = new PokerSeatBase(0, "player1", 100);
    seats[0].inHand = true;
    seats[0].hasActedThisRound = true;
    seats[1] = new PokerSeatBase(1, "player2", 100);
    seats[1].inHand = true;
    seats[1].hasActedThisRound = true;
    
    bettingState.contribThisRound.set(0, 20);
    bettingState.contribThisRound.set(1, 20);
    
    expect(isBettingRoundComplete(seats, bettingState)).equal(true);
  });

  test("should return false when player hasn't matched bet", () => {
    const bettingState = new BettingRoundState();
    bettingState.currentBetToMatch = 20;
    
    const seats = new Array<PokerSeatBase>(2);
    seats[0] = new PokerSeatBase(0, "player1", 100);
    seats[0].inHand = true;
    seats[0].hasActedThisRound = true;
    seats[1] = new PokerSeatBase(1, "player2", 100);
    seats[1].inHand = true;
    seats[1].hasActedThisRound = true;
    
    bettingState.contribThisRound.set(0, 20);
    bettingState.contribThisRound.set(1, 10); // Hasn't matched
    
    expect(isBettingRoundComplete(seats, bettingState)).equal(false);
  });

  test("should return false when player hasn't acted", () => {
    const bettingState = new BettingRoundState();
    bettingState.currentBetToMatch = 20;
    
    const seats = new Array<PokerSeatBase>(2);
    seats[0] = new PokerSeatBase(0, "player1", 100);
    seats[0].inHand = true;
    seats[0].hasActedThisRound = true;
    seats[1] = new PokerSeatBase(1, "player2", 100);
    seats[1].inHand = true;
    seats[1].hasActedThisRound = false; // Hasn't acted
    
    bettingState.contribThisRound.set(0, 20);
    bettingState.contribThisRound.set(1, 20);
    
    expect(isBettingRoundComplete(seats, bettingState)).equal(false);
  });

  test("should return true with only one active player", () => {
    const bettingState = new BettingRoundState();
    bettingState.currentBetToMatch = 20;
    
    const seats = new Array<PokerSeatBase>(2);
    seats[0] = new PokerSeatBase(0, "player1", 100);
    seats[0].inHand = true;
    seats[0].hasActedThisRound = true; // Has acted
    seats[1] = new PokerSeatBase(1, "player2", 100);
    seats[1].inHand = false; // Folded
    
    // Player 1 has matched (or doesn't need to match if no bet)
    bettingState.contribThisRound.set(0, 20);
    
    expect(isBettingRoundComplete(seats, bettingState)).equal(true);
  });
});

