// @ts-nocheck
/**
 * Blackjack Rules Configuration
 * 
 * Provides configurable blackjack rules for different game variants
 */

// Card and Rank are used in blackjack.ts, not here

// Re-export from local blackjack module
export { BlackjackRules, BlackjackPayouts, dealerShouldHit, isSoftHand, calculateBlackjackHandValue, isBlackjack as coreIsBlackjack, isBusted as coreIsBusted, canSplitCards as coreCanSplitCards, PairPlusResult, evaluatePairPlus, TwentyOnePlusThreeResult, evaluateTwentyOnePlusThree } from "./blackjack";
