// @ts-nocheck
/**
 * State validation helpers for Arcana programs
 * 
 * Provides utilities for:
 * - Validating program status
 * - Validating wager amounts
 * - Validating player counts
 * - Structured validation results
 * 
 * These helpers provide consistent validation patterns across programs.
 */

import { ProgramState, ContractStatus } from "../core/state";

/**
 * Validation result class for structured validation responses
 */
export class ValidationResult {
  isValid: bool;
  errorMessage: string;

  constructor(isValid: bool, errorMessage: string = "") {
    this.isValid = isValid;
    this.errorMessage = errorMessage;
  }

  /**
   * Create a valid result
   * @returns A ValidationResult indicating success
   */
  static valid(): ValidationResult {
    return new ValidationResult(true, "");
  }

  /**
   * Create an invalid result with an error message
   * @param message - The error message
   * @returns A ValidationResult indicating failure
   */
  static invalid(message: string): ValidationResult {
    return new ValidationResult(false, message);
  }
}

/**
 * Validate that the program status matches the required status
 * @param state - The program state to validate
 * @param requiredStatus - The required status (e.g., ContractStatus.ACTIVE)
 * @returns ValidationResult indicating if the status matches
 */
export function validateProgramStatus(state: ProgramState, requiredStatus: string): ValidationResult {
  if (state.status === requiredStatus) {
    return ValidationResult.valid();
  }
  return ValidationResult.invalid("Program status must be '" + requiredStatus + "', but is '" + state.status + "'");
}

/**
 * Validate that the program is not finished
 * @param state - The program state to validate
 * @returns ValidationResult indicating if the program is not finished
 */
export function validateProgramNotFinished(state: ProgramState): ValidationResult {
  if (state.status === ContractStatus.FINISHED) {
    return ValidationResult.invalid("Program has already finished");
  }
  return ValidationResult.valid();
}

/**
 * Validate that the program is active (not pending or finished)
 * @param state - The program state to validate
 * @returns ValidationResult indicating if the program is active
 */
export function validateProgramActive(state: ProgramState): ValidationResult {
  if (state.status !== ContractStatus.ACTIVE && state.status !== ContractStatus.RUNNING) {
    return ValidationResult.invalid("Program is not active (status: '" + state.status + "')");
  }
  return ValidationResult.valid();
}

/**
 * Validate that the program is in pending status
 * @param state - The program state to validate
 * @returns ValidationResult indicating if the program is pending
 */
export function validateProgramPending(state: ProgramState): ValidationResult {
  if (state.status !== ContractStatus.PENDING) {
    return ValidationResult.invalid("Program must be in pending status, but is '" + state.status + "'");
  }
  return ValidationResult.valid();
}

export function validateGameStatus(state: ProgramState, requiredStatus: string): ValidationResult {
  return validateProgramStatus(state, requiredStatus);
}

export function validateGameNotFinished(state: ProgramState): ValidationResult {
  return validateProgramNotFinished(state);
}

export function validateGameActive(state: ProgramState): ValidationResult {
  return validateProgramActive(state);
}

export function validateGamePending(state: ProgramState): ValidationResult {
  return validateProgramPending(state);
}

/**
 * Validate a wager amount
 * @param wager - The wager amount to validate
 * @param minWager - The minimum allowed wager (inclusive)
 * @param maxWager - The maximum allowed wager (inclusive, 0 means no max)
 * @returns ValidationResult indicating if the wager is valid
 */
export function validateWager(wager: i64, minWager: i64, maxWager: i64 = 0): ValidationResult {
  if (wager < minWager) {
    return ValidationResult.invalid("Wager must be at least " + minWager.toString());
  }
  if (maxWager > 0 && wager > maxWager) {
    return ValidationResult.invalid("Wager must be at most " + maxWager.toString());
  }
  return ValidationResult.valid();
}

/**
 * Validate that wager is greater than zero
 * @param wager - The wager amount to validate
 * @returns ValidationResult indicating if the wager is positive
 */
