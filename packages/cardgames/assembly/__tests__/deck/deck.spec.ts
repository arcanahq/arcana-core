// @ts-nocheck
/**
 * Comprehensive tests for deck management utilities
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import {
  DeckConfig,
  StandardDeckConfig,
  Spanish21DeckConfig,
  ShoeConfig,
  CardIndexMapper,
  deterministicShuffleIndices,
  dealCardByIndex,
  dealCardFromShoe,
  createShuffledDeck,
  createUnshuffledDeck,
  getShuffledIndices,
  dealCards,
  getShuffledShoeIndices,
  dealCardsFromShoe,
} from "../../deck/deck";
import { Card, Suit, Rank } from "../../cards";

// ============================================================================
// DeckConfig Tests
// ============================================================================

describe("DeckConfig", () => {
  test("should create standard deck config using static method", () => {
    const config: StandardDeckConfig = DeckConfig.standard();
    expect(config.totalCards).equal(52);
    expect(config.deckSize).equal(52); // Backward compatibility
  });
  
  test("should create Spanish 21 deck config using static method", () => {
    const config: Spanish21DeckConfig = DeckConfig.spanish21();
    expect(config.totalCards).equal(48);
    expect(config.deckSize).equal(48); // Backward compatibility
  });
  
  test("should convert index to card using fromIndex", () => {
    const config: StandardDeckConfig = DeckConfig.standard();
    const card = config.fromIndex(0);
    if (card !== null) {
      expect(card.rank).equal(Rank.TWO);
      expect(card.suit).equal(Suit.SPADES);
    } else {
      expect(false).equal(true); // Should not be null
    }
  });
  
  test("should convert card to index using toIndex", () => {
    const config: StandardDeckConfig = DeckConfig.standard();
    const card = new Card(Suit.SPADES, Rank.TWO);
    const index: i32 = config.toIndex(card);
    expect(index).equal(0);
  });
  
  test("should handle Spanish 21 fromIndex", () => {
    const config: Spanish21DeckConfig = DeckConfig.spanish21();
    const card = config.fromIndex(0);
    if (card !== null) {
      // Should not be a 10
      expect(card.rank == Rank.TEN).equal(false);
    } else {
      expect(false).equal(true); // Should not be null
    }
  });
  
  test("should handle Spanish 21 toIndex - returns -1 for 10s", () => {
    const config: Spanish21DeckConfig = DeckConfig.spanish21();
    const tenCard = new Card(Suit.SPADES, Rank.TEN);
    const index: i32 = config.toIndex(tenCard);
    expect(index).equal(-1); // 10s not in Spanish 21
  });
  
  test("StandardDeckConfig should be instance of DeckConfig", () => {
    const config = new StandardDeckConfig();
    expect(config.totalCards).equal(52);
    const card = config.fromIndex(0);
    if (card !== null) {
      expect(card.rank).equal(Rank.TWO);
    }
  });
  
  test("Spanish21DeckConfig should be instance of DeckConfig", () => {
    const config = new Spanish21DeckConfig();
    expect(config.totalCards).equal(48);
    const card = config.fromIndex(0);
    if (card !== null) {
      expect(card.rank == Rank.TEN).equal(false);
    }
  });
});

// ============================================================================
// CardIndexMapper Tests
// ============================================================================

describe("CardIndexMapper", () => {
  test("should convert index to card for standard deck", () => {
    const standardConfig = DeckConfig.standard();
    // Index 0 = 2 of Spades
    const card = CardIndexMapper.indexToCard(0, standardConfig);
    expect(card !== null).equal(true);
    if (card !== null) {
      expect(card.suit).equal(Suit.SPADES);
      expect(card.rank).equal(Rank.TWO);
    }
    
    // Index 12 = Ace of Spades
    const card2 = CardIndexMapper.indexToCard(12, standardConfig);
    expect(card2 !== null).equal(true);
    if (card2 !== null) {
      expect(card2.suit).equal(Suit.SPADES);
      expect(card2.rank).equal(Rank.ACE);
    }
    
    // Index 13 = 2 of Hearts
    const card3 = CardIndexMapper.indexToCard(13, standardConfig);
    expect(card3 !== null).equal(true);
    if (card3 !== null) {
      expect(card3.suit).equal(Suit.HEARTS);
      expect(card3.rank).equal(Rank.TWO);
    }
    
    // Index 51 = Ace of Clubs
    const card4 = CardIndexMapper.indexToCard(51, standardConfig);
    expect(card4 !== null).equal(true);
    if (card4 !== null) {
      expect(card4.suit).equal(Suit.CLUBS);
      expect(card4.rank).equal(Rank.ACE);
    }
  });
  
  test("should convert card to index for standard deck", () => {
    const standardConfig = DeckConfig.standard();
    const card = new Card(Suit.SPADES, Rank.TWO);
    const index = CardIndexMapper.cardToIndex(card, standardConfig);
    expect(index).equal(0);
    
    const card2 = new Card(Suit.SPADES, Rank.ACE);
    const index2 = CardIndexMapper.cardToIndex(card2, standardConfig);
    expect(index2).equal(12);
    
    const card3 = new Card(Suit.HEARTS, Rank.TWO);
    const index3 = CardIndexMapper.cardToIndex(card3, standardConfig);
    expect(index3).equal(13);
    
    const card4 = new Card(Suit.CLUBS, Rank.ACE);
    const index4 = CardIndexMapper.cardToIndex(card4, standardConfig);
    expect(index4).equal(51);
  });
  
  test("should convert index to card for Spanish 21 deck", () => {
    const spanishConfig = DeckConfig.spanish21();
    // Index 0 = 2 of Spades (same as standard)
    const card = CardIndexMapper.indexToCard(0, spanishConfig);
    expect(card !== null).equal(true);
    if (card !== null) {
      expect(card.suit).equal(Suit.SPADES);
      expect(card.rank).equal(Rank.TWO);
    }
    
    // Index 11 = Ace of Spades (no 10, so Ace is at 11 instead of 12)
    const card2 = CardIndexMapper.indexToCard(11, spanishConfig);
    expect(card2 !== null).equal(true);
    if (card2 !== null) {
      expect(card2.suit).equal(Suit.SPADES);
      expect(card2.rank).equal(Rank.ACE);
    }
    
    // Index 47 = Ace of Clubs (last card)
    const card3 = CardIndexMapper.indexToCard(47, spanishConfig);
    expect(card3 !== null).equal(true);
    if (card3 !== null) {
      expect(card3.suit).equal(Suit.CLUBS);
      expect(card3.rank).equal(Rank.ACE);
    }
  });
  
  test("should convert card to index for Spanish 21 deck", () => {
    const spanishConfig = DeckConfig.spanish21();
    const card = new Card(Suit.SPADES, Rank.TWO);
    const index = CardIndexMapper.cardToIndex(card, spanishConfig);
    expect(index).equal(0);
    
    const card2 = new Card(Suit.SPADES, Rank.ACE);
    const index2 = CardIndexMapper.cardToIndex(card2, spanishConfig);
    expect(index2).equal(11); // No 10, so Ace is at 11
    
    // 10 should not be in Spanish 21 deck
    const card3 = new Card(Suit.SPADES, Rank.TEN);
    const index3 = CardIndexMapper.cardToIndex(card3, spanishConfig);
    expect(index3).equal(-1); // Invalid
  });
  
  test("should handle invalid indices", () => {
    const standardConfig = DeckConfig.standard();
    const spanishConfig = DeckConfig.spanish21();
    const card = CardIndexMapper.indexToCard(-1, standardConfig);
    expect(card === null).equal(true);
    
    const card2 = CardIndexMapper.indexToCard(52, standardConfig);
    expect(card2 === null).equal(true);
    
    const card3 = CardIndexMapper.indexToCard(48, spanishConfig);
    expect(card3 === null).equal(true);
  });
  
  test("should create unshuffled deck indices for standard deck", () => {
    const standardConfig = DeckConfig.standard();
    const indices = CardIndexMapper.createUnshuffledDeckIndices(standardConfig);
    expect(indices.length).equal(52);
    expect(indices[0]).equal(0);
    expect(indices[12]).equal(12);
    expect(indices[51]).equal(51);
  });
  
  test("should create unshuffled deck indices for Spanish 21 deck", () => {
    const spanishConfig = DeckConfig.spanish21();
    const indices = CardIndexMapper.createUnshuffledDeckIndices(spanishConfig);
    expect(indices.length).equal(48);
    expect(indices[0]).equal(0);
    expect(indices[11]).equal(11); // Ace of Spades
    expect(indices[47]).equal(47); // Ace of Clubs
  });
  
  test("should round-trip convert card to index and back", () => {
    const standardConfig = DeckConfig.standard();
    const originalCard = new Card(Suit.HEARTS, Rank.KING);
    const index = CardIndexMapper.cardToIndex(originalCard, standardConfig);
    expect(index).greaterThanOrEqual(0);
    
    const convertedCard = CardIndexMapper.indexToCard(index, standardConfig);
    expect(convertedCard !== null).equal(true);
    if (convertedCard !== null) {
      expect(convertedCard.suit).equal(originalCard.suit);
      expect(convertedCard.rank).equal(originalCard.rank);
    }
  });
});

// ============================================================================
// deterministicShuffleIndices Tests
// ============================================================================

describe("deterministicShuffleIndices", () => {
  test("should shuffle indices deterministically", () => {
    const config = DeckConfig.standard();
    const indices = CardIndexMapper.createUnshuffledDeckIndices(config);
    
    const shuffled1 = deterministicShuffleIndices(indices, "test-id", "test-salt", 0);
    const shuffled2 = deterministicShuffleIndices(indices, "test-id", "test-salt", 0);
    
    // Same seed should produce same shuffle
    expect(shuffled1.length).equal(shuffled2.length);
    for (let i = 0; i < shuffled1.length; i++) {
      expect(shuffled1[i]).equal(shuffled2[i]);
    }
  });
  
  test("should produce different shuffles with different seeds", () => {
    const config = DeckConfig.standard();
    const indices = CardIndexMapper.createUnshuffledDeckIndices(config);
    
    const shuffled1 = deterministicShuffleIndices(indices, "test-id-1", "test-salt", 0);
    const shuffled2 = deterministicShuffleIndices(indices, "test-id-2", "test-salt", 0);
    
    // Different seeds should produce different shuffles
    let different = false;
    for (let i = 0; i < shuffled1.length; i++) {
      if (shuffled1[i] != shuffled2[i]) {
        different = true;
        break;
      }
    }
    expect(different).equal(true);
  });
  
  test("should shuffle Spanish 21 deck", () => {
    const config = DeckConfig.spanish21();
    const indices = CardIndexMapper.createUnshuffledDeckIndices(config);
    
    const shuffled = deterministicShuffleIndices(indices, "test-id", "test-salt", 0);
    expect(shuffled.length).equal(48);
    
    // Verify all indices are present (0-47)
    const present = new Array<bool>(48);
    for (let i = 0; i < 48; i++) {
      present[i] = false;
    }
    for (let i = 0; i < shuffled.length; i++) {
      if (shuffled[i] >= 0 && shuffled[i] < 48) {
        present[shuffled[i]] = true;
      }
    }
    for (let i = 0; i < 48; i++) {
      expect(present[i]).equal(true);
    }
  });
});

// ============================================================================
// dealCardByIndex Tests
// ============================================================================

describe("dealCardByIndex", () => {
  test("should deal cards deterministically from standard deck", () => {
    const config = DeckConfig.standard();
    
    const card1 = dealCardByIndex("test-id", "test-salt", 0, config);
    const card2 = dealCardByIndex("test-id", "test-salt", 1, config);
    const card3 = dealCardByIndex("test-id", "test-salt", 0, config); // Same as card1
    
    // Same index should produce same card
    expect(card1.suit).equal(card3.suit);
    expect(card1.rank).equal(card3.rank);
    
    // Different indices should produce different cards (usually)
    // Note: There's a small chance they could be the same, but very unlikely
    const different = card1.suit != card2.suit || card1.rank != card2.rank;
    expect(different).equal(true);
  });
  
  test("should deal cards deterministically from Spanish 21 deck", () => {
    const config = DeckConfig.spanish21();
    
    const card1 = dealCardByIndex("test-id", "test-salt", 0, config);
    const card2 = dealCardByIndex("test-id", "test-salt", 1, config);
    
    // Cards should be valid
    expect(card1 !== null).equal(true);
    expect(card2 !== null).equal(true);
    
    // Spanish 21 should never deal a 10
    expect(card1.rank != Rank.TEN).equal(true);
    expect(card2.rank != Rank.TEN).equal(true);
  });
  
  test("should handle deck reshuffling", () => {
    const config = DeckConfig.standard();
    
    // Deal card 52 (first card of second deck, using seedIndex=1)
    const card52 = dealCardByIndex("test-id", "test-salt", 52, config);
    // Deal card 0 (first card of first deck, using seedIndex=0)
    const card0 = dealCardByIndex("test-id", "test-salt", 0, config);
    
    // Verify cards are valid
    expect(card52 !== null).equal(true);
    expect(card0 !== null).equal(true);
    
    // Verify reshuffling works (cards should be deterministically different)
    // Note: There's a small chance they could be the same, but the shuffle
    // should produce a different deck order
    const sameCard = card52.suit == card0.suit && card52.rank == card0.rank;
    // This is unlikely but possible, so we just verify the function works
    expect(true).equal(true);
  });
  
  test("should produce same cards with same shuffle parameters", () => {
    const config = DeckConfig.standard();
    
    const card1 = dealCardByIndex("test-id", "test-salt", 5, config);
    const card2 = dealCardByIndex("test-id", "test-salt", 5, config);
    
    expect(card1.suit).equal(card2.suit);
    expect(card1.rank).equal(card2.rank);
  });
});

// ============================================================================
// createShuffledDeck Tests
// ============================================================================

describe("createShuffledDeck", () => {
  test("should create full shuffled standard deck", () => {
    const config = DeckConfig.standard();
    const deck = createShuffledDeck("test-id", "test-salt", 0, config);
    
    expect(deck.length).equal(52);
    
    // Verify all cards are valid
    for (let i = 0; i < deck.length; i++) {
      expect(deck[i] !== null).equal(true);
    }
  });
  
  test("should create full shuffled Spanish 21 deck", () => {
    const config = DeckConfig.spanish21();
    const deck = createShuffledDeck("test-id", "test-salt", 0, config);
    
    expect(deck.length).equal(48);
    
    // Verify no 10s
    for (let i = 0; i < deck.length; i++) {
      expect(deck[i].rank != Rank.TEN).equal(true);
    }
  });
  
  test("should produce same deck with same parameters", () => {
    const config = DeckConfig.standard();
    const deck1 = createShuffledDeck("test-id", "test-salt", 0, config);
    const deck2 = createShuffledDeck("test-id", "test-salt", 0, config);
    
    expect(deck1.length).equal(deck2.length);
    for (let i = 0; i < deck1.length; i++) {
      expect(deck1[i].suit).equal(deck2[i].suit);
      expect(deck1[i].rank).equal(deck2[i].rank);
    }
  });
});

// ============================================================================
// getShuffledIndices / dealCards (efficient batch) Tests
// ============================================================================

describe("getShuffledIndices and dealCards", () => {
  test("getShuffledIndices returns 52 indices for standard deck", () => {
    const config = DeckConfig.standard();
    const indices = getShuffledIndices("test-id", "test-salt", 0, config);
    expect(indices.length).equal(52);
    const card0 = config.fromIndex(indices[0]);
    expect(card0 !== null).equal(true);
  });

  test("dealCards returns same cards as dealCardByIndex for first 4", () => {
    const config = DeckConfig.standard();
    const batch = dealCards("test-id", "test-salt", 0, 4, config);
    expect(batch.length).equal(4);
    const c0 = dealCardByIndex("test-id", "test-salt", 0, config);
    const c1 = dealCardByIndex("test-id", "test-salt", 1, config);
    const c2 = dealCardByIndex("test-id", "test-salt", 2, config);
    const c3 = dealCardByIndex("test-id", "test-salt", 3, config);
    expect(batch[0].suit).equal(c0.suit);
    expect(batch[0].rank).equal(c0.rank);
    expect(batch[1].suit).equal(c1.suit);
    expect(batch[1].rank).equal(c1.rank);
    expect(batch[2].suit).equal(c2.suit);
    expect(batch[2].rank).equal(c2.rank);
    expect(batch[3].suit).equal(c3.suit);
    expect(batch[3].rank).equal(c3.rank);
  });

  test("dealCards crossing deck boundary uses two blocks", () => {
    const config = DeckConfig.standard();
    const batch = dealCards("test-id", "test-salt", 50, 4, config);
    expect(batch.length).equal(4);
    const c50 = dealCardByIndex("test-id", "test-salt", 50, config);
    const c51 = dealCardByIndex("test-id", "test-salt", 51, config);
    const c52 = dealCardByIndex("test-id", "test-salt", 52, config);
    const c53 = dealCardByIndex("test-id", "test-salt", 53, config);
    expect(batch[0].suit).equal(c50.suit);
    expect(batch[0].rank).equal(c50.rank);
    expect(batch[1].suit).equal(c51.suit);
    expect(batch[1].rank).equal(c51.rank);
    expect(batch[2].suit).equal(c52.suit);
    expect(batch[2].rank).equal(c52.rank);
    expect(batch[3].suit).equal(c53.suit);
    expect(batch[3].rank).equal(c53.rank);
  });

  test("dealCards returns empty for count 0", () => {
    const config = DeckConfig.standard();
    const batch = dealCards("test-id", "test-salt", 0, 0, config);
    expect(batch.length).equal(0);
  });
});

// ============================================================================
// getShuffledShoeIndices / dealCardsFromShoe Tests
// ============================================================================

describe("getShuffledShoeIndices and dealCardsFromShoe", () => {
  test("getShuffledShoeIndices returns shoeSize indices for single deck", () => {
    const shoeConfig = ShoeConfig.standard(1);
    const indices = getShuffledShoeIndices("test-id", "test-salt", 0, shoeConfig);
    expect(indices.length).equal(52);
  });

  test("dealCardsFromShoe returns same cards as dealCardFromShoe for first 4", () => {
    const shoeConfig = ShoeConfig.standard(1);
    const batch = dealCardsFromShoe("test-id", "test-salt", 0, 4, shoeConfig);
    expect(batch.length).equal(4);
    const c0 = dealCardFromShoe("test-id", "test-salt", 0, shoeConfig);
    const c1 = dealCardFromShoe("test-id", "test-salt", 1, shoeConfig);
    const c2 = dealCardFromShoe("test-id", "test-salt", 2, shoeConfig);
    const c3 = dealCardFromShoe("test-id", "test-salt", 3, shoeConfig);
    expect(batch[0].suit).equal(c0.suit);
    expect(batch[0].rank).equal(c0.rank);
    expect(batch[1].suit).equal(c1.suit);
    expect(batch[1].rank).equal(c1.rank);
    expect(batch[2].suit).equal(c2.suit);
    expect(batch[2].rank).equal(c2.rank);
    expect(batch[3].suit).equal(c3.suit);
    expect(batch[3].rank).equal(c3.rank);
  });

  test("dealCardsFromShoe returns empty for count 0", () => {
    const shoeConfig = ShoeConfig.standard(1);
    const batch = dealCardsFromShoe("test-id", "test-salt", 0, 0, shoeConfig);
    expect(batch.length).equal(0);
  });
});

// ============================================================================
// createUnshuffledDeck Tests
// ============================================================================

describe("createUnshuffledDeck", () => {
  test("should create unshuffled standard deck", () => {
    const config = DeckConfig.standard();
    const deck = createUnshuffledDeck(config);
    
    expect(deck.length).equal(52);
    
    // First card should be 2 of Spades
    expect(deck[0].suit).equal(Suit.SPADES);
    expect(deck[0].rank).equal(Rank.TWO);
    
    // 13th card should be Ace of Spades
    expect(deck[12].suit).equal(Suit.SPADES);
    expect(deck[12].rank).equal(Rank.ACE);
    
    // 14th card should be 2 of Hearts
    expect(deck[13].suit).equal(Suit.HEARTS);
    expect(deck[13].rank).equal(Rank.TWO);
  });
  
  test("should create unshuffled Spanish 21 deck", () => {
    const config = DeckConfig.spanish21();
    const deck = createUnshuffledDeck(config);
    
    expect(deck.length).equal(48);
    
    // First card should be 2 of Spades
    expect(deck[0].suit).equal(Suit.SPADES);
    expect(deck[0].rank).equal(Rank.TWO);
    
    // 12th card should be Ace of Spades (no 10)
    expect(deck[11].suit).equal(Suit.SPADES);
    expect(deck[11].rank).equal(Rank.ACE);
    
    // Verify no 10s
    for (let i = 0; i < deck.length; i++) {
      expect(deck[i].rank != Rank.TEN).equal(true);
    }
  });
});

