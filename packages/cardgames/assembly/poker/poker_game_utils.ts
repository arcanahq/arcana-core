// @ts-nocheck
/**
 * Poker Game Utilities
 * 
 * Generic utilities for poker-style card games including:
 * - Blinds and ante posting
 * - Pot construction and side pots
 * - Rake calculation
 * - Pot distribution
 */

import { Pot, Stakes, AnteType, PokerRakeConfig, PotDistributionResult, BettingRoundState, PokerSeatBase } from "./poker_game_types";

/**
 * Calculate rake for a pot amount
 * @param potAmount Total pot amount
 * @param rakeConfig Rake configuration
 * @returns Rake amount to deduct
 */
export function calculatePokerRake(potAmount: i64, rakeConfig: PokerRakeConfig): i64 {
  if (rakeConfig.percentage <= 0.0) {
    return 0;
  }
  
  // Calculate rake as percentage
  const rake = <i64>(<f64>potAmount * rakeConfig.percentage / 100.0);
  
  // Apply cap if set
  if (rakeConfig.cap > 0 && rake > rakeConfig.cap) {
    return rakeConfig.cap;
  }
  
  return rake;
}

/**
 * Calculate rake for a pot amount (simple version with percentage and cap)
 * @param potAmount Total pot amount
 * @param rakePercentage Rake percentage (e.g., 5.0 for 5%)
 * @param rakeCap Maximum rake per pot (0 = no cap)
 * @returns Rake amount to deduct
 */
export function calculateRakeSimple(potAmount: i64, rakePercentage: f64, rakeCap: i64): i64 {
  if (rakePercentage <= 0.0) {
    return 0;
  }
  
  // Calculate rake as percentage
  const rake = <i64>(<f64>potAmount * rakePercentage / 100.0);
  
  // Apply cap if set
  if (rakeCap > 0 && rake > rakeCap) {
    return rakeCap;
  }
  
  return rake;
}

/**
 * Construct side pots from player contributions
 * Creates separate pots for each contribution level (for all-in scenarios)
 * 
 * @param contributions Map of seat ID to total contribution
 * @param startPotId Starting pot ID (usually 0)
 * @returns Array of Pot objects, ordered from smallest to largest
 */
export function constructSidePots(contributions: Map<i32, i64>, startPotId: i32 = 0): Pot[] {
  const pots = new Array<Pot>(0);
  
  if (contributions.size === 0) {
    return pots;
  }
  
  // Get unique contribution levels, sorted ascending
  const contribValues = new Array<i64>(0);
  const contribKeys = contributions.keys();
  for (let i = 0; i < contribKeys.length; i++) {
    const value = contributions.get(contribKeys[i]);
    let found = false;
    for (let j = 0; j < contribValues.length; j++) {
      if (contribValues[j] === value) {
        found = true;
        break;
      }
    }
    if (!found) {
      contribValues.push(value);
    }
  }
  
  // Sort ascending
  contribValues.sort((a, b) => a < b ? -1 : (a > b ? 1 : 0));
  
  // Create pots for each contribution level
  let prevLevel: i64 = 0;
  for (let i = 0; i < contribValues.length; i++) {
    const level = contribValues[i];
    const eligibleSeats = new Array<i32>(0);
    
    // Find all seats with contribution >= this level
    const seatIds = contributions.keys();
    for (let j = 0; j < seatIds.length; j++) {
      const seatId = seatIds[j];
      const contrib = contributions.get(seatId);
      if (contrib >= level) {
        eligibleSeats.push(seatId);
      }
    }
    
    // Calculate pot amount for this level
    // Each eligible seat contributes (level - prevLevel) to this pot
    const amountPerSeat = level - prevLevel;
    let potAmount: i64 = 0;
    
    // Count how many seats contribute to this pot
    for (let j = 0; j < seatIds.length; j++) {
      const seatId = seatIds[j];
      const contrib = contributions.get(seatId);
      if (contrib >= prevLevel) {
        const contribToThisPot = contrib >= level ? amountPerSeat : (contrib - prevLevel);
        potAmount += contribToThisPot;
      }
    }
    
    if (potAmount > 0 && eligibleSeats.length > 0) {
      const pot = new Pot(startPotId + pots.length, potAmount, eligibleSeats, false, 1, new Array<i64>(0));
      pots.push(pot);
    }
    
    prevLevel = level;
  }
  
  return pots;
}

/**
 * Split a pot for run-it multiple times
 * @param pot Pot to split
 * @param runCount Number of runs
 * @returns New pot with split amounts
 */
