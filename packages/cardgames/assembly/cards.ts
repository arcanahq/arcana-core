// @ts-nocheck
/**
 * Deck of Cards Library
 * 
 * Provides Card, Suit, and Rank classes for card games.
 * All operations are deterministic when using seeded randomness.
 */

import { getRandomIntInRange, RandomSeed, RandomResult } from "@arcanahq/core/assembly/primitives/random";

// Card suit constants
export class Suit {
  static readonly SPADES: string = "♠";
  static readonly HEARTS: string = "♥";
  static readonly DIAMONDS: string = "♦";
  static readonly CLUBS: string = "♣";
  
  static readonly ALL: string[] = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS];
  
  static isValid(suit: string): bool {
    return suit === Suit.SPADES || suit === Suit.HEARTS || suit === Suit.DIAMONDS || suit === Suit.CLUBS;
  }
}

// Card rank constants
export class Rank {
  static readonly TWO: string = "2";
  static readonly THREE: string = "3";
  static readonly FOUR: string = "4";
  static readonly FIVE: string = "5";
  static readonly SIX: string = "6";
  static readonly SEVEN: string = "7";
  static readonly EIGHT: string = "8";
  static readonly NINE: string = "9";
  static readonly TEN: string = "10";
  static readonly JACK: string = "J";
  static readonly QUEEN: string = "Q";
  static readonly KING: string = "K";
  static readonly ACE: string = "A";
  
  static readonly ALL: string[] = [
    Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
    Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE
  ];
  
