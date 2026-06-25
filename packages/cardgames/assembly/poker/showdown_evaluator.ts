// @ts-nocheck
/**
 * Showdown Evaluator Interface
 * 
 * Abstract interface for evaluating poker showdowns.
 * Allows different implementations for different poker variants
 * (e.g., standard Hold'em, Six-plus Hold'em, etc.)
 */

import { Card, HandRank } from "../cards";

/**
 * Result of a showdown comparison
 */
export class ShowdownResult {
  winners: i32[]; // Array of seat IDs that tied for the win
  handRanks: Map<i32, HandRank>; // Map of seat ID to their hand rank
  bestFiveCards: Map<i32, Card[]>; // Map of seat ID to their best 5-card hand
  
  constructor(
    winners: i32[],
    handRanks: Map<i32, HandRank>,
    bestFiveCards: Map<i32, Card[]>
  ) {
    this.winners = winners;
    this.handRanks = handRanks;
    this.bestFiveCards = bestFiveCards;
  }
}

/**
 * Abstract interface for showdown evaluation
 * Implement this for different poker variants
 * 
 * This interface is flexible enough to support:
 * - Hold'em variants (Texas Hold'em, Six-Plus, etc.) - uses community cards
 * - Stud variants (5-card, 7-card) - no community cards, all cards in holeCards
 * - Omaha variants - must use specific number of hole cards
 * - Lowball variants - lowest hand wins
 */
export abstract class ShowdownEvaluator {
  /**
   * Evaluate a single player's hand from hole cards and community cards
   * 
   * For Hold'em: holeCards = 2 cards, communityCards = 5 cards
   * For Stud: holeCards = 5 or 7 cards, communityCards = [] (empty)
   * For Omaha: holeCards = 4 cards, communityCards = 5 cards (must use exactly 2 hole cards)
   * 
   * @param holeCards Player's hole cards (or all cards for stud variants)
   * @param communityCards Community cards (empty for stud variants)
   * @returns HandRank for the player's best hand
   */
  abstract evaluateHand(holeCards: Card[], communityCards: Card[]): HandRank;
  
  /**
   * Get the best 5-card hand from hole cards and community cards
   * @param holeCards Player's hole cards
   * @param communityCards Community cards
   * @returns Best 5-card hand
   */
  abstract getBestFiveCards(holeCards: Card[], communityCards: Card[]): Card[];
  
  /**
   * Compare two hand ranks
   * @param hand1 First hand rank
   * @param hand2 Second hand rank
   * @returns -1 if hand1 < hand2, 0 if equal, 1 if hand1 > hand2
   */
  abstract compareHands(hand1: HandRank, hand2: HandRank): i32;
  
  /**
   * Compare multiple poker hands and determine winners
   * @param holeCardsMap Map of seat ID to their hole cards
   * @param communityCards Community cards
   * @returns ShowdownResult with winners, hand ranks, and best 5-card hands
   */
  compareHandsShowdown(
    holeCardsMap: Map<i32, Card[]>,
    communityCards: Card[]
  ): ShowdownResult {
    const handRanks = new Map<i32, HandRank>();
    const bestFiveCards = new Map<i32, Card[]>();
    const winners = new Array<i32>(0);
    
    // Evaluate each player's hand
    const seatIds = holeCardsMap.keys();
    for (let i = 0; i < seatIds.length; i++) {
      const seatId = seatIds[i];
      const holeCards = holeCardsMap.get(seatId);
      
      if (holeCards.length === 0) {
        continue; // Skip empty hands
      }
      
      // Evaluate hand using the abstract method
      const handRank = this.evaluateHand(holeCards, communityCards);
      handRanks.set(seatId, handRank);
      
      // Get best 5-card hand using the abstract method
      const bestFive = this.getBestFiveCards(holeCards, communityCards);
      bestFiveCards.set(seatId, bestFive);
    }
    
    if (handRanks.size === 0) {
      return new ShowdownResult(winners, handRanks, bestFiveCards);
    }
    
    // Find the best hand(s)
    let bestRank: HandRank | null = null;
    const seatIdsForComparison = handRanks.keys();
    
    for (let i = 0; i < seatIdsForComparison.length; i++) {
      const seatId = seatIdsForComparison[i];
      const rank = handRanks.get(seatId);
      
      if (bestRank === null) {
        bestRank = rank;
        winners.push(seatId);
      } else {
        const comparison = this.compareHands(rank, bestRank);
        if (comparison > 0) {
          // New best hand
          bestRank = rank;
          winners.length = 0;
          winners.push(seatId);
        } else if (comparison === 0) {
          // Tie
          winners.push(seatId);
        }
      }
    }
    
    return new ShowdownResult(winners, handRanks, bestFiveCards);
  }
  
  /**
   * Compare exactly 5 cards and determine winner
   * Useful for games like 5-card draw
   * @param handsMap Map of seat ID to their 5-card hand
   * @returns ShowdownResult with winners
   */
  compareFiveCardHands(handsMap: Map<i32, Card[]>): ShowdownResult {
    const handRanks = new Map<i32, HandRank>();
    const bestFiveCards = new Map<i32, Card[]>();
    const winners = new Array<i32>(0);
    
    // Evaluate each player's 5-card hand
    const seatIds = handsMap.keys();
    for (let i = 0; i < seatIds.length; i++) {
      const seatId = seatIds[i];
      const hand = handsMap.get(seatId);
      
      if (hand.length !== 5) {
        continue; // Skip invalid hands
      }
      
      // Evaluate 5-card hand directly (no community cards)
      const handRank = this.evaluateHand(hand, new Array<Card>(0));
      handRanks.set(seatId, handRank);
      bestFiveCards.set(seatId, hand);
    }
    
    if (handRanks.size === 0) {
      return new ShowdownResult(winners, handRanks, bestFiveCards);
    }
    
    // Find the best hand(s)
    let bestRank: HandRank | null = null;
    const seatIdsForComparison = handRanks.keys();
    
    for (let i = 0; i < seatIdsForComparison.length; i++) {
      const seatId = seatIdsForComparison[i];
      const rank = handRanks.get(seatId);
      
      if (bestRank === null) {
        bestRank = rank;
        winners.push(seatId);
      } else {
        const comparison = this.compareHands(rank, bestRank);
        if (comparison > 0) {
          // New best hand
          bestRank = rank;
          winners.length = 0;
          winners.push(seatId);
        } else if (comparison === 0) {
          // Tie
          winners.push(seatId);
        }
      }
    }
    
    return new ShowdownResult(winners, handRanks, bestFiveCards);
  }
  
  /**
   * Get hand rank for a single player
   * Convenience method
   */
  getPlayerHandRank(holeCards: Card[], communityCards: Card[]): HandRank {
    return this.evaluateHand(holeCards, communityCards);
  }
  
  /**
   * Get best 5-card hand for a single player
   * Convenience method
   */
  getPlayerBestHand(holeCards: Card[], communityCards: Card[]): Card[] {
    return this.getBestFiveCards(holeCards, communityCards);
  }
  
  /**
   * Compare two specific hands and return winner
   * @returns 1 if hand1 wins, -1 if hand2 wins, 0 if tie
   */
  compareTwoHands(
    holeCards1: Card[],
    holeCards2: Card[],
    communityCards: Card[]
  ): i32 {
    const rank1 = this.evaluateHand(holeCards1, communityCards);
    const rank2 = this.evaluateHand(holeCards2, communityCards);
    return this.compareHands(rank1, rank2);
  }
}

