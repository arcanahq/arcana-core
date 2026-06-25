// @ts-nocheck
/**
 * Generic Deck Management Library
 *
 * Provides deterministic shuffling and dealing for card games.
 * Supports both standard 52-card decks and Spanish 21 (48-card) decks.
 * Uses index-based card mapping for efficient storage and dealing.
 *
 * Efficient batch dealing (WASM instruction limit):
 * - getShuffledIndices / getShuffledShoeIndices: one shuffle, return indices; index into result for multiple cards.
 * - dealCards / dealCardsFromShoe: deal N cards with at most 1–2 shuffles (2 only when crossing deck/shoe boundary).
 * Use these instead of calling dealCardByIndex / dealCardFromShoe in a loop.
 */

import { Card, Suit, Rank } from "../cards";
import { getRandomValueFromSeed } from "@arcanahq/core/assembly/primitives/random";

/**
 * Base class for deck configuration
 * Provides a flexible interface for any deck configuration
 * Subclasses must implement fromIndex, toIndex, and totalCards
 */
export class DeckConfig {
  /**
   * Get total number of cards in the deck
   */
  get totalCards(): i32 {
    return 0; // Must be overridden
  }
  
  /**
   * Convert an index (0 to totalCards-1) to a Card
   * @param index The card index
   * @returns The Card at that index, or null if invalid
   */
  fromIndex(index: i32): Card | null {
    return null; // Must be overridden
  }
  
  /**
   * Convert a Card to its index (0 to totalCards-1)
   * @param card The card to convert
   * @returns The index of the card, or -1 if not in deck
   */
  toIndex(card: Card): i32 {
    return -1; // Must be overridden
  }
  
  // Backward compatibility properties
  /**
   * @deprecated Use totalCards instead
   */
  get deckSize(): i32 {
    return this.totalCards;
  }
  
  /**
   * Standard 52-card deck
   */
  static standard(): StandardDeckConfig {
    return new StandardDeckConfig();
  }
  
  /**
   * Spanish 21 deck (48 cards, no 10s)
   */
  static spanish21(): Spanish21DeckConfig {
    return new Spanish21DeckConfig();
  }
}

/**
 * Standard 52-card deck configuration
 * Includes all ranks (2-A) in all suits
 */
export class StandardDeckConfig extends DeckConfig {
  private static readonly TOTAL_CARDS: i32 = 52;
  private static readonly RANKS_PER_SUIT: i32 = 13;
  
  get totalCards(): i32 {
    return StandardDeckConfig.TOTAL_CARDS;
  }
  
  fromIndex(index: i32): Card | null {
    if (index < 0 || index >= StandardDeckConfig.TOTAL_CARDS) {
      return null;
    }
    
    const suitIndex = index / StandardDeckConfig.RANKS_PER_SUIT;
    const rankIndex = index % StandardDeckConfig.RANKS_PER_SUIT;
    
    if (suitIndex >= Suit.ALL.length || rankIndex >= Rank.ALL.length) {
      return null;
    }
    
    return new Card(Suit.ALL[suitIndex], Rank.ALL[rankIndex]);
  }
  
  toIndex(card: Card): i32 {
    // Find suit index
    let suitIndex: i32 = -1;
    for (let i = 0; i < Suit.ALL.length; i++) {
      if (Suit.ALL[i] === card.suit) {
        suitIndex = i;
        break;
      }
    }
    
    if (suitIndex < 0) {
      return -1;
    }
    
    // Find rank index
    let rankIndex: i32 = -1;
    for (let i = 0; i < Rank.ALL.length; i++) {
      if (Rank.ALL[i] === card.rank) {
        rankIndex = i;
        break;
      }
    }
    
    if (rankIndex < 0) {
      return -1;
    }
    
    // Standard deck: suitIndex * 13 + rankIndex
    return suitIndex * StandardDeckConfig.RANKS_PER_SUIT + rankIndex;
  }
}

/**
 * Spanish 21 deck configuration (48 cards, no 10s)
 * Excludes all 10s from the deck
 */
