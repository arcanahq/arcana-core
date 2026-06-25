/**
 * Game module
 * 
 * Provides a base class for building game clients that interact with
 * Arcana game instances. Extends this class to add game-specific methods.
 * 
 * @example
 * ```typescript
 * class BattleshipClient extends GameClient<BattleshipState> {
 *   async placeShip(ship: ShipPlacement) {
 *     return this.action('place_ship', ship);
 *   }
 *   
 *   async fireShot(row: number, column: number) {
 *     return this.action('fire_shot', { row, column });
 *   }
 * }
 * 
 * // Usage
 * const client = new ArcanaClient({ apiUrl: 'http://localhost:3003' });
 * const game = new BattleshipClient(client, instanceId, userId);
 * await game.placeShip({ shipType: 'carrier', row: 0, column: 0, horizontal: true });
 * ```
 */

import type { ArcanaClient } from '../client.js';
import type { InstanceActionResponse } from '../contracts/types.js';
import type {
  GameActionResult,
  BaseGameState,
  GamePlace,
  CreateGameOptions,
} from './types.js';

export * from './types.js';

/**
 * Base class for game clients.
 * 
 * Provides common functionality for interacting with game instances:
 * - State retrieval (view and raw)
 * - Action execution with error handling
 * - Common game state queries (status, winner, players, etc.)
 * 
 * Extend this class to create game-specific clients with typed actions.
 * 
 * @typeParam TState - The game state type (should extend BaseGameState)
 */
export class GameClient<TState extends BaseGameState = BaseGameState> {
  protected client: ArcanaClient;
  protected instanceId: string;
  protected userId: string;

  /**
   * Create a new game client.
   * 
   * @param client - The ArcanaClient instance
   * @param instanceId - The game instance ID
   * @param userId - The current user's ID
   */
  constructor(client: ArcanaClient, instanceId: string, userId: string) {
    this.client = client;
    this.instanceId = instanceId;
    this.userId = userId;
  }

  // ==========================================================================
  // State Retrieval
  // ==========================================================================

  /**
   * Get the game state (personalized view for the current user).
   * 
   * This is the primary way to get game state. The server filters
   * the state based on the authenticated user (e.g., hiding opponent's hand).
   */
  async getState(): Promise<TState> {
    const response = await this.client.contracts.view(this.instanceId);
    return this.parseState(response);
  }

  /**
   * Get raw game state (no filtering, for debugging).
   * 
   * Warning: This may expose private information in multiplayer games.
   * Use `getState()` for normal gameplay.
   */
  async getRawState(): Promise<TState> {
    const response = await this.client.contracts.getState(this.instanceId);
    if (response.state) {
      return response.state as TState;
    }
    return response as unknown as TState;
  }

  /**
   * Parse state from API response.
   * Override this in subclasses for custom parsing.
   */
  protected parseState(response: unknown): TState {
    if (Array.isArray(response)) {
      return response as unknown as TState;
    }
    const data = response as Record<string, unknown>;
    
    // Handle different response formats
    let state: unknown;
    
    if (data.state) {
      state = data.state;
    } else if (data.view) {
      state = data.view;
    } else if (data.gameState) {
      state = data.gameState;
    } else {
      state = data;
    }
    
    // Unwrap nested gameState if present
    const stateObj = state as Record<string, unknown>;
    if (stateObj.gameState && !stateObj.phase && !stateObj.status) {
      return stateObj.gameState as TState;
    }
    
    return state as TState;
  }

  // ==========================================================================
  // Actions
  // ==========================================================================

  /**
   * Execute a game action.
   * 
   * @param entrypoint - The action entrypoint name
   * @param args - Action arguments
   * @param options - Optional action options (idempotency_key for HTTP-level idempotency)
   * @returns Action result with events and version (new_state not included - fetch state separately if needed)
   * @throws Error if action fails (includes entrypoint and instance info)
   */
  async action<TArgs = unknown>(
    entrypoint: string,
    args?: TArgs,
    options?: { idempotency_key?: string; block?: boolean }
  ): Promise<GameActionResult<TState>> {
    try {
      // Pass both block and idempotency_key to executeAction
      const executeOptions: { block?: boolean; idempotency_key?: string } = {};
      if (options?.block !== undefined) {
        executeOptions.block = options.block;
      }
      if (options?.idempotency_key) {
        executeOptions.idempotency_key = options.idempotency_key;
      }
      const response = await this.client.contracts.executeAction(
        this.instanceId,
        entrypoint,
        args ?? {},
        Object.keys(executeOptions).length > 0 ? executeOptions : undefined
      );
      
      return {
        new_state: response.new_state as GameActionResult<TState>['new_state'],
        events: response.events as GameActionResult<TState>['events'],
        version: response.version,
        error: response.error,
      };
    } catch (error: unknown) {
      const errorMessage = this.extractErrorMessage(error);
      return {
        error: errorMessage,
      };
    }
  }

