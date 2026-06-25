/**
 * Conversion utilities for token amounts
 * Handles conversion between raw amounts (u64 or BigInt) and human-readable formats
 * with token-specific decimals support
 * 
 * Supports both downscaled u64 amounts and full BigInt amounts (as strings)
 * 
 * STANDARDIZED u256 HANDLING:
 * - Amounts from onchain are always strings (u256 precision)
 * - Amounts can be optionally downscaled to u64 for game engine use
 * - All conversions are type-safe and validated
 */

import { BigInt } from "./bigint";

// ============================================================================
// u256 VALIDATION AND UTILITIES
// ============================================================================

/// Maximum u256 value: 2^256 - 1
/// 115792089237316195423570985008687907853269984665640564039457584007913129639935
const U256_MAX_STRING = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
const U256_MAX_LENGTH = 78;

/// Validate that a string is a valid u256 amount
/// 
/// @param value - String to validate
/// @returns true if valid u256 string, false otherwise
export function is_valid_u256_string(value: string): bool {
  // Must be non-empty
  if (value.length == 0) {
    return false;
  }
  
  // Must contain only digits
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    if (char < 48 || char > 57) { // '0' to '9'
      return false;
    }
  }
  
  // Check length (u256 max is 78 digits)
  if (value.length > U256_MAX_LENGTH) {
    return false;
  }
  
  // Check if it exceeds u256 max value (lexicographic comparison for same length)
  if (value.length == U256_MAX_LENGTH && value > U256_MAX_STRING) {
    return false;
  }
  
  return true;
}

/// Parse and validate a u256 amount string
/// Returns BigInt.ZERO if invalid - check with is_valid_u256_string first
/// 
/// @param value - String to parse
/// @returns BigInt value (BigInt.ZERO if invalid)
export function parse_u256_string(value: string): BigInt {
  if (!is_valid_u256_string(value)) {
    return BigInt.ZERO;
  }
  
  return BigInt.fromString(value);
}

/// Convert a u256 string to BigInt with validation
/// Throws error if invalid
/// 
/// @param value - u256 string to convert
/// @returns BigInt value
export function u256_string_to_bigint(value: string): BigInt {
  if (!is_valid_u256_string(value)) {
    throw new Error(`Invalid u256 string: ${value}`);
  }
  return BigInt.fromString(value);
}

/// Check if a u256 string can be safely converted to u64
/// 
/// @param value - u256 string to check
/// @returns true if value fits in u64, false otherwise
export function u256_string_fits_u64(value: string): bool {
  if (!is_valid_u256_string(value)) {
    return false;
  }
  
  // u64 max is 18446744073709551615 (20 digits)
  const U64_MAX_STRING = "18446744073709551615";
  
  if (value.length > 20) {
    return false;
  }
  
  if (value.length == 20 && value > U64_MAX_STRING) {
    return false;
  }
  
  return true;
}

/// Convert a u256 string to u64 with validation
/// Returns 0 if value exceeds u64::MAX (use u256_string_fits_u64 to check first)
/// 
/// @param value - u256 string to convert
/// @returns u64 value (0 if too large - check with u256_string_fits_u64 first)
export function u256_string_to_u64(value: string): u64 {
  if (!u256_string_fits_u64(value)) {
    return u64(0);
  }
  
  return U64.parseInt(value);
}

/// Convert u64 to string
export function u64_to_string(value: u64): string {
  return value.toString();
}

/// Convert string to u64
export function string_to_u64(value: string): u64 {
  return U64.parseInt(value);
}

/// Convert raw amount (u64, in smallest unit) to human-readable string
/// Uses token-specific decimals for conversion
/// 
/// @param raw - Raw amount in smallest unit (e.g., wei for ETH)
/// @param decimals - Number of decimal places for the token (e.g., 18 for ETH, 6 for USDC)
/// @returns Human-readable string amount
export function raw_to_human(raw: u64, decimals: u8): string {
  if (decimals == 0) {
    return raw.toString();
  }
  
  // Calculate 10^decimals
  let divisor: u64 = 1;
  for (let i: u8 = 0; i < decimals; i++) {
    divisor = divisor * u64(10);
  }
  
  const whole = raw / divisor;
  const remainder = raw % divisor;
  
  if (remainder == 0) {
    return whole.toString();
  }
  
  // Format with decimals
  const remainderStr = remainder.toString();
  const decimalsI32 = i32(decimals);
  const padding = decimalsI32 - remainderStr.length;
  let paddedRemainder = remainderStr;
  for (let i = 0; i < padding; i++) {
    paddedRemainder = "0" + paddedRemainder;
  }
  
  // Remove trailing zeros
  while (paddedRemainder.length > 0 && paddedRemainder.charAt(paddedRemainder.length - 1) == "0") {
    paddedRemainder = paddedRemainder.substring(0, paddedRemainder.length - 1);
  }
  
  if (paddedRemainder.length == 0) {
    return whole.toString();
  }
  
  return whole.toString() + "." + paddedRemainder;
}

