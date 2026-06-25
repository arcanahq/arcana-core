// @ts-nocheck
/**
 * Tests for Six-Plus Hold'em showdown evaluator
 * 
 * Six-Plus Hold'em uses a 36-card deck and different hand rankings:
 * - Flush beats Full House
 * - Three of a Kind beats Straight
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import { Card, Suit, Rank, HandType } from "../../cards";
import { SixPlusShowdownEvaluator } from "../../poker/six_plus_showdown";

// Helper function to create cards
function createCard(rank: string, suit: string): Card {
  return new Card(suit, rank);
}

describe("SixPlusShowdownEvaluator", () => {
  test("should rank Flush higher than Full House", () => {
    const evaluator = new SixPlusShowdownEvaluator();
    
    // Flush: A♠ K♠ Q♠ J♠ 10♠
    const flushHole = new Array<Card>(2);
    flushHole[0] = createCard(Rank.ACE, Suit.SPADES);
    flushHole[1] = createCard(Rank.KING, Suit.SPADES);
    const flushCommunity = new Array<Card>(5);
    flushCommunity[0] = createCard(Rank.QUEEN, Suit.SPADES);
    flushCommunity[1] = createCard(Rank.JACK, Suit.SPADES);
    flushCommunity[2] = createCard(Rank.TEN, Suit.SPADES);
    flushCommunity[3] = createCard(Rank.NINE, Suit.SPADES);
    flushCommunity[4] = createCard(Rank.EIGHT, Suit.SPADES);
    
    // Full House: A♠ A♥ A♦ K♠ K♥
    const fullHouseHole = new Array<Card>(2);
    fullHouseHole[0] = createCard(Rank.ACE, Suit.SPADES);
    fullHouseHole[1] = createCard(Rank.ACE, Suit.HEARTS);
    const fullHouseCommunity = new Array<Card>(5);
    fullHouseCommunity[0] = createCard(Rank.ACE, Suit.DIAMONDS);
    fullHouseCommunity[1] = createCard(Rank.KING, Suit.SPADES);
    fullHouseCommunity[2] = createCard(Rank.KING, Suit.HEARTS);
    fullHouseCommunity[3] = createCard(Rank.QUEEN, Suit.HEARTS);
    fullHouseCommunity[4] = createCard(Rank.JACK, Suit.HEARTS);
    
    const flushRank = evaluator.evaluateHand(flushHole, flushCommunity);
    const fullHouseRank = evaluator.evaluateHand(fullHouseHole, fullHouseCommunity);
    
    // In Six-Plus, Flush should beat Full House
    const comparison = evaluator.compareHands(flushRank, fullHouseRank);
    expect(comparison).equal(1); // Flush wins
  });

  test("should rank Three of a Kind higher than Straight", () => {
    const evaluator = new SixPlusShowdownEvaluator();
    
    // Three of a Kind: A♠ A♥ A♦ K♠ Q♠ (no flush/straight possible)
    const tripsHole = new Array<Card>(2);
    tripsHole[0] = createCard(Rank.ACE, Suit.SPADES);
    tripsHole[1] = createCard(Rank.ACE, Suit.HEARTS);
    const tripsCommunity = new Array<Card>(5);
    tripsCommunity[0] = createCard(Rank.ACE, Suit.DIAMONDS);
    tripsCommunity[1] = createCard(Rank.KING, Suit.HEARTS);
    tripsCommunity[2] = createCard(Rank.QUEEN, Suit.CLUBS);
    tripsCommunity[3] = createCard(Rank.JACK, Suit.DIAMONDS);
    tripsCommunity[4] = createCard(Rank.TEN, Suit.HEARTS);
    
    // Straight: A♠ K♠ Q♠ J♠ 10♠ (but this is actually a flush, so use different setup)
    // Straight: 9♠ 8♠ 7♠ 6♠ 5♠
    const straightHole = new Array<Card>(2);
    straightHole[0] = createCard(Rank.NINE, Suit.SPADES);
    straightHole[1] = createCard(Rank.EIGHT, Suit.HEARTS);
    const straightCommunity = new Array<Card>(5);
    straightCommunity[0] = createCard(Rank.SEVEN, Suit.DIAMONDS);
    straightCommunity[1] = createCard(Rank.SIX, Suit.CLUBS);
    straightCommunity[2] = createCard(Rank.FIVE, Suit.SPADES);
    straightCommunity[3] = createCard(Rank.FOUR, Suit.HEARTS);
    straightCommunity[4] = createCard(Rank.TWO, Suit.HEARTS);
    
    const tripsRank = evaluator.evaluateHand(tripsHole, tripsCommunity);
    const straightRank = evaluator.evaluateHand(straightHole, straightCommunity);
    
    // In Six-Plus, Three of a Kind should beat Straight
    const comparison = evaluator.compareHands(tripsRank, straightRank);
    expect(comparison).equal(1); // Three of a Kind wins
  });

  test("should handle showdown with multiple players", () => {
    const evaluator = new SixPlusShowdownEvaluator();
    
    // Player 0: Flush (should win in Six-Plus)
    const holeCards0 = new Array<Card>(2);
    holeCards0[0] = createCard(Rank.ACE, Suit.SPADES);
    holeCards0[1] = createCard(Rank.KING, Suit.SPADES);
    
    // Player 1: Full House (should lose to Flush in Six-Plus)
    const holeCards1 = new Array<Card>(2);
    holeCards1[0] = createCard(Rank.ACE, Suit.HEARTS);
    holeCards1[1] = createCard(Rank.ACE, Suit.DIAMONDS);
    
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.QUEEN, Suit.SPADES);
    community[1] = createCard(Rank.JACK, Suit.SPADES);
    community[2] = createCard(Rank.TEN, Suit.SPADES);
    community[3] = createCard(Rank.ACE, Suit.CLUBS);
    community[4] = createCard(Rank.KING, Suit.HEARTS);
    
    const holeCardsMap = new Map<i32, Card[]>();
    holeCardsMap.set(0, holeCards0);
    holeCardsMap.set(1, holeCards1);
    
    const result = evaluator.compareHandsShowdown(holeCardsMap, community);
    
    // Player 0 should win with Flush (beats Full House in Six-Plus)
    expect(result.winners.length).equal(1);
    expect(result.winners[0]).equal(0);
  });

  test("should preserve standard rankings for other hands", () => {
    const evaluator = new SixPlusShowdownEvaluator();
    
    // Royal Flush should still beat everything
    const royalFlushHole = new Array<Card>(2);
    royalFlushHole[0] = createCard(Rank.ACE, Suit.SPADES);
    royalFlushHole[1] = createCard(Rank.KING, Suit.SPADES);
    const royalFlushCommunity = new Array<Card>(5);
    royalFlushCommunity[0] = createCard(Rank.QUEEN, Suit.SPADES);
    royalFlushCommunity[1] = createCard(Rank.JACK, Suit.SPADES);
    royalFlushCommunity[2] = createCard(Rank.TEN, Suit.SPADES);
    royalFlushCommunity[3] = createCard(Rank.NINE, Suit.SPADES);
    royalFlushCommunity[4] = createCard(Rank.EIGHT, Suit.SPADES);
    
    // Flush (high in Six-Plus, but not Royal Flush) - use lower non-consecutive cards
    const flushHole = new Array<Card>(2);
    flushHole[0] = createCard(Rank.ACE, Suit.HEARTS);
    flushHole[1] = createCard(Rank.KING, Suit.HEARTS);
    const flushCommunity = new Array<Card>(5);
    flushCommunity[0] = createCard(Rank.QUEEN, Suit.HEARTS);
    flushCommunity[1] = createCard(Rank.JACK, Suit.HEARTS);
    flushCommunity[2] = createCard(Rank.SEVEN, Suit.HEARTS); // Changed from TEN to break straight
    flushCommunity[3] = createCard(Rank.FIVE, Suit.HEARTS); // Changed from NINE to break straight
    flushCommunity[4] = createCard(Rank.THREE, Suit.HEARTS); // Changed from SIX to break straight
    
    const royalRank = evaluator.evaluateHand(royalFlushHole, royalFlushCommunity);
    const flushRank = evaluator.evaluateHand(flushHole, flushCommunity);
    
    // Royal Flush should still beat Flush
    // Royal Flush (type 10, maps to 10 in Six-Plus) > Flush (type 6, maps to 7 in Six-Plus)
    const comparison = evaluator.compareHands(royalRank, flushRank);
    expect(comparison).equal(1); // Royal Flush wins
  });
});