export function splitPotForRuns(pot: Pot, runCount: i32): Pot {
  if (runCount <= 1) {
    const newPot = pot.clone();
    newPot.splitAmountsPerRun = new Array<i64>(1);
    newPot.splitAmountsPerRun[0] = pot.amount;
    newPot.runCountForPot = 1;
    return newPot;
  }
  
  const base = pot.amount / <i64>runCount;
  const remainder = pot.amount % <i64>runCount;
  
  const splits = new Array<i64>(runCount);
  for (let i = 0; i < runCount; i++) {
    splits[i] = base + (i < remainder ? 1 : 0);
  }
  
  const newPot = pot.clone();
  newPot.runCountForPot = runCount;
  newPot.splitAmountsPerRun = splits;
  
  return newPot;
}

/**
 * Split all pots for run-it multiple times
 * @param pots Array of pots to split
 * @param runCount Number of runs
 * @returns Array of split pots
 */
export function splitAllPotsForRuns(pots: Pot[], runCount: i32): Pot[] {
  const newPots = new Array<Pot>(pots.length);
  for (let i = 0; i < pots.length; i++) {
    newPots[i] = splitPotForRuns(pots[i], runCount);
  }
  return newPots;
}

/**
 * Calculate odd chip distribution
 * Deterministic: distributes remainder chips to winners
 * 
 * @param amount Total amount to distribute
 * @param numWinners Number of winners
 * @param winners Array of winner seat IDs
 * @param buttonSeatId Button seat ID (for odd chip distribution rules)
 * @returns Array of payout amounts, one per winner
 */
export function calculateOddChips(amount: i64, numWinners: i32, winners: i32[], buttonSeatId: i32): i64[] {
  if (numWinners <= 0) {
    return new Array<i64>(0);
  }
  
  const base = amount / <i64>numWinners;
  const remainder = amount % <i64>numWinners;
  
  const payouts = new Array<i64>(numWinners);
  for (let i = 0; i < numWinners; i++) {
    payouts[i] = base;
  }
  
  // Distribute remainder chips to winners closest to button (clockwise)
  // For simplicity, give remainder to first winner in array
  // In full implementation, would calculate actual clockwise distance from button
  if (remainder > 0) {
    payouts[0] += remainder;
  }
  
  return payouts;
}

/**
 * Distribute pot to winners (after rake deduction)
 * 
 * @param pot Pot to distribute
 * @param winners Array of winner seat IDs
 * @param runIndex Run index (for run-it multiple times, 0-based)
 * @param buttonSeatId Button seat ID (for odd chip distribution)
 * @param rakeConfig Rake configuration
 * @returns PotDistributionResult with payouts and rake
 */
export function distributePot(
  pot: Pot,
  winners: i32[],
  runIndex: i32,
  buttonSeatId: i32,
  rakeConfig: PokerRakeConfig
): PotDistributionResult {
  const payouts = new Map<i32, i64>();
  
  if (winners.length === 0 || pot.splitAmountsPerRun.length === 0) {
    return new PotDistributionResult(payouts, 0);
  }
  
  const runAmount = runIndex < pot.splitAmountsPerRun.length 
    ? pot.splitAmountsPerRun[runIndex] 
    : pot.amount / <i64>pot.runCountForPot;
  
  // Calculate and deduct rake
  const rake = calculatePokerRake(runAmount, rakeConfig);
  const potAfterRake = runAmount - rake;
  
  // Distribute remaining pot to winners
  const oddChips = calculateOddChips(potAfterRake, winners.length, winners, buttonSeatId);
  
  for (let i = 0; i < winners.length; i++) {
    payouts.set(winners[i], oddChips[i]);
  }
  
  return new PotDistributionResult(payouts, rake);
}

/**
 * Distribute pot to winners (simple version with percentage and cap)
 * 
 * @param pot Pot to distribute
 * @param winners Array of winner seat IDs
 * @param runIndex Run index (for run-it multiple times, 0-based)
 * @param buttonSeatId Button seat ID (for odd chip distribution)
 * @param rakePercentage Rake percentage (e.g., 5.0 for 5%)
 * @param rakeCap Maximum rake per pot (0 = no cap)
 * @returns PotDistributionResult with payouts and rake
 */
export function distributePotSimple(
  pot: Pot,
  winners: i32[],
  runIndex: i32,
  buttonSeatId: i32,
  rakePercentage: f64 = 0.0,
  rakeCap: i64 = 0
): PotDistributionResult {
  const rakeConfig = new PokerRakeConfig(rakePercentage, rakeCap, false);
  return distributePot(pot, winners, runIndex, buttonSeatId, rakeConfig);
}