/// Convert human-readable string to raw amount (u64, in smallest unit)
/// Uses token-specific decimals for conversion
/// 
/// @param human - Human-readable string amount (e.g., "1.5")
/// @param decimals - Number of decimal places for the token (e.g., 18 for ETH, 6 for USDC)
/// @returns Raw amount in smallest unit, or 0 if parsing fails
export function human_to_raw(human: string, decimals: u8): u64 {
  if (decimals == 0) {
    return U64.parseInt(human);
  }
  
  const parts = human.split(".");
  const whole = parts.length > 0 ? U64.parseInt(parts[0]) : u64(0);
  const fractional = parts.length > 1 ? parts[1] : "";
  
  // Pad fractional part to decimals length
  let paddedFractional = fractional;
  const decimalsI32 = i32(decimals);
  while (paddedFractional.length < decimalsI32) {
    paddedFractional = paddedFractional + "0";
  }
  // Truncate if too long
  if (paddedFractional.length > decimalsI32) {
    paddedFractional = paddedFractional.substring(0, decimalsI32);
  }
  
  const fractionalValue = U64.parseInt(paddedFractional);
  
  // Calculate 10^decimals
  let multiplier: u64 = 1;
  for (let i: u8 = 0; i < decimals; i++) {
    multiplier = multiplier * u64(10);
  }
  
  return whole * multiplier + fractionalValue;
}

/// Default decimals for ERC20 tokens
export const DEFAULT_DECIMALS: u8 = 18;

/// Parse amount from number (u64) to u64
/// 
/// @param value - Amount as number (u64)
/// @returns u64 value
export function parse_amount_from_number(value: number): u64 {
  return <u64>value;
}

/// Parse amount from string (BigInt) - returns as string for BigInt parsing
/// 
/// @param value - Amount as string (BigInt)
/// @returns String value for BigInt parsing
export function parse_amount_from_string(value: string): string {
  return value;
}

/// Convert number (u64) to string
/// 
/// @param value - Amount as number (u64)
/// @returns Amount as string
export function amount_number_to_string(value: number): string {
  return value.toString();
}

/// Convert string to string (identity function for consistency)
/// 
/// @param value - Amount as string
/// @returns Amount as string
export function amount_string_to_string(value: string): string {
  return value;
}

/// Try to convert amount string to u64
/// 
/// @param value - Amount as string
/// @returns u64 if value fits, otherwise returns 0
export function amount_string_to_u64(value: string): u64 {
  // Try to parse as u64
  const u64_val = U64.parseInt(value);
  // Check if the string representation matches (to detect overflow)
  if (u64_val.toString() == value) {
    return u64_val;
  } else {
    // Value is too large for u64, return 0
    return u64(0);
  }
}

/// Check if amount string can be converted to u64
/// 
/// @param value - Amount as string
/// @returns true if value fits in u64, false otherwise
export function amount_string_fits_u64(value: string): bool {
  const u64_val = U64.parseInt(value);
  return u64_val.toString() == value;
}

// ============================================================================
// FIXED-POINT INTEGER CONVERSIONS
// ============================================================================
// These functions allow the game engine to work with fixed-point integers
// instead of dealing with decimals directly. For example:
// - 1.95 becomes 1_950000 (with 6 decimal places)
// - This is stored as u64: 1950000
// - Calculations stay as integers, making them easier to work with
// - When converting back to raw u256 for effects, multiply by appropriate factor

/// Fixed-point precision for game engine (8 decimal places = 1e8, default)
/// This means 1.95 is represented as 195000000 (u64)
/// 
/// Using 8 decimals provides:
/// - Support for very small memecoin values (down to 0.00000001 = 1e-8)
/// - Max value: ~184.4 billion tokens (fits in u64)
/// - Good precision for game logic while maintaining exact accounting in Rust
/// 
/// Note: This can be overridden per-contract via ContractContext.fixedPointScale
/// The AssemblyScript side will use the scale specified in the context
export const FIXED_POINT_DECIMALS: u8 = 8;

/// Calculate 10^decimals as u64
function pow10(decimals: u8): u64 {
  let result: u64 = 1;
  for (let i: u8 = 0; i < decimals; i++) {
    result = result * u64(10);
  }
  return result;
}

