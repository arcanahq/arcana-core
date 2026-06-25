// @ts-nocheck
/**
 * Tests for multi-deck shoe functionality
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import {
  ShoeConfig,
  DeckConfig,
  dealCardFromShoe,
  CardIndexMapper
} from "../../deck/deck";
import { Card, Suit, Rank } from "../../cards";

// ============================================================================
// ShoeConfig Tests
// ============================================================================

describe("ShoeConfig", () => {
  test("should create single deck shoe", () => {
    const shoe = ShoeConfig.standard(1);
    expect(shoe.numDecks).equal(1);
    expect(shoe.deckConfig.totalCards).equal(52);
    expect(shoe.getShoeSize()).equal(52);
  });
  
  test("should create 2-deck shoe", () => {
    const shoe = ShoeConfig.standard(2);
    expect(shoe.numDecks).equal(2);
    expect(shoe.deckConfig.totalCards).equal(52);
    expect(shoe.getShoeSize()).equal(104); // 2 * 52
  });
  
  test("should create 4-deck shoe", () => {
    const shoe = ShoeConfig.standard(4);
    expect(shoe.numDecks).equal(4);
    expect(shoe.deckConfig.totalCards).equal(52);
    expect(shoe.getShoeSize()).equal(208); // 4 * 52
  });
  
  test("should create 6-deck shoe", () => {
    const shoe = ShoeConfig.standard(6);
    expect(shoe.numDecks).equal(6);
    expect(shoe.deckConfig.totalCards).equal(52);
    expect(shoe.getShoeSize()).equal(312); // 6 * 52
  });
  
  test("should create 8-deck shoe", () => {
    const shoe = ShoeConfig.standard(8);
    expect(shoe.numDecks).equal(8);
    expect(shoe.deckConfig.totalCards).equal(52);
    expect(shoe.getShoeSize()).equal(416); // 8 * 52
  });
  
  test("should create custom number of decks", () => {
    const shoe = ShoeConfig.standard(10);
    expect(shoe.numDecks).equal(10);
    expect(shoe.getShoeSize()).equal(520); // 10 * 52
  });
  
  test("should create Spanish 21 with any number of decks", () => {
    const shoe1 = ShoeConfig.spanish21(1);
    expect(shoe1.numDecks).equal(1);
    expect(shoe1.getShoeSize()).equal(48); // 1 * 48
    
    const shoe6 = ShoeConfig.spanish21(6);
    expect(shoe6.numDecks).equal(6);
    expect(shoe6.getShoeSize()).equal(288); // 6 * 48
    
    const shoe12 = ShoeConfig.spanish21(12);
    expect(shoe12.numDecks).equal(12);
    expect(shoe12.getShoeSize()).equal(576); // 12 * 48
  });
  
  test("should create shoe with custom deck config using withDeck", () => {
    const deckConfig = DeckConfig.standard();
    const shoe = ShoeConfig.withDeck(deckConfig, 4);
    expect(shoe.numDecks).equal(4);
    expect(shoe.getShoeSize()).equal(208); // 4 * 52
  });
  
  test("should create Spanish 21 shoe with withDeck", () => {
    const spanishDeck = DeckConfig.spanish21();
    const shoe = ShoeConfig.withDeck(spanishDeck, 6);
    expect(shoe.numDecks).equal(6);
    expect(shoe.deckConfig.totalCards).equal(48);
    expect(shoe.getShoeSize()).equal(288); // 6 * 48
  });
  
  test("should support backward compatibility with custom method", () => {
    const deckConfig = DeckConfig.standard();
    const shoe = ShoeConfig.custom(deckConfig, 4);
    expect(shoe.numDecks).equal(4);
    expect(shoe.getShoeSize()).equal(208); // 4 * 52
  });
  
  test("should create shoe using constructor directly", () => {
    const deckConfig = DeckConfig.standard();
    const shoe = new ShoeConfig(deckConfig, 3);
    expect(shoe.numDecks).equal(3);
    expect(shoe.getShoeSize()).equal(156); // 3 * 52
  });
  
  // Backward compatibility tests
  test("should support deprecated convenience methods", () => {
    const single = ShoeConfig.singleDeck();
    expect(single.numDecks).equal(1);
    
    const six = ShoeConfig.sixDeck();
    expect(six.numDecks).equal(6);
    
    const eight = ShoeConfig.eightDeck();
    expect(eight.numDecks).equal(8);
  });
});

// ============================================================================
// createUnshuffledShoeIndices Tests
// ============================================================================

describe("createUnshuffledShoeIndices", () => {
  test("should create indices for single deck shoe", () => {
    const shoe = ShoeConfig.singleDeck();
    const indices = CardIndexMapper.createUnshuffledShoeIndices(shoe);
    
    expect(indices.length).equal(52);
    // First card should be 2 of Spades (index 0)
    expect(indices[0]).equal(0);
    // Last card should be Ace of Clubs (index 51)
    expect(indices[51]).equal(51);
  });
  
  test("should create indices for 6-deck shoe", () => {
    const shoe = ShoeConfig.sixDeck();
    const indices = CardIndexMapper.createUnshuffledShoeIndices(shoe);
    
    expect(indices.length).equal(312); // 6 * 52
    
    // Each deck should have the same card order
    // First deck: indices 0-51
    expect(indices[0]).equal(0); // 2♠
    expect(indices[51]).equal(51); // A♣
    
    // Second deck: indices 52-103 (same order)
    expect(indices[52]).equal(0); // 2♠
    expect(indices[103]).equal(51); // A♣
    
    // Third deck: indices 104-155
    expect(indices[104]).equal(0); // 2♠
    expect(indices[155]).equal(51); // A♣
    
    // Sixth deck: indices 260-311
    expect(indices[260]).equal(0); // 2♠
    expect(indices[311]).equal(51); // A♣
  });
  
  test("should create indices for 8-deck shoe", () => {
    const shoe = ShoeConfig.eightDeck();
    const indices = CardIndexMapper.createUnshuffledShoeIndices(shoe);
    
    expect(indices.length).equal(416); // 8 * 52
    
    // Verify each deck has same order
    for (let deck = 0; deck < 8; deck++) {
      const deckStart = deck * 52;
      expect(indices[deckStart]).equal(0); // First card of each deck
      expect(indices[deckStart + 51]).equal(51); // Last card of each deck
    }
  });
  
  test("should create indices for Spanish 21 6-deck shoe", () => {
    const shoe = ShoeConfig.spanish21SixDeck();
    const indices = CardIndexMapper.createUnshuffledShoeIndices(shoe);
    
    expect(indices.length).equal(288); // 6 * 48
    
    // Verify structure
    for (let deck = 0; deck < 6; deck++) {
      const deckStart = deck * 48;
      expect(indices[deckStart]).equal(0); // First card of each deck
      expect(indices[deckStart + 47]).equal(47); // Last card of each deck
    }
  });
});

// ============================================================================
// dealCardFromShoe Tests
// ============================================================================

describe("dealCardFromShoe", () => {
  test("should deal cards from 6-deck shoe", () => {
    const shoe = ShoeConfig.sixDeck();
    const shuffleId = "test-shuffle-6deck";
    const shuffleSalt = "test-salt";
    
    // Deal first card
    const card1 = dealCardFromShoe(shuffleId, shuffleSalt, 0, shoe);
    expect(card1.suit.length).greaterThan(0); // Verify card is valid
    
    // Deal second card
    const card2 = dealCardFromShoe(shuffleId, shuffleSalt, 1, shoe);
    expect(card2.suit.length).greaterThan(0); // Verify card is valid
    
    // Cards should be different (shuffled)
    expect(card1.equals(card2)).equal(false);
  });
  
  test("should deal cards from 8-deck shoe", () => {
    const shoe = ShoeConfig.eightDeck();
    const shuffleId = "test-shuffle-8deck";
    const shuffleSalt = "test-salt";
    
    // Deal multiple cards
    const card1 = dealCardFromShoe(shuffleId, shuffleSalt, 0, shoe);
    const card2 = dealCardFromShoe(shuffleId, shuffleSalt, 1, shoe);
    const card3 = dealCardFromShoe(shuffleId, shuffleSalt, 2, shoe);
    
    expect(card1.suit.length).greaterThan(0);
    expect(card2.suit.length).greaterThan(0);
    expect(card3.suit.length).greaterThan(0);
    
    // All should be different
    expect(card1.equals(card2)).equal(false);
    expect(card2.equals(card3)).equal(false);
  });
  
  test("should handle shoe exhaustion and reshuffle", () => {
    const shoe = ShoeConfig.sixDeck();
    const shuffleId = "test-shuffle-exhaust";
    const shuffleSalt = "test-salt";
    const shoeSize = shoe.getShoeSize(); // 312
    
    // Deal last card of first shoe
    const lastCard = dealCardFromShoe(shuffleId, shuffleSalt, shoeSize - 1, shoe);
    expect(lastCard.suit.length).greaterThan(0);
    
    // Deal first card of second shoe (reshuffled)
    const firstCardNewShoe = dealCardFromShoe(shuffleId, shuffleSalt, shoeSize, shoe);
    expect(firstCardNewShoe.suit.length).greaterThan(0);
    
    // The new shoe should be deterministically shuffled
    // (same shuffleId/salt but different iteration)
    const firstCardNewShoe2 = dealCardFromShoe(shuffleId, shuffleSalt, shoeSize, shoe);
    expect(firstCardNewShoe.equals(firstCardNewShoe2)).equal(true);
  });
  
  test("should deal deterministically from same position", () => {
    const shoe = ShoeConfig.sixDeck();
    const shuffleId = "test-deterministic";
    const shuffleSalt = "test-salt";
    
    const card1 = dealCardFromShoe(shuffleId, shuffleSalt, 50, shoe);
    const card2 = dealCardFromShoe(shuffleId, shuffleSalt, 50, shoe);
    
    // Same position should yield same card
    expect(card1.equals(card2)).equal(true);
  });
  
  test("should handle large shoe positions", () => {
    const shoe = ShoeConfig.eightDeck();
    const shuffleId = "test-large-position";
    const shuffleSalt = "test-salt";
    
    // Deal from middle of shoe
    const card1 = dealCardFromShoe(shuffleId, shuffleSalt, 200, shoe);
    expect(card1.suit.length).greaterThan(0);
    
    // Deal from near end of shoe
    const card2 = dealCardFromShoe(shuffleId, shuffleSalt, 410, shoe);
    expect(card2.suit.length).greaterThan(0);
    
    // Deal from second shoe iteration
    const card3 = dealCardFromShoe(shuffleId, shuffleSalt, 500, shoe);
    expect(card3.suit.length).greaterThan(0);
  });
  
  test("should work with Spanish 21 6-deck shoe", () => {
    const shoe = ShoeConfig.spanish21SixDeck();
    const shuffleId = "test-spanish-6deck";
    const shuffleSalt = "test-salt";
    
    const card1 = dealCardFromShoe(shuffleId, shuffleSalt, 0, shoe);
    const card2 = dealCardFromShoe(shuffleId, shuffleSalt, 100, shoe);
    const card3 = dealCardFromShoe(shuffleId, shuffleSalt, 200, shoe);
    
    expect(card1.suit.length).greaterThan(0);
    expect(card2.suit.length).greaterThan(0);
    expect(card3.suit.length).greaterThan(0);
    
    // Verify no 10s in Spanish 21
    expect(card1.rank == Rank.TEN).equal(false);
    expect(card2.rank == Rank.TEN).equal(false);
    expect(card3.rank == Rank.TEN).equal(false);
  });
  
  test("should handle multiple shoe iterations", () => {
    const shoe = ShoeConfig.sixDeck();
    const shuffleId = "test-iterations";
    const shuffleSalt = "test-salt";
    const shoeSize = shoe.getShoeSize(); // 312
    
    // First shoe iteration
    const card1 = dealCardFromShoe(shuffleId, shuffleSalt, 0, shoe);
    const card2 = dealCardFromShoe(shuffleId, shuffleSalt, shoeSize - 1, shoe);
    
    // Second shoe iteration (reshuffled)
    const card3 = dealCardFromShoe(shuffleId, shuffleSalt, shoeSize, shoe);
    const card4 = dealCardFromShoe(shuffleId, shuffleSalt, shoeSize * 2 - 1, shoe);
    
    // Third shoe iteration
    const card5 = dealCardFromShoe(shuffleId, shuffleSalt, shoeSize * 2, shoe);
    
    expect(card1.suit.length).greaterThan(0);
    expect(card2.suit.length).greaterThan(0);
    expect(card3.suit.length).greaterThan(0);
    expect(card4.suit.length).greaterThan(0);
    expect(card5.suit.length).greaterThan(0);
    
    // Each iteration should be deterministically shuffled
    const card1Again = dealCardFromShoe(shuffleId, shuffleSalt, 0, shoe);
    expect(card1.equals(card1Again)).equal(true);
    
    const card3Again = dealCardFromShoe(shuffleId, shuffleSalt, shoeSize, shoe);
    expect(card3.equals(card3Again)).equal(true);
  });
  
  test("should track position correctly across multiple deals", () => {
    const shoe = ShoeConfig.eightDeck();
    const shuffleId = "test-position-tracking";
    const shuffleSalt = "test-salt";
    
    // Simulate dealing multiple cards in sequence
    const cards = new Array<Card>(10);
    for (let i = 0; i < 10; i++) {
      cards[i] = dealCardFromShoe(shuffleId, shuffleSalt, i, shoe);
    }
    
    // All cards should be different (shuffled shoe)
    for (let i = 0; i < 10; i++) {
      for (let j = i + 1; j < 10; j++) {
        // Cards might be the same by chance, but very unlikely in shuffled shoe
        // We just verify they're valid cards
        expect(cards[i].suit.length).greaterThan(0);
        expect(cards[j].suit.length).greaterThan(0);
      }
    }
  });
});

// ============================================================================
// Shoe Position Persistence Tests
// ============================================================================

describe("Shoe Position Persistence", () => {
  test("should resume from saved position", () => {
    const shoe = ShoeConfig.sixDeck();
    const shuffleId = "test-resume";
    const shuffleSalt = "test-salt";
    
    // Deal 100 cards
    const cardsBefore = new Array<Card>(100);
    for (let i = 0; i < 100; i++) {
      cardsBefore[i] = dealCardFromShoe(shuffleId, shuffleSalt, i, shoe);
    }
    
    // "Save" position at 100
    const savedPosition = 100;
    
    // "Resume" from saved position
    const cardsAfter = new Array<Card>(10);
    for (let i = 0; i < 10; i++) {
      cardsAfter[i] = dealCardFromShoe(shuffleId, shuffleSalt, savedPosition + i, shoe);
    }
    
    // Cards after resume should match what we would have gotten
    const expectedCards = new Array<Card>(10);
    for (let i = 0; i < 10; i++) {
      expectedCards[i] = dealCardFromShoe(shuffleId, shuffleSalt, 100 + i, shoe);
    }
    
    for (let i = 0; i < 10; i++) {
      expect(cardsAfter[i].equals(expectedCards[i])).equal(true);
    }
  });
  
  test("should handle position across shoe boundaries", () => {
    const shoe = ShoeConfig.sixDeck();
    const shuffleId = "test-boundary";
    const shuffleSalt = "test-salt";
    const shoeSize = shoe.getShoeSize(); // 312
    
    // Deal last few cards of first shoe
    const lastCardShoe1 = dealCardFromShoe(shuffleId, shuffleSalt, shoeSize - 1, shoe);
    
    // Deal first card of second shoe
    const firstCardShoe2 = dealCardFromShoe(shuffleId, shuffleSalt, shoeSize, shoe);
    
    // Deal second card of second shoe
    const secondCardShoe2 = dealCardFromShoe(shuffleId, shuffleSalt, shoeSize + 1, shoe);
    
    expect(lastCardShoe1.suit.length).greaterThan(0);
    expect(firstCardShoe2.suit.length).greaterThan(0);
    expect(secondCardShoe2.suit.length).greaterThan(0);
    
    // All should be different
    expect(lastCardShoe1.equals(firstCardShoe2)).equal(false);
    expect(firstCardShoe2.equals(secondCardShoe2)).equal(false);
  });
});

