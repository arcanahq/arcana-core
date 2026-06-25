// @ts-nocheck
/**
 * Tests for dealer hole card scenarios
 * 
 * Tests various dealer showing/hole card combinations and their interactions
 * with insurance, player blackjack, and game outcomes
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import {
  shouldOfferInsurance,
  calculateAvailableActions
} from "../../../blackjack/actions";
import { BlackjackRules } from "../../../blackjack/rules";
import {
  isBlackjack,
  calculateBlackjackHandValue
} from "../../../blackjack/blackjack";
import { Card, Rank, Suit } from "../../../cards";

// ============================================================================
// Helper Functions
// ============================================================================

function createCard(rank: string, suit: string = Suit.SPADES): Card {
  return new Card(suit, rank);
}

function createDealerHand(upCard: Card, holeCard: Card): Card[] {
  return [upCard, holeCard];
}

function createPlayerHand(card1: Card, card2: Card): Card[] {
  return [card1, card2];
}

// ============================================================================
// Dealer Has Ace Showing, 10-K Down (Blackjack)
// ============================================================================

describe("Dealer Scenarios - Ace Showing, 10-K Down (Blackjack)", () => {
  test("should offer insurance when dealer shows ace", () => {
    const rules = BlackjackRules.standard();
    const dealerUpCard = createCard(Rank.ACE);
    expect(shouldOfferInsurance(dealerUpCard.rank, rules)).equal(true);
  });
  
  test("dealer has blackjack with A showing and K down - player accepts insurance, player has blackjack", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.KING)
    );
    const playerHand = createPlayerHand(
      createCard(Rank.ACE),
      createCard(Rank.KING)
    );
    
    // Verify dealer has blackjack
    expect(isBlackjack(dealerHand)).equal(true);
    expect(calculateBlackjackHandValue(dealerHand)).equal(21);
    
    // Verify player has blackjack
    expect(isBlackjack(playerHand)).equal(true);
    expect(calculateBlackjackHandValue(playerHand)).equal(21);
    
    // Insurance should be offered
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(true);
    
    // If player accepts insurance and dealer has blackjack:
    // - Insurance pays 2:1 (player wins insurance bet)
    // - Main bet pushes (both have blackjack)
    // Player should be able to continue or the hand should be resolved
  });
  
  test("dealer has blackjack with A showing and K down - player accepts insurance, player does not have blackjack", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.KING)
    );
    const playerHand = createPlayerHand(
      createCard(Rank.TEN),
      createCard(Rank.SEVEN)
    );
    
    // Verify dealer has blackjack
    expect(isBlackjack(dealerHand)).equal(true);
    expect(calculateBlackjackHandValue(dealerHand)).equal(21);
    
    // Verify player does not have blackjack
    expect(isBlackjack(playerHand)).equal(false);
    expect(calculateBlackjackHandValue(playerHand)).equal(17);
    
    // Insurance should be offered
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(true);
    
    // If player accepts insurance and dealer has blackjack:
    // - Insurance pays 2:1 (player wins insurance bet)
    // - Main bet loses (dealer blackjack beats player)
  });
  
  test("dealer has blackjack with A showing and K down - player denies insurance, player has blackjack", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.KING)
    );
    const playerHand = createPlayerHand(
      createCard(Rank.ACE),
      createCard(Rank.KING)
    );
    
    // Verify dealer has blackjack
    expect(isBlackjack(dealerHand)).equal(true);
    
    // Verify player has blackjack
    expect(isBlackjack(playerHand)).equal(true);
    
    // Insurance should be offered
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(true);
    
    // If player denies insurance and dealer has blackjack:
    // - No insurance payout
    // - Main bet pushes (both have blackjack)
  });
  
  test("dealer has blackjack with A showing and K down - player denies insurance, player does not have blackjack", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.KING)
    );
    const playerHand = createPlayerHand(
      createCard(Rank.TEN),
      createCard(Rank.SEVEN)
    );
    
    // Verify dealer has blackjack
    expect(isBlackjack(dealerHand)).equal(true);
    
    // Verify player does not have blackjack
    expect(isBlackjack(playerHand)).equal(false);
    
    // Insurance should be offered
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(true);
    
    // If player denies insurance and dealer has blackjack:
    // - No insurance payout
    // - Main bet loses (dealer blackjack beats player)
  });
  
  test("dealer has blackjack with A showing and Q down", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.QUEEN)
    );
    
    expect(isBlackjack(dealerHand)).equal(true);
    expect(calculateBlackjackHandValue(dealerHand)).equal(21);
  });
  
  test("dealer has blackjack with A showing and J down", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.JACK)
    );
    
    expect(isBlackjack(dealerHand)).equal(true);
    expect(calculateBlackjackHandValue(dealerHand)).equal(21);
  });
  
  test("dealer has blackjack with A showing and TEN down", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.TEN)
    );
    
    expect(isBlackjack(dealerHand)).equal(true);
    expect(calculateBlackjackHandValue(dealerHand)).equal(21);
  });
});

// ============================================================================
// Dealer Has K Showing, A Down (Blackjack)
// ============================================================================

describe("Dealer Scenarios - K Showing, A Down (Blackjack)", () => {
  test("dealer has blackjack with K showing and A down - player has blackjack", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.KING),
      createCard(Rank.ACE)
    );
    const playerHand = createPlayerHand(
      createCard(Rank.ACE),
      createCard(Rank.KING)
    );
    
    // Verify dealer has blackjack
    expect(isBlackjack(dealerHand)).equal(true);
    expect(calculateBlackjackHandValue(dealerHand)).equal(21);
    
    // Verify player has blackjack
    expect(isBlackjack(playerHand)).equal(true);
    expect(calculateBlackjackHandValue(playerHand)).equal(21);
    
    // Insurance should NOT be offered (dealer doesn't show ace)
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(false);
    
    // When dealer has blackjack but doesn't show ace:
    // - No insurance offered
    // - If player has blackjack: push
    // - If player doesn't have blackjack: player loses
  });
  
  test("dealer has blackjack with K showing and A down - player does not have blackjack", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.KING),
      createCard(Rank.ACE)
    );
    const playerHand = createPlayerHand(
      createCard(Rank.TEN),
      createCard(Rank.SEVEN)
    );
    
    // Verify dealer has blackjack
    expect(isBlackjack(dealerHand)).equal(true);
    expect(calculateBlackjackHandValue(dealerHand)).equal(21);
    
    // Verify player does not have blackjack
    expect(isBlackjack(playerHand)).equal(false);
    expect(calculateBlackjackHandValue(playerHand)).equal(17);
    
    // Insurance should NOT be offered (dealer doesn't show ace)
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(false);
    
    // When dealer has blackjack but doesn't show ace:
    // - No insurance offered
    // - Player loses main bet
  });
  
  test("dealer has blackjack with Q showing and A down", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.QUEEN),
      createCard(Rank.ACE)
    );
    
    expect(isBlackjack(dealerHand)).equal(true);
    expect(calculateBlackjackHandValue(dealerHand)).equal(21);
    
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(false);
  });
  
  test("dealer has blackjack with J showing and A down", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.JACK),
      createCard(Rank.ACE)
    );
    
    expect(isBlackjack(dealerHand)).equal(true);
    expect(calculateBlackjackHandValue(dealerHand)).equal(21);
    
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(false);
  });
});

// ============================================================================
// Dealer Has A Showing, Not 10-K Down (No Blackjack)
// ============================================================================

describe("Dealer Scenarios - Ace Showing, Not 10-K Down (No Blackjack)", () => {
  test("dealer has A showing and 9 down (no blackjack) - player accepts insurance, player has blackjack", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.NINE)
    );
    const playerHand = createPlayerHand(
      createCard(Rank.ACE),
      createCard(Rank.KING)
    );
    
    // Verify dealer does NOT have blackjack
    expect(isBlackjack(dealerHand)).equal(false);
    expect(calculateBlackjackHandValue(dealerHand)).equal(20);
    
    // Verify player has blackjack
    expect(isBlackjack(playerHand)).equal(true);
    expect(calculateBlackjackHandValue(playerHand)).equal(21);
    
    // Insurance should be offered
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(true);
    
    // If player accepts insurance and dealer does NOT have blackjack:
    // - Insurance loses (player loses insurance bet)
    // - Main bet: player blackjack beats dealer (player wins 3:2)
  });
  
  test("dealer has A showing and 9 down (no blackjack) - player accepts insurance, player does not have blackjack", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.NINE)
    );
    const playerHand = createPlayerHand(
      createCard(Rank.TEN),
      createCard(Rank.SEVEN)
    );
    
    // Verify dealer does NOT have blackjack
    expect(isBlackjack(dealerHand)).equal(false);
    expect(calculateBlackjackHandValue(dealerHand)).equal(20);
    
    // Verify player does not have blackjack
    expect(isBlackjack(playerHand)).equal(false);
    expect(calculateBlackjackHandValue(playerHand)).equal(17);
    
    // Insurance should be offered
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(true);
    
    // If player accepts insurance and dealer does NOT have blackjack:
    // - Insurance loses (player loses insurance bet)
    // - Main bet: game continues (dealer has 20, player has 17)
  });
  
  test("dealer has A showing and 9 down (no blackjack) - player denies insurance, player has blackjack", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.NINE)
    );
    const playerHand = createPlayerHand(
      createCard(Rank.ACE),
      createCard(Rank.KING)
    );
    
    // Verify dealer does NOT have blackjack
    expect(isBlackjack(dealerHand)).equal(false);
    expect(calculateBlackjackHandValue(dealerHand)).equal(20);
    
    // Verify player has blackjack
    expect(isBlackjack(playerHand)).equal(true);
    expect(calculateBlackjackHandValue(playerHand)).equal(21);
    
    // Insurance should be offered
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(true);
    
    // If player denies insurance and dealer does NOT have blackjack:
    // - No insurance bet
    // - Main bet: player blackjack beats dealer (player wins 3:2)
  });
  
  test("dealer has A showing and 9 down (no blackjack) - player denies insurance, player does not have blackjack", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.NINE)
    );
    const playerHand = createPlayerHand(
      createCard(Rank.TEN),
      createCard(Rank.SEVEN)
    );
    
    // Verify dealer does NOT have blackjack
    expect(isBlackjack(dealerHand)).equal(false);
    expect(calculateBlackjackHandValue(dealerHand)).equal(20);
    
    // Verify player does not have blackjack
    expect(isBlackjack(playerHand)).equal(false);
    expect(calculateBlackjackHandValue(playerHand)).equal(17);
    
    // Insurance should be offered
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(true);
    
    // If player denies insurance and dealer does NOT have blackjack:
    // - No insurance bet
    // - Main bet: game continues (dealer has 20, player has 17)
  });
  
  test("dealer has A showing and 8 down (no blackjack)", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.EIGHT)
    );
    
    expect(isBlackjack(dealerHand)).equal(false);
    expect(calculateBlackjackHandValue(dealerHand)).equal(19);
    
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(true);
  });
  
  test("dealer has A showing and 7 down (no blackjack)", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.SEVEN)
    );
    
    expect(isBlackjack(dealerHand)).equal(false);
    expect(calculateBlackjackHandValue(dealerHand)).equal(18);
    
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(true);
  });
  
  test("dealer has A showing and 2 down (no blackjack)", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.TWO)
    );
    
    expect(isBlackjack(dealerHand)).equal(false);
    expect(calculateBlackjackHandValue(dealerHand)).equal(13);
    
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(true);
  });
});

// ============================================================================
// Additional Edge Cases
// ============================================================================

describe("Dealer Scenarios - Edge Cases", () => {
  test("dealer has A showing and A down (soft 12, no blackjack)", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.ACE)
    );
    
    expect(isBlackjack(dealerHand)).equal(false);
    expect(calculateBlackjackHandValue(dealerHand)).equal(12);
    
    const rules = BlackjackRules.standard();
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(true);
  });
  
  test("insurance not offered when insurance is disabled in rules", () => {
    const dealerHand = createDealerHand(
      createCard(Rank.ACE),
      createCard(Rank.KING)
    );
    
    const rules = new BlackjackRules(17, false, 4, false, true, false, false); // insuranceOffered = false
    expect(shouldOfferInsurance(dealerHand[0].rank, rules)).equal(false);
  });
});

