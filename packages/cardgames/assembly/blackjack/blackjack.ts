// @ts-nocheck
/**
 * Blackjack Card Game Utilities
 * 
 * Provides utilities for blackjack-specific card game operations:
 * - Blackjack card value calculations
 * - Hand value calculations with ace handling
 * - Blackjack-specific game rules
 */

import { Card, Rank, Suit } from "../cards";

/**
 * Extended Card class for blackjack with hidden card support
 */
export class BlackjackCard extends Card {
  isHidden: bool;
  
  constructor(suit: string = "", rank: string = "", isHidden: bool = false) {
    super(suit, rank);
    this.isHidden = isHidden;
  }
  
  static fromCard(card: Card, isHidden: bool = false): BlackjackCard {
    return new BlackjackCard(card.suit, card.rank, isHidden);
  }
  
  clone(): BlackjackCard {
    return new BlackjackCard(this.suit, this.rank, this.isHidden);
  }
}

/**
 * Gets the numeric value of a card rank for blackjack
 * Aces return 11 (will be adjusted in hand calculation)
 * Face cards (J, Q, K) return 10
 * Number cards return their face value
 */
export function getBlackjackCardValue(card: Card): i32 {
  if (card.rank === Rank.ACE) {
    return 11; // Default to 11, will be adjusted in hand calculation
  } else if (card.rank === Rank.JACK || card.rank === Rank.QUEEN || card.rank === Rank.KING) {
    return 10;
  } else if (card.rank === "?") {
    return 0; // Unknown card
  } else {
    // Parse number cards (2-10)
    const num = parseInt(card.rank);
    if (isNaN(num) || num < 2 || num > 10) {
      return 0;
    }
    return <i32>num;
  }
}

/**
 * Calculates the optimal value of a hand in blackjack
 * Aces are counted as 11 when beneficial, otherwise as 1
 */
export function calculateBlackjackHandValue(cards: Card[]): i32 {
  if (cards.length === 0) {
    return 0;
  }

  let total: i32 = 0;
  let aces: i32 = 0;

  // First pass: count all cards, treating aces as 11
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card) {
      continue; // Skip null cards
    }
    
    // Skip hidden cards (for blackjack, we check isHidden property)
    // Check if card is a BlackjackCard by checking if it has isHidden property
    // We use a type guard: if the card is a BlackjackCard, it will have isHidden
    const bjCard = changetype<BlackjackCard>(card);
    if (bjCard !== null && bjCard.isHidden === true) {
      continue;
    }
    // Also check for suit === "hidden" for backward compatibility
    if (card.suit === "hidden") {
      continue;
    }
    
    if (card.rank === Rank.ACE) {
      aces++;
      total += 11;
    } else {
      total += getBlackjackCardValue(card);
    }
  }

  // Adjust aces down from 11 to 1 if needed to avoid busting
  while (total > 21 && aces > 0) {
    total -= 10; // Convert one ace from 11 to 1
    aces--;
  }

  return total;
}

/**
 * Checks if a hand is a blackjack (21 with exactly 2 cards)
 */
export function isBlackjack(cards: Card[]): bool {
  return cards.length === 2 && calculateBlackjackHandValue(cards) === 21;
}

/**
 * Checks if a hand is busted (over 21)
 */
export function isBusted(cards: Card[]): bool {
  return calculateBlackjackHandValue(cards) > 21;
}

/**
 * Checks if two cards can be split (same rank)
 */
export function canSplitCards(cards: Card[]): bool {
  if (cards.length !== 2) {
    return false;
  }
  
  const rank1 = cards[0].rank;
  const rank2 = cards[1].rank;
  
  // Special case: face cards (J, Q, K) can split with each other
  if ((rank1 === Rank.JACK || rank1 === Rank.QUEEN || rank1 === Rank.KING) &&
      (rank2 === Rank.JACK || rank2 === Rank.QUEEN || rank2 === Rank.KING)) {
    return true;
  }
  
  // Otherwise, ranks must match exactly
  return rank1 === rank2;
}


/**
 * Configurable Blackjack Rules
 * Supports different blackjack variants (standard, Spanish 21, etc.)
 */
export class BlackjackRules {
  // Dealer rules
  dealerStandValue: i32 = 17; // Dealer stands on this value or higher
  hitOnSoft17: bool = false; // Dealer hits on soft 17 (A-6) if true, stands if false
  
