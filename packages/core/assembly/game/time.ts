// @ts-nocheck
/**
 * Time and Timer Utilities for Game Contracts
 * 
 * Provides utilities for:
 * - Checking if timeouts have elapsed
 * - Calculating deadlines
 * - Getting remaining time
 * - Managing turn timers
 * 
 * All time values are in milliseconds (i64).
 */

/**
 * Check if a timeout has elapsed
 * @param deadline - The deadline timestamp in milliseconds
 * @param currentTime - The current timestamp in milliseconds
 * @param timeoutMs - The timeout duration in milliseconds
 * @returns true if the deadline has passed, false otherwise
 */
export function isTimeoutElapsed(deadline: i64, currentTime: i64, timeoutMs: i64): bool {
  if (deadline <= 0) {
    return false; // No deadline set
  }
  return currentTime >= deadline;
}

/**
 * Calculate a deadline timestamp from current time and timeout duration
 * @param currentTime - The current timestamp in milliseconds
 * @param timeoutMs - The timeout duration in milliseconds
 * @returns The deadline timestamp (currentTime + timeoutMs)
 */
export function calculateDeadline(currentTime: i64, timeoutMs: i64): i64 {
  return currentTime + timeoutMs;
}

/**
 * Get the remaining time until a deadline
 * @param deadline - The deadline timestamp in milliseconds
 * @param currentTime - The current timestamp in milliseconds
 * @returns The remaining time in milliseconds, or 0 if the deadline has passed
 */
export function getTimeRemaining(deadline: i64, currentTime: i64): i64 {
  if (deadline <= 0) {
    return 0; // No deadline set
  }
  const remaining = deadline - currentTime;
  return remaining > 0 ? remaining : 0;
}

/**
 * Check if a deadline is valid (not expired and not in the past)
 * @param deadline - The deadline timestamp in milliseconds
 * @param currentTime - The current timestamp in milliseconds
 * @returns true if the deadline is valid and not expired
 */
export function isValidDeadline(deadline: i64, currentTime: i64): bool {
  if (deadline <= 0) {
    return false; // No deadline set
  }
  return deadline > currentTime;
}

/**
 * TurnTimer class for managing turn-based timeouts
 * 
 * Tracks when a turn started and when it should expire.
 * Useful for games with time-limited turns.
 * 
 * Example usage:
 *   const timer = new TurnTimer(context.nowMs, 30000); // 30 second turn
 *   if (timer.isExpired(context.nowMs)) {
 *     // Turn expired, forfeit or skip
 *   }
 */
export class TurnTimer {
  startTime: i64;
  timeoutMs: i64;
  deadline: i64;

  /**
   * Create a new TurnTimer
   * @param startTime - When the turn started (in milliseconds)
   * @param timeoutMs - How long the turn should last (in milliseconds)
   */
  constructor(startTime: i64, timeoutMs: i64) {
    this.startTime = startTime;
    this.timeoutMs = timeoutMs;
    this.deadline = calculateDeadline(startTime, timeoutMs);
  }

  /**
   * Check if the turn timer has expired
   * @param currentTime - The current timestamp in milliseconds
   * @returns true if the turn has expired
   */
  isExpired(currentTime: i64): bool {
    return isTimeoutElapsed(this.deadline, currentTime, this.timeoutMs);
  }

  /**
   * Get the remaining time for this turn
   * @param currentTime - The current timestamp in milliseconds
   * @returns The remaining time in milliseconds, or 0 if expired
   */
  getTimeRemaining(currentTime: i64): i64 {
    return getTimeRemaining(this.deadline, currentTime);
  }

  /**
   * Check if the timer is still valid (not expired)
   * @param currentTime - The current timestamp in milliseconds
   * @returns true if the timer is still valid
   */
  isValid(currentTime: i64): bool {
    return isValidDeadline(this.deadline, currentTime);
  }

  /**
   * Get the elapsed time since the turn started
   * @param currentTime - The current timestamp in milliseconds
   * @returns The elapsed time in milliseconds
   */
  getElapsedTime(currentTime: i64): i64 {
    return currentTime - this.startTime;
  }

  /**
   * Create a new timer with the same timeout but updated start time
   * @param newStartTime - The new start time in milliseconds
   * @returns A new TurnTimer instance
   */
  withNewStartTime(newStartTime: i64): TurnTimer {
    return new TurnTimer(newStartTime, this.timeoutMs);
  }
}

/**
 * Create a new TurnTimer from current time
 * @param currentTime - The current timestamp in milliseconds
 * @param timeoutMs - The timeout duration in milliseconds
 * @returns A new TurnTimer instance
 */
export function createTurnTimer(currentTime: i64, timeoutMs: i64): TurnTimer {
  return new TurnTimer(currentTime, timeoutMs);
}

