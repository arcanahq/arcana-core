/**
 * useGame - React hook for game clients.
 * 
 * Provides an easy way to use a GameClient with TanStack Query hooks.
 */

import { useMemo } from 'react';
import { useArcana } from './context.js';
import { GameClient, BaseGameState } from '../games/index.js';
import { createGameHooks, type GameHooks } from '../hooks/games.js';

export interface UseGameOptions {
  /** Whether to enable automatic polling (default: false) */
  poll?: boolean;
  /** Polling interval in milliseconds (default: 2000) */
  pollInterval?: number;
}

export interface UseGameResult<TState extends BaseGameState = BaseGameState> {
  /** The game client instance */
  game: GameClient<TState>;
  /** TanStack Query hooks for the game */
  hooks: GameHooks<TState>;
}

/**
 * Create a game client and hooks for a given instance.
 * 
 * @param instanceId - The game instance ID
 * @param options - Optional configuration
 * 
 * @example
 * ```tsx
 * function BattleshipPage({ gameId }: { gameId: string }) {
 *   const { userId } = useArcana();
 *   const { game, hooks } = useGame<BattleshipState>(gameId);
 *   
 *   const { data: state, isLoading } = hooks.useGameState();
 *   const action = hooks.useGameAction();
 *   
 *   const handleFire = async (row: number, col: number) => {
 *     await action.mutateAsync({ entrypoint: 'fire_shot', args: { row, col } });
 *   };
 *   
 *   if (isLoading) return <div>Loading...</div>;
 *   
 *   return <GameBoard state={state} onFire={handleFire} />;
 * }
 * ```
 */
export function useGame<TState extends BaseGameState = BaseGameState>(
  instanceId: string,
  _options?: UseGameOptions
): UseGameResult<TState> {
  const { client, userId } = useArcana();

  const game = useMemo(
    () => new GameClient<TState>(client, instanceId, userId || ''),
    [client, instanceId, userId]
  );

  const hooks = useMemo(
    () => createGameHooks<TState>(game),
    [game]
  );

  return { game, hooks };
}

/**
 * Create a custom game client class and return hooks for it.
 * 
 * @param GameClass - The game client class constructor
 * @param instanceId - The game instance ID
 * 
 * @example
 * ```tsx
 * class BattleshipGame extends GameClient<BattleshipState> {
 *   async placeShip(ship: ShipPlacement) {
 *     return this.actionOrThrow('place_ship', ship);
 *   }
 *   
 *   async fireShot(row: number, col: number) {
 *     return this.actionOrThrow('fire_shot', { row, col });
 *   }
 * }
 * 
 * function BattleshipPage({ gameId }: { gameId: string }) {
 *   const { game, hooks } = useCustomGame(BattleshipGame, gameId);
 *   
 *   // game has placeShip() and fireShot() methods
 *   const handleFire = async (row: number, col: number) => {
 *     await game.fireShot(row, col);
 *   };
 * }
 * ```
 */
export function useCustomGame<
  TGame extends GameClient<TState>,
  TState extends BaseGameState = BaseGameState
>(
  GameClass: new (client: any, instanceId: string, userId: string) => TGame,
  instanceId: string
): { game: TGame; hooks: GameHooks<TState> } {
  const { client, userId } = useArcana();

  const game = useMemo(
    () => new GameClass(client, instanceId, userId || ''),
    [GameClass, client, instanceId, userId]
  );

  const hooks = useMemo(
    () => createGameHooks<TState>(game),
    [game]
  );

  return { game, hooks };
}