  // Game mechanics
  maxSplitHands: i32 = 4; // Maximum number of hands from splitting
  doubleAfterSplit: bool = false; // Allow double after split (standard is false)
  surrenderAllowed: bool = true; // Allow surrender
  lateSurrender: bool = false; // Late surrender (after dealer checks for blackjack)
  insuranceOffered: bool = true; // Offer insurance when dealer shows ace
  
  // Deck configuration
  isSpanish21: bool = false; // Spanish 21 uses 48-card deck (no 10s)
  deckSize: i32 = 52; // Standard deck size (48 for Spanish 21)
  
  // Hand values
  blackjackValue: i32 = 21;
  bustValue: i32 = 22;
  
  // Payout rates (as multipliers)
  payoutBlackjack: f64 = 1.5; // 3:2
  payoutWin: f64 = 1.0; // 1:1
  payoutPush: f64 = 1.0; // 1:1 (return bet)
  payoutLose: f64 = 0.0; // 0:1
  payoutSurrender: f64 = 0.5; // 0.5:1 (half bet returned)
  payoutInsurance: f64 = 2.0; // 2:1
  
  constructor(
    dealerStandValue: i32 = 17,
    hitOnSoft17: bool = false,
    maxSplitHands: i32 = 4,
    doubleAfterSplit: bool = false,
    surrenderAllowed: bool = true,
    lateSurrender: bool = false,
    insuranceOffered: bool = true,
    isSpanish21: bool = false,
    payoutBlackjack: f64 = 1.5,
    payoutWin: f64 = 1.0,
    payoutPush: f64 = 1.0,
    payoutLose: f64 = 0.0,
    payoutSurrender: f64 = 0.5,
    payoutInsurance: f64 = 2.0
  ) {
    this.dealerStandValue = dealerStandValue;
    this.hitOnSoft17 = hitOnSoft17;
    this.maxSplitHands = maxSplitHands;
    this.doubleAfterSplit = doubleAfterSplit;
    this.surrenderAllowed = surrenderAllowed;
    this.lateSurrender = lateSurrender;
    this.insuranceOffered = insuranceOffered;
    this.isSpanish21 = isSpanish21;
    this.deckSize = isSpanish21 ? 48 : 52;
    this.payoutBlackjack = payoutBlackjack;
    this.payoutWin = payoutWin;
    this.payoutPush = payoutPush;
    this.payoutLose = payoutLose;
    this.payoutSurrender = payoutSurrender;
    this.payoutInsurance = payoutInsurance;
  }
  
  /**
   * Create standard blackjack rules (most common casino rules)
   */
  static standard(): BlackjackRules {
    return new BlackjackRules(
      17, // dealerStandValue
      false, // hitOnSoft17 (most casinos stand on soft 17)
      4, // maxSplitHands
      false, // doubleAfterSplit (standard rule: no double after split)
      true, // surrenderAllowed
      false, // lateSurrender
      true, // insuranceOffered
      false // isSpanish21
    );
  }
  
  /**
   * Create Spanish 21 rules (48-card deck, no 10s)
   */
  static spanish21(): BlackjackRules {
    return new BlackjackRules(
      17, // dealerStandValue
      true, // hitOnSoft17 (Spanish 21 typically hits on soft 17)
      4, // maxSplitHands
      true, // doubleAfterSplit (Spanish 21 allows double after split)
      true, // surrenderAllowed
      false, // lateSurrender
      false, // insuranceOffered (Spanish 21 doesn't offer insurance)
      true // isSpanish21
    );
  }
  
  /**
   * Create rules with dealer hitting on soft 17
   */
  static dealerHitsSoft17(): BlackjackRules {
    const rules = BlackjackRules.standard();
    rules.hitOnSoft17 = true;
    return rules;
  }
  
  /**
   * Create rules allowing double after split
   */
  static allowDoubleAfterSplit(): BlackjackRules {
    const rules = BlackjackRules.standard();
    rules.doubleAfterSplit = true;
    return rules;
  }
}

/**
 * Legacy static constants for backward compatibility
 */
export class BlackjackPayouts {
  static readonly BLACKJACK: f64 = 1.5; // 3:2
  static readonly WIN: f64 = 1.0; // 1:1
  static readonly PUSH: f64 = 1.0; // 1:1 (return bet)
  static readonly LOSE: f64 = 0.0; // 0:1
  static readonly SURRENDER: f64 = 0.5; // 0.5:1 (half bet returned)
  static readonly INSURANCE: f64 = 2.0; // 2:1
}

