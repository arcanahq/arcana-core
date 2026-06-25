// @ts-nocheck
/**
 * Poker Variant Utilities
 * 
 * Helper functions for working with different poker variants
 */

import { ShowdownEvaluator } from "./showdown_evaluator";
import { StandardShowdownEvaluator } from "./showdown";
import { SixPlusShowdownEvaluator } from "./six_plus_showdown";
import { StudShowdownEvaluator } from "./stud_evaluator";
import { OmahaShowdownEvaluator } from "./omaha_evaluator";
import { PokerVariant, PokerVariantConfig } from "./variants";

/**
 * Get the appropriate showdown evaluator for a poker variant
 * 
 * @param variant Variant name (e.g., PokerVariant.TEXAS_HOLDEM)
 * @param config Optional variant configuration
 * @returns ShowdownEvaluator instance for the variant
 */
export function getEvaluatorForVariant(
  variant: string,
  config: PokerVariantConfig | null = null
): ShowdownEvaluator {
  if (variant === PokerVariant.SIX_PLUS_HOLDEM || variant === PokerVariant.SHORT_DECK_HOLDEM) {
    return new SixPlusShowdownEvaluator();
  }
  
  if (variant === PokerVariant.SEVEN_CARD_STUD || variant === PokerVariant.FIVE_CARD_STUD || variant === PokerVariant.RAZZ) {
    return new StudShowdownEvaluator();
  }
  
  if (variant === PokerVariant.OMAHA || variant === PokerVariant.OMAHA_HI_LO) {
    return new OmahaShowdownEvaluator();
  }
  
  // Default to standard Hold'em
  return new StandardShowdownEvaluator();
}

/**
 * Create evaluator from variant configuration
 * 
 * @param config Poker variant configuration
 * @returns ShowdownEvaluator instance
 */
export function createEvaluator(config: PokerVariantConfig): ShowdownEvaluator {
  return getEvaluatorForVariant(config.variant, config);
}

