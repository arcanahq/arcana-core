// @ts-nocheck
/**
 * Six-Plus Hold'em Showdown Evaluator
 * 
 * Six-Plus Hold'em (also known as Short Deck Hold'em) uses a 36-card deck
 * (removes 2-5 cards) and has different hand rankings:
 * - Flush beats Full House
 * - Three of a Kind beats Straight
 * 
 * This evaluator implements the Six-Plus Hold'em hand ranking rules.
 */

import { Card, HandRank, HandType, Rank } from "../cards";
import { ShowdownEvaluator, ShowdownResult } from "./showdown_evaluator";
import { evaluateHand, getBestFiveCards } from "../poker";

/**
 * Six-Plus Hold'em showdown evaluator
 * Uses modified hand rankings for 36-card deck
 */
export class SixPlusShowdownEvaluator extends ShowdownEvaluator {
  /**
   * Evaluate a hand using Six-Plus Hold'em rules
   * Hand rankings are different: Flush > Full House, Three of a Kind > Straight
   */
  evaluateHand(holeCards: Card[], communityCards: Card[]): HandRank {
    // First evaluate using standard rules
    const standardRank = evaluateHand(holeCards, communityCards);
    
    // Then adjust for Six-Plus Hold'em rankings
    return this.adjustForSixPlusRanking(standardRank);
  }
  
  /**
   * Get best 5-card hand (same as standard)
   */
  getBestFiveCards(holeCards: Card[], communityCards: Card[]): Card[] {
    return getBestFiveCards(holeCards, communityCards);
  }
  
  /**
   * Compare hands using Six-Plus Hold'em rules
   * Override to handle Six-Plus ranking swaps
   */
  compareHands(hand1: HandRank, hand2: HandRank): i32 {
    // Get adjusted types for comparison
    const type1 = this.getSixPlusType(hand1.handType);
    const type2 = this.getSixPlusType(hand2.handType);
    
    // Compare types first
    if (type1 < type2) return -1;
    if (type1 > type2) return 1;
    
    // Same type, compare kickers
    const maxLen = hand1.kickers.length > hand2.kickers.length ? hand1.kickers.length : hand2.kickers.length;
    for (let i = 0; i < maxLen; i++) {
      const kicker1 = i < hand1.kickers.length ? hand1.kickers[i] : 0;
      const kicker2 = i < hand2.kickers.length ? hand2.kickers[i] : 0;
      if (kicker1 < kicker2) return -1;
      if (kicker1 > kicker2) return 1;
    }
    
    return 0;
  }
  
  /**
   * Get Six-Plus Hold'em type value for comparison
   * Returns a value where higher = better hand
   * Hand rankings: Royal Flush > Straight Flush > Four of a Kind > Flush > Full House > Three of a Kind > Straight > Two Pair > Pair > High Card
   */
  private getSixPlusType(handType: i32): i32 {
    // Map standard types to Six-Plus ranking values
    // Higher number = better hand
    if (handType === HandType.ROYAL_FLUSH) return 10;
    if (handType === HandType.STRAIGHT_FLUSH) return 9;
    if (handType === HandType.FOUR_OF_A_KIND) return 8;
    if (handType === HandType.FLUSH) return 7; // Flush beats Full House in Six-Plus
    if (handType === HandType.FULL_HOUSE) return 6; // Full House loses to Flush in Six-Plus
    if (handType === HandType.THREE_OF_A_KIND) return 5; // Three of a Kind beats Straight in Six-Plus
    if (handType === HandType.STRAIGHT) return 4; // Straight loses to Three of a Kind in Six-Plus
    if (handType === HandType.TWO_PAIR) return 3;
    if (handType === HandType.PAIR) return 2;
    return 1; // HIGH_CARD
  }
  
  /**
   * Adjust hand rank for Six-Plus Hold'em rules
   * This is used for display/logging purposes
   */
  private adjustForSixPlusRanking(rank: HandRank): HandRank {
    // This method is kept for potential future use
    // The actual comparison is handled in compareHands via getSixPlusType
    return rank;
  }
}