/**
 * Lock pots (no further contributions can affect eligibility)
 * @param pots Array of pots to lock
 * @returns Array of locked pots
 */
export function lockPots(pots: Pot[]): Pot[] {
  const lockedPots = new Array<Pot>(pots.length);
  for (let i = 0; i < pots.length; i++) {
    const pot = pots[i].clone();
    pot.locked = true;
    lockedPots[i] = pot;
  }
  return lockedPots;
}

/**
 * Calculate total pot amount from all pots
 * @param pots Array of pots
 * @returns Total amount across all pots
 */
export function getTotalPotAmount(pots: Pot[]): i64 {
  let total: i64 = 0;
  for (let i = 0; i < pots.length; i++) {
    total += pots[i].amount;
  }
  return total;
}

/**
 * Calculate ante amount based on ante type
 * @param stakes Stakes configuration
 * @param anteType Ante type (NONE, FIXED, PERCENTAGE)
 * @param antePercentage If PERCENTAGE type, the percentage value (e.g., 10.0 for 10%)
 * @returns Ante amount per player
 */
export function calculateAnteAmount(stakes: Stakes, anteType: string, antePercentage: f64 = 0.0): i64 {
  if (anteType === AnteType.NONE) {
    return 0;
  }
  
  if (anteType === AnteType.FIXED) {
    return stakes.ante;
  }
  
  if (anteType === AnteType.PERCENTAGE) {
    // Ante as percentage of big blind
    return <i64>(<f64>stakes.bb * antePercentage / 100.0);
  }
  
  return 0;
}

/**
 * Post antes for all active players in hand
 * Subtracts ante from each player's stack and adds to contributions
 * 
 * @param seats Array of poker seats (must have stack property)
 * @param stakes Stakes configuration
 * @param anteType Ante type (NONE, FIXED, PERCENTAGE)
 * @param antePercentage If PERCENTAGE type, the percentage value
 * @param bettingState Betting round state to update contributions
 * @returns Updated seats array and total ante collected
 */
export class PostAntesResult {
  seats: PokerSeatBase[];
  totalAnteCollected: i64;
  
  constructor(seats: PokerSeatBase[], totalAnteCollected: i64) {
    this.seats = seats;
    this.totalAnteCollected = totalAnteCollected;
  }
}

export function postAntes(
  seats: PokerSeatBase[],
  stakes: Stakes,
  anteType: string,
  antePercentage: f64,
  bettingState: BettingRoundState
): PostAntesResult {
  const anteAmount = calculateAnteAmount(stakes, anteType, antePercentage);
  let totalAnteCollected: i64 = 0;
  
  const updatedSeats = new Array<PokerSeatBase>(seats.length);
  
  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i].clone();
    
    // Only post ante for players in hand
    if (seat.inHand && !seat.isEmpty()) {
      const anteToPost = anteAmount;
      
      // Subtract from stack (can't go negative)
      if (seat.stack >= anteToPost) {
        seat.stack -= anteToPost;
        totalAnteCollected += anteToPost;
        
        // Add to contributions
        const currentContrib = bettingState.getContributionThisRound(seat.seatId);
        bettingState.contribThisRound.set(seat.seatId, currentContrib + anteToPost);
        
        const totalContrib = bettingState.getTotalContribution(seat.seatId);
        bettingState.contribTotal.set(seat.seatId, totalContrib + anteToPost);
      } else {
        // All-in ante
        const remainingStack = seat.stack;
        seat.stack = 0;
        seat.allIn = true;
        totalAnteCollected += remainingStack;
        
        // Add to contributions
        const currentContrib = bettingState.getContributionThisRound(seat.seatId);
        bettingState.contribThisRound.set(seat.seatId, currentContrib + remainingStack);
        
        const totalContrib = bettingState.getTotalContribution(seat.seatId);
        bettingState.contribTotal.set(seat.seatId, totalContrib + remainingStack);
      }
    }
    
    updatedSeats[i] = seat;
  }
  
  return new PostAntesResult(updatedSeats, totalAnteCollected);
}

/**
 * Post small blind and big blind
 * Subtracts blinds from players' stacks and adds to contributions
 * 
 * @param seats Array of poker seats
 * @param stakes Stakes configuration
 * @param sbSeatId Small blind seat ID
 * @param bbSeatId Big blind seat ID
 * @param bettingState Betting round state to update contributions
 * @returns Updated seats array and updated currentBetToMatch
 */
