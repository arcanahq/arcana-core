// @ts-nocheck
/**
 * Tests for Stud Poker showdown evaluator
 * 
 * Supports both 5-card and 7-card stud variants
 * In stud poker, there are no community cards - each player has their own complete hand
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import { Card, Suit, Rank, HandType } from "../../cards";
import { StudShowdownEvaluator } from "../../poker/stud_evaluator";

// Helper function to create cards
function createCard(rank: string, suit: string): Card {
  return new Card(suit, rank);
}

describe("StudShowdownEvaluator", () => {
  describe("5-Card Stud", () => {
    test("should evaluate 5-card hands directly", () => {
      const evaluator = new StudShowdownEvaluator();
      
      // Player has 5 cards: A♠ K♠ Q♠ J♠ 10♠ (Royal Flush)
      const fiveCards = new Array<Card>(5);
      fiveCards[0] = createCard(Rank.ACE, Suit.SPADES);
      fiveCards[1] = createCard(Rank.KING, Suit.SPADES);
      fiveCards[2] = createCard(Rank.QUEEN, Suit.SPADES);
      fiveCards[3] = createCard(Rank.JACK, Suit.SPADES);
      fiveCards[4] = createCard(Rank.TEN, Suit.SPADES);
      
      const rank = evaluator.evaluateHand(fiveCards, new Array<Card>(0));
      
      expect(rank.handType).equal(HandType.ROYAL_FLUSH);
    });

    test("should use all 5 cards for best hand", () => {
      const evaluator = new StudShowdownEvaluator();
      
      const fiveCards = new Array<Card>(5);
      fiveCards[0] = createCard(Rank.ACE, Suit.SPADES);
      fiveCards[1] = createCard(Rank.ACE, Suit.HEARTS);
      fiveCards[2] = createCard(Rank.KING, Suit.SPADES);
      fiveCards[3] = createCard(Rank.QUEEN, Suit.SPADES);
      fiveCards[4] = createCard(Rank.JACK, Suit.SPADES);
      
      const bestHand = evaluator.getBestFiveCards(fiveCards, new Array<Card>(0));
      
      expect(bestHand.length).equal(5);
      // Should return all 5 cards
    });

    test("should compare multiple 5-card stud hands", () => {
      const evaluator = new StudShowdownEvaluator();
      
      // Player 0: Pair of Aces
      const hand0 = new Array<Card>(5);
      hand0[0] = createCard(Rank.ACE, Suit.SPADES);
      hand0[1] = createCard(Rank.ACE, Suit.HEARTS);
      hand0[2] = createCard(Rank.KING, Suit.SPADES);
      hand0[3] = createCard(Rank.QUEEN, Suit.SPADES);
      hand0[4] = createCard(Rank.JACK, Suit.SPADES);
      
      // Player 1: Two Pair
      const hand1 = new Array<Card>(5);
      hand1[0] = createCard(Rank.ACE, Suit.DIAMONDS);
      hand1[1] = createCard(Rank.ACE, Suit.CLUBS);
      hand1[2] = createCard(Rank.KING, Suit.HEARTS);
      hand1[3] = createCard(Rank.KING, Suit.DIAMONDS);
      hand1[4] = createCard(Rank.QUEEN, Suit.HEARTS);
      
      const holeCardsMap = new Map<i32, Card[]>();
      holeCardsMap.set(0, hand0);
      holeCardsMap.set(1, hand1);
      
      const result = evaluator.compareHandsShowdown(holeCardsMap, new Array<Card>(0));
      
      // Player 1 should win with Two Pair
      expect(result.winners.length).equal(1);
      expect(result.winners[0]).equal(1);
    });
  });

  describe("7-Card Stud", () => {
    test("should choose best 5 from 7 cards", () => {
      const evaluator = new StudShowdownEvaluator();
      
      // 7 cards: A♠ K♠ Q♠ J♠ 10♠ 9♠ 8♠
      // Best 5: A♠ K♠ Q♠ J♠ 10♠ (Royal Flush)
      const sevenCards = new Array<Card>(7);
      sevenCards[0] = createCard(Rank.ACE, Suit.SPADES);
      sevenCards[1] = createCard(Rank.KING, Suit.SPADES);
      sevenCards[2] = createCard(Rank.QUEEN, Suit.SPADES);
      sevenCards[3] = createCard(Rank.JACK, Suit.SPADES);
      sevenCards[4] = createCard(Rank.TEN, Suit.SPADES);
      sevenCards[5] = createCard(Rank.NINE, Suit.SPADES);
      sevenCards[6] = createCard(Rank.EIGHT, Suit.SPADES);
      
      const rank = evaluator.evaluateHand(sevenCards, new Array<Card>(0));
      
      expect(rank.handType).equal(HandType.ROYAL_FLUSH);
    });

    test("should return best 5 cards from 7", () => {
      const evaluator = new StudShowdownEvaluator();
      
      // 7 cards with best 5 being a flush
      const sevenCards = new Array<Card>(7);
      sevenCards[0] = createCard(Rank.ACE, Suit.SPADES);
      sevenCards[1] = createCard(Rank.KING, Suit.SPADES);
      sevenCards[2] = createCard(Rank.QUEEN, Suit.SPADES);
      sevenCards[3] = createCard(Rank.JACK, Suit.SPADES);
      sevenCards[4] = createCard(Rank.TEN, Suit.SPADES);
      sevenCards[5] = createCard(Rank.NINE, Suit.HEARTS); // Different suit
      sevenCards[6] = createCard(Rank.EIGHT, Suit.HEARTS); // Different suit
      
      const bestHand = evaluator.getBestFiveCards(sevenCards, new Array<Card>(0));
      
      expect(bestHand.length).equal(5);
      // Should be the 5 spades (flush)
    });

    test("should compare multiple 7-card stud hands", () => {
      const evaluator = new StudShowdownEvaluator();
      
      // Player 0: 7 cards, best 5 is a flush (A♠ K♠ Q♠ J♠ 10♠)
      const hand0 = new Array<Card>(7);
      hand0[0] = createCard(Rank.ACE, Suit.SPADES);
      hand0[1] = createCard(Rank.KING, Suit.SPADES);
      hand0[2] = createCard(Rank.QUEEN, Suit.SPADES);
      hand0[3] = createCard(Rank.JACK, Suit.SPADES);
      hand0[4] = createCard(Rank.TEN, Suit.SPADES);
      hand0[5] = createCard(Rank.NINE, Suit.HEARTS);
      hand0[6] = createCard(Rank.EIGHT, Suit.HEARTS);
      
      // Player 1: 7 cards, best 5 is a straight (A♥ K♥ Q♥ J♥ 10♥ - but this is also a flush!)
      // Use a non-flush straight instead
      const hand1 = new Array<Card>(7);
      hand1[0] = createCard(Rank.ACE, Suit.HEARTS);
      hand1[1] = createCard(Rank.KING, Suit.DIAMONDS);
      hand1[2] = createCard(Rank.QUEEN, Suit.CLUBS);
      hand1[3] = createCard(Rank.JACK, Suit.HEARTS);
      hand1[4] = createCard(Rank.TEN, Suit.DIAMONDS);
      hand1[5] = createCard(Rank.NINE, Suit.CLUBS);
      hand1[6] = createCard(Rank.EIGHT, Suit.HEARTS);
      
      const holeCardsMap = new Map<i32, Card[]>();
      holeCardsMap.set(0, hand0);
      holeCardsMap.set(1, hand1);
      
      const result = evaluator.compareHandsShowdown(holeCardsMap, new Array<Card>(0));
      
      // Player 0 should win with Flush (beats Straight)
      expect(result.winners.length).equal(1);
      expect(result.winners[0]).equal(0);
    });

    test("should handle ties in 7-card stud", () => {
      const evaluator = new StudShowdownEvaluator();
      
      // Both players have same best 5-card hand
      const hand0 = new Array<Card>(7);
      hand0[0] = createCard(Rank.ACE, Suit.SPADES);
      hand0[1] = createCard(Rank.ACE, Suit.HEARTS);
      hand0[2] = createCard(Rank.KING, Suit.SPADES);
      hand0[3] = createCard(Rank.QUEEN, Suit.SPADES);
      hand0[4] = createCard(Rank.JACK, Suit.SPADES);
      hand0[5] = createCard(Rank.TEN, Suit.HEARTS);
      hand0[6] = createCard(Rank.NINE, Suit.HEARTS);
      
      const hand1 = new Array<Card>(7);
      hand1[0] = createCard(Rank.ACE, Suit.DIAMONDS);
      hand1[1] = createCard(Rank.ACE, Suit.CLUBS);
      hand1[2] = createCard(Rank.KING, Suit.HEARTS);
      hand1[3] = createCard(Rank.QUEEN, Suit.HEARTS);
      hand1[4] = createCard(Rank.JACK, Suit.HEARTS);
      hand1[5] = createCard(Rank.TEN, Suit.DIAMONDS);
      hand1[6] = createCard(Rank.NINE, Suit.DIAMONDS);
      
      const holeCardsMap = new Map<i32, Card[]>();
      holeCardsMap.set(0, hand0);
      holeCardsMap.set(1, hand1);
      
      const result = evaluator.compareHandsShowdown(holeCardsMap, new Array<Card>(0));
      
      // Both have pair of Aces with same kickers
      expect(result.winners.length).equal(2);
    });
  });
});

