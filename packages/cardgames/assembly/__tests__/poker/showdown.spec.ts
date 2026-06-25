// @ts-nocheck
/**
 * Tests for poker showdown utilities
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import { Card, Suit, Rank, HandType } from "../../cards";
import {
  compareHandsShowdown,
  compareFiveCardHands,
  getPlayerHandRank,
  getPlayerBestHand,
  compareTwoHands
} from "../../poker/showdown";

// Helper function to create cards
function createCard(rank: string, suit: string): Card {
  return new Card(suit, rank);
}

// ============================================================================
// compareHandsShowdown Tests
// ============================================================================

describe("compareHandsShowdown", () => {
  test("should determine single winner with best hand", () => {
    // Player 0: Royal Flush
    const holeCards1 = new Array<Card>(2);
    holeCards1[0] = createCard(Rank.ACE, Suit.SPADES);
    holeCards1[1] = createCard(Rank.KING, Suit.SPADES);
    
    // Player 1: Pair of 2s (using different suits to avoid flush/straight)
    const holeCards2 = new Array<Card>(2);
    holeCards2[0] = createCard(Rank.TWO, Suit.HEARTS);
    holeCards2[1] = createCard(Rank.TWO, Suit.DIAMONDS);
    
    // Community: Q♠ J♠ 10♠ 9♠ 8♠ (completes royal flush for player 0)
    // For player 1, best hand is pair of 2s with Q, J, 10 kickers
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.QUEEN, Suit.SPADES);
    community[1] = createCard(Rank.JACK, Suit.SPADES);
    community[2] = createCard(Rank.TEN, Suit.SPADES);
    community[3] = createCard(Rank.NINE, Suit.SPADES);
    community[4] = createCard(Rank.EIGHT, Suit.SPADES);
    
    const holeCardsMap = new Map<i32, Card[]>();
    holeCardsMap.set(0, holeCards1);
    holeCardsMap.set(1, holeCards2);
    
    const result = compareHandsShowdown(holeCardsMap, community);
    
    expect(result.winners.length).equal(1);
    expect(result.winners[0]).equal(0); // Player 0 wins with royal flush
    expect(result.handRanks.has(0)).equal(true);
    expect(result.handRanks.has(1)).equal(true);
    const rank0 = result.handRanks.get(0);
    const rank1 = result.handRanks.get(1);
    expect(rank0.handType).equal(HandType.ROYAL_FLUSH);
    // Player 1's best 5-card hand from 2♥ 2♦ and Q♠ J♠ 10♠ 9♠ 8♠ is actually a straight flush (8♠ 9♠ 10♠ J♠ Q♠)
    // So we need to change the test to expect STRAIGHT_FLUSH instead of PAIR
    expect(rank1.handType).equal(HandType.STRAIGHT_FLUSH);
  });

  test("should handle ties", () => {
    // Both players have same pair of Aces with same kickers
    const holeCards1 = new Array<Card>(2);
    holeCards1[0] = createCard(Rank.ACE, Suit.SPADES);
    holeCards1[1] = createCard(Rank.ACE, Suit.HEARTS);
    
    const holeCards2 = new Array<Card>(2);
    holeCards2[0] = createCard(Rank.ACE, Suit.DIAMONDS);
    holeCards2[1] = createCard(Rank.ACE, Suit.CLUBS);
    
    // Community: K♥ Q♦ J♣ 10♥ 9♦ (mixed suits, no flush/straight possible)
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.KING, Suit.HEARTS);
    community[1] = createCard(Rank.QUEEN, Suit.DIAMONDS);
    community[2] = createCard(Rank.JACK, Suit.CLUBS);
    community[3] = createCard(Rank.TEN, Suit.HEARTS);
    community[4] = createCard(Rank.NINE, Suit.DIAMONDS);
    
    const holeCardsMap = new Map<i32, Card[]>();
    holeCardsMap.set(0, holeCards1);
    holeCardsMap.set(1, holeCards2);
    
    const result = compareHandsShowdown(holeCardsMap, community);
    
    // Both have same hand (pair of Aces with same kickers: K, Q, J)
    expect(result.winners.length).equal(2);
    if (result.winners.length >= 1) {
      expect(result.winners[0] === 0 || result.winners[0] === 1).equal(true);
    }
    if (result.winners.length >= 2) {
      expect(result.winners[1] === 0 || result.winners[1] === 1).equal(true);
    }
  });

  test("should handle multiple players", () => {
    // Player 0: Straight (5-6-7-8-9)
    const holeCards1 = new Array<Card>(2);
    holeCards1[0] = createCard(Rank.FIVE, Suit.HEARTS);
    holeCards1[1] = createCard(Rank.SIX, Suit.HEARTS);
    
    // Player 1: Flush (all spades)
    const holeCards2 = new Array<Card>(2);
    holeCards2[0] = createCard(Rank.TWO, Suit.SPADES);
    holeCards2[1] = createCard(Rank.THREE, Suit.SPADES);
    
    // Player 2: Pair of 2s
    const holeCards3 = new Array<Card>(2);
    holeCards3[0] = createCard(Rank.TWO, Suit.HEARTS);
    holeCards3[1] = createCard(Rank.TWO, Suit.DIAMONDS);
    
    // Community: 7♠ 8♠ 9♠ 10♠ 2♣
    // Player 0: 5♥ 6♥ 7♠ 8♠ 9♠ = Straight (5-6-7-8-9)
    // Player 1: 2♠ 3♠ 7♠ 8♠ 9♠ = Flush (all spades)
    // Player 2: 2♥ 2♦ 7♠ 8♠ 9♠ 10♠ 2♣ = Pair of 2s
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.SEVEN, Suit.SPADES);
    community[1] = createCard(Rank.EIGHT, Suit.SPADES);
    community[2] = createCard(Rank.NINE, Suit.SPADES);
    community[3] = createCard(Rank.TEN, Suit.SPADES);
    community[4] = createCard(Rank.TWO, Suit.CLUBS);
    
    const holeCardsMap = new Map<i32, Card[]>();
    holeCardsMap.set(0, holeCards1);
    holeCardsMap.set(1, holeCards2);
    holeCardsMap.set(2, holeCards3);
    
    const result = compareHandsShowdown(holeCardsMap, community);
    
    // Player 1 has flush (best), then player 0 has straight, then player 2 has pair
    expect(result.winners.length).equal(1);
    expect(result.winners[0]).equal(1); // Player 1 wins with flush
  });

  test("should return empty winners for no hands", () => {
    const holeCardsMap = new Map<i32, Card[]>();
    const community = new Array<Card>(5);
    
    const result = compareHandsShowdown(holeCardsMap, community);
    
    expect(result.winners.length).equal(0);
    expect(result.handRanks.size).equal(0);
  });
});

// ============================================================================
// compareFiveCardHands Tests
// ============================================================================

describe("compareFiveCardHands", () => {
  test("should compare 5-card hands", () => {
    // Player 1: Royal Flush
    const hand1 = new Array<Card>(5);
    hand1[0] = createCard(Rank.ACE, Suit.SPADES);
    hand1[1] = createCard(Rank.KING, Suit.SPADES);
    hand1[2] = createCard(Rank.QUEEN, Suit.SPADES);
    hand1[3] = createCard(Rank.JACK, Suit.SPADES);
    hand1[4] = createCard(Rank.TEN, Suit.SPADES);
    
    // Player 2: Pair
    const hand2 = new Array<Card>(5);
    hand2[0] = createCard(Rank.ACE, Suit.HEARTS);
    hand2[1] = createCard(Rank.ACE, Suit.DIAMONDS);
    hand2[2] = createCard(Rank.KING, Suit.HEARTS);
    hand2[3] = createCard(Rank.QUEEN, Suit.HEARTS);
    hand2[4] = createCard(Rank.JACK, Suit.HEARTS);
    
    const handsMap = new Map<i32, Card[]>();
    handsMap.set(0, hand1);
    handsMap.set(1, hand2);
    
    const result = compareFiveCardHands(handsMap);
    
    expect(result.winners.length).equal(1);
    expect(result.winners[0]).equal(0); // Player 1 wins
  });

  test("should skip invalid hands (not 5 cards)", () => {
    const hand1 = new Array<Card>(5);
    hand1[0] = createCard(Rank.ACE, Suit.SPADES);
    hand1[1] = createCard(Rank.KING, Suit.SPADES);
    hand1[2] = createCard(Rank.QUEEN, Suit.SPADES);
    hand1[3] = createCard(Rank.JACK, Suit.SPADES);
    hand1[4] = createCard(Rank.TEN, Suit.SPADES);
    
    const hand2 = new Array<Card>(2); // Invalid: only 2 cards
    hand2[0] = createCard(Rank.ACE, Suit.HEARTS);
    hand2[1] = createCard(Rank.KING, Suit.HEARTS);
    
    const handsMap = new Map<i32, Card[]>();
    handsMap.set(0, hand1);
    handsMap.set(1, hand2);
    
    const result = compareFiveCardHands(handsMap);
    
    // Only player 1 should be evaluated
    expect(result.winners.length).equal(1);
    expect(result.winners[0]).equal(0);
    expect(result.handRanks.has(1)).equal(false);
  });
});

// ============================================================================
// getPlayerHandRank Tests
// ============================================================================

describe("getPlayerHandRank", () => {
  test("should return hand rank for player", () => {
    const holeCards = new Array<Card>(2);
    holeCards[0] = createCard(Rank.ACE, Suit.SPADES);
    holeCards[1] = createCard(Rank.ACE, Suit.HEARTS);
    
    // Community cards that don't create flush/straight (mixed suits, no consecutive ranks)
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.KING, Suit.HEARTS);
    community[1] = createCard(Rank.QUEEN, Suit.DIAMONDS);
    community[2] = createCard(Rank.JACK, Suit.CLUBS);
    community[3] = createCard(Rank.SEVEN, Suit.HEARTS); // Changed from TEN to break straight
    community[4] = createCard(Rank.THREE, Suit.DIAMONDS); // Changed from NINE to break straight
    
    const rank = getPlayerHandRank(holeCards, community);
    
    expect(rank.handType).equal(HandType.PAIR); // Pair of Aces
  });
});

// ============================================================================
// getPlayerBestHand Tests
// ============================================================================

describe("getPlayerBestHand", () => {
  test("should return best 5-card hand", () => {
    const holeCards = new Array<Card>(2);
    holeCards[0] = createCard(Rank.ACE, Suit.SPADES);
    holeCards[1] = createCard(Rank.KING, Suit.SPADES);
    
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.QUEEN, Suit.SPADES);
    community[1] = createCard(Rank.JACK, Suit.SPADES);
    community[2] = createCard(Rank.TEN, Suit.SPADES);
    community[3] = createCard(Rank.NINE, Suit.HEARTS);
    community[4] = createCard(Rank.EIGHT, Suit.HEARTS);
    
    const bestHand = getPlayerBestHand(holeCards, community);
    
    expect(bestHand.length).equal(5);
    // Should be the straight: A♠ K♠ Q♠ J♠ 10♠
  });
});

// ============================================================================
// compareTwoHands Tests
// ============================================================================

describe("compareTwoHands", () => {
  test("should return 1 when first hand wins", () => {
    // Player 1: Royal Flush
    const holeCards1 = new Array<Card>(2);
    holeCards1[0] = createCard(Rank.ACE, Suit.SPADES);
    holeCards1[1] = createCard(Rank.KING, Suit.SPADES);
    
    // Player 2: Pair
    const holeCards2 = new Array<Card>(2);
    holeCards2[0] = createCard(Rank.TWO, Suit.HEARTS);
    holeCards2[1] = createCard(Rank.TWO, Suit.DIAMONDS);
    
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.QUEEN, Suit.SPADES);
    community[1] = createCard(Rank.JACK, Suit.SPADES);
    community[2] = createCard(Rank.TEN, Suit.SPADES);
    community[3] = createCard(Rank.NINE, Suit.SPADES);
    community[4] = createCard(Rank.EIGHT, Suit.SPADES);
    
    const result = compareTwoHands(holeCards1, holeCards2, community);
    expect(result).equal(1); // Player 1 wins
  });

  test("should return -1 when second hand wins", () => {
    // Player 1: Pair
    const holeCards1 = new Array<Card>(2);
    holeCards1[0] = createCard(Rank.TWO, Suit.HEARTS);
    holeCards1[1] = createCard(Rank.TWO, Suit.DIAMONDS);
    
    // Player 2: Royal Flush
    const holeCards2 = new Array<Card>(2);
    holeCards2[0] = createCard(Rank.ACE, Suit.SPADES);
    holeCards2[1] = createCard(Rank.KING, Suit.SPADES);
    
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.QUEEN, Suit.SPADES);
    community[1] = createCard(Rank.JACK, Suit.SPADES);
    community[2] = createCard(Rank.TEN, Suit.SPADES);
    community[3] = createCard(Rank.NINE, Suit.SPADES);
    community[4] = createCard(Rank.EIGHT, Suit.SPADES);
    
    const result = compareTwoHands(holeCards1, holeCards2, community);
    expect(result).equal(-1); // Player 2 wins
  });

  test("should return 0 when hands tie", () => {
    // Both players have same pair of Aces with same kickers
    const holeCards1 = new Array<Card>(2);
    holeCards1[0] = createCard(Rank.ACE, Suit.SPADES);
    holeCards1[1] = createCard(Rank.ACE, Suit.HEARTS);
    
    const holeCards2 = new Array<Card>(2);
    holeCards2[0] = createCard(Rank.ACE, Suit.DIAMONDS);
    holeCards2[1] = createCard(Rank.ACE, Suit.CLUBS);
    
    // Community cards that don't create flush/straight
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.KING, Suit.HEARTS);
    community[1] = createCard(Rank.QUEEN, Suit.DIAMONDS);
    community[2] = createCard(Rank.JACK, Suit.CLUBS);
    community[3] = createCard(Rank.TEN, Suit.HEARTS);
    community[4] = createCard(Rank.NINE, Suit.DIAMONDS);
    
    const result = compareTwoHands(holeCards1, holeCards2, community);
    expect(result).equal(0); // Tie - both have pair of Aces with same kickers
  });
});

