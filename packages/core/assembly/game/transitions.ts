// @ts-nocheck
/**
 * State transition helpers for Arcana programs
 * 
 * Provides utilities for:
 * - Validating state transitions
 * - Creating state updates
 * - Managing allowed transitions
 * - Tracking state change history
 * 
 * These helpers enforce valid state machine transitions and reduce
 * state mutation bugs.
 */

import { ContractStatus } from "../core/state";

/**
 * StateTransition class for tracking and validating state changes
 */
export class StateTransition {
  fromStatus: string;
  toStatus: string;
  isValid: bool;
  errorMessage: string;

  constructor(fromStatus: string, toStatus: string, isValid: bool, errorMessage: string = "") {
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
    this.isValid = isValid;
    this.errorMessage = errorMessage;
  }

  /**
   * Create a valid transition
   * @param fromStatus - The source status
   * @param toStatus - The target status
   * @returns A StateTransition indicating success
   */
  static valid(fromStatus: string, toStatus: string): StateTransition {
    return new StateTransition(fromStatus, toStatus, true, "");
  }

  /**
   * Create an invalid transition with an error message
   * @param fromStatus - The source status
   * @param toStatus - The target status
   * @param errorMessage - The error message
   * @returns A StateTransition indicating failure
   */
  static invalid(fromStatus: string, toStatus: string, errorMessage: string): StateTransition {
    return new StateTransition(fromStatus, toStatus, false, errorMessage);
  }
}

/**
 * Check if a state transition is allowed
 * @param fromStatus - The current status
 * @param toStatus - The target status
 * @param allowedTransitions - Map of allowed transitions (from -> array of allowed to statuses)
 * @returns true if the transition is allowed
 */
export function isTransitionAllowed(
  fromStatus: string,
  toStatus: string,
  allowedTransitions: Map<string, string[]>
): bool {
  const allowed = allowedTransitions.get(fromStatus);
  if (allowed === null) {
    return false; // No transitions allowed from this status
  }
  
  for (let i = 0; i < allowed.length; i++) {
    if (allowed[i] === toStatus) {
      return true;
    }
  }
  return false;
}

/**
 * Validate a state transition
 * @param fromStatus - The current status
 * @param toStatus - The target status
 * @param allowedTransitions - Map of allowed transitions
 * @returns StateTransition result
 */
export function validateTransition(
  fromStatus: string,
  toStatus: string,
  allowedTransitions: Map<string, string[]>
): StateTransition {
  if (isTransitionAllowed(fromStatus, toStatus, allowedTransitions)) {
    return StateTransition.valid(fromStatus, toStatus);
  }
  const allowed = allowedTransitions.get(fromStatus);
  let allowedStr = "none";
  if (allowed !== null && allowed.length > 0) {
    allowedStr = allowed.join(", ");
  }
  return StateTransition.invalid(
    fromStatus,
    toStatus,
    "Invalid transition from '" + fromStatus + "' to '" + toStatus + "'. Allowed: [" + allowedStr + "]"
  );
}

/**
 * Create a standard program state transition map
 * Common transitions: pending -> active -> finished
 * @returns Map of allowed transitions for standard program flow
 */
export function createStandardProgramTransitions(): Map<string, string[]> {
  const transitions = new Map<string, string[]>();
  
  const pendingAllowed: string[] = [ContractStatus.ACTIVE, ContractStatus.FINISHED];
  transitions.set(ContractStatus.PENDING, pendingAllowed);
  
  const activeAllowed: string[] = [ContractStatus.RUNNING, ContractStatus.FINISHED];
  transitions.set(ContractStatus.ACTIVE, activeAllowed);
  
  const runningAllowed: string[] = [ContractStatus.ACTIVE, ContractStatus.FINISHED];
  transitions.set(ContractStatus.RUNNING, runningAllowed);
  
  // Finished is terminal - no transitions allowed
  const finishedAllowed: string[] = [];
  transitions.set(ContractStatus.FINISHED, finishedAllowed);
  
  return transitions;
}

export function createStandardGameTransitions(): Map<string, string[]> {
  return createStandardProgramTransitions();
}

/**
 * Check if a status is terminal (no transitions allowed)
 * @param status - The status to check
 * @param allowedTransitions - Map of allowed transitions
 * @returns true if the status is terminal
 */
export function isTerminalStatus(status: string, allowedTransitions: Map<string, string[]>): bool {
  const allowed = allowedTransitions.get(status);
  return allowed === null || allowed.length === 0;
}

/**
 * Get all allowed transitions from a status
 * @param fromStatus - The source status
 * @param allowedTransitions - Map of allowed transitions
 * @returns Array of allowed target statuses, or empty array if none
 */
export function getAllowedTransitions(
  fromStatus: string,
  allowedTransitions: Map<string, string[]>
): string[] {
  const allowed = allowedTransitions.get(fromStatus);
  if (allowed === null) {
    return [];
  }
  return allowed.slice(0); // Return copy
}

/**
 * TransitionManager class for managing state transitions
 * 
 * Tracks allowed transitions and validates state changes.
 * 
 * Example usage:
 *   const manager = new TransitionManager(createStandardGameTransitions());
 *   const result = manager.canTransition("pending", "active"); // true
 *   const transition = manager.validateTransition("pending", "active"); // StateTransition
 */
export class TransitionManager {
  allowedTransitions: Map<string, string[]>;

  /**
   * Create a new TransitionManager
   * @param allowedTransitions - Map of allowed transitions
   */
  constructor(allowedTransitions: Map<string, string[]>) {
    this.allowedTransitions = allowedTransitions;
  }

  /**
   * Check if a transition is allowed
   * @param fromStatus - The source status
   * @param toStatus - The target status
   * @returns true if the transition is allowed
   */
  canTransition(fromStatus: string, toStatus: string): bool {
    return isTransitionAllowed(fromStatus, toStatus, this.allowedTransitions);
  }

  /**
   * Validate a transition
   * @param fromStatus - The source status
   * @param toStatus - The target status
   * @returns StateTransition result
   */
  validateTransition(fromStatus: string, toStatus: string): StateTransition {
    return validateTransition(fromStatus, toStatus, this.allowedTransitions);
  }

  /**
   * Get all allowed transitions from a status
   * @param fromStatus - The source status
   * @returns Array of allowed target statuses
   */
  getAllowedTransitions(fromStatus: string): string[] {
    return getAllowedTransitions(fromStatus, this.allowedTransitions);
  }

  /**
   * Check if a status is terminal
   * @param status - The status to check
   * @returns true if the status is terminal
   */
  isTerminal(status: string): bool {
    return isTerminalStatus(status, this.allowedTransitions);
  }
}

/**
 * Create a new TransitionManager with standard program transitions
 * @returns A TransitionManager with standard program flow transitions
 */
export function createStandardTransitionManager(): TransitionManager {
  return new TransitionManager(createStandardProgramTransitions());
}
