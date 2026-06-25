// @ts-nocheck
/**
 * Shared utilities for cash games
 * 
 * Standardized functions for buy-in validation, rake calculation, rebuy eligibility, etc.
 */

import { BigInt } from "@arcanahq/core/assembly/primitives/bigint";
import { is_valid_u256_string, parse_u256_string } from "@arcanahq/core/assembly/primitives/conversions";
import { CashGameSeatBase } from "./cash_game_types";

/**
 * Validate buy-in amount is within min/max range
 * @param amount Buy-in amount as string (BigInt)
 * @param minBuyIn Minimum buy-in as string (BigInt)
 * @param maxBuyIn Maximum buy-in as string (BigInt)
 * @returns true if valid, false otherwise
 */
export function validateBuyInAmount(amount: string, minBuyIn: string, maxBuyIn: string): bool {
  // Validate amount format
  if (!is_valid_u256_string(amount)) {
    return false;
  }
  
  const amountBigInt = parse_u256_string(amount);
  if (amountBigInt.lte(BigInt.ZERO)) {
    return false;
  }
  
  // Validate min/max format
  if (!is_valid_u256_string(minBuyIn) || !is_valid_u256_string(maxBuyIn)) {
    return false;
  }
  
  const minBigInt = parse_u256_string(minBuyIn);
  const maxBigInt = parse_u256_string(maxBuyIn);
  
  // Validate range
  if (minBigInt.lte(BigInt.ZERO) || maxBigInt.lte(BigInt.ZERO)) {
    return false;
  }
  
  if (minBigInt.gt(maxBigInt)) {
    return false;
  }
  
  // Check amount is within range
  if (amountBigInt.lt(minBigInt) || amountBigInt.gt(maxBigInt)) {
    return false;
  }
  
  return true;
}

/**
 * Calculate rake for a pot amount
 * @param potAmount Pot amount as i64
 * @param rakePercentage Rake percentage (e.g., 5.0 for 5%)
 * @param rakeCap Maximum rake per pot (0 = no cap)
 * @returns Rake amount as i64
 */
export function calculateRake(potAmount: i64, rakePercentage: f64, rakeCap: i64): i64 {
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
 * Calculate rake for a pot amount (BigInt string version)
 * @param potAmount Pot amount as string (BigInt)
 * @param rakePercentage Rake percentage (e.g., 5.0 for 5%)
 * @param rakeCap Maximum rake per pot as string (BigInt, "0" = no cap)
 * @returns Rake amount as string (BigInt)
 */
export function calculateRakeString(potAmount: string, rakePercentage: f64, rakeCap: string): string {
  if (rakePercentage <= 0.0) {
    return "0";
  }
  
  if (!is_valid_u256_string(potAmount)) {
    return "0";
  }
  
  const potBigInt = parse_u256_string(potAmount);
  if (potBigInt.lte(BigInt.ZERO)) {
    return "0";
  }
  
  // For percentage calculation, we need to use fixed-point math
  // Calculate percentage using BigInt operations
  // potAmount * percentage / 100
  // Since we can't do floating point with BigInt directly, we'll use integer math:
  // Multiply by percentage (as integer * 100), then divide by 10000
  // e.g., 5% = 500 / 10000
  const percentageInt = <i64>(rakePercentage * 100.0); // e.g., 5.0% = 500
  const percentageBigInt = BigInt.fromString(percentageInt.toString());
  const divisorBigInt = BigInt.fromString("10000");
  
  // Calculate: pot * percentage / 10000
  const rakeBigInt = potBigInt.mul(percentageBigInt).div(divisorBigInt);
  
  // Apply cap if set
  if (is_valid_u256_string(rakeCap) && rakeCap !== "0") {
    const capBigInt = parse_u256_string(rakeCap);
    if (capBigInt.gt(BigInt.ZERO) && rakeBigInt.gt(capBigInt)) {
      return capBigInt.toString();
    }
  }
  
  return rakeBigInt.toString();
}

/**
 * Check if a player can rebuy
 * @param seat Seat to check
 * @param gamePhase Current game phase
 * @param rebuyAllowed Whether rebuys are allowed
 * @param cooldownMs Cooldown between rebuys
 * @param nowMs Current timestamp in milliseconds
 * @returns true if rebuy is allowed, false otherwise
 */
export function canRebuy(
  seat: CashGameSeatBase,
  gamePhase: string,
  rebuyAllowed: bool,
  cooldownMs: i64,
  nowMs: i64
): bool {
  if (!rebuyAllowed) {
    return false;
  }
  
  // Must have a player
  if (seat.isEmpty()) {
    return false;
  }
  
  // Check cooldown
  if (cooldownMs > 0 && seat.lastRebuyAt > 0) {
    const timeSinceRebuy = nowMs - seat.lastRebuyAt;
    if (timeSinceRebuy < cooldownMs) {
      return false;
    }
  }
  
  // Check if stack is zero or very low (for rebuy eligibility)
  const stackBigInt = parse_u256_string(seat.stack);
  if (stackBigInt.gt(BigInt.ZERO)) {
    // For top-up, not rebuy - use canTopUp instead
    return false;
  }
  
  // Can rebuy if stack is zero and not in active hand
  // Game-specific phases should be checked by caller
  return true;
}

/**
 * Check if a player can top up
 * @param seat Seat to check
 * @param topUpAmount Amount to top up as string (BigInt)
 * @param maxBuyIn Maximum buy-in as string (BigInt)
 * @param gamePhase Current game phase
 * @returns true if top-up is allowed, false otherwise
 */
export function canTopUp(
  seat: CashGameSeatBase,
  topUpAmount: string,
  maxBuyIn: string,
  gamePhase: string
): bool {
  // Must have a player
  if (seat.isEmpty()) {
    return false;
  }
  
  // Validate top-up amount
  if (!is_valid_u256_string(topUpAmount)) {
    return false;
  }
  
  const topUpBigInt = parse_u256_string(topUpAmount);
  if (topUpBigInt.lte(BigInt.ZERO)) {
    return false;
  }
  
  // Check current stack + top-up doesn't exceed max buy-in
  const stackBigInt = parse_u256_string(seat.stack);
  const maxBigInt = parse_u256_string(maxBuyIn);
  
  const newStack = stackBigInt.add(topUpBigInt);
  if (newStack.gt(maxBigInt)) {
    return false;
  }
  
  // Can top up if not in active hand
  // Game-specific phases should be checked by caller
  return true;
}

/**
 * Initialize cash game seats array
 * @param maxSeats Maximum number of seats
 * @returns Array of empty seats with seat IDs 0 to maxSeats-1
 */
export function initializeCashGameSeats(maxSeats: i32): CashGameSeatBase[] {
  const seats = new Array<CashGameSeatBase>(maxSeats);
  for (let i = 0; i < maxSeats; i++) {
    seats[i] = new CashGameSeatBase(i, null, "0", "0");
  }
  return seats;
}

