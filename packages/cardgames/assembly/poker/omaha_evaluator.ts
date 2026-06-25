// @ts-nocheck
/**
 * Omaha Poker Showdown Evaluator
 * 
 * Evaluator for Omaha and Omaha Hi-Lo variants.
 * In Omaha, players receive 4 hole cards and must use exactly 2 of them
 * combined with exactly 3 community cards to make their best 5-card hand.
 */

import { Card, HandRank } from "../cards";
import { ShowdownEvaluator } from "./showdown_evaluator";
import { evaluateHand } from "../poker";

/**
 * Omaha showdown evaluator
 * Players must use exactly 2 hole cards and 3 community cards
 */
export class OmahaShowdownEvaluator extends ShowdownEvaluator {
  /**
   * Evaluate an Omaha hand
   * Must use exactly 2 hole cards and 3 community cards
   * 
   * @param holeCards 4 hole cards (must use exactly 2)
   * @param communityCards 5 community cards (must use exactly 3)
   */
  evaluateHand(holeCards: Card[], communityCards: Card[]): HandRank {
    if (holeCards.length !== 4 || communityCards.length !== 5) {
      // Invalid hand structure for Omaha
      return new HandRank(1, []); // Return high card as fallback
    }
    
    // Try all combinations of 2 hole cards and 3 community cards
    let bestRank: HandRank | null = null;
    
    // All combinations of 2 hole cards
    for (let i = 0; i < holeCards.length - 1; i++) {
      for (let j = i + 1; j < holeCards.length; j++) {
        const twoHole = new Array<Card>(2);
        twoHole[0] = holeCards[i];
        twoHole[1] = holeCards[j];
        
        // All combinations of 3 community cards
        for (let k = 0; k < communityCards.length - 2; k++) {
          for (let l = k + 1; l < communityCards.length - 1; l++) {
            for (let m = l + 1; m < communityCards.length; m++) {
              const threeCommunity = new Array<Card>(3);
              threeCommunity[0] = communityCards[k];
              threeCommunity[1] = communityCards[l];
              threeCommunity[2] = communityCards[m];
              
              // Evaluate this 5-card combination
              const rank = evaluateHand(twoHole, threeCommunity);
              
              if (bestRank === null || rank.compare(bestRank) > 0) {
                bestRank = rank;
              }
            }
          }
        }
      }
    }
    
    return bestRank !== null ? bestRank : new HandRank(1, []);
  }
  
  /**
   * Get best 5-card hand for Omaha
   * Returns the 2 hole cards + 3 community cards that form the best hand
   */
  getBestFiveCards(holeCards: Card[], communityCards: Card[]): Card[] {
    if (holeCards.length !== 4 || communityCards.length !== 5) {
      return new Array<Card>(0);
    }
    
    let bestRank: HandRank | null = null;
    let bestCards: Card[] | null = null;
    
    // Try all combinations of 2 hole cards and 3 community cards
    for (let i = 0; i < holeCards.length - 1; i++) {
      for (let j = i + 1; j < holeCards.length; j++) {
        const twoHole = new Array<Card>(2);
        twoHole[0] = holeCards[i];
        twoHole[1] = holeCards[j];
        
        for (let k = 0; k < communityCards.length - 2; k++) {
          for (let l = k + 1; l < communityCards.length - 1; l++) {
            for (let m = l + 1; m < communityCards.length; m++) {
              const threeCommunity = new Array<Card>(3);
              threeCommunity[0] = communityCards[k];
              threeCommunity[1] = communityCards[l];
              threeCommunity[2] = communityCards[m];
              
              const rank = evaluateHand(twoHole, threeCommunity);
              
              if (bestRank === null || rank.compare(bestRank) > 0) {
                bestRank = rank;
                // Combine the cards
                bestCards = new Array<Card>(5);
                bestCards[0] = twoHole[0];
                bestCards[1] = twoHole[1];
                bestCards[2] = threeCommunity[0];
                bestCards[3] = threeCommunity[1];
                bestCards[4] = threeCommunity[2];
              }
            }
          }
        }
      }
    }
    
    return bestCards !== null ? bestCards : new Array<Card>(0);
  }
  
  /**
   * Compare hands (same as standard)
   */
  compareHands(hand1: HandRank, hand2: HandRank): i32 {
    return hand1.compare(hand2);
  }
}

