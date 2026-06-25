// @ts-nocheck
/**
 * Poker Hand Evaluation Utilities
 * 
 * Provides utilities for evaluating and comparing poker hands (5-card hands)
 */

import { Card, Rank, HandType, HandRank } from "./cards";

/**
 * Evaluate a poker hand from hole cards and community cards
 * Returns the best 5-card hand rank
 */
export function evaluateHand(holeCards: Card[], community: Card[]): HandRank {
  // Combine all cards
  const allCards = new Array<Card>(holeCards.length + community.length);
  for (let i = 0; i < holeCards.length; i++) {
    allCards[i] = holeCards[i];
  }
  for (let i = 0; i < community.length; i++) {
    allCards[holeCards.length + i] = community[i];
  }
  
  // Need at least 5 cards total
  if (allCards.length < 5) {
    return new HandRank(HandType.HIGH_CARD, []);
  }
  
  // Try all combinations of 5 cards from allCards
  let bestRank: HandRank | null = null;
  
  const n = allCards.length;
  // Generate all combinations of 5 cards
  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            const fiveCards = new Array<Card>(5);
            fiveCards[0] = allCards[i];
            fiveCards[1] = allCards[j];
            fiveCards[2] = allCards[k];
            fiveCards[3] = allCards[l];
            fiveCards[4] = allCards[m];
            
            const rank = evaluateFiveCards(fiveCards);
            if (bestRank === null || rank.compare(bestRank) > 0) {
              bestRank = rank;
            }
          }
        }
      }
    }
  }
  
  return bestRank !== null ? bestRank : new HandRank(HandType.HIGH_CARD, []);
}

/**
 * Evaluate exactly 5 cards
 */