export class Spanish21DeckConfig extends DeckConfig {
  private static readonly TOTAL_CARDS: i32 = 48;
  private static readonly RANKS_PER_SUIT: i32 = 12; // 13 ranks - 1 (no 10s)
  
  get totalCards(): i32 {
    return Spanish21DeckConfig.TOTAL_CARDS;
  }
  
  fromIndex(index: i32): Card | null {
    if (index < 0 || index >= Spanish21DeckConfig.TOTAL_CARDS) {
      return null;
    }
    
    const suitIndex = index / Spanish21DeckConfig.RANKS_PER_SUIT;
    const rankIndex = index % Spanish21DeckConfig.RANKS_PER_SUIT;
    
    if (suitIndex >= Suit.ALL.length) {
      return null;
    }
    
    // Map rank index to actual rank (skip 10)
    // Rank.ALL = [2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A]
    // Spanish 21 = [2, 3, 4, 5, 6, 7, 8, 9, J, Q, K, A] (no 10)
    let actualRankIndex: i32;
    if (rankIndex < 8) {
      // 2-9 map directly
      actualRankIndex = rankIndex;
    } else {
      // J, Q, K, A (indices 9, 10, 11, 12 in Rank.ALL)
      actualRankIndex = rankIndex + 1; // Skip 10
    }
    
    if (actualRankIndex >= Rank.ALL.length) {
      return null;
    }
    
    return new Card(Suit.ALL[suitIndex], Rank.ALL[actualRankIndex]);
  }
  
  toIndex(card: Card): i32 {
    // Check if rank is 10 (not allowed in Spanish 21)
    if (card.rank == Rank.TEN) {
      return -1; // 10s not in Spanish 21 deck
    }
    
    // Find suit index
    let suitIndex: i32 = -1;
    for (let i = 0; i < Suit.ALL.length; i++) {
      if (Suit.ALL[i] === card.suit) {
        suitIndex = i;
        break;
      }
    }
    
    if (suitIndex < 0) {
      return -1;
    }
    
    // Find rank index
    let rankIndex: i32 = -1;
    for (let i = 0; i < Rank.ALL.length; i++) {
      if (Rank.ALL[i] === card.rank) {
        rankIndex = i;
        break;
      }
    }
    
    if (rankIndex < 0) {
      return -1;
    }
    
    // Map rank index to Spanish 21 index (skip 10)
    let spanishRankIndex: i32;
    if (rankIndex < 8) {
      // 2-9 map directly
      spanishRankIndex = rankIndex;
    } else if (rankIndex == 8) {
      // 10 is not in Spanish 21
      return -1;
    } else {
      // J, Q, K, A (indices 9, 10, 11, 12) map to 8, 9, 10, 11
      spanishRankIndex = rankIndex - 1;
    }
    
    return suitIndex * Spanish21DeckConfig.RANKS_PER_SUIT + spanishRankIndex;
  }
}

/**
 * Factory functions for creating deck configurations
 * These are static methods on the DeckConfig class
 */
// Note: Factory methods are defined below after the concrete classes

/**
 * Shoe configuration for multi-deck games
 * A shoe contains multiple decks shuffled together
 * Supports any number of decks (1, 2, 4, 6, 8, etc.)
 */
export class ShoeConfig {
  deckConfig: DeckConfig;
  numDecks: i32 = 1; // Number of decks in the shoe (can be any positive integer)
  
  /**
   * Create a shoe configuration with any number of decks
   * @param deckConfig The deck configuration (standard or Spanish 21)
   * @param numDecks Number of decks in the shoe (must be >= 1)
   */
  constructor(deckConfig: DeckConfig, numDecks: i32 = 1) {
    if (numDecks < 1) {
      throw new Error("Number of decks must be at least 1");
    }
    this.deckConfig = deckConfig;
    this.numDecks = numDecks;
  }
  
  /**
   * Get total number of cards in the shoe
   */
  getShoeSize(): i32 {
    return this.deckConfig.totalCards * this.numDecks;
  }
  
  /**
   * Create a shoe with any number of standard decks
   * @param numDecks Number of decks (1, 2, 4, 6, 8, etc.)
   */
  static standard(numDecks: i32 = 1): ShoeConfig {
    return new ShoeConfig(DeckConfig.standard(), numDecks);
  }
  
