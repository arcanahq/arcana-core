// @ts-nocheck
/**
 * Poker Game Types
 * 
 * Generic types for poker-style card games including blinds, antes, pots, and rake
 */

/**
 * Stakes configuration for poker games
 * Defines small blind, big blind, and ante amounts
 */
export class Stakes {
  sb: i64 = 0; // Small blind
  bb: i64 = 0; // Big blind
  ante: i64 = 0; // Ante per player
  
  constructor(sb: i64 = 0, bb: i64 = 0, ante: i64 = 0) {
    this.sb = sb;
    this.bb = bb;
    this.ante = ante;
  }
  
  clone(): Stakes {
    return new Stakes(this.sb, this.bb, this.ante);
  }
}

/**
 * Ante type configuration
 */
export class AnteType {
  static readonly NONE: string = "NONE";
  static readonly FIXED: string = "FIXED"; // Fixed ante per player
  static readonly PERCENTAGE: string = "PERCENTAGE"; // Ante as percentage of big blind
}

/**
 * Pot structure for poker games
 * Supports side pots and run-it multiple times
 */
export class Pot {
  potId: i32 = 0;
  amount: i64 = 0;
  eligibleSeats: i32[] = []; // Seat IDs eligible to win this pot
  locked: bool = false; // Whether pot is locked (no further contributions)
  runCountForPot: i32 = 1; // Number of runs for run-it multiple times
  splitAmountsPerRun: i64[] = []; // Amount per run if split
  
  constructor(
    potId: i32 = 0,
    amount: i64 = 0,
    eligibleSeats: i32[] = new Array<i32>(0),
    locked: bool = false,
    runCountForPot: i32 = 1,
    splitAmountsPerRun: i64[] = new Array<i64>(0)
  ) {
    this.potId = potId;
    this.amount = amount;
    this.eligibleSeats = eligibleSeats;
    this.locked = locked;
    this.runCountForPot = runCountForPot;
    this.splitAmountsPerRun = splitAmountsPerRun;
  }
  
  clone(): Pot {
    const clonedEligibleSeats = new Array<i32>(this.eligibleSeats.length);
    for (let i = 0; i < this.eligibleSeats.length; i++) {
      clonedEligibleSeats[i] = this.eligibleSeats[i];
    }
    
    const clonedSplitAmounts = new Array<i64>(this.splitAmountsPerRun.length);
    for (let i = 0; i < this.splitAmountsPerRun.length; i++) {
      clonedSplitAmounts[i] = this.splitAmountsPerRun[i];
    }
    
    return new Pot(
      this.potId,
      this.amount,
      clonedEligibleSeats,
      this.locked,
      this.runCountForPot,
      clonedSplitAmounts
    );
  }
}

/**
 * Rake configuration for poker games
 * Note: Uses same structure as cashgames RakeConfig but with additional poker-specific options
 */
export class PokerRakeConfig {
  percentage: f64 = 0.0; // Rake percentage (e.g., 5.0 for 5%)
  cap: i64 = 0; // Maximum rake per pot (0 = no cap)
  noFlopNoDrop: bool = false; // No rake if hand doesn't reach flop
  
  constructor(percentage: f64 = 0.0, cap: i64 = 0, noFlopNoDrop: bool = false) {
    this.percentage = percentage;
    this.cap = cap;
    this.noFlopNoDrop = noFlopNoDrop;
  }
  
  clone(): PokerRakeConfig {
    return new PokerRakeConfig(this.percentage, this.cap, this.noFlopNoDrop);
  }
}

/**
 * Result of pot distribution
 */
export class PotDistributionResult {
  payouts: Map<i32, i64>; // Map of seat ID to payout amount
  rake: i64; // Rake amount deducted
  
  constructor(payouts: Map<i32, i64>, rake: i64) {
    this.payouts = payouts;
    this.rake = rake;
  }
}

/**
 * Betting round state for poker games
 * Tracks contributions, current bet, and action state
 */
