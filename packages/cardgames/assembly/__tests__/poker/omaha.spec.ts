// @ts-nocheck
/**
 * Tests for Omaha Poker showdown evaluator
 * 
 * In Omaha, players receive 4 hole cards and must use exactly 2 of them
 * combined with exactly 3 community cards to make their best 5-card hand.
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import { Card, Suit, Rank, HandType } from "../../cards";
import { OmahaShowdownEvaluator } from "../../poker/omaha_evaluator";

// Helper function to create cards
function createCard(rank: string, suit: string): Card {
  return new Card(suit, rank);
}

describe("OmahaShowdownEvaluator", () => {
  test("should require exactly 2 hole cards and 3 community cards", () => {
    const evaluator = new OmahaShowdownEvaluator();
    
    // 4 hole cards
    const holeCards = new Array<Card>(4);
    holeCards[0] = createCard(Rank.ACE, Suit.SPADES);
    holeCards[1] = createCard(Rank.ACE, Suit.HEARTS);
    holeCards[2] = createCard(Rank.SEVEN, Suit.SPADES);
    holeCards[3] = createCard(Rank.SIX, Suit.HEARTS);
    
    // 5 community cards (mixed suits and non-consecutive ranks to avoid flush/straight)
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.KING, Suit.DIAMONDS);
    community[1] = createCard(Rank.QUEEN, Suit.CLUBS);
    community[2] = createCard(Rank.JACK, Suit.HEARTS);
    community[3] = createCard(Rank.NINE, Suit.DIAMONDS);
    community[4] = createCard(Rank.EIGHT, Suit.CLUBS);
    
    const rank = evaluator.evaluateHand(holeCards, community);
    
    // Should evaluate using best combination of 2 hole + 3 community
    // Best would be A♠ A♥ + K♦ Q♣ J♥ = Pair of Aces with K, Q, J kickers
    expect(rank.handType).equal(HandType.PAIR);
  });

  test("should find best combination of 2 hole + 3 community", () => {
    const evaluator = new OmahaShowdownEvaluator();
    
    // Hole cards: A♠ K♠ Q♥ J♥
    const holeCards = new Array<Card>(4);
    holeCards[0] = createCard(Rank.ACE, Suit.SPADES);
    holeCards[1] = createCard(Rank.KING, Suit.SPADES);
    holeCards[2] = createCard(Rank.QUEEN, Suit.HEARTS);
    holeCards[3] = createCard(Rank.JACK, Suit.HEARTS);
    
    // Community: 10♠ 9♠ 8♠ 7♠ 6♠ (all spades)
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.TEN, Suit.SPADES);
    community[1] = createCard(Rank.NINE, Suit.SPADES);
    community[2] = createCard(Rank.EIGHT, Suit.SPADES);
    community[3] = createCard(Rank.SEVEN, Suit.SPADES);
    community[4] = createCard(Rank.SIX, Suit.SPADES);
    
    // Best combination: A♠ K♠ + 10♠ 9♠ 8♠ = Flush (A♠ K♠ 10♠ 9♠ 8♠)
    const rank = evaluator.evaluateHand(holeCards, community);
    
    expect(rank.handType).equal(HandType.FLUSH);
  });

  test("should return best 5 cards from 2 hole + 3 community", () => {
    const evaluator = new OmahaShowdownEvaluator();
    
    const holeCards = new Array<Card>(4);
    holeCards[0] = createCard(Rank.ACE, Suit.SPADES);
    holeCards[1] = createCard(Rank.KING, Suit.SPADES);
    holeCards[2] = createCard(Rank.QUEEN, Suit.HEARTS);
    holeCards[3] = createCard(Rank.JACK, Suit.HEARTS);
    
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.TEN, Suit.SPADES);
    community[1] = createCard(Rank.NINE, Suit.SPADES);
    community[2] = createCard(Rank.EIGHT, Suit.SPADES);
    community[3] = createCard(Rank.SEVEN, Suit.HEARTS);
    community[4] = createCard(Rank.SIX, Suit.HEARTS);
    
    const bestHand = evaluator.getBestFiveCards(holeCards, community);
    
    expect(bestHand.length).equal(5);
    // Should be A♠ K♠ 10♠ 9♠ 8♠ (flush) or A♠ K♠ Q♥ J♥ 10♠ (straight)
  });

  test("should compare multiple Omaha hands", () => {
    const evaluator = new OmahaShowdownEvaluator();
    
    // Player 0: 4 hole cards that can make a flush
    const holeCards0 = new Array<Card>(4);
    holeCards0[0] = createCard(Rank.ACE, Suit.SPADES);
    holeCards0[1] = createCard(Rank.KING, Suit.SPADES);
    holeCards0[2] = createCard(Rank.QUEEN, Suit.HEARTS);
    holeCards0[3] = createCard(Rank.JACK, Suit.HEARTS);
    
    // Player 1: 4 hole cards that can make a straight
    const holeCards1 = new Array<Card>(4);
    holeCards1[0] = createCard(Rank.ACE, Suit.HEARTS);
    holeCards1[1] = createCard(Rank.KING, Suit.HEARTS);
    holeCards1[2] = createCard(Rank.QUEEN, Suit.DIAMONDS);
    holeCards1[3] = createCard(Rank.JACK, Suit.DIAMONDS);
    
    // Community: 10♠ 9♠ 8♠ 7♠ 6♠
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.TEN, Suit.SPADES);
    community[1] = createCard(Rank.NINE, Suit.SPADES);
    community[2] = createCard(Rank.EIGHT, Suit.SPADES);
    community[3] = createCard(Rank.SEVEN, Suit.SPADES);
    community[4] = createCard(Rank.SIX, Suit.SPADES);
    
    const holeCardsMap = new Map<i32, Card[]>();
    holeCardsMap.set(0, holeCards0);
    holeCardsMap.set(1, holeCards1);
    
    const result = evaluator.compareHandsShowdown(holeCardsMap, community);
    
    // Player 0 should win with Flush (A♠ K♠ + 10♠ 9♠ 8♠)
    expect(result.winners.length).equal(1);
    expect(result.winners[0]).equal(0);
  });

  test("should handle full house in Omaha", () => {
    const evaluator = new OmahaShowdownEvaluator();
    
    // Hole cards: A♠ A♥ K♠ Q♠ (two Aces, one King, one Queen)
    const holeCards = new Array<Card>(4);
    holeCards[0] = createCard(Rank.ACE, Suit.SPADES);
    holeCards[1] = createCard(Rank.ACE, Suit.HEARTS);
    holeCards[2] = createCard(Rank.KING, Suit.SPADES);
    holeCards[3] = createCard(Rank.QUEEN, Suit.SPADES);
    
    // Community: A♦ K♦ K♣ J♠ 7♠ (one Ace, two Kings, mixed suits to avoid flush/straight)
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.ACE, Suit.DIAMONDS);
    community[1] = createCard(Rank.KING, Suit.DIAMONDS);
    community[2] = createCard(Rank.KING, Suit.CLUBS); // Second King for full house
    community[3] = createCard(Rank.JACK, Suit.CLUBS);
    community[4] = createCard(Rank.SEVEN, Suit.HEARTS); // Non-consecutive to break straight
    
    // Best: A♠ A♥ (hole) + A♦ K♦ K♣ (community) = Full House (Aces over Kings)
    const rank = evaluator.evaluateHand(holeCards, community);
    
    expect(rank.handType).equal(HandType.FULL_HOUSE);
  });

  test("should handle invalid hand structure gracefully", () => {
    const evaluator = new OmahaShowdownEvaluator();
    
    // Wrong number of hole cards
    const wrongHole = new Array<Card>(2);
    wrongHole[0] = createCard(Rank.ACE, Suit.SPADES);
    wrongHole[1] = createCard(Rank.KING, Suit.SPADES);
    
    const community = new Array<Card>(5);
    community[0] = createCard(Rank.QUEEN, Suit.SPADES);
    community[1] = createCard(Rank.JACK, Suit.SPADES);
    community[2] = createCard(Rank.TEN, Suit.SPADES);
    community[3] = createCard(Rank.NINE, Suit.SPADES);
    community[4] = createCard(Rank.EIGHT, Suit.SPADES);
    
    const rank = evaluator.evaluateHand(wrongHole, community);
    
    // Should return high card as fallback
    expect(rank.handType).equal(HandType.HIGH_CARD);
  });
});

