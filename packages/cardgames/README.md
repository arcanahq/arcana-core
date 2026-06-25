# @arcanahq/cardgames

Card game utilities and blackjack action processing library for Arcana contracts.

## Overview

This library provides reusable card game logic that can be shared across different card game implementations. It builds on top of `@arcanahq/core` and provides:

- **Deck Management**: Deterministic shuffling and dealing for both standard (52-card) and Spanish 21 (48-card) decks
- **Card Index Mapping**: Efficient index-based card representation (0-51 for standard, 0-47 for Spanish 21)
- **Blackjack Rules Configuration**: Configurable rules for different blackjack variants (standard, Spanish 21, etc.)
- **Blackjack Action Processing**: Utility functions for validating and processing blackjack actions
- **Poker Game Utilities**: Hand evaluation, pot management, blinds/antes posting, betting rounds, rake calculation
- **Cash Game Utilities**: Buy-in validation, rake calculation, rebuy management

## Installation

```bash
npm install @arcanahq/cardgames
```

Or use as a local dependency:
```json
{
  "dependencies": {
    "@arcanahq/cardgames": "file:../packages/cardgames"
  }
}
```

## Structure

```
@cardgames/
├── assembly/
│   ├── blackjack/
│   │   ├── rules.ts      # Blackjack rules configuration
│   │   └── actions.ts    # Blackjack action processing utilities
│   ├── deck/
│   │   ├── deck.ts       # Deck management (shuffling, dealing, index mapping)
│   │   └── index.ts      # Deck module exports
│   ├── cards.ts          # Card, Suit, Rank classes
│   ├── cardgames.ts      # Card game utilities (deck creation, shuffling, dealing)
│   └── index.ts          # Main entry point
└── package.json
```

## Usage

### Deck Management

#### Single Deck (52 cards)

```typescript
import { DeckConfig, dealCardByIndex, createShuffledDeck } from "@arcanahq/cardgames/assembly/deck";

const config = DeckConfig.standard();

// Deal a card deterministically
const card = dealCardByIndex("shuffle-id", "shuffle-salt", 0, config);

// Create full shuffled deck
const deck = createShuffledDeck("shuffle-id", "shuffle-salt", 0, config);
```

#### Spanish 21 Deck (48 cards, no 10s)

```typescript
const config = DeckConfig.spanish21();

// Deal a card from Spanish 21 deck
const card = dealCardByIndex("shuffle-id", "shuffle-salt", 0, config);
// card will never be a 10

// Create full shuffled Spanish 21 deck
const deck = createShuffledDeck("shuffle-id", "shuffle-salt", 0, config);
```

#### Multi-Deck Shoes

```typescript
import { ShoeConfig, dealCardFromShoe, DeckConfig } from "@arcanahq/cardgames/assembly/deck";

// Standard shoe with any number of decks
const shoe6 = ShoeConfig.standard(6);  // 6-deck shoe (312 cards)
const shoe8 = ShoeConfig.standard(8);  // 8-deck shoe (416 cards)
const shoeCustom = ShoeConfig.standard(10); // 10-deck shoe (520 cards)

// Spanish 21 shoe with any number of decks
const spanishShoe6 = ShoeConfig.spanish21(6);  // 6-deck Spanish 21 (288 cards)
const spanishShoe8 = ShoeConfig.spanish21(8);  // 8-deck Spanish 21 (384 cards)

// Create shoe with any custom deck configuration
const spanishDeck = DeckConfig.spanish21();
const customShoe = ShoeConfig.withDeck(spanishDeck, 6); // 6-deck Spanish 21

// Or with a custom deck config
// Use standard or Spanish 21, or create your own DeckConfig subclass
const customDeck = DeckConfig.standard(); // or DeckConfig.spanish21()
const shoe = ShoeConfig.withDeck(customDeck, 4); // 4-deck shoe

// Deal cards from shoe (tracks position, auto-reshuffles when exhausted)
let shoePosition = 0;
const card1 = dealCardFromShoe("shuffle-id", "shuffle-salt", shoePosition++, shoe6);
const card2 = dealCardFromShoe("shuffle-id", "shuffle-salt", shoePosition++, shoe6);
// Position persists across game sessions
```

#### Card Index Mapping