function evaluateFiveCards(cards: Card[]): HandRank {
  if (cards.length !== 5) {
    return new HandRank(HandType.HIGH_CARD, []);
  }
  
  // Count ranks and suits
  const rankCounts = new Map<string, i32>();
  const suitCounts = new Map<string, i32>();
  const rankValues = new Array<i32>(5);
  
  for (let i = 0; i < 5; i++) {
    const rank = cards[i].rank;
    const suit = cards[i].suit;
    const value = cards[i].getValue();
    
    rankValues[i] = value;
    
    rankCounts.set(rank, (rankCounts.has(rank) ? rankCounts.get(rank) : 0) + 1);
    suitCounts.set(suit, (suitCounts.has(suit) ? suitCounts.get(suit) : 0) + 1);
  }
  
  // Sort rank values descending
  rankValues.sort((a, b) => b - a);
  
  // Check for flush
  let isFlush = false;
  const suits = suitCounts.keys();
  for (let i = 0; i < suits.length; i++) {
    if (suitCounts.get(suits[i]) === 5) {
      isFlush = true;
      break;
    }
  }
  
  // Check for straight
  let isStraight = false;
  let straightHigh = 0;
  
  // Check normal straight
  let consecutive = 1;
  for (let i = 1; i < 5; i++) {
    if (rankValues[i] === rankValues[i - 1] - 1) {
      consecutive++;
      if (consecutive === 5) {
        isStraight = true;
        straightHigh = rankValues[i - 4];
        break;
      }
    } else if (rankValues[i] !== rankValues[i - 1]) {
      consecutive = 1;
    }
  }
  
  // Check A-2-3-4-5 straight (wheel)
  if (!isStraight) {
    const hasAce = rankValues[0] === 14;
    const hasTwo = rankValues[1] === 2 || rankValues[2] === 2 || rankValues[3] === 2 || rankValues[4] === 2;
    const hasThree = rankValues[1] === 3 || rankValues[2] === 3 || rankValues[3] === 3 || rankValues[4] === 3;
    const hasFour = rankValues[1] === 4 || rankValues[2] === 4 || rankValues[3] === 4 || rankValues[4] === 4;
    const hasFive = rankValues[1] === 5 || rankValues[2] === 5 || rankValues[3] === 5 || rankValues[4] === 5;
    
    if (hasAce && hasTwo && hasThree && hasFour && hasFive) {
      isStraight = true;
      straightHigh = 5; // Ace plays low in wheel
    }
  }
  
  // Count pairs, trips, quads
  const counts = new Array<i32>(0);
  const countValues = new Map<i32, i32>();
  const rankCountValues = rankCounts.values();
  for (let i = 0; i < rankCountValues.length; i++) {
    const count = rankCountValues[i];
    counts.push(count);
    if (count === 2 || count === 3 || count === 4) {
      // Find the rank value for this count
      const ranks = rankCounts.keys();
      for (let j = 0; j < ranks.length; j++) {
        if (rankCounts.get(ranks[j]) === count) {
          const rankVal = Rank.getValue(ranks[j]);
          if (!countValues.has(count)) {
            countValues.set(count, rankVal);
          } else {
            // Multiple of same count (e.g., two pair)
            const existing = countValues.get(count);
            if (rankVal > existing) {
              countValues.set(count, rankVal);
            }
          }
        }
      }
    }
  }
  
  // Determine hand type
  let hasFour = false;
  let hasThree = false;
  let pairCount = 0;
  let pairValue = 0;
  let secondPairValue = 0;
  let tripsValue = 0;
  let quadsValue = 0;
  
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] === 4) {
      hasFour = true;
      quadsValue = countValues.has(4) ? countValues.get(4) : 0;
    } else if (counts[i] === 3) {
      hasThree = true;
      tripsValue = countValues.has(3) ? countValues.get(3) : 0;
    } else if (counts[i] === 2) {
      pairCount++;
      if (pairValue === 0) {
        pairValue = countValues.has(2) ? countValues.get(2) : 0;
      } else {
        secondPairValue = countValues.has(2) ? countValues.get(2) : 0;
      }
    }
  }
  
  // Royal flush
  if (isFlush && isStraight && straightHigh === 14) {
    return new HandRank(HandType.ROYAL_FLUSH, []);
  }
  
  // Straight flush
  if (isFlush && isStraight) {
    return new HandRank(HandType.STRAIGHT_FLUSH, [straightHigh]);
  }
  
  // Four of a kind
  if (hasFour) {
    const kicker = rankValues[0] === quadsValue ? rankValues[4] : rankValues[0];
    return new HandRank(HandType.FOUR_OF_A_KIND, [quadsValue, kicker]);
  }
  
  // Full house
  if (hasThree && pairCount > 0) {
    return new HandRank(HandType.FULL_HOUSE, [tripsValue, pairValue]);
  }
  
  // Flush
  if (isFlush) {
    return new HandRank(HandType.FLUSH, rankValues);
  }
  
  // Straight
  if (isStraight) {
    return new HandRank(HandType.STRAIGHT, [straightHigh]);
  }
  
  // Three of a kind
  if (hasThree) {
    const kickers = new Array<i32>(0);
    for (let i = 0; i < 5; i++) {
      if (rankValues[i] !== tripsValue) {
        kickers.push(rankValues[i]);
      }
    }
    kickers.sort((a, b) => b - a);
    return new HandRank(HandType.THREE_OF_A_KIND, [tripsValue, kickers[0], kickers[1]]);
  }
  
  // Two pair
  if (pairCount >= 2) {
    const highPair = pairValue > secondPairValue ? pairValue : secondPairValue;
    const lowPair = pairValue > secondPairValue ? secondPairValue : pairValue;
    const kicker = rankValues[0] === highPair || rankValues[0] === lowPair
      ? (rankValues[1] === highPair || rankValues[1] === lowPair
        ? rankValues[2]
        : rankValues[1])
      : rankValues[0];
    return new HandRank(HandType.TWO_PAIR, [highPair, lowPair, kicker]);
  }
  
  // Pair
  if (pairCount === 1) {
    const kickers = new Array<i32>(0);
    for (let i = 0; i < 5; i++) {
      if (rankValues[i] !== pairValue) {
        kickers.push(rankValues[i]);
      }
    }
    kickers.sort((a, b) => b - a);
    return new HandRank(HandType.PAIR, [pairValue, kickers[0], kickers[1], kickers[2]]);
  }
  
  // High card
  return new HandRank(HandType.HIGH_CARD, rankValues);
}

/**
 * Compare two hands and determine winner
 * Returns: -1 if hand1 < hand2, 0 if equal, 1 if hand1 > hand2
 */
export function compareHands(hand1: HandRank, hand2: HandRank): i32 {
  return hand1.compare(hand2);
}

/**
 * Get the best 5-card hand from hole cards and community cards
 * Returns the 5 cards that form the best hand
 */
export function getBestFiveCards(holeCards: Card[], community: Card[]): Card[] {
  const allCards = new Array<Card>(holeCards.length + community.length);
  for (let i = 0; i < holeCards.length; i++) {
    allCards[i] = holeCards[i];
  }
  for (let i = 0; i < community.length; i++) {
    allCards[holeCards.length + i] = community[i];
  }
  
  if (allCards.length < 5) {
    return allCards;
  }
  
  let bestRank: HandRank | null = null;
  let bestCards: Card[] | null = null;
  
  const n = allCards.length;
  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            const fiveCards = new Array<Card>(5);
            fiveCards[0] = allCards[i];
            fiveCards[1] = allCards[j];
            fiveCards[2] = allCards[k];
            fiveCards[3] = allCards[l];
            fiveCards[4] = allCards[m];
            
            const rank = evaluateFiveCards(fiveCards);
            if (bestRank === null || rank.compare(bestRank) > 0) {
              bestRank = rank;
              bestCards = fiveCards;
            }
          }
        }
      }
    }
  }
  
  return bestCards !== null ? bestCards : allCards.slice(0, 5);
}