  /**
   * Create a shoe with any number of Spanish 21 decks
   * @param numDecks Number of decks (1, 2, 4, 6, 8, etc.)
   */
  static spanish21(numDecks: i32 = 1): ShoeConfig {
    return new ShoeConfig(DeckConfig.spanish21(), numDecks);
  }
  
  /**
   * Create a shoe with a custom deck configuration and any number of decks
   * This is the most flexible method - you can use any DeckConfig
   * 
   * @param deckConfig Custom deck configuration (e.g., DeckConfig.spanish21(), DeckConfig.standard(), or a custom one)
   * @param numDecks Number of decks (1, 2, 4, 6, 8, etc.)
   * 
   * @example
   * // Spanish 21 shoe with 6 decks
   * const shoe = ShoeConfig.withDeck(DeckConfig.spanish21(), 6);
   * 
   * // Standard deck shoe with 8 decks
   * const shoe = ShoeConfig.withDeck(DeckConfig.standard(), 8);
   * 
   * // Custom deck configuration
   * const customDeck = new DeckConfig(52, true);
   * const shoe = ShoeConfig.withDeck(customDeck, 4);
   */
  static withDeck(deckConfig: DeckConfig, numDecks: i32 = 1): ShoeConfig {
    return new ShoeConfig(deckConfig, numDecks);
  }
  
  /**
   * Create a shoe with custom deck configuration and any number of decks
   * @deprecated Use ShoeConfig.withDeck() instead for better clarity
   * @param deckConfig Custom deck configuration
   * @param numDecks Number of decks (1, 2, 4, 6, 8, etc.)
   */
  static custom(deckConfig: DeckConfig, numDecks: i32 = 1): ShoeConfig {
    return new ShoeConfig(deckConfig, numDecks);
  }
  
  // Convenience methods for common configurations (backward compatibility)
  
  /**
   * Single standard deck (52 cards)
   * @deprecated Use ShoeConfig.standard(1) instead
   */
  static singleDeck(): ShoeConfig {
    return new ShoeConfig(DeckConfig.standard(), 1);
  }
  
  /**
   * 6-deck shoe (312 cards)
   * @deprecated Use ShoeConfig.standard(6) instead
   */
  static sixDeck(): ShoeConfig {
    return new ShoeConfig(DeckConfig.standard(), 6);
  }
  
  /**
   * 8-deck shoe (416 cards)
   * @deprecated Use ShoeConfig.standard(8) instead
   */
  static eightDeck(): ShoeConfig {
    return new ShoeConfig(DeckConfig.standard(), 8);
  }
  
  /**
   * Spanish 21 single deck (48 cards)
   * @deprecated Use ShoeConfig.spanish21(1) instead
   */
  static spanish21SingleDeck(): ShoeConfig {
    return new ShoeConfig(DeckConfig.spanish21(), 1);
  }
  
  /**
   * Spanish 21 6-deck shoe (288 cards)
   * @deprecated Use ShoeConfig.spanish21(6) instead
   */
  static spanish21SixDeck(): ShoeConfig {
    return new ShoeConfig(DeckConfig.spanish21(), 6);
  }
  
  /**
   * Spanish 21 8-deck shoe (384 cards)
   * @deprecated Use ShoeConfig.spanish21(8) instead
   */
  static spanish21EightDeck(): ShoeConfig {
    return new ShoeConfig(DeckConfig.spanish21(), 8);
  }
}

/**
 * Card index mapping utilities
 * 
 * @deprecated Use DeckConfig.fromIndex() and DeckConfig.toIndex() instead
 * This class is kept for backward compatibility
 */
export class CardIndexMapper {
  /**
   * Convert card index to Card object
   * @deprecated Use config.fromIndex(index) instead
   */
  static indexToCard(index: i32, config: DeckConfig): Card | null {
    return config.fromIndex(index);
  }
  
  /**
   * Convert Card object to index
   * @deprecated Use config.toIndex(card) instead
   */
  static cardToIndex(card: Card, config: DeckConfig): i32 {
    return config.toIndex(card);
  }
  