```typescript
import { CardIndexMapper } from "@arcanahq/cardgames/assembly/deck";

const config = DeckConfig.standard();

// Convert index to card
const card = CardIndexMapper.indexToCard(0, config); // 2 of Spades
const card2 = CardIndexMapper.indexToCard(51, config); // Ace of Clubs

// Convert card to index
const index = CardIndexMapper.cardToIndex(card, config); // 0

// Create unshuffled deck indices
const indices = CardIndexMapper.createUnshuffledDeckIndices(config);
// [0, 1, 2, ..., 51]
```

#### Deterministic Shuffling

```typescript
import { deterministicShuffleIndices, CardIndexMapper } from "@arcanahq/cardgames/assembly/deck";

const config = DeckConfig.standard();
const unshuffledIndices = CardIndexMapper.createUnshuffledDeckIndices(config);

// Shuffle deterministically
const shuffledIndices = deterministicShuffleIndices(
  unshuffledIndices,
  "shuffle-id",
  "shuffle-salt",
  0 // seedIndex
);

// Same parameters = same shuffle
const shuffled2 = deterministicShuffleIndices(
  unshuffledIndices,
  "shuffle-id",
  "shuffle-salt",
  0
);
// shuffledIndices === shuffled2
```

### Blackjack Rules

#### Standard Rules

```typescript
import { BlackjackRules } from "@arcanahq/cardgames/assembly/blackjack/rules";

// Use standard rules (most common casino rules)
const rules = BlackjackRules.standard();
// - Dealer stands on 17
// - No hit on soft 17
// - No double after split
// - Surrender allowed
// - Insurance offered
```

#### Spanish 21 Rules

```typescript
const rules = BlackjackRules.spanish21();
// - 48-card deck (no 10s)
// - Dealer hits on soft 17
// - Double after split allowed
// - No insurance
```

#### Custom Rules

```typescript
const rules = new BlackjackRules(
  17,        // dealerStandValue
  false,     // hitOnSoft17
  4,         // maxSplitHands
  false,     // doubleAfterSplit
  true,      // surrenderAllowed
  false,     // lateSurrender
  true,      // insuranceOffered
  false      // isSpanish21
);

// Or use factory methods
const rules = BlackjackRules.dealerHitsSoft17();
const rules = BlackjackRules.allowDoubleAfterSplit();
```

#### Custom Payouts

```typescript
const rules = new BlackjackRules(
  17, false, 4, false, true, false, true, false,
  2.0,  // payoutBlackjack (6:5 instead of 3:2)
  1.0,  // payoutWin
  1.0,  // payoutPush
  0.0,  // payoutLose
  0.5,  // payoutSurrender
  2.0   // payoutInsurance
);
```

### Blackjack Action Validation

#### Calculate Available Actions

```typescript
import { calculateAvailableActions } from "@arcanahq/cardgames/assembly/blackjack/actions";

const actions = calculateAvailableActions(
  hand.cards.length,      // handCardsLength
  hand.isFromSplit,       // handIsFromSplit
  hand.isSplitAces,       // handIsSplitAces
  hand.isStanding,        // handIsStanding
  hand.isBusted,          // handIsBusted
  state.gamePhase,        // gamePhase
  state.playerHands.length, // playerHandsCount
  canSplitCards(hand.cards), // canSplit (pre-calculated)
  rules
);

// Use actions
if (actions.canStand) { /* ... */ }
if (actions.canDouble) { /* ... */ }
if (actions.canSplit) { /* ... */ }
if (actions.canSurrender) { /* ... */ }
```

#### Validate Actions

```typescript
import {
  validateCanDouble,
  validateCanSplit,
  validateCanSurrender,
  validateCanHit,
  validateCanStand,
  validateActionPhase,
  validateActiveHand
} from "@arcanahq/cardgames/assembly/blackjack/actions";

// Validate double action
validateCanDouble(
  hand.cards.length,
  hand.isSplitAces,
  hand.isFromSplit,
  rules
);

// Validate split action
validateCanSplit(
  hand.cards.length,
  state.playerHands.length,
  canSplitCards(hand.cards),
  rules
);

// Validate surrender action
validateCanSurrender(
  hand.cards.length,
  hand.isFromSplit,
  rules
);

// Validate hit action
validateCanHit(
  hand.isStanding,
  hand.isBusted,
  hand.isSplitAces
);

// Validate stand action
validateCanStand(
  hand.isStanding,
  hand.isBusted
);

// Validate game phase
validateActionPhase(state.gamePhase, "HIT", "PLAYING");

// Validate active hand
validateActiveHand(currentHandIndex, state.playerHands.length);
```

### Dealer Logic

