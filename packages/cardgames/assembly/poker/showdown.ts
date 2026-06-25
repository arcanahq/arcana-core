// @ts-nocheck
/**
 * Poker Showdown Utilities
 * 
 * Utilities for comparing multiple poker hands and determining winners
 * Supports both 5-card and 7-card (Hold'em) hands
 * 
 * Provides both a concrete StandardShowdownEvaluator and convenience functions
 * that use the standard evaluator by default.
 */

import { Card, HandRank } from "../cards";
import { evaluateHand, compareHands, getBestFiveCards } from "../poker";
import { ShowdownEvaluator, ShowdownResult } from "./showdown_evaluator";

/**
 * Standard showdown evaluator for traditional poker games
 * Uses standard 52-card deck evaluation
 */
export class StandardShowdownEvaluator extends ShowdownEvaluator {
  evaluateHand(holeCards: Card[], communityCards: Card[]): HandRank {
    return evaluateHand(holeCards, communityCards);
  }
  
  getBestFiveCards(holeCards: Card[], communityCards: Card[]): Card[] {
    return getBestFiveCards(holeCards, communityCards);
  }
  
  compareHands(hand1: HandRank, hand2: HandRank): i32 {
    return compareHands(hand1, hand2);
  }
}

// Default evaluator instance for convenience functions
const defaultEvaluator = new StandardShowdownEvaluator();

/**
 * Compare multiple poker hands and determine winners
 * Uses the default StandardShowdownEvaluator
 * 
 * @param holeCardsMap Map of seat ID to their hole cards (2 cards for Hold'em)
 * @param communityCards Community cards (5 cards for Hold'em: flop + turn + river)
 * @returns ShowdownResult with winners, hand ranks, and best 5-card hands
 */
export function compareHandsShowdown(
  holeCardsMap: Map<i32, Card[]>,
  communityCards: Card[]
): ShowdownResult {
  return defaultEvaluator.compareHandsShowdown(holeCardsMap, communityCards);
}

/**
 * Compare exactly 5 cards and determine winner
 * Useful for games like 5-card draw
 * Uses the default StandardShowdownEvaluator
 * 
 * @param handsMap Map of seat ID to their 5-card hand
 * @returns ShowdownResult with winners
 */
export function compareFiveCardHands(handsMap: Map<i32, Card[]>): ShowdownResult {
  return defaultEvaluator.compareFiveCardHands(handsMap);
}

/**
 * Get hand rank for a single player
 * Convenience function for evaluating one player's hand
 * Uses the default StandardShowdownEvaluator
 * 
 * @param holeCards Player's hole cards (2 cards for Hold'em)
 * @param communityCards Community cards (5 cards for Hold'em)
 * @returns HandRank for the player's best hand
 */
export function getPlayerHandRank(holeCards: Card[], communityCards: Card[]): HandRank {
  return defaultEvaluator.getPlayerHandRank(holeCards, communityCards);
}

/**
 * Get best 5-card hand for a single player
 * Convenience function for getting a player's best 5-card hand
 * Uses the default StandardShowdownEvaluator
 * 
 * @param holeCards Player's hole cards (2 cards for Hold'em)
 * @param communityCards Community cards (5 cards for Hold'em)
 * @returns Best 5-card hand
 */
export function getPlayerBestHand(holeCards: Card[], communityCards: Card[]): Card[] {
  return defaultEvaluator.getPlayerBestHand(holeCards, communityCards);
}

/**
 * Compare two specific hands and return winner
 * Uses the default StandardShowdownEvaluator
 * 
 * @param holeCards1 First player's hole cards
 * @param holeCards2 Second player's hole cards
 * @param communityCards Community cards
 * @returns 1 if player 1 wins, -1 if player 2 wins, 0 if tie
 */
export function compareTwoHands(
  holeCards1: Card[],
  holeCards2: Card[],
  communityCards: Card[]
): i32 {
  return defaultEvaluator.compareTwoHands(holeCards1, holeCards2, communityCards);
}