  /**
   * Create unshuffled shoe indices for a multi-deck shoe
   * Combines multiple decks into a single shoe
   */
  static createUnshuffledShoeIndices(shoeConfig: ShoeConfig): i32[] {
    const deckSize = shoeConfig.deckConfig.totalCards;
    const numDecks = shoeConfig.numDecks;
    const shoeSize = deckSize * numDecks;
    
    const shoeIndices = new Array<i32>(shoeSize);
    
    // For each deck in the shoe
    for (let deckNum = 0; deckNum < numDecks; deckNum++) {
      // Create unshuffled deck indices for this deck
      const deckIndices = CardIndexMapper.createUnshuffledDeckIndices(shoeConfig.deckConfig);
      
      // Add deck indices to shoe (each deck has the same card order)
      for (let i = 0; i < deckSize; i++) {
        shoeIndices[deckNum * deckSize + i] = deckIndices[i];
      }
    }
    
    return shoeIndices;
  }
  
  /**
   * Create unshuffled deck as array of indices
   * Uses the deck config's toIndex method to generate indices
   */
  static createUnshuffledDeckIndices(config: DeckConfig): i32[] {
    const totalCards = config.totalCards;
    const indices = new Array<i32>(totalCards);
    
    // Generate all valid cards and map them to indices
    // For standard deck: iterate through all suits and ranks
    // For Spanish 21: iterate through all suits and ranks except 10s
    
    // Generic approach: try all possible cards and use toIndex
    // This works for any deck configuration
    let index = 0;
    for (let s = 0; s < Suit.ALL.length; s++) {
      for (let r = 0; r < Rank.ALL.length; r++) {
        const card = new Card(Suit.ALL[s], Rank.ALL[r]);
        const cardIndex = config.toIndex(card);
        if (cardIndex >= 0 && cardIndex < totalCards) {
          indices[index] = cardIndex;
          index++;
          if (index >= totalCards) {
            break;
          }
        }
      }
      if (index >= totalCards) {
        break;
      }
    }
    
    return indices;
  }
}

/**
 * Deterministic shuffle using Fisher-Yates algorithm
 * Shuffles an array of card indices
 */
export function deterministicShuffleIndices(
  indices: i32[],
  shuffleId: string,
  shuffleSalt: string,
  seedIndex: i32
): i32[] {
  const shuffled = new Array<i32>(indices.length);
  // Copy indices
  for (let i = 0; i < indices.length; i++) {
    shuffled[i] = indices[i];
  }
  
  // Create seed from shuffleId, salt, and seedIndex
  const seed = shuffleId + ":" + shuffleSalt + ":" + seedIndex.toString();
  
  // Fisher-Yates shuffle with deterministic random
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Get deterministic random value
    const randomResult = getRandomValueFromSeed(seed, i);
    const randomValue = randomResult.value;
    
    // Map [0, 1) to [0, i+1)
    const j = <i32>(randomValue * <f64>(i + 1));
    
    // Swap
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  
  return shuffled;
}

/**
 * Deal a card by index from a deterministically shuffled deck
 * Returns the Card object at the specified position
 * 
 * @deprecated Use dealCardFromShoe for multi-deck support
 */
export function dealCardByIndex(
  shuffleId: string,
  shuffleSalt: string,
  dealtCardCount: i32,
  config: DeckConfig
): Card {
  // Create unshuffled deck indices
  const unshuffledIndices = CardIndexMapper.createUnshuffledDeckIndices(config);
  
  // Determine which shuffle iteration we're on
  const shuffleIteration = dealtCardCount / config.totalCards;
  const cardIndexInShuffle = dealtCardCount % config.totalCards;
  
  // Shuffle deterministically
  const shuffledIndices = deterministicShuffleIndices(
    unshuffledIndices,
    shuffleId,
    shuffleSalt,
    shuffleIteration
  );
  
  // Get the card index at the position
  const cardIndex = shuffledIndices[cardIndexInShuffle];
  
  // Convert index to Card using deck config
  const card = config.fromIndex(cardIndex);
  if (card === null) {
    // Fallback: return a default card (shouldn't happen)
    return new Card(Suit.SPADES, Rank.TWO);
  }
  
  return card;
}