  /**
   * Execute a game action, throwing on error.
   * 
   * @param entrypoint - The action entrypoint name
   * @param args - Action arguments
   * @param options - Optional action options (idempotency_key for HTTP-level idempotency)
   * @returns Action result
   * @throws Error with detailed message if action fails
   */
  async actionOrThrow<TArgs = unknown>(
    entrypoint: string,
    args?: TArgs,
    options?: { idempotency_key?: string; block?: boolean }
  ): Promise<GameActionResult<TState>> {
    const result = await this.action(entrypoint, args, options);
    
    if (result.error) {
      throw new Error(
        `Action '${entrypoint}' failed: ${result.error}\n` +
        `Instance: ${this.instanceId}, User: ${this.userId}`
      );
    }
    
    return result;
  }

  /**
   * Extract error message from various error formats.
   */
  protected extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    const err = error as Record<string, unknown>;
    if (err.response) {
      const response = err.response as Record<string, unknown>;
      const data = response.data as Record<string, unknown> | undefined;
      return (
        (data?.message as string) ||
        (data?.error as string) ||
        (data?.data as Record<string, unknown>)?.error as string ||
        'Unknown error'
      );
    }
    return String(error);
  }

  // ==========================================================================
  // Common Game Queries
  // ==========================================================================

  /**
   * Get game status.
   */
  async getStatus(): Promise<string | undefined> {
    const state = await this.getState();
    return state.status;
  }

  /**
   * Get game phase.
   */
  async getPhase(): Promise<string | undefined> {
    const state = await this.getState();
    return state.phase;
  }

  /**
   * Check if game is finished.
   */
  async isFinished(): Promise<boolean> {
    const state = await this.getState();
    return state.gameFinished === true || state.status === 'finished';
  }

  /**
   * Get winner (if game is finished).
   */
  async getWinner(): Promise<string | null> {
    const state = await this.getState();
    
    if (state.winner) {
      return state.winner;
    }
    
    // Check places for first place
    if (state.places && state.places.length > 0) {
      const firstPlace = state.places.find(p => p.place === 1);
      return firstPlace?.playerId ?? null;
    }
    
    return null;
  }

  /**
   * Get place rankings.
   */
  async getPlaces(): Promise<GamePlace[]> {
    const state = await this.getState();
    return state.places ?? [];
  }

  /**
   * Get players array.
   */
  async getPlayers(): Promise<string[]> {
    const state = await this.getState();
    
    if (!state.players) {
      return [];
    }
    
    // Handle array of strings
    if (state.players.length > 0 && typeof state.players[0] === 'string') {
      return state.players;
    }
    
    // Handle array of objects
    return state.players
      .map((p: unknown) => {
        if (typeof p === 'string') return p;
        const player = p as Record<string, unknown>;
        return (player.playerId || player.id || String(p)) as string;
      })
      .filter(Boolean);
  }

  /**
   * Check if it's the current user's turn (for turn-based games).
   */
  async isMyTurn(): Promise<boolean> {
    const state = await this.getState();
    if (state.currentPlayerIndex === undefined || !state.players) {
      return false;
    }
    return state.players[state.currentPlayerIndex] === this.userId;
  }

  // ==========================================================================
  // Accessors
  // ==========================================================================

  /**
   * Get the instance ID.
   */
  getInstanceId(): string {
    return this.instanceId;
  }

  /**
   * Get the user ID.
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Get the underlying ArcanaClient.
   */
  getClient(): ArcanaClient {
    return this.client;
  }

  // ==========================================================================
  // Static Factory
  // ==========================================================================

  /**
   * Create a new game instance.
   * 
   * @param client - The ArcanaClient instance
   * @param programType - The program type (e.g., 'battleship')
   * @param userId - The current user's ID
   * @param options - Creation options (args, instanceId)
   * @returns A new GameClient for the created instance
   */
  static async create<TState extends BaseGameState = BaseGameState>(
    client: ArcanaClient,
    programType: string,
    userId: string,
    options: CreateGameOptions = {}
  ): Promise<GameClient<TState>> {
    const instance = await client.contracts.create(
      programType,
      options.args,
      { instanceId: options.instanceId }
    );
    
    // Handle different response formats - instance has instance_id property
    const instanceId = (instance as unknown as { instance_id?: string; id?: string }).instance_id ||
                       (instance as unknown as { instance_id?: string; id?: string }).id ||
                       '';
    
    if (!instanceId) {
      throw new Error('Failed to create instance: no instance_id returned');
    }
    
    return new GameClient<TState>(client, instanceId, userId);
  }
}