export class PostBlindsResult {
  seats: PokerSeatBase[];
  currentBetToMatch: i64;
  
  constructor(seats: PokerSeatBase[], currentBetToMatch: i64) {
    this.seats = seats;
    this.currentBetToMatch = currentBetToMatch;
  }
}

export function postBlinds(
  seats: PokerSeatBase[],
  stakes: Stakes,
  sbSeatId: i32,
  bbSeatId: i32,
  bettingState: BettingRoundState
): PostBlindsResult {
  const updatedSeats = new Array<PokerSeatBase>(seats.length);
  let currentBetToMatch: i64 = 0;
  
  // Copy seats first
  for (let i = 0; i < seats.length; i++) {
    updatedSeats[i] = seats[i].clone();
  }
  
  // Post small blind
  if (sbSeatId >= 0 && sbSeatId < updatedSeats.length) {
    const sbSeat = updatedSeats[sbSeatId];
    if (sbSeat.inHand && !sbSeat.isEmpty()) {
      const sbAmount = stakes.sb;
      
      if (sbSeat.stack >= sbAmount) {
        sbSeat.stack -= sbAmount;
      } else {
        // All-in small blind
        sbSeat.stack = 0;
        sbSeat.allIn = true;
      }
      
      const actualSbAmount = sbSeat.stack === 0 ? (sbAmount - (sbSeat.stack + sbAmount - sbAmount)) : sbAmount;
      const actualSb = actualSbAmount > sbSeat.stack + sbAmount ? sbSeat.stack + sbAmount : actualSbAmount;
      const postedSb = sbSeat.stack === 0 ? (sbSeat.stack + sbAmount) : sbAmount;
      
      // Calculate actual amount posted
      const sbPosted = sbSeat.stack === 0 ? (sbAmount - (sbSeat.stack + sbAmount - sbAmount)) : sbAmount;
      const finalSb = sbSeat.stack === 0 ? (sbSeat.stack + sbAmount) : sbAmount;
      
      // Simplified: just use the amount we subtracted
      const sbPostedAmount = sbSeat.allIn ? (sbAmount - (sbSeat.stack + sbAmount)) : sbAmount;
      const finalSbPosted = sbSeat.allIn ? (sbSeat.stack + sbAmount) : sbAmount;
      
      // Actually, let's recalculate properly
      const originalStack = seats[sbSeatId].stack;
      const sbPostedFinal = originalStack >= sbAmount ? sbAmount : originalStack;
      
      // Add to contributions
      const currentContrib = bettingState.getContributionThisRound(sbSeatId);
      bettingState.contribThisRound.set(sbSeatId, currentContrib + sbPostedFinal);
      
      const totalContrib = bettingState.getTotalContribution(sbSeatId);
      bettingState.contribTotal.set(sbSeatId, totalContrib + sbPostedFinal);
    }
  }
  
  // Post big blind
  if (bbSeatId >= 0 && bbSeatId < updatedSeats.length) {
    const bbSeat = updatedSeats[bbSeatId];
    if (bbSeat.inHand && !bbSeat.isEmpty()) {
      const bbAmount = stakes.bb;
      const originalStack = seats[bbSeatId].stack;
      
      if (bbSeat.stack >= bbAmount) {
        bbSeat.stack -= bbAmount;
      } else {
        // All-in big blind
        bbSeat.stack = 0;
        bbSeat.allIn = true;
      }
      
      const bbPostedFinal = originalStack >= bbAmount ? bbAmount : originalStack;
      
      // Add to contributions
      const currentContrib = bettingState.getContributionThisRound(bbSeatId);
      bettingState.contribThisRound.set(bbSeatId, currentContrib + bbPostedFinal);
      
      const totalContrib = bettingState.getTotalContribution(bbSeatId);
      bettingState.contribTotal.set(bbSeatId, totalContrib + bbPostedFinal);
      
      // Big blind sets the current bet to match
      currentBetToMatch = bbPostedFinal;
      bettingState.currentBetToMatch = currentBetToMatch;
    }
  }
  
  return new PostBlindsResult(updatedSeats, currentBetToMatch);
}

/**
 * Get next acting seat (clockwise from button, skipping folded/all-in players)
 * 
 * @param seats Array of poker seats
 * @param buttonSeatId Button seat ID
 * @param isPreflop Whether this is preflop (action starts after big blind)
 * @param bettingState Betting round state
 * @returns Next acting seat ID, or -1 if no one can act
 */