/**
 * Deal a card from a multi-deck shoe
 * Handles shoe exhaustion and reshuffling automatically
 * 
 * @param shuffleId Unique identifier for the shuffle
 * @param shuffleSalt Secret salt for shuffle verification
 * @param shoePosition Current position in the shoe (0 to shoeSize-1)
 * @param shoeConfig Shoe configuration (number of decks, deck type)
 * @returns The card at the current shoe position
 */
export function dealCardFromShoe(
  shuffleId: string,
  shuffleSalt: string,
  shoePosition: i32,
  shoeConfig: ShoeConfig
): Card {
  const shoeSize = shoeConfig.getShoeSize();
  
  // If we've exhausted the shoe, reshuffle
  // Determine which shoe iteration we're on
  const shoeIteration = shoePosition / shoeSize;
  const positionInShoe = shoePosition % shoeSize;
  
  // Create unshuffled shoe indices (all decks combined)
  const unshuffledShoeIndices = CardIndexMapper.createUnshuffledShoeIndices(shoeConfig);
  
  // Shuffle the entire shoe deterministically
  const shuffledShoeIndices = deterministicShuffleIndices(
    unshuffledShoeIndices,
    shuffleId,
    shuffleSalt,
    shoeIteration
  );
  
  // Get the card index at the position in the current shoe
  const cardIndex = shuffledShoeIndices[positionInShoe];
  
  // Convert index to Card using deck config
  const card = shoeConfig.deckConfig.fromIndex(cardIndex);
  if (card === null) {
    // Fallback: return a default card (shouldn't happen)
    return new Card(Suit.SPADES, Rank.TWO);
  }
  
  return card;
}

/**
 * Get shuffled shoe indices for one shoe block (one shuffle).
 * Efficient: call once per batch of cards from the shoe, then index into the returned array.
 *
 * @param shuffleId Unique identifier for the shuffle
 * @param shuffleSalt Salt for deterministic shuffle
 * @param shoeIteration Which shoe block (0 = first shoe, 1 = next, etc.)
 * @param shoeConfig Shoe configuration
 * @returns Shuffled indices for the shoe; card at position i is shoeConfig.deckConfig.fromIndex(result[i])
 */
export function getShuffledShoeIndices(
  shuffleId: string,
  shuffleSalt: string,
  shoeIteration: i32,
  shoeConfig: ShoeConfig
): i32[] {
  const unshuffledShoeIndices = CardIndexMapper.createUnshuffledShoeIndices(shoeConfig);
  return deterministicShuffleIndices(
    unshuffledShoeIndices,
    shuffleId,
    shuffleSalt,
    shoeIteration
  );
}

/**
 * Deal multiple cards from a shoe with at most one or two shuffles (two only when crossing the shoe boundary).
 * Use this instead of calling dealCardFromShoe in a loop to stay within WASM instruction limits.
 *
 * @param shuffleId Unique identifier for the shuffle
 * @param shuffleSalt Salt for deterministic shuffle
 * @param shoePosition Current position in the shoe (number of cards already dealt)
 * @param count Number of cards to deal
 * @param shoeConfig Shoe configuration
 * @returns Array of count cards; caller must advance shoePosition by count
 */
export function dealCardsFromShoe(
  shuffleId: string,
  shuffleSalt: string,
  shoePosition: i32,
  count: i32,
  shoeConfig: ShoeConfig
): Card[] {
  const result = new Array<Card>();
  if (count <= 0) return result;
  const shoeSize = shoeConfig.getShoeSize();
  const shoeIteration = shoePosition / shoeSize;
  const base = shoePosition % shoeSize;
  const indices0 = getShuffledShoeIndices(shuffleId, shuffleSalt, shoeIteration, shoeConfig);
  let indices1: i32[] = [];
  if (base + count > shoeSize) {
    indices1 = getShuffledShoeIndices(shuffleId, shuffleSalt, shoeIteration + 1, shoeConfig);
  }
  const config = shoeConfig.deckConfig;
  for (let i = 0; i < count; i++) {
    const idx = base + i;
    const cardIndex = idx < shoeSize ? indices0[idx] : indices1[idx - shoeSize];
    const card = config.fromIndex(cardIndex);
    if (card !== null) {
      result.push(card);
    } else {
      result.push(new Card(Suit.SPADES, Rank.TWO));
    }
  }
  return result;
}