export class BettingRoundState {
  contribThisRound: Map<i32, i64>; // Contributions this betting round (seat ID -> amount)
  contribTotal: Map<i32, i64>; // Total contributions this hand (seat ID -> amount)
  currentBetToMatch: i64 = 0; // Current bet amount that must be matched
  minRaise: i64 = 0; // Minimum raise amount
  lastFullRaiseSize: i64 = 0; // Size of last full raise
  lastAggressorSeatId: i32 = -1; // Seat ID of last player to bet/raise
  actingSeatId: i32 = -1; // Seat ID of player currently to act
  
  constructor() {
    this.contribThisRound = new Map<i32, i64>();
    this.contribTotal = new Map<i32, i64>();
  }
  
  /**
   * Get contribution for a seat this round
   */
  getContributionThisRound(seatId: i32): i64 {
    return this.contribThisRound.has(seatId) ? this.contribThisRound.get(seatId) : 0;
  }
  
  /**
   * Get total contribution for a seat this hand
   */
  getTotalContribution(seatId: i32): i64 {
    return this.contribTotal.has(seatId) ? this.contribTotal.get(seatId) : 0;
  }
  
  /**
   * Calculate amount needed to call for a seat
   */
  calculateToCall(seatId: i32): i64 {
    const contrib = this.getContributionThisRound(seatId);
    const toCall = this.currentBetToMatch - contrib;
    return toCall > 0 ? toCall : 0;
  }
  
  /**
   * Reset betting round state for next street
   */
  resetRound(): void {
    this.contribThisRound = new Map<i32, i64>();
    this.currentBetToMatch = 0;
    this.lastFullRaiseSize = 0;
    this.lastAggressorSeatId = -1;
    this.actingSeatId = -1;
  }
  
  clone(): BettingRoundState {
    const cloned = new BettingRoundState();
    cloned.currentBetToMatch = this.currentBetToMatch;
    cloned.minRaise = this.minRaise;
    cloned.lastFullRaiseSize = this.lastFullRaiseSize;
    cloned.lastAggressorSeatId = this.lastAggressorSeatId;
    cloned.actingSeatId = this.actingSeatId;
    
    // Clone maps
    const contribThisRoundKeys = this.contribThisRound.keys();
    for (let i = 0; i < contribThisRoundKeys.length; i++) {
      const key = contribThisRoundKeys[i];
      cloned.contribThisRound.set(key, this.contribThisRound.get(key));
    }
    
    const contribTotalKeys = this.contribTotal.keys();
    for (let i = 0; i < contribTotalKeys.length; i++) {
      const key = contribTotalKeys[i];
      cloned.contribTotal.set(key, this.contribTotal.get(key));
    }
    
    return cloned;
  }
}

/**
 * Base interface for poker seat
 * Games should extend this with game-specific fields
 */
export class PokerSeatBase {
  seatId: i32 = 0;
  playerId: string | null = null;
  stack: i64 = 0; // Current stack
  inHand: bool = false; // Whether player is in the current hand
  allIn: bool = false; // Whether player is all-in
  hasActedThisRound: bool = false; // Whether player has acted this betting round
  lastAction: string = ""; // Last action taken (FOLD, CHECK, CALL, BET, RAISE, etc.)
  
  constructor(seatId: i32 = 0, playerId: string | null = null, stack: i64 = 0) {
    this.seatId = seatId;
    this.playerId = playerId;
    this.stack = stack;
  }
  
  isEmpty(): bool {
    const pid = this.playerId;
    if (pid === null) {
      return true;
    }
    return pid.length === 0;
  }
  
  clone(): PokerSeatBase {
    const seat = new PokerSeatBase(this.seatId, this.playerId, this.stack);
    seat.inHand = this.inHand;
    seat.allIn = this.allIn;
    seat.hasActedThisRound = this.hasActedThisRound;
    seat.lastAction = this.lastAction;
    return seat;
  }
}

