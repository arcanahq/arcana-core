// @ts-nocheck
/**
 * Turn Management Utilities for Game Contracts
 * 
 * Provides utilities for:
 * - Managing turn order and rotation
 * - Calculating next player
 * - Rotating player order
 * - Validating turn transitions
 * 
 * These helpers simplify turn-based game logic.
 */

/**
 * Calculate the next player index in a round-robin fashion
 * @param currentIndex - The current player index (0-based)
 * @param totalPlayers - The total number of players
 * @returns The next player index, wrapping around to 0 after the last player
 */
export function nextPlayer(currentIndex: i32, totalPlayers: i32): i32 {
  if (totalPlayers <= 0) {
    return 0;
  }
  return (currentIndex + 1) % totalPlayers;
}

/**
 * Calculate the previous player index in a round-robin fashion
 * @param currentIndex - The current player index (0-based)
 * @param totalPlayers - The total number of players
 * @returns The previous player index, wrapping around to last player if at 0
 */
export function previousPlayer(currentIndex: i32, totalPlayers: i32): i32 {
  if (totalPlayers <= 0) {
    return 0;
  }
  if (currentIndex <= 0) {
    return totalPlayers - 1;
  }
  return currentIndex - 1;
}

/**
 * Rotate the players array to start from a specific index
 * @param players - The original players array
 * @param startIndex - The index to start from (0-based)
 * @returns A new array with players rotated to start from the specified index
 */
export function rotatePlayers(players: string[], startIndex: i32): string[] {
  if (players.length === 0 || startIndex < 0 || startIndex >= players.length) {
    return players.slice(0); // Return copy of original
  }
  
  const rotated: string[] = [];
  for (let i = 0; i < players.length; i++) {
    const index = (startIndex + i) % players.length;
    rotated.push(players[index]);
  }
  return rotated;
}

/**
 * Check if a player index is valid
 * @param playerIndex - The player index to check (0-based)
 * @param totalPlayers - The total number of players
 * @returns true if the index is valid
 */
export function isValidPlayerIndex(playerIndex: i32, totalPlayers: i32): bool {
  return playerIndex >= 0 && playerIndex < totalPlayers;
}

/**
 * TurnManager class for managing turn-based game flow
 * 
 * Tracks current player, turn order, and provides utilities for
 * advancing turns and managing player rotation.
 * 
 * Example usage:
 *   const manager = new TurnManager(["player1", "player2"], 0);
 *   manager.advanceTurn(); // Move to next player
 *   const current = manager.getCurrentPlayer(); // "player2"
 */
export class TurnManager {
  players: string[];
  currentIndex: i32;

  /**
   * Create a new TurnManager
   * @param players - Array of player IDs in turn order
   * @param currentIndex - The index of the current player (0-based)
   */
  constructor(players: string[], currentIndex: i32 = 0) {
    this.players = players.slice(0); // Copy array
    if (currentIndex < 0 || currentIndex >= players.length) {
      this.currentIndex = 0;
    } else {
      this.currentIndex = currentIndex;
    }
  }

  /**
   * Get the current player ID
   * @returns The current player ID, or empty string if no players
   */
  getCurrentPlayer(): string {
    if (this.players.length === 0) {
      return "";
    }
    return this.players[this.currentIndex];
  }

  /**
   * Get the current player index
   * @returns The current player index (0-based)
   */
  getCurrentIndex(): i32 {
    return this.currentIndex;
  }

  /**
   * Advance to the next player's turn
   * @returns The new current player ID
   */
  advanceTurn(): string {
    this.currentIndex = nextPlayer(this.currentIndex, this.players.length);
    return this.getCurrentPlayer();
  }

  /**
   * Go back to the previous player's turn
   * @returns The new current player ID
   */
  previousTurn(): string {
    this.currentIndex = previousPlayer(this.currentIndex, this.players.length);
    return this.getCurrentPlayer();
  }

  /**
   * Set the current player by index
   * @param index - The player index to set (0-based)
   * @returns true if the index was valid and set, false otherwise
   */
  setCurrentPlayer(index: i32): bool {
    if (!isValidPlayerIndex(index, this.players.length)) {
      return false;
    }
    this.currentIndex = index;
    return true;
  }

  /**
   * Set the current player by player ID
   * @param playerId - The player ID to set as current
   * @returns true if the player ID was found and set, false otherwise
   */
  setCurrentPlayerById(playerId: string): bool {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i] === playerId) {
        this.currentIndex = i;
        return true;
      }
    }
    return false;
  }

  /**
   * Get the next player ID without advancing the turn
   * @returns The next player ID
   */
  peekNextPlayer(): string {
    const nextIndex = nextPlayer(this.currentIndex, this.players.length);
    if (this.players.length === 0) {
      return "";
    }
    return this.players[nextIndex];
  }

  /**
   * Get the previous player ID without going back
   * @returns The previous player ID
   */
  peekPreviousPlayer(): string {
    const prevIndex = previousPlayer(this.currentIndex, this.players.length);
    if (this.players.length === 0) {
      return "";
    }
    return this.players[prevIndex];
  }

  /**
   * Get the total number of players
   * @returns The number of players
   */
  getPlayerCount(): i32 {
    return this.players.length;
  }

  /**
   * Check if the turn manager is valid (has players)
   * @returns true if there are players
   */
  isValid(): bool {
    return this.players.length > 0;
  }

  /**
   * Create a copy of this TurnManager
   * @returns A new TurnManager with the same state
   */
  clone(): TurnManager {
    return new TurnManager(this.players, this.currentIndex);
  }
}

/**
 * Create a new TurnManager from players array
 * @param players - Array of player IDs in turn order
 * @param startIndex - The index to start from (0-based, default 0)
 * @returns A new TurnManager instance
 */
export function createTurnManager(players: string[], startIndex: i32 = 0): TurnManager {
  return new TurnManager(players, startIndex);
}