/**
 * Checks if a hand is a soft hand (contains an ace counted as 11)
 * A soft hand is one where an ace is counted as 11 and the hand value could be reduced by 10
 * This is used to determine dealer behavior on soft 17
 */
export function isSoftHand(cards: Card[]): bool {
  if (cards.length === 0) {
    return false;
  }

  let hasAce = false;
  let nonAceValue: i32 = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card) continue;
    
    // Check if card is a BlackjackCard with isHidden property
    const bjCard = changetype<BlackjackCard>(card);
    if (bjCard !== null && bjCard.isHidden === true) continue;
    if (card.suit === "hidden") continue;
    
    if (card.rank === Rank.ACE) {
      hasAce = true;
    } else {
      nonAceValue += getBlackjackCardValue(card);
    }
  }

  if (!hasAce) {
    return false;
  }

  // A soft hand is one where we can count an ace as 11
  // Check if hand value is exactly 17 and has an ace (soft 17)
  const handValue = calculateBlackjackHandValue(cards);
  
  // If hand value is 17 and has an ace, check if it's soft
  if (handValue === 17 && hasAce) {
    // Calculate hard value (treating all aces as 1)
    let hardValue: i32 = 0;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card) continue;
      const bjCard = changetype<BlackjackCard>(card);
      if (bjCard !== null && bjCard.isHidden === true) continue;
      if (card.suit === "hidden") continue;
      
      if (card.rank === Rank.ACE) {
        hardValue += 1; // Ace as 1
      } else {
        hardValue += getBlackjackCardValue(card);
      }
    }
    // If hard value is less than 17, it's a soft 17
    return hardValue < 17;
  }
  
  // For other values, check if we can count an ace as 11 without busting
  return hasAce && (nonAceValue + 11 <= 21);
}

/**
 * Determines if dealer should hit based on configurable rules
 * @param cards Dealer's cards
 * @param rules Blackjack rules configuration
 * @returns true if dealer should hit, false if dealer should stand
 */
export function dealerShouldHit(cards: Card[], rules: BlackjackRules): bool {
  const handValue = calculateBlackjackHandValue(cards);
  
  // Dealer must hit if below stand value
  if (handValue < rules.dealerStandValue) {
    return true;
  }
  
  // Dealer stands if above stand value
  if (handValue > rules.dealerStandValue) {
    return false;
  }
  
  // At exactly stand value (17), check if it's soft 17
  if (handValue === rules.dealerStandValue) {
    // If dealer hits on soft 17 and this is a soft hand, dealer hits
    if (rules.hitOnSoft17 && isSoftHand(cards)) {
      return true;
    }
    // Otherwise dealer stands
    return false;
  }
  
  return false;
}

/**
 * Result class for Pair Plus bonus bet evaluation
 */
export class PairPlusResult {
  hasPair: bool = false;
  pairType: string = ""; // "perfect", "colored", "mixed", or ""
  payoutMultiplier: i32 = 0; // 25, 10, 5, or 0
}

/**
 * Result class for 21+3 bonus bet evaluation
 */
export class TwentyOnePlusThreeResult {
  hasMatch: bool = false;
  handType: string = ""; // "suited_three_kind", "straight_flush", "three_kind", "straight", "flush", or ""
  payoutMultiplier: i32 = 0; // 100, 40, 30, 10, 5, or 0
}

/**
 * Get card color (red or black) from suit
 * Hearts and Diamonds are red, Spades and Clubs are black
 */
function getCardColor(suit: string): string {
  if (suit === Suit.HEARTS || suit === Suit.DIAMONDS) {
    return "red";
  } else if (suit === Suit.SPADES || suit === Suit.CLUBS) {
    return "black";
  }
  return "";
}

/**
 * Check if all cards have the same rank
 */
function isThreeOfAKind(cards: Card[]): bool {
  if (cards.length !== 3) {
    return false;
  }
  const rank1 = cards[0].rank;
  const rank2 = cards[1].rank;
  const rank3 = cards[2].rank;
  return rank1 === rank2 && rank2 === rank3;
}

/**
 * Check if all cards have the same suit
 */
function isFlush(cards: Card[]): bool {
  if (cards.length !== 3) {
    return false;
  }
  const suit1 = cards[0].suit;
  const suit2 = cards[1].suit;
  const suit3 = cards[2].suit;
  return suit1 === suit2 && suit2 === suit3;
}

