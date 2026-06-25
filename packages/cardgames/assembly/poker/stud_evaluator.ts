// @ts-nocheck
/**
 * Stud Poker Showdown Evaluator
 * 
 * Evaluator for 5-card and 7-card stud poker variants.
 * In stud poker, there are no community cards - each player has their own complete hand.
 * 
 * For 7-card stud: Players receive 7 cards and choose the best 5
 * For 5-card stud: Players receive 5 cards (use all 5)
 */

import { Card, HandRank } from "../cards";
import { ShowdownEvaluator } from "./showdown_evaluator";
import { evaluateHand, getBestFiveCards } from "../poker";

/**
 * Standard stud poker evaluator
 * Works for both 5-card and 7-card stud
 */
export class StudShowdownEvaluator extends ShowdownEvaluator {
  /**
   * Evaluate a stud hand
   * In stud, all cards are in holeCards, communityCards is empty
   * 
   * @param holeCards All player's cards (5 for 5-card stud, 7 for 7-card stud)
   * @param communityCards Empty array for stud variants
   */
  evaluateHand(holeCards: Card[], communityCards: Card[]): HandRank {
    // For stud, all cards are in holeCards, communityCards should be empty
    // We can use the standard evaluator with empty community cards
    return evaluateHand(holeCards, communityCards);
  }
  
  /**
   * Get best 5-card hand from stud cards
   * For 5-card stud, returns all cards
   * For 7-card stud, returns best 5 cards
   */
  getBestFiveCards(holeCards: Card[], communityCards: Card[]): Card[] {
    // For stud, all cards are in holeCards
    if (holeCards.length === 5) {
      // 5-card stud: use all cards
      return holeCards;
    } else if (holeCards.length === 7) {
      // 7-card stud: choose best 5
      return getBestFiveCards(holeCards, new Array<Card>(0));
    }
    
    // Fallback: use standard logic
    return getBestFiveCards(holeCards, communityCards);
  }
  
  /**
   * Compare hands (same as standard)
   */
  compareHands(hand1: HandRank, hand2: HandRank): i32 {
    return hand1.compare(hand2);
  }
}

