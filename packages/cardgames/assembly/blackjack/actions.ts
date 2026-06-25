// @ts-nocheck
/**
 * Blackjack Action Processing Utilities
 * 
 * Provides reusable blackjack action processing logic that can be used
 * by any blackjack implementation. This library handles the game logic
 * while allowing implementations to manage their own state structure.
 */

import { BlackjackRules } from "./rules";

/**
 * Available actions result
 */
export class AvailableActions {
  canStand: bool = false;
  canDouble: bool = false;
  canSplit: bool = false;
  canSurrender: bool = false;
}

/**
 * Calculate available actions for a hand based on rules
 */
export function calculateAvailableActions(
  handCardsLength: i32,
  handIsFromSplit: bool,
  handIsSplitAces: bool,
  handIsStanding: bool,
  handIsBusted: bool,
  gamePhase: string,
  playerHandsCount: i32,
  canSplit: bool, // Pre-calculated: whether cards can be split
  rules: BlackjackRules
): AvailableActions {
  const result = new AvailableActions();
  
  // Stand is always available if hand is not busted and not already standing
  // (and we're in the playing phase)
  if (gamePhase == "PLAYING" && !handIsStanding && !handIsBusted) {
    result.canStand = true;
    
    // Other actions are only available on first two cards
    if (handCardsLength == 2 && !handIsSplitAces) {
      result.canDouble = true;
      if (handIsFromSplit && !rules.doubleAfterSplit) {
        result.canDouble = false;
      }
      result.canSurrender = rules.surrenderAllowed && !handIsFromSplit;
      if (canSplit && playerHandsCount < rules.maxSplitHands) {
        result.canSplit = true;
      }
    }
  }
  
  return result;
}

/**
 * Check if dealer should hit based on rules
 */
export function shouldDealerHit(
  handValue: i32,
  dealerStandValue: i32,
  hitOnSoft17: bool,
  isSoftHand: bool
): bool {
  // Below stand value - must hit
  if (handValue < dealerStandValue) {
    return true;
  }
  
  // Above stand value - stand
  if (handValue > dealerStandValue) {
    return false;
  }
  
  // At stand value - check if soft 17
  if (handValue == dealerStandValue && hitOnSoft17) {
    return isSoftHand;
  }
  
  return false;
}

/**
 * Validate action can be performed in current phase
 */
export function validateActionPhase(gamePhase: string, action: string, requiredPhase: string): void {
  if (gamePhase != requiredPhase) {
    throw new Error(`Can only perform ${action} during ${requiredPhase} phase`);
  }
}

/**
 * Validate hand exists and is active
 */
export function validateActiveHand(currentHandIndex: i32, playerHandsLength: i32): void {
  if (currentHandIndex < 0 || currentHandIndex >= playerHandsLength) {
    throw new Error("No active hand found");
  }
}

/**
 * Validate hand can be hit
 */
export function validateCanHit(handIsStanding: bool, handIsBusted: bool, handIsSplitAces: bool): void {
  if (handIsStanding || handIsBusted || handIsSplitAces) {
    throw new Error("Cannot hit on this hand");
  }
}

/**
 * Validate hand can be stood
 */
export function validateCanStand(handIsStanding: bool, handIsBusted: bool): void {
  if (handIsStanding) {
    throw new Error("Hand is already standing");
  }
  if (handIsBusted) {
    throw new Error("Cannot stand on busted hand");
  }
}

/**
 * Validate hand can be doubled
 */
export function validateCanDouble(
  handCardsLength: i32,
  handIsSplitAces: bool,
  handIsFromSplit: bool,
  rules: BlackjackRules
): void {
  if (handCardsLength != 2) {
    throw new Error("Can only double on first two cards");
  }
  
  if (handIsSplitAces) {
    throw new Error("Cannot double on split aces");
  }
  
  if (handIsFromSplit && !rules.doubleAfterSplit) {
    throw new Error("Cannot double after split");
  }
}

/**
 * Validate hand can be split
 */
export function validateCanSplit(
  handCardsLength: i32,
  playerHandsCount: i32,
  canSplit: bool, // Pre-calculated: whether cards can be split
  rules: BlackjackRules
): void {
  if (handCardsLength != 2) {
    throw new Error("Can only split on first two cards");
  }
  
  if (playerHandsCount >= rules.maxSplitHands) {
    throw new Error("Maximum number of split hands reached");
  }
  
  if (!canSplit) {
    throw new Error("Cards cannot be split");
  }
}

/**
 * Validate hand can be surrendered
 */
export function validateCanSurrender(
  handCardsLength: i32,
  handIsFromSplit: bool,
  rules: BlackjackRules
): void {
  if (!rules.surrenderAllowed) {
    throw new Error("Surrender is not allowed");
  }
  
  if (handCardsLength != 2 || handIsFromSplit) {
    throw new Error("Can only surrender on first two cards of original hand");
  }
}

/**
 * Check if insurance should be offered
 */
export function shouldOfferInsurance(dealerUpCardRank: string, rules: BlackjackRules): bool {
  return dealerUpCardRank == "A" && rules.insuranceOffered;
}