export function getNextActingSeat(
  seats: PokerSeatBase[],
  buttonSeatId: i32,
  isPreflop: bool,
  bettingState: BettingRoundState
): i32 {
  if (seats.length === 0) {
    return -1;
  }
  
  // Find starting position (after button for preflop, button for postflop)
  let startIndex: i32 = -1;
  if (isPreflop) {
    // Preflop: start after big blind (button + 3)
    startIndex = (buttonSeatId + 3) % seats.length;
  } else {
    // Postflop: start after button (button + 1)
    startIndex = (buttonSeatId + 1) % seats.length;
  }
  
  // Search clockwise for next player who can act
  for (let i = 0; i < seats.length; i++) {
    const seatIndex = (startIndex + i) % seats.length;
    const seat = seats[seatIndex];
    
    // Skip empty seats, folded players, and all-in players
    if (seat.isEmpty() || !seat.inHand || seat.allIn) {
      continue;
    }
    
    // Check if they need to act (haven't matched the bet)
    const contrib = bettingState.getContributionThisRound(seat.seatId);
    if (contrib < bettingState.currentBetToMatch || !seat.hasActedThisRound) {
      return seat.seatId;
    }
  }
  
  // No one needs to act
  return -1;
}

/**
 * Validate buy-in amount
 * 
 * @param buyInAmount Amount player wants to buy in for
 * @param minBuyIn Minimum buy-in amount
 * @param maxBuyIn Maximum buy-in amount
 * @returns true if buy-in amount is valid
 */
export function validateBuyIn(buyInAmount: i64, minBuyIn: i64, maxBuyIn: i64): bool {
  return buyInAmount >= minBuyIn && buyInAmount <= maxBuyIn;
}

/**
 * Process a buy-in for a player
 * Adds chips to their stack and records buy-in amount
 * 
 * @param seat Poker seat to update
 * @param buyInAmount Amount to buy in for
 * @param minBuyIn Minimum buy-in amount
 * @param maxBuyIn Maximum buy-in amount
 * @returns Updated seat, or null if buy-in is invalid
 */
export function processBuyIn(
  seat: PokerSeatBase,
  buyInAmount: i64,
  minBuyIn: i64,
  maxBuyIn: i64
): PokerSeatBase | null {
  if (!validateBuyIn(buyInAmount, minBuyIn, maxBuyIn)) {
    return null;
  }
  
  const updatedSeat = seat.clone();
  updatedSeat.stack += buyInAmount;
  // Note: buyInAmount tracking would be in game-specific seat class
  return updatedSeat;
}

/**
 * Check if betting round is complete
 * All non-all-in players must have acted and matched the bet
 * 
 * @param seats Array of poker seats
 * @param bettingState Betting round state
 * @returns true if betting round is complete
 */
export function isBettingRoundComplete(
  seats: PokerSeatBase[],
  bettingState: BettingRoundState
): bool {
  // Count active players (in hand, not all-in)
  let activePlayers = 0;
  let playersWhoCanAct = 0;
  
  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i];
    if (seat.isEmpty() || !seat.inHand) {
      continue;
    }
    
    activePlayers++;
    
    // Skip all-in players
    if (seat.allIn) {
      continue;
    }
    
    playersWhoCanAct++;
    
    // Check if they've matched the bet
    const contrib = bettingState.getContributionThisRound(seat.seatId);
    if (contrib < bettingState.currentBetToMatch) {
      return false; // Someone hasn't matched
    }
    
    // Check if they've acted (unless they're the last aggressor)
    if (!seat.hasActedThisRound) {
      // If this is the last aggressor and everyone else has matched, round is complete
      if (seat.seatId === bettingState.lastAggressorSeatId) {
        // Check if everyone else has matched
        let allMatched = true;
        for (let j = 0; j < seats.length; j++) {
          if (i === j) continue;
          const otherSeat = seats[j];
          if (otherSeat.isEmpty() || !otherSeat.inHand || otherSeat.allIn) continue;
          const otherContrib = bettingState.getContributionThisRound(otherSeat.seatId);
          if (otherContrib < bettingState.currentBetToMatch) {
            allMatched = false;
            break;
          }
        }
        if (allMatched) {
          return true;
        }
      }
      return false; // Someone hasn't acted
    }
  }
  
  // If only one active player, round is complete
  if (activePlayers <= 1) {
    return true;
  }
  
  // If no one can act, round is complete
  if (playersWhoCanAct === 0) {
    return true;
  }
  
  return true;
}

