// @ts-nocheck
/**
 * Poker Variant Configuration
 * 
 * Defines configurations for different poker variants to make the library
 * flexible enough to support Hold'em, Stud, Six-Plus, and other variants.
 */

/**
 * Poker variant types
 */
export class PokerVariant {
  static readonly TEXAS_HOLDEM: string = "TEXAS_HOLDEM";
  static readonly OMAHA: string = "OMAHA";
  static readonly OMAHA_HI_LO: string = "OMAHA_HI_LO";
  static readonly SEVEN_CARD_STUD: string = "SEVEN_CARD_STUD";
  static readonly FIVE_CARD_STUD: string = "FIVE_CARD_STUD";
  static readonly RAZZ: string = "RAZZ"; // Lowball 7-card stud
  static readonly SIX_PLUS_HOLDEM: string = "SIX_PLUS_HOLDEM";
  static readonly SHORT_DECK_HOLDEM: string = "SIX_PLUS_HOLDEM"; // Alias
}

/**
 * Deck configuration for poker variants
 */
export class PokerDeckConfig {
  static readonly STANDARD_52: string = "STANDARD_52"; // Standard 52-card deck
  static readonly SIX_PLUS_36: string = "SIX_PLUS_36"; // 36-card deck (removes 2-5)
  static readonly SHORT_DECK_36: string = "SIX_PLUS_36"; // Alias
}

/**
 * Hand structure configuration
 */
export class HandStructure {
  holeCards: i32 = 0; // Number of hole cards dealt to each player
  communityCards: i32 = 0; // Number of community cards
  cardsToUse: i32 = 5; // Number of cards to use for best hand (usually 5)
  mustUseHoleCards: i32 = 0; // Number of hole cards that must be used (0 = any, 2 = Omaha)
  
  constructor(
    holeCards: i32 = 0,
    communityCards: i32 = 0,
    cardsToUse: i32 = 5,
    mustUseHoleCards: i32 = 0
  ) {
    this.holeCards = holeCards;
    this.communityCards = communityCards;
    this.cardsToUse = cardsToUse;
    this.mustUseHoleCards = mustUseHoleCards;
  }
  
  clone(): HandStructure {
    return new HandStructure(
      this.holeCards,
      this.communityCards,
      this.cardsToUse,
      this.mustUseHoleCards
    );
  }
}

/**
 * Poker variant configuration
 */
export class PokerVariantConfig {
  variant: string = "";
  deckConfig: string = "";
  handStructure: HandStructure;
  usesLowball: bool = false; // Whether this is a lowball variant (lowest hand wins)
  usesHighLow: bool = false; // Whether this splits pot between high and low
  
  constructor(
    variant: string,
    deckConfig: string = PokerDeckConfig.STANDARD_52,
    handStructure: HandStructure = new HandStructure(),
    usesLowball: bool = false,
    usesHighLow: bool = false
  ) {
    this.variant = variant;
    this.deckConfig = deckConfig;
    this.handStructure = handStructure;
    this.usesLowball = usesLowball;
    this.usesHighLow = usesHighLow;
  }
  
  clone(): PokerVariantConfig {
    return new PokerVariantConfig(
      this.variant,
      this.deckConfig,
      this.handStructure.clone(),
      this.usesLowball,
      this.usesHighLow
    );
  }
}

/**
 * Predefined variant configurations
 */
export class VariantConfigs {
  /**
   * Texas Hold'em: 2 hole cards, 5 community cards, use any 5
   */
  static texasHoldem(): PokerVariantConfig {
    return new PokerVariantConfig(
      PokerVariant.TEXAS_HOLDEM,
      PokerDeckConfig.STANDARD_52,
      new HandStructure(2, 5, 5, 0)
    );
  }
  
  /**
   * Omaha: 4 hole cards, 5 community cards, must use exactly 2 hole cards
   */
  static omaha(): PokerVariantConfig {
    return new PokerVariantConfig(
      PokerVariant.OMAHA,
      PokerDeckConfig.STANDARD_52,
      new HandStructure(4, 5, 5, 2)
    );
  }
  
  /**
   * Omaha Hi-Lo: Same as Omaha but splits pot between high and low
   */
  static omahaHiLo(): PokerVariantConfig {
    return new PokerVariantConfig(
      PokerVariant.OMAHA_HI_LO,
      PokerDeckConfig.STANDARD_52,
      new HandStructure(4, 5, 5, 2),
      false,
      true
    );
  }
  
  /**
   * 7-Card Stud: 7 cards per player, no community cards, use best 5
   */
  static sevenCardStud(): PokerVariantConfig {
    return new PokerVariantConfig(
      PokerVariant.SEVEN_CARD_STUD,
      PokerDeckConfig.STANDARD_52,
      new HandStructure(7, 0, 5, 0)
    );
  }
  
  /**
   * 5-Card Stud: 5 cards per player, no community cards, use all 5
   */
  static fiveCardStud(): PokerVariantConfig {
    return new PokerVariantConfig(
      PokerVariant.FIVE_CARD_STUD,
      PokerDeckConfig.STANDARD_52,
      new HandStructure(5, 0, 5, 0)
    );
  }
  
  /**
   * Razz: 7-card stud lowball (lowest hand wins)
   */
  static razz(): PokerVariantConfig {
    return new PokerVariantConfig(
      PokerVariant.RAZZ,
      PokerDeckConfig.STANDARD_52,
      new HandStructure(7, 0, 5, 0),
      true // Lowball
    );
  }
  
  /**
   * Six-Plus Hold'em: 2 hole cards, 5 community cards, 36-card deck
   */
  static sixPlusHoldem(): PokerVariantConfig {
    return new PokerVariantConfig(
      PokerVariant.SIX_PLUS_HOLDEM,
      PokerDeckConfig.SIX_PLUS_36,
      new HandStructure(2, 5, 5, 0)
    );
  }
}