/**
 * Create a full shuffled deck as Card objects
 * Useful for testing or when you need the entire deck
 */
export function createShuffledDeck(
  shuffleId: string,
  shuffleSalt: string,
  seedIndex: i32,
  config: DeckConfig
): Card[] {
  const unshuffledIndices = CardIndexMapper.createUnshuffledDeckIndices(config);
  const shuffledIndices = deterministicShuffleIndices(
    unshuffledIndices,
    shuffleId,
    shuffleSalt,
    seedIndex
  );
  
  const deck = new Array<Card>(config.totalCards);
  for (let i = 0; i < config.totalCards; i++) {
    const card = config.fromIndex(shuffledIndices[i]);
    if (card !== null) {
      deck[i] = card;
    } else {
      // Fallback
      deck[i] = new Card(Suit.SPADES, Rank.TWO);
    }
  }
  
  return deck;
}

/**
 * Get shuffled indices for one deck block (one shuffle).
 * Efficient: call once per batch of cards, then index into the returned array.
 * Use when dealing multiple cards in the same action to avoid instruction limit.
 *
 * @param shuffleId Unique identifier for the shuffle
 * @param shuffleSalt Salt for deterministic shuffle
 * @param seedIndex Which 52-card block (0 = first deck, 1 = next deck, etc.)
 * @param config Deck configuration
 * @returns Shuffled indices; card at position i is config.fromIndex(result[i])
 */
export function getShuffledIndices(
  shuffleId: string,
  shuffleSalt: string,
  seedIndex: i32,
  config: DeckConfig
): i32[] {
  const unshuffledIndices = CardIndexMapper.createUnshuffledDeckIndices(config);
  return deterministicShuffleIndices(unshuffledIndices, shuffleId, shuffleSalt, seedIndex);
}

/**
 * Deal multiple cards with at most one or two shuffles (two only when crossing the deck boundary).
 * Use this instead of calling dealCardByIndex in a loop to stay within WASM instruction limits.
 *
 * @param shuffleId Unique identifier for the shuffle
 * @param shuffleSalt Salt for deterministic shuffle
 * @param dealtCardCount Current position (number of cards already dealt)
 * @param count Number of cards to deal
 * @param config Deck configuration
 * @returns Array of count cards; caller must advance dealtCardCount by count
 */
export function dealCards(
  shuffleId: string,
  shuffleSalt: string,
  dealtCardCount: i32,
  count: i32,
  config: DeckConfig
): Card[] {
  const result = new Array<Card>();
  if (count <= 0) return result;
  const deckSize = config.totalCards;
  const seedIndex0 = dealtCardCount / deckSize;
  const base = dealtCardCount % deckSize;
  const indices0 = getShuffledIndices(shuffleId, shuffleSalt, seedIndex0, config);
  let indices1: i32[] = [];
  if (base + count > deckSize) {
    indices1 = getShuffledIndices(shuffleId, shuffleSalt, seedIndex0 + 1, config);
  }
  for (let i = 0; i < count; i++) {
    const idx = base + i;
    const cardIndex = idx < deckSize ? indices0[idx] : indices1[idx - deckSize];
    const card = config.fromIndex(cardIndex);
    if (card !== null) {
      result.push(card);
    } else {
      result.push(new Card(Suit.SPADES, Rank.TWO));
    }
  }
  return result;
}

/**
 * Create unshuffled deck as Card objects
 */
export function createUnshuffledDeck(config: DeckConfig): Card[] {
  const indices = CardIndexMapper.createUnshuffledDeckIndices(config);
  const deck = new Array<Card>(config.totalCards);
  
  for (let i = 0; i < config.totalCards; i++) {
    const card = config.fromIndex(indices[i]);
    if (card !== null) {
      deck[i] = card;
    } else {
      // Fallback
      deck[i] = new Card(Suit.SPADES, Rank.TWO);
    }
  }
  
  return deck;
}
