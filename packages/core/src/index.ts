/**
 * Core interfaces for game engines
 * 
 * All game engines must implement the GameEngine interface
 * and be pure, deterministic functions.
 */

export interface GameContext {
  gameId: string;
  callerId: string;
  nowMs: number;
  serverSeed: string;
}

export interface GameEvent {
  type: string;
  payload?: any;
}

export interface EngineResult<State = any> {
  newState: State;
  events: GameEvent[];
}

export type EntrypointHandler<State = any, Args = any> = (
  state: State,
  context: GameContext,
  args: Args
) => EngineResult<State>;

export interface GameEngine<State = any> {
  /**
   * Called once when creating a new game (optional)
   * If not provided, the initial state must be provided externally
   */
  init?: (context: GameContext, args: any) => EngineResult<State>;

  /**
   * Generic handler for all game actions
   * Must be pure and deterministic
   */
  handle: EntrypointHandler<State, any>;
}

/**
 * Helper function to create a deterministic random number from a seed
 */
export function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  let value = Math.abs(hash);
  
  return function() {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