/**
 * Check if all cards have the same rank and suit (suited three of a kind)
 */
function isSuitedThreeOfAKind(cards: Card[]): bool {
  if (cards.length !== 3) {
    return false;
  }
  return isThreeOfAKind(cards) && isFlush(cards);
}

/**
 * Check if 3 cards form a straight (consecutive ranks)
 * Handles A-2-3 and Q-K-A straights
 */
function isStraight(cards: Card[]): bool {
  if (cards.length !== 3) {
    return false;
  }
  
  // Get rank values
  const rankValues = new Array<i32>(3);
  for (let i = 0; i < 3; i++) {
    rankValues[i] = Rank.getValue(cards[i].rank);
  }
  
  // Sort rank values
  rankValues.sort((a, b) => a - b);
  
  // Check normal straight (e.g., 2-3-4, 5-6-7)
  if (rankValues[1] === rankValues[0] + 1 && rankValues[2] === rankValues[1] + 1) {
    return true;
  }
  
  // Check A-2-3 straight (wheel)
  if (rankValues[0] === 2 && rankValues[1] === 3 && rankValues[2] === 14) {
    return true;
  }
  
  // Check Q-K-A straight
  if (rankValues[0] === 12 && rankValues[1] === 13 && rankValues[2] === 14) {
    return true;
  }
  
  return false;
}

/**
 * Check if cards form a straight flush (straight + flush)
 */
function isStraightFlush(cards: Card[]): bool {
  return isStraight(cards) && isFlush(cards);
}

/**
 * Evaluate Pair Plus bonus bet
 * Checks if the first two cards form a pair and what type
 * @param card1 First player card
 * @param card2 Second player card
 * @returns PairPlusResult with pair type and payout multiplier
 */
export function evaluatePairPlus(card1: Card, card2: Card): PairPlusResult {
  const result = new PairPlusResult();
  
  // Check if ranks match
  if (card1.rank !== card2.rank) {
    return result; // No pair
  }
  
  result.hasPair = true;
  
  // Perfect pair: same rank and suit
  if (card1.suit === card2.suit) {
    result.pairType = "perfect";
    result.payoutMultiplier = 25;
    return result;
  }
  
  // Check if same color
  const color1 = getCardColor(card1.suit);
  const color2 = getCardColor(card2.suit);
  
  if (color1 === color2 && color1.length > 0) {
    result.pairType = "colored";
    result.payoutMultiplier = 10;
    return result;
  }
  
  // Mixed pair: same rank, different suits (and different colors)
  result.pairType = "mixed";
  result.payoutMultiplier = 5;
  return result;
}

/**
 * Evaluate 21+3 bonus bet
 * Uses player's two cards plus dealer's upcard to form a three-card poker hand
 * @param card1 First player card
 * @param card2 Second player card
 * @param card3 Dealer's upcard
 * @returns TwentyOnePlusThreeResult with hand type and payout multiplier
 */
export function evaluateTwentyOnePlusThree(card1: Card, card2: Card, card3: Card): TwentyOnePlusThreeResult {
  const result = new TwentyOnePlusThreeResult();
  const cards = new Array<Card>(3);
  cards[0] = card1;
  cards[1] = card2;
  cards[2] = card3;
  
  // Check in order of highest payout first
  
  // Suited three of a kind: all same rank and suit (100:1)
  if (isSuitedThreeOfAKind(cards)) {
    result.hasMatch = true;
    result.handType = "suited_three_kind";
    result.payoutMultiplier = 100;
    return result;
  }
  
  // Straight flush: straight + flush (40:1)
  if (isStraightFlush(cards)) {
    result.hasMatch = true;
    result.handType = "straight_flush";
    result.payoutMultiplier = 40;
    return result;
  }
  
  // Three of a kind: all same rank (30:1)
  if (isThreeOfAKind(cards)) {
    result.hasMatch = true;
    result.handType = "three_kind";
    result.payoutMultiplier = 30;
    return result;
  }
  
  // Straight: consecutive ranks (10:1)
  if (isStraight(cards)) {
    result.hasMatch = true;
    result.handType = "straight";
    result.payoutMultiplier = 10;
    return result;
  }
  
  // Flush: all same suit (5:1)
  if (isFlush(cards)) {
    result.hasMatch = true;
    result.handType = "flush";
    result.payoutMultiplier = 5;
    return result;
  }
  
  // No match
  return result;
}