```typescript
import { shouldDealerHit, shouldOfferInsurance } from "@arcanahq/cardgames/assembly/blackjack/actions";

// Check if dealer should hit
const dealerShouldHit = shouldDealerHit(
  dealerHandValue,
  rules.dealerStandValue,
  rules.hitOnSoft17,
  isSoftHand(dealerCards)
);

// Check if insurance should be offered
const offerInsurance = shouldOfferInsurance(
  dealerUpCard.rank,
  rules
);
```

### Card Types

```typescript
import { Card, Suit, Rank } from "@arcanahq/cardgames/assembly/cards";

// Create a card
const card = new Card(Suit.HEARTS, Rank.ACE);

// Use suit and rank constants
const suits = Suit.ALL; // [♠, ♥, ♦, ♣]
const ranks = Rank.ALL; // [2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A]
```

### Card Game Utilities

```typescript
import {
  createStandardDeck,
  shuffleDeck,
  dealCard,
  dealCards,
  cardToInt,
  intToCard
} from "@arcanahq/cardgames/assembly/cardgames";

// Create a standard 52-card deck
const deck = createStandardDeck();

// Shuffle with deterministic randomness
const shuffled = shuffleDeck(deck, seed);

// Deal cards
const card = dealCard(deck);
const cards = dealCards(deck, 5);

// Convert between Card and integer (0-51)
const index = cardToInt(card);
const card2 = intToCard(index);
```

### Core Blackjack Functions

```typescript
import {
  dealerShouldHit,
  isSoftHand,
  calculateBlackjackHandValue,
  isBlackjack,
  isBusted,
  canSplitCards
} from "@arcanahq/cardgames/assembly/blackjack/rules";

// Calculate hand value
const value = calculateBlackjackHandValue(cards);

// Check for blackjack
const hasBlackjack = isBlackjack(cards);

// Check for bust
const isBusted = isBusted(cards);

// Check if cards can be split
const canSplit = canSplitCards(cards);

// Check if hand is soft
const isSoft = isSoftHand(cards);

// Check if dealer should hit
const shouldHit = dealerShouldHit(cards, rules);
```

## Extensibility

### Creating Custom Rule Variants

```typescript
// Example: European Blackjack (no hole card)
class EuropeanBlackjackRules extends BlackjackRules {
  static create(): BlackjackRules {
    const rules = BlackjackRules.standard();
    // Customize for European rules
    return rules;
  }
}
```

### Adding Custom Actions

```typescript
// Extend AvailableActions for custom game variants
class CustomAvailableActions extends AvailableActions {
  canInsurance: bool = false;
  canEvenMoney: bool = false;
}
```

## Testing

The library includes comprehensive test coverage:

```bash
npm test
```

All core functions are tested with:
- Standard blackjack rules
- Spanish 21 rules
- Custom rule configurations
- Edge cases and error conditions

## API Reference

### BlackjackRules

Configurable blackjack rules class with factory methods:
- `BlackjackRules.standard()` - Standard casino rules
- `BlackjackRules.spanish21()` - Spanish 21 variant
- `BlackjackRules.dealerHitsSoft17()` - Dealer hits on soft 17
- `BlackjackRules.allowDoubleAfterSplit()` - Allow double after split

### AvailableActions

Result class from `calculateAvailableActions()`:
- `canStand: bool` - Can player stand
- `canDouble: bool` - Can player double
- `canSplit: bool` - Can player split
- `canSurrender: bool` - Can player surrender

### Validation Functions

All validation functions throw errors on invalid conditions:
- `validateActionPhase()` - Validates game phase
- `validateActiveHand()` - Validates hand exists
- `validateCanHit()` - Validates hit action
- `validateCanStand()` - Validates stand action
- `validateCanDouble()` - Validates double action
- `validateCanSplit()` - Validates split action
- `validateCanSurrender()` - Validates surrender action

### Utility Functions

- `calculateAvailableActions()` - Calculate all available actions
- `shouldDealerHit()` - Determine if dealer should hit
- `shouldOfferInsurance()` - Determine if insurance should be offered

## Dependencies

- `@arcanahq/core`: Core framework for Arcana contracts

## Poker Game Utilities

The library includes comprehensive utilities for poker-style card games:

### Stakes and Betting

