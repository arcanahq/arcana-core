// @ts-nocheck
/**
 * Card Game Utilities Library
 * 
 * Provides common card game operations that can be shared across different card games:
 * - Standard deck creation (52 cards)
 * - Deterministic shuffling using Fisher-Yates algorithm
 * - Card dealing utilities
 * 
 * All operations are deterministic when using seeded randomness from the random module.
 */

import { Card, Suit, Rank } from "./cards";
import { RandomSeed, getRandomIntInRange } from "@arcanahq/core/assembly/primitives/random";

/**
 * Creates a standard 52-card deck in unshuffled order
 * Cards are ordered: suits in order (Spades, Hearts, Diamonds, Clubs),
 * ranks in order (2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A)
 * 
 * @returns A new array containing all 52 cards in standard order
 */
export function createStandardDeck(): Card[] {
  const deck = new Array<Card>(52);
  let index = 0;
  
  for (let s = 0; s < Suit.ALL.length; s++) {
    for (let r = 0; r < Rank.ALL.length; r++) {
      deck[index] = new Card(Suit.ALL[s], Rank.ALL[r]);
      index++;
    }
  }
  
  return deck;
}

/**
 * Shuffles a deck using the Fisher-Yates algorithm with deterministic randomness
 * The shuffle is reproducible given the same seed
 * 
 * @param deck The deck to shuffle (will be modified in place)
 * @param seed The random seed to use for shuffling
 * @returns The updated random seed after shuffling
 */
export function shuffleDeck(deck: Card[], seed: RandomSeed): RandomSeed {
  const n = deck.length;
  let currentSeed = seed;
  
  // Fisher-Yates shuffle: iterate from last element to first
  for (let i = n - 1; i > 0; i--) {
    // Get random index from 0 to i (inclusive)
    const result = getRandomIntInRange(currentSeed, 0, i + 1);
    const j = <i32>result.value;
    currentSeed = result.seed;
    
    // Swap cards[i] and cards[j]
    const temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }
  
  return currentSeed;
}

/**
 * Result class for createShuffledDeck
 */
export class ShuffledDeckResult {
  deck: Card[];
  newSeed: RandomSeed;
  
  constructor(deck: Card[], newSeed: RandomSeed) {
    this.deck = deck;
    this.newSeed = newSeed;
  }
}

/**
 * Creates a shuffled deck from a standard deck using deterministic randomness
 * 
 * @param seed The random seed to use for shuffling
 * @returns A ShuffledDeckResult containing the shuffled deck and the updated random seed
 */
export function createShuffledDeck(seed: RandomSeed): ShuffledDeckResult {
  const deck = createStandardDeck();
  const newSeed = shuffleDeck(deck, seed);
  return new ShuffledDeckResult(deck, newSeed);
}

/**
 * Deals a single card from the top of the deck
 * 
 * @param deck The deck to deal from (will be modified)
 * @returns The dealt card, or null if the deck is empty
 */
export function dealCard(deck: Card[]): Card | null {
  if (deck.length === 0) {
    return null;
  }
  const card = deck.pop();
  return card !== null ? card : null;
}

/**
 * Deals multiple cards from the top of the deck
 * 
 * @param deck The deck to deal from (will be modified)
 * @param count The number of cards to deal
 * @returns An array of dealt cards (may be shorter than count if deck runs out)
 */
export function dealCards(deck: Card[], count: i32): Card[] {
  const dealt = new Array<Card>(0);
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      break; // Deck is empty
    }
    const card = dealCard(deck);
    if (card !== null) {
      dealt.push(card);
    } else {
      break; // Deck is empty
    }
  }
  return dealt;
}

/**
 * Result class for dealCardFromDeck
 */
export class DealCardResult {
  card: Card | null;
  newDeck: Card[];
  newSeed: RandomSeed;
  
  constructor(card: Card | null, newDeck: Card[], newSeed: RandomSeed) {
    this.card = card;
    this.newDeck = newDeck;
    this.newSeed = newSeed;
  }
}

/**
 * Deals a card from a specific position in the deck using deterministic randomness
 * This is useful for games that need to deal cards in a specific order based on a seed
 * 
 * @param deck The deck to deal from
 * @param seed The random seed to use for selecting the card
 * @returns A DealCardResult containing the dealt card, the updated deck, and the updated seed
 */
