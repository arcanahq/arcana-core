import type { ArgsStruct } from '../contracts/types.js';

/**
 * Game module types
 * 
 * Common types for game implementations.
 */

/**
 * Result of a game action.
 */
export interface GameActionResult<TState = unknown> {
  /** Error message if action failed */
  error?: string;
  /** New state after action */
  new_state?: TState;
  /** Events emitted by action */
  events?: GameEvent[];
  /** State version after action */
  version?: number;
}

/**
 * Game event emitted during action execution.
 */
export interface GameEvent {
  type: string;
  data?: unknown;
  timestamp?: number;
}

/**
 * Standard game state fields (games may extend this).
 */
export interface BaseGameState {
  /** Game status */
  status?: string;
  /** Game phase */
  phase?: string;
  /** List of player IDs */
  players?: string[];
  /** Current player index (for turn-based games) */
  currentPlayerIndex?: number;
  /** Winner player ID (if finished) */
  winner?: string;
  /** Whether game is finished */
  gameFinished?: boolean;
  /** Place rankings */
  places?: GamePlace[];
}

/**
 * Place ranking in a game.
 */
export interface GamePlace {
  playerId: string;
  place: number;
  score?: number;
}

/**
 * Options for creating a game instance.
 */
export interface CreateGameOptions {
  /** Optional instance ID (auto-generated if not provided) */
  instanceId?: string;
  /** Initialization arguments */
  args?: ArgsStruct;
}