```typescript
import { Stakes, AnteType, BettingRoundState, PokerSeatBase } from "@arcanahq/cardgames/assembly/poker/poker_game_types";
import { 
  calculateAnteAmount, 
  postAntes, 
  postBlinds, 
  getNextActingSeat,
  validateBuyIn,
  processBuyIn,
  isBettingRoundComplete
} from "@arcanahq/cardgames/assembly/poker/poker_game_utils";

// Create stakes configuration
const stakes = new Stakes(10, 20, 5); // SB: 10, BB: 20, Ante: 5

// Calculate ante amount
const anteAmount = calculateAnteAmount(stakes, AnteType.FIXED, 0.0);

// Post antes for all players
const bettingState = new BettingRoundState();
const antesResult = postAntes(seats, stakes, AnteType.FIXED, 0.0, bettingState);
// antesResult.seats - updated seats with antes deducted
// antesResult.totalAnteCollected - total ante collected

// Post small blind and big blind
const blindsResult = postBlinds(seats, stakes, sbSeatId, bbSeatId, bettingState);
// blindsResult.seats - updated seats with blinds deducted
// blindsResult.currentBetToMatch - current bet to match (BB amount)

// Get next player to act
const nextSeatId = getNextActingSeat(seats, buttonSeatId, true, bettingState); // true = preflop

// Validate and process buy-in
if (validateBuyIn(buyInAmount, minBuyIn, maxBuyIn)) {
  const updatedSeat = processBuyIn(seat, buyInAmount, minBuyIn, maxBuyIn);
}

// Check if betting round is complete
const isComplete = isBettingRoundComplete(seats, bettingState);
```

### Showdown Utilities

The showdown system uses an interface pattern, allowing different implementations for various poker variants.

#### Standard Hold'em (Default)

```typescript
import {
  compareHandsShowdown,
  compareFiveCardHands,
  getPlayerHandRank,
  getPlayerBestHand,
  compareTwoHands,
  StandardShowdownEvaluator
} from "@arcanahq/cardgames/assembly/poker/showdown";
import { Card } from "@arcanahq/cardgames/assembly/cards";

// Compare multiple players' hands in a showdown
const holeCardsMap = new Map<i32, Card[]>();
holeCardsMap.set(0, player0HoleCards);
holeCardsMap.set(1, player1HoleCards);
holeCardsMap.set(2, player2HoleCards);

const communityCards = [flop, turn, river]; // 5 cards total

const result = compareHandsShowdown(holeCardsMap, communityCards);
// result.winners - array of seat IDs that tied for the win
// result.handRanks - map of seat ID to their HandRank
// result.bestFiveCards - map of seat ID to their best 5-card hand

// Compare exactly 5-card hands (for games like 5-card draw)
const fiveCardHands = new Map<i32, Card[]>();
fiveCardHands.set(0, player0FiveCards);
fiveCardHands.set(1, player1FiveCards);
const result = compareFiveCardHands(fiveCardHands);

// Get a single player's hand rank
const handRank = getPlayerHandRank(holeCards, communityCards);

// Get a single player's best 5-card hand
const bestHand = getPlayerBestHand(holeCards, communityCards);

// Compare two specific hands
const winner = compareTwoHands(holeCards1, holeCards2, communityCards);
// Returns: 1 if hand1 wins, -1 if hand2 wins, 0 if tie
```

#### Six-Plus Hold'em

```typescript
import { SixPlusShowdownEvaluator } from "@arcanahq/cardgames/assembly/poker/six_plus_showdown";
import { Card } from "@arcanahq/cardgames/assembly/cards";

// Create Six-Plus evaluator (uses 36-card deck, different hand rankings)
const evaluator = new SixPlusShowdownEvaluator();

// Use the evaluator for showdown
const result = evaluator.compareHandsShowdown(holeCardsMap, communityCards);
// result.winners - array of seat IDs that tied for the win

// Six-Plus hand rankings:
// - Flush beats Full House (opposite of standard)
// - Three of a Kind beats Straight (opposite of standard)
```

#### Stud Poker (5-Card and 7-Card)

```typescript
import { StudShowdownEvaluator } from "@arcanahq/cardgames/assembly/poker/stud_evaluator";
import { Card } from "@arcanahq/cardgames/assembly/cards";

const evaluator = new StudShowdownEvaluator();

// For 7-card stud: each player has 7 cards, choose best 5
const sevenCardHands = new Map<i32, Card[]>();
sevenCardHands.set(0, player0SevenCards); // 7 cards
sevenCardHands.set(1, player1SevenCards); // 7 cards

// No community cards for stud
const result = evaluator.compareHandsShowdown(sevenCardHands, new Array<Card>(0));

// For 5-card stud: each player has 5 cards, use all 5
const fiveCardHands = new Map<i32, Card[]>();
fiveCardHands.set(0, player0FiveCards); // 5 cards
fiveCardHands.set(1, player1FiveCards); // 5 cards

const result = evaluator.compareHandsShowdown(fiveCardHands, new Array<Card>(0));
```

