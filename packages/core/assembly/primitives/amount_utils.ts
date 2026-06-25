/**
 * Standardized amount handling utilities for game engines
 * 
 * This module provides type-safe utilities for handling u256 amounts
 * from onchain contracts to AssemblyScript game engines.
 * 
 * USAGE PATTERN:
 * 1. Amounts come from onchain as strings (u256 precision)
 * 2. Parse and validate using parse_amount_from_string() or parse_amount_from_number()
 * 3. Use BigInt for calculations if full precision needed
 * 4. Convert to u64 only if value fits (for performance)
 * 5. Convert back to string for effects/output
 * 
 * NOTE: AssemblyScript doesn't support union types, so we provide separate
 * functions for string and number inputs. Use parse_amount_from_string() for
 * u256 strings, and parse_amount_from_number() for downscaled u64 values.
 */

import { BigInt } from "./bigint";
import {
  is_valid_u256_string,
  parse_u256_string,
  u256_string_to_bigint,
  u256_string_fits_u64,
  u256_string_to_u64
} from "./conversions";

/**
 * Check if a string amount is valid
 * 
 * @param value - u256 string value
 * @returns true if valid, false otherwise
 */
export function is_valid_amount_string(value: string): bool {
  if (value.length == 0) {
    return false;
  }
  return is_valid_u256_string(value);
}

/**
 * Parse an amount from a string (u256)
 * Returns BigInt.ZERO if invalid - check with is_valid_amount_string first
 * 
 * @param value - u256 string value
 * @returns BigInt value (BigInt.ZERO if invalid)
 */
export function parse_amount_from_string(value: string): BigInt {
  if (value.length == 0) {
    return BigInt.ZERO;
  }
  // u256 string - parse and validate
  return parse_u256_string(value);
}

/**
 * Parse an amount from a number (u64, downscaled)
 * 
 * @param value - u64 number value
 * @returns BigInt representation
 */
export function parse_amount_from_number(value: u64): BigInt {
  // This is a downscaled u64 value - convert to BigInt
  return BigInt.fromString(value.toString());
}

/**
 * Parse an amount from string, throwing error if invalid or missing
 * 
 * @param value - u256 string value
 * @param fieldName - Field name for error messages
 * @returns BigInt value
 */
export function parse_amount_from_string_required(
  value: string,
  fieldName: string
): BigInt {
  if (value.length == 0) {
    throw new Error(fieldName + " is required");
  }
  
  if (!is_valid_amount_string(value)) {
    throw new Error(fieldName + " is invalid: " + value);
  }
  
  const amount = parse_amount_from_string(value);
  if (amount.eq(BigInt.ZERO) && value != "0") {
    throw new Error(fieldName + " is invalid: " + value);
  }
  
  return amount;
}

/**
 * Parse an amount from number, throwing error if invalid
 * 
 * @param value - u64 number value
 * @param fieldName - Field name for error messages
 * @returns BigInt value
 */
export function parse_amount_from_number_required(
  value: u64,
  fieldName: string
): BigInt {
  return parse_amount_from_number(value);
}

/**
 * Parse an amount from string and validate it's greater than zero
 * 
 * @param value - u256 string value
 * @param fieldName - Field name for error messages
 * @returns BigInt value
 */
export function parse_amount_from_string_positive(
  value: string,
  fieldName: string
): BigInt {
  const amount = parse_amount_from_string_required(value, fieldName);
  
  if (amount.lte(BigInt.ZERO)) {
    throw new Error(fieldName + " must be greater than 0");
  }
  
  return amount;
}

/**
 * Parse an amount from number and validate it's greater than zero
 * 
 * @param value - u64 number value
 * @param fieldName - Field name for error messages
 * @returns BigInt value
 */
export function parse_amount_from_number_positive(
  value: u64,
  fieldName: string
): BigInt {
  const amount = parse_amount_from_number(value);
  
  if (amount.lte(BigInt.ZERO)) {
    throw new Error(fieldName + " must be greater than 0");
  }
  
  return amount;
}

/**
 * Check if a string amount can be converted to u64
 * 
 * @param value - u256 string value
 * @returns true if value fits in u64, false otherwise
 */
export function amount_string_fits_u64(value: string): bool {
  if (value.length == 0) {
    return false;
  }
  return u256_string_fits_u64(value);
}

/**
 * Parse an amount from string and convert to u64 if it fits
 * Returns 0 if value exceeds u64::MAX - check with amount_string_fits_u64 first
 * 
 * @param value - u256 string value
 * @returns u64 value (0 if too large - check with amount_string_fits_u64 first)
 */
export function parse_amount_string_to_u64(value: string): u64 {
  if (value.length == 0) {
    return u64(0);
  }
  // u256 string - try to convert to u64
  return u256_string_to_u64(value);
}

/**
 * Parse an amount from number (already u64)
 * 
 * @param value - u64 number value
 * @returns u64 value
 */
export function parse_amount_number_to_u64(value: u64): u64 {
  return value;
}

/**
 * Convert a BigInt amount to u256 string for effects/output
 * 
 * @param amount - BigInt amount
 * @returns u256 string
 */
export function amount_to_string(amount: BigInt): string {
  return amount.toString();
}

/**
 * Convert a u64 amount to u256 string for effects/output
 * 
 * @param amount - u64 amount
 * @returns u256 string
 */
export function u64_amount_to_string(amount: u64): string {
  return amount.toString();
}

/**
 * Compare two amounts
 * 
 * @param a - First amount (BigInt)
 * @param b - Second amount (BigInt)
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compare_amounts(a: BigInt, b: BigInt): i32 {
  if (a.lt(b)) return -1;
  if (a.gt(b)) return 1;
  return 0;
}

/**
 * Add two amounts
 * 
 * @param a - First amount (BigInt)
 * @param b - Second amount (BigInt)
 * @returns Sum as BigInt
 */
export function add_amounts(a: BigInt, b: BigInt): BigInt {
  return a.add(b);
}

/**
 * Subtract two amounts
 * 
 * @param a - First amount (BigInt)
 * @param b - Second amount (BigInt)
 * @returns Difference as BigInt (returns zero if result would be negative)
 */
export function subtract_amounts(a: BigInt, b: BigInt): BigInt {
  if (a.lt(b)) {
    return BigInt.ZERO;
  }
  return a.sub(b);
}

/**
 * Multiply an amount by a u64 factor
 * 
 * @param amount - Amount (BigInt)
 * @param factor - Factor (u64)
 * @returns Product as BigInt
 */
export function multiply_amount(amount: BigInt, factor: u64): BigInt {
  const factorBigInt = BigInt.fromString(factor.toString());
  return amount.mul(factorBigInt);
}

/**
 * Divide an amount by a u64 divisor
 * 
 * @param amount - Amount (BigInt)
 * @param divisor - Divisor (u64, must be > 0)
 * @returns Quotient as BigInt
 */
export function divide_amount(amount: BigInt, divisor: u64): BigInt {
  if (divisor == 0) {
    throw new Error("Division by zero");
  }
  const divisorBigInt = BigInt.fromString(divisor.toString());
  return amount.div(divisorBigInt);
}