  static isValid(rank: string): bool {
    for (let i = 0; i < Rank.ALL.length; i++) {
      if (Rank.ALL[i] === rank) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Get numeric value for comparison (2=2, A=14)
   */
  static getValue(rank: string): i32 {
    if (rank === Rank.TWO) return 2;
    if (rank === Rank.THREE) return 3;
    if (rank === Rank.FOUR) return 4;
    if (rank === Rank.FIVE) return 5;
    if (rank === Rank.SIX) return 6;
    if (rank === Rank.SEVEN) return 7;
    if (rank === Rank.EIGHT) return 8;
    if (rank === Rank.NINE) return 9;
    if (rank === Rank.TEN) return 10;
    if (rank === Rank.JACK) return 11;
    if (rank === Rank.QUEEN) return 12;
    if (rank === Rank.KING) return 13;
    if (rank === Rank.ACE) return 14;
    return 0;
  }
}

/**
 * Card class representing a single playing card
 */
export class Card {
  suit: string;
  rank: string;
  
  constructor(suit: string, rank: string) {
    this.suit = suit;
    this.rank = rank;
  }
  
  static fromString(str: string): Card | null {
    // Format: "As" (Ace of spades), "Kh" (King of hearts), "2d" (2 of diamonds), "Tc" (10 of clubs)
    if (str.length < 2) return null;
    
    const rankStr = str.substring(0, str.length - 1);
    const suitStr = str.substring(str.length - 1);
    
    // Map suit characters
    let suit: string = "";
    if (suitStr === "s" || suitStr === "S") suit = Suit.SPADES;
    else if (suitStr === "h" || suitStr === "H") suit = Suit.HEARTS;
    else if (suitStr === "d" || suitStr === "D") suit = Suit.DIAMONDS;
    else if (suitStr === "c" || suitStr === "C") suit = Suit.CLUBS;
    else return null;
    
    // Map rank characters
    let rank: string = "";
    if (rankStr === "2") rank = Rank.TWO;
    else if (rankStr === "3") rank = Rank.THREE;
    else if (rankStr === "4") rank = Rank.FOUR;
    else if (rankStr === "5") rank = Rank.FIVE;
    else if (rankStr === "6") rank = Rank.SIX;
    else if (rankStr === "7") rank = Rank.SEVEN;
    else if (rankStr === "8") rank = Rank.EIGHT;
    else if (rankStr === "9") rank = Rank.NINE;
    else if (rankStr === "T" || rankStr === "t" || rankStr === "10") rank = Rank.TEN;
    else if (rankStr === "J" || rankStr === "j") rank = Rank.JACK;
    else if (rankStr === "Q" || rankStr === "q") rank = Rank.QUEEN;
    else if (rankStr === "K" || rankStr === "k") rank = Rank.KING;
    else if (rankStr === "A" || rankStr === "a") rank = Rank.ACE;
    else return null;
    
    return new Card(suit, rank);
  }
  
  toString(): string {
    let rankStr: string = "";
    if (this.rank === Rank.TWO) rankStr = "2";
    else if (this.rank === Rank.THREE) rankStr = "3";
    else if (this.rank === Rank.FOUR) rankStr = "4";
    else if (this.rank === Rank.FIVE) rankStr = "5";
    else if (this.rank === Rank.SIX) rankStr = "6";
    else if (this.rank === Rank.SEVEN) rankStr = "7";
    else if (this.rank === Rank.EIGHT) rankStr = "8";
    else if (this.rank === Rank.NINE) rankStr = "9";
    else if (this.rank === Rank.TEN) rankStr = "T";
    else if (this.rank === Rank.JACK) rankStr = "J";
    else if (this.rank === Rank.QUEEN) rankStr = "Q";
    else if (this.rank === Rank.KING) rankStr = "K";
    else if (this.rank === Rank.ACE) rankStr = "A";
    else rankStr = "?";
    
    let suitStr: string = "";
    if (this.suit === Suit.SPADES) suitStr = "s";
    else if (this.suit === Suit.HEARTS) suitStr = "h";
    else if (this.suit === Suit.DIAMONDS) suitStr = "d";
    else if (this.suit === Suit.CLUBS) suitStr = "c";
    else suitStr = "?";
    
    return rankStr + suitStr;
  }
  
  equals(other: Card | null): bool {
    if (other === null) return false;
    return this.suit === other.suit && this.rank === other.rank;
  }
  
  getValue(): i32 {
    return Rank.getValue(this.rank);
  }
}

/**
 * Hand rank types for poker evaluation
 */
export class HandType {
  static readonly HIGH_CARD: i32 = 1;
  static readonly PAIR: i32 = 2;
  static readonly TWO_PAIR: i32 = 3;
  static readonly THREE_OF_A_KIND: i32 = 4;
  static readonly STRAIGHT: i32 = 5;
  static readonly FLUSH: i32 = 6;
  static readonly FULL_HOUSE: i32 = 7;
  static readonly FOUR_OF_A_KIND: i32 = 8;
  static readonly STRAIGHT_FLUSH: i32 = 9;
  static readonly ROYAL_FLUSH: i32 = 10;
}

/**
 * HandRank represents the strength of a poker hand
 */
export class HandRank {
  handType: i32;
  kickers: i32[]; // Sorted descending, used for tie-breaking
  
  constructor(handType: i32, kickers: i32[] = []) {
    this.handType = handType;
    this.kickers = kickers;
  }
  
  /**
   * Compare two hand ranks
   * Returns: -1 if this < other, 0 if equal, 1 if this > other
   */
  compare(other: HandRank): i32 {
    if (this.handType < other.handType) return -1;
    if (this.handType > other.handType) return 1;
    
    // Same hand type, compare kickers
    const maxLen = this.kickers.length > other.kickers.length ? this.kickers.length : other.kickers.length;
    for (let i = 0; i < maxLen; i++) {
      const thisKicker = i < this.kickers.length ? this.kickers[i] : 0;
      const otherKicker = i < other.kickers.length ? other.kickers[i] : 0;
      if (thisKicker < otherKicker) return -1;
      if (thisKicker > otherKicker) return 1;
    }
    
    return 0;
  }
}

/**
 * Deck class representing a standard 52-card deck
 */
export class Deck {
  cards: Card[];
  
  constructor() {
    this.cards = new Array<Card>(52);
    let idx = 0;
    for (let s = 0; s < Suit.ALL.length; s++) {
      for (let r = 0; r < Rank.ALL.length; r++) {
        this.cards[idx] = new Card(Suit.ALL[s], Rank.ALL[r]);
        idx++;
      }
    }
  }
  
  /**
   * Create a new deck from existing cards (for deserialization)
   */
  static fromCards(cards: Card[]): Deck {
    const deck = new Deck();
    deck.cards = cards;
    return deck;
  }
  
  /**
   * Shuffle the deck using Fisher-Yates algorithm with deterministic randomness
   */
  shuffle(seed: RandomSeed): RandomSeed {
    const n = this.cards.length;
    let currentSeed = seed;
    
    for (let i = n - 1; i > 0; i--) {
      // Get random index from 0 to i (inclusive)
      const result = getRandomIntInRange(currentSeed, 0, i + 1);
      const j = <i32>result.value;
      currentSeed = result.seed;
      
      // Swap cards[i] and cards[j]
      const temp = this.cards[i];
      this.cards[i] = this.cards[j];
      this.cards[j] = temp;
    }
    
    return currentSeed;
  }
  
  /**
   * Deal one card from the top of the deck
   */
  dealCard(): Card | null {
    if (this.cards.length === 0) return null;
    return this.cards.pop();
  }
  
  /**
   * Deal multiple cards
   */
  dealCards(count: i32): Card[] {
    const dealt = new Array<Card>(0);
    for (let i = 0; i < count; i++) {
      const card = this.dealCard();
      if (card !== null) {
        dealt.push(card);
      } else {
        break;
      }
    }
    return dealt;
  }
  
  /**
   * Burn a card (remove without returning)
   */
  burnCard(): bool {
    return this.dealCard() !== null;
  }
  
  /**
   * Get number of cards remaining
   */
  size(): i32 {
    return this.cards.length;
  }
  
  /**
   * Check if deck is empty
   */
  isEmpty(): bool {
    return this.cards.length === 0;
  }
  
  /**
   * Get a copy of the deck
   */
  clone(): Deck {
    const newDeck = new Deck();
    newDeck.cards = new Array<Card>(this.cards.length);
    for (let i = 0; i < this.cards.length; i++) {
      newDeck.cards[i] = this.cards[i];
    }
    return newDeck;
  }
}