#### Omaha

```typescript
import { OmahaShowdownEvaluator } from "@arcanahq/cardgames/assembly/poker/omaha_evaluator";
import { Card } from "@arcanahq/cardgames/assembly/cards";

const evaluator = new OmahaShowdownEvaluator();

// Omaha: 4 hole cards, must use exactly 2 + 3 community cards
const holeCardsMap = new Map<i32, Card[]>();
holeCardsMap.set(0, player0FourCards); // 4 cards
holeCardsMap.set(1, player1FourCards); // 4 cards

const communityCards = [flop, turn, river]; // 5 cards

const result = evaluator.compareHandsShowdown(holeCardsMap, communityCards);
// Automatically tries all combinations of 2 hole + 3 community cards
```

#### Using Variant Configurations

```typescript
import {
  VariantConfigs,
  PokerVariant,
  getEvaluatorForVariant,
  createEvaluator
} from "@arcanahq/cardgames/assembly/poker/variants";
import { ShowdownEvaluator } from "@arcanahq/cardgames/assembly/poker/showdown_evaluator";

// Get evaluator by variant name
const holdemEvaluator = getEvaluatorForVariant(PokerVariant.TEXAS_HOLDEM);
const studEvaluator = getEvaluatorForVariant(PokerVariant.SEVEN_CARD_STUD);
const omahaEvaluator = getEvaluatorForVariant(PokerVariant.OMAHA);
const sixPlusEvaluator = getEvaluatorForVariant(PokerVariant.SIX_PLUS_HOLDEM);

// Or use variant configuration
const config = VariantConfigs.sevenCardStud();
const evaluator = createEvaluator(config);

// Available configurations:
// - VariantConfigs.texasHoldem()
// - VariantConfigs.omaha()
// - VariantConfigs.omahaHiLo()
// - VariantConfigs.sevenCardStud()
// - VariantConfigs.fiveCardStud()
// - VariantConfigs.razz() // Lowball 7-card stud
// - VariantConfigs.sixPlusHoldem()
```

#### Custom Evaluator

```typescript
import { ShowdownEvaluator, ShowdownResult } from "@arcanahq/cardgames/assembly/poker/showdown_evaluator";
import { Card, HandRank } from "@arcanahq/cardgames/assembly/cards";

// Extend ShowdownEvaluator for custom poker variants
class CustomShowdownEvaluator extends ShowdownEvaluator {
  evaluateHand(holeCards: Card[], communityCards: Card[]): HandRank {
    // Custom evaluation logic
  }
  
  getBestFiveCards(holeCards: Card[], communityCards: Card[]): Card[] {
    // Custom best hand selection
  }
  
  compareHands(hand1: HandRank, hand2: HandRank): i32 {
    // Custom comparison logic
  }
}

const customEvaluator = new CustomShowdownEvaluator();
const result = customEvaluator.compareHandsShowdown(holeCardsMap, communityCards);
```

### Pot Management

```typescript
import { 
  constructSidePots, 
  calculatePokerRake, 
  distributePot,
  splitPotForRuns,
  lockPots
} from "@arcanahq/cardgames/assembly/poker/poker_game_utils";

// Construct side pots from player contributions
const contributions = new Map<i32, i64>();
contributions.set(seat1Id, 100);
contributions.set(seat2Id, 200); // All-in
const pots = constructSidePots(contributions, 0);

// Calculate rake
const rakeConfig = new PokerRakeConfig(5.0, 10); // 5% rake, cap at 10
const rake = calculatePokerRake(potAmount, rakeConfig);

// Distribute pot to winners
const distribution = distributePot(pot, winners, runIndex, buttonSeatId, rakeConfig);
// distribution.payouts - Map of seat ID to payout amount
// distribution.rake - Rake amount deducted
```

### Betting Round State

```typescript
import { BettingRoundState } from "@arcanahq/cardgames/assembly/poker/poker_game_types";

const bettingState = new BettingRoundState();

// Track contributions
bettingState.contribThisRound.set(seatId, amount);
bettingState.contribTotal.set(seatId, totalAmount);

// Calculate amount to call
const toCall = bettingState.calculateToCall(seatId);

// Reset for next street
bettingState.resetRound();
```

## License

MIT