/// Convert raw u256 (as string) to fixed-point u64 for game engine
/// 
/// Example: "1000000000000000000" (1 ETH, 18 decimals) → 1_000000 (1000000 u64)
/// 
/// @param rawU256 - Raw amount as string (u256 precision)
/// @param tokenDecimals - Token decimals (e.g., 18 for ETH, 6 for USDC)
/// @returns Fixed-point u64 value (with FIXED_POINT_DECIMALS precision)
export function raw_u256_to_fixed_point_u64(rawU256: string, tokenDecimals: u8): u64 {
  // Parse the raw u256 string
  const rawBigInt = BigInt.fromString(rawU256);
  
  // Convert to fixed-point representation
  // We need to scale down from tokenDecimals to FIXED_POINT_DECIMALS
  const scaleDown = tokenDecimals - FIXED_POINT_DECIMALS;
  
  if (scaleDown > 0) {
    // Token has more decimals than our fixed-point, divide down
    const divisor = BigInt.from(pow10(scaleDown).toString());
    const scaled = rawBigInt.div(divisor);
    // Convert to u64 (may lose precision if too large, but that's expected)
    return U64.parseInt(scaled.toString());
  } else if (scaleDown < 0) {
    // Token has fewer decimals, multiply up
    const multiplier = BigInt.from(pow10(-scaleDown).toString());
    const scaled = rawBigInt.mul(multiplier);
    return U64.parseInt(scaled.toString());
  } else {
    // Same precision, just convert
    return U64.parseInt(rawBigInt.toString());
  }
}

/// Convert fixed-point u64 back to raw u256 (as string) for effects
/// 
/// Example: 1_950000 (1950000 u64) → "195000000000000000000" (1.95 ETH, 18 decimals)
/// 
/// @param fixedPointU64 - Fixed-point u64 value (with FIXED_POINT_DECIMALS precision)
/// @param tokenDecimals - Token decimals (e.g., 18 for ETH, 6 for USDC)
/// @returns Raw amount as string (u256 precision)
export function fixed_point_u64_to_raw_u256(fixedPointU64: u64, tokenDecimals: u8): string {
  // Convert u64 to BigInt
  const fixedPointBigInt = BigInt.fromString(fixedPointU64.toString());
  
  // Scale up from FIXED_POINT_DECIMALS to tokenDecimals
  const scaleUp = tokenDecimals - FIXED_POINT_DECIMALS;
  
  if (scaleUp > 0) {
    // Token has more decimals, multiply up
    const multiplier = BigInt.from(pow10(scaleUp).toString());
    return fixedPointBigInt.mul(multiplier).toString();
  } else if (scaleUp < 0) {
    // Token has fewer decimals, divide down
    const divisor = BigInt.from(pow10(-scaleUp).toString());
    return fixedPointBigInt.div(divisor).toString();
  } else {
    // Same precision, just convert
    return fixedPointBigInt.toString();
  }
}

/// Convert fixed-point u64 to human-readable string
/// 
/// Example: 1_950000 (1950000 u64) → "1.95"
/// 
/// @param fixedPointU64 - Fixed-point u64 value
/// @returns Human-readable string with decimal point
export function fixed_point_u64_to_human(fixedPointU64: u64): string {
  const divisor = pow10(FIXED_POINT_DECIMALS);
  const whole = fixedPointU64 / divisor;
  const remainder = fixedPointU64 % divisor;
  
  if (remainder == 0) {
    return whole.toString();
  }
  
  // Format with decimals
  const remainderStr = remainder.toString();
  const padding = i32(FIXED_POINT_DECIMALS) - remainderStr.length;
  let paddedRemainder = remainderStr;
  for (let i = 0; i < padding; i++) {
    paddedRemainder = "0" + paddedRemainder;
  }
  
  // Remove trailing zeros
  while (paddedRemainder.length > 0 && paddedRemainder.charAt(paddedRemainder.length - 1) == "0") {
    paddedRemainder = paddedRemainder.substring(0, paddedRemainder.length - 1);
  }
  
  if (paddedRemainder.length == 0) {
    return whole.toString();
  }
  
  return whole.toString() + "." + paddedRemainder;
}

/// Convert human-readable string to fixed-point u64
/// 
/// Example: "1.95" → 1_950000 (1950000 u64)
/// 
/// @param human - Human-readable string (e.g., "1.95")
/// @returns Fixed-point u64 value
export function human_to_fixed_point_u64(human: string): u64 {
  const parts = human.split(".");
  const whole = parts.length > 0 ? U64.parseInt(parts[0]) : u64(0);
  const fractional = parts.length > 1 ? parts[1] : "";
  
  // Pad fractional part to FIXED_POINT_DECIMALS length
  let paddedFractional = fractional;
  const decimalsI32 = i32(FIXED_POINT_DECIMALS);
  while (paddedFractional.length < decimalsI32) {
    paddedFractional = paddedFractional + "0";
  }
  // Truncate if too long
  if (paddedFractional.length > decimalsI32) {
    paddedFractional = paddedFractional.substring(0, decimalsI32);
  }
  
  const fractionalValue = U64.parseInt(paddedFractional);
  const multiplier = pow10(FIXED_POINT_DECIMALS);
  
  return whole * multiplier + fractionalValue;
}