export function validateWagerPositive(wager: i64): ValidationResult {
  if (wager <= 0) {
    return ValidationResult.invalid("Wager must be greater than 0");
  }
  return ValidationResult.valid();
}

/**
 * Validate the player count
 * @param players - Array of player IDs
 * @param expectedCount - The expected number of players
 * @returns ValidationResult indicating if the player count matches
 */
export function validatePlayers(players: string[] | null, expectedCount: i32): ValidationResult {
  if (players === null) {
    return ValidationResult.invalid("Players array is null");
  }
  if (players.length !== expectedCount) {
    return ValidationResult.invalid("Must provide exactly " + expectedCount.toString() + " players, but got " + players.length.toString());
  }
  return ValidationResult.valid();
}

/**
 * Validate that there are at least a minimum number of players
 * @param players - Array of player IDs
 * @param minCount - The minimum number of players required
 * @returns ValidationResult indicating if there are enough players
 */
export function validateMinPlayers(players: string[] | null, minCount: i32): ValidationResult {
  if (players === null) {
    return ValidationResult.invalid("Players array is null");
  }
  if (players.length < minCount) {
    return ValidationResult.invalid("Must provide at least " + minCount.toString() + " players, but got " + players.length.toString());
  }
  return ValidationResult.valid();
}

/**
 * Validate that player IDs are not empty
 * @param players - Array of player IDs
 * @returns ValidationResult indicating if all player IDs are non-empty
 */
export function validatePlayerIdsNotEmpty(players: string[] | null): ValidationResult {
  if (players === null) {
    return ValidationResult.invalid("Players array is null");
  }
  for (let i = 0; i < players.length; i++) {
    if (players[i].length === 0) {
      return ValidationResult.invalid("Player ID at index " + i.toString() + " is empty");
    }
  }
  return ValidationResult.valid();
}

/**
 * Validate that all player IDs are unique
 * @param players - Array of player IDs
 * @returns ValidationResult indicating if all player IDs are unique
 */
export function validatePlayerIdsUnique(players: string[] | null): ValidationResult {
  if (players === null) {
    return ValidationResult.invalid("Players array is null");
  }
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      if (players[i] === players[j]) {
        return ValidationResult.invalid("Duplicate player ID found: '" + players[i] + "'");
      }
    }
  }
  return ValidationResult.valid();
}

/**
 * Validate a token symbol is not empty
 * @param token - The token symbol to validate
 * @returns ValidationResult indicating if the token is valid
 */
export function validateToken(token: string): ValidationResult {
  if (token.length === 0) {
    return ValidationResult.invalid("Token symbol is required");
  }
  return ValidationResult.valid();
}

/**
 * Validate a numeric value is within a range
 * @param value - The value to validate
 * @param min - The minimum allowed value (inclusive)
 * @param max - The maximum allowed value (inclusive)
 * @returns ValidationResult indicating if the value is in range
 */
export function validateRange(value: i32, min: i32, max: i32): ValidationResult {
  if (value < min || value > max) {
    return ValidationResult.invalid("Value must be between " + min.toString() + " and " + max.toString() + ", but got " + value.toString());
  }
  return ValidationResult.valid();
}

/**
 * Validate a numeric value is at least a minimum
 * @param value - The value to validate
 * @param min - The minimum allowed value (inclusive)
 * @returns ValidationResult indicating if the value meets the minimum
 */
export function validateMin(value: i32, min: i32): ValidationResult {
  if (value < min) {
    return ValidationResult.invalid("Value must be at least " + min.toString() + ", but got " + value.toString());
  }
  return ValidationResult.valid();
}

/**
 * Validate a numeric value is at most a maximum
 * @param value - The value to validate
 * @param max - The maximum allowed value (inclusive)
 * @returns ValidationResult indicating if the value meets the maximum
 */
export function validateMax(value: i32, max: i32): ValidationResult {
  if (value > max) {
    return ValidationResult.invalid("Value must be at most " + max.toString() + ", but got " + value.toString());
  }
  return ValidationResult.valid();
}
