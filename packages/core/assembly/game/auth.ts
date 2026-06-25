// @ts-nocheck
/**
 * Player Authorization Helpers for Game Contracts
 * 
 * Provides utilities for:
 * - Checking if a caller is a player in the game
 * - Getting player indices
 * - Validating player permissions
 * - Checking if it's a specific player's turn
 * 
 * These helpers reduce boilerplate in game contracts by providing
 * common authorization patterns.
 */

import { ContractContext } from "../core/context";

/**
 * Check if the caller is a player in the game
 * @param context - The contract context containing callerId
 * @param playerIds - Array of player IDs in the game
 * @returns true if the caller is one of the players
 */
export function isPlayer(context: ContractContext, playerIds: string[]): bool {
  const callerId = context.callerId;
  for (let i = 0; i < playerIds.length; i++) {
    if (playerIds[i] === callerId) {
      return true;
    }
  }
  return false;
}

/**
 * Get the index of the caller in the players array
 * @param context - The contract context containing callerId
 * @param playerIds - Array of player IDs in the game
 * @returns The player index (0-based), or -1 if not a player
 */
export function getPlayerIndex(context: ContractContext, playerIds: string[]): i32 {
  const callerId = context.callerId;
  for (let i = 0; i < playerIds.length; i++) {
    if (playerIds[i] === callerId) {
      return i;
    }
  }
  return -1;
}

/**
 * Check if the caller is a specific player by index
 * @param context - The contract context containing callerId
 * @param playerIds - Array of player IDs in the game
 * @param playerIndex - The index of the player to check (0-based)
 * @returns true if the caller is the player at the specified index
 */
export function isPlayerAtIndex(context: ContractContext, playerIds: string[], playerIndex: i32): bool {
  if (playerIndex < 0 || playerIndex >= playerIds.length) {
    return false;
  }
  return context.callerId === playerIds[playerIndex];
}

/**
 * Check if it's the current player's turn
 * @param context - The contract context containing callerId
 * @param playerIds - Array of player IDs in the game
 * @param currentPlayerIndex - The index of the player whose turn it is (0-based)
 * @returns true if the caller is the current player
 */
export function isCurrentPlayer(context: ContractContext, playerIds: string[], currentPlayerIndex: i32): bool {
  if (currentPlayerIndex < 0 || currentPlayerIndex >= playerIds.length) {
    return false;
  }
  return context.callerId === playerIds[currentPlayerIndex];
}

/**
 * Check if the caller is NOT the current player (opponent's turn)
 * @param context - The contract context containing callerId
 * @param playerIds - Array of player IDs in the game
 * @param currentPlayerIndex - The index of the player whose turn it is (0-based)
 * @returns true if the caller is NOT the current player
 */
export function isNotCurrentPlayer(context: ContractContext, playerIds: string[], currentPlayerIndex: i32): bool {
  return !isCurrentPlayer(context, playerIds, currentPlayerIndex);
}

/**
 * Validate that the caller is a player in the game
 * @param context - The contract context containing callerId
 * @param playerIds - Array of player IDs in the game
 * @returns true if the caller is a player, false otherwise
 */
export function validatePlayer(context: ContractContext, playerIds: string[]): bool {
  return isPlayer(context, playerIds);
}

/**
 * Validate that the caller is the current player
 * @param context - The contract context containing callerId
 * @param playerIds - Array of player IDs in the game
 * @param currentPlayerIndex - The index of the player whose turn it is (0-based)
 * @returns true if the caller is the current player, false otherwise
 */
export function validateCurrentPlayer(context: ContractContext, playerIds: string[], currentPlayerIndex: i32): bool {
  return isCurrentPlayer(context, playerIds, currentPlayerIndex);
}

/**
 * Get player ID at a specific index
 * @param playerIds - Array of player IDs in the game
 * @param index - The index of the player (0-based)
 * @returns The player ID at the index, or empty string if index is invalid
 */
export function getPlayerId(playerIds: string[], index: i32): string {
  if (index < 0 || index >= playerIds.length) {
    return "";
  }
  return playerIds[index];
}

/**
 * Check if a specific player ID is in the players array
 * @param playerId - The player ID to check
 * @param playerIds - Array of player IDs in the game
 * @returns true if the player ID is in the array
 */
export function isPlayerIdInGame(playerId: string, playerIds: string[]): bool {
  for (let i = 0; i < playerIds.length; i++) {
    if (playerIds[i] === playerId) {
      return true;
    }
  }
  return false;
}

/**
 * Get all player IDs except the caller
 * @param context - The contract context containing callerId
 * @param playerIds - Array of player IDs in the game
 * @returns Array of player IDs excluding the caller
 */
export function getOtherPlayers(context: ContractContext, playerIds: string[]): string[] {
  const callerId = context.callerId;
  const others: string[] = [];
  for (let i = 0; i < playerIds.length; i++) {
    if (playerIds[i] !== callerId) {
      others.push(playerIds[i]);
    }
  }
  return others;
}