export function dealCardFromDeck(
  deck: Card[],
  seed: RandomSeed
): DealCardResult {
  if (deck.length === 0) {
    return new DealCardResult(null, deck, seed);
  }
  
  // Use deterministic randomness to select a card index
  const result = getRandomIntInRange(seed, 0, deck.length);
  const cardIndex = <i32>result.value;
  const newSeed = result.seed;
  
  // Remove the selected card from the deck
  const card = deck[cardIndex];
  const newDeck = new Array<Card>(deck.length - 1);
  
  let newDeckIndex = 0;
  for (let i = 0; i < deck.length; i++) {
    if (i !== cardIndex) {
      newDeck[newDeckIndex] = deck[i];
      newDeckIndex++;
    }
  }
  
  return new DealCardResult(card, newDeck, newSeed);
}

/**
 * Gets the number of cards remaining in the deck
 * 
 * @param deck The deck to check
 * @returns The number of cards in the deck
 */
export function getDeckSize(deck: Card[]): i32 {
  return deck.length;
}

/**
 * Checks if the deck is empty
 * 
 * @param deck The deck to check
 * @returns True if the deck is empty, false otherwise
 */
export function isDeckEmpty(deck: Card[]): bool {
  return deck.length === 0;
}

/**
 * Creates a copy of a deck without modifying the original
 * 
 * @param deck The deck to clone
 * @returns A new array containing copies of all cards in the deck
 */
export function cloneDeck(deck: Card[]): Card[] {
  const cloned = new Array<Card>(deck.length);
  for (let i = 0; i < deck.length; i++) {
    cloned[i] = deck[i];
  }
  return cloned;
}

/**
 * Converts a Card to an integer representation (0-51)
 * Mapping: cardIndex = suitIndex * 13 + rankIndex
 * - Suit order: Spades=0, Hearts=1, Diamonds=2, Clubs=3
 * - Rank order: 2=0, 3=1, 4=2, 5=3, 6=4, 7=5, 8=6, 9=7, 10=8, J=9, Q=10, K=11, A=12
 * 
 * @param card The card to convert
 * @returns An integer from 0-51 representing the card
 */
export function cardToInt(card: Card): i32 {
  // Find suit index
  let suitIndex: i32 = -1;
  for (let i = 0; i < Suit.ALL.length; i++) {
    if (Suit.ALL[i] === card.suit) {
      suitIndex = i;
      break;
    }
  }
  
  // Find rank index
  let rankIndex: i32 = -1;
  for (let i = 0; i < Rank.ALL.length; i++) {
    if (Rank.ALL[i] === card.rank) {
      rankIndex = i;
      break;
    }
  }
  
  // If card is invalid, return -1
  if (suitIndex < 0 || rankIndex < 0) {
    return -1;
  }
  
  // Calculate card index: suitIndex * 13 + rankIndex
  return suitIndex * 13 + rankIndex;
}

/**
 * Converts an integer (0-51) back to a Card
 * Mapping: cardIndex = suitIndex * 13 + rankIndex
 * - Suit order: Spades=0, Hearts=1, Diamonds=2, Clubs=3
 * - Rank order: 2=0, 3=1, 4=2, 5=3, 6=4, 7=5, 8=6, 9=7, 10=8, J=9, Q=10, K=11, A=12
 * 
 * @param value The integer value (0-51) representing the card
 * @returns A Card object, or null if the value is invalid
 */
export function intToCard(value: i32): Card | null {
  // Validate range
  if (value < 0 || value >= 52) {
    return null;
  }
  
  // Calculate suit and rank indices
  const suitIndex = value / 13;  // Integer division
  const rankIndex = value % 13;  // Modulo
  
  // Get suit and rank from arrays
  if (suitIndex >= Suit.ALL.length || rankIndex >= Rank.ALL.length) {
    return null;
  }
  
  const suit = Suit.ALL[suitIndex];
  const rank = Rank.ALL[rankIndex];
  
  return new Card(suit, rank);
}

/**
 * Converts a deck of cards to an array of integers
 * Useful for serialization and storage
 * 
 * @param deck The deck to serialize
 * @returns An array of integers (0-51) representing each card
 */
export function deckToIntArray(deck: Card[]): i32[] {
  const result = new Array<i32>(deck.length);
  for (let i = 0; i < deck.length; i++) {
    result[i] = cardToInt(deck[i]);
  }
  return result;
}

/**
 * Converts an array of integers back to a deck of cards
 * Useful for deserialization
 * 
 * @param ints An array of integers (0-51) representing cards
 * @returns An array of Card objects
 */
export function intArrayToDeck(ints: i32[]): Card[] {
  const deck = new Array<Card>(ints.length);
  for (let i = 0; i < ints.length; i++) {
    const card = intToCard(ints[i]);
    if (card !== null) {
      deck[i] = card;
    } else {
      // Invalid card value - skip or use a default?
      // For now, we'll create a placeholder card
      deck[i] = new Card(Suit.SPADES, Rank.TWO);
    }
  }
  return deck;
}
