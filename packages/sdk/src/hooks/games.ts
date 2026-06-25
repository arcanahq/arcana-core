/**
 * React hooks for game interactions.
 * 
 * Uses TanStack Query for state management and caching.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import type { GameClient, GameActionResult, BaseGameState } from '../games/index.js';

/**
 * Create game hooks for a specific GameClient instance.
 * 
 * @example
 * ```tsx
 * function BattleshipGame({ gameClient }: { gameClient: BattleshipClient }) {
 *   const hooks = createGameHooks(gameClient);
 *   const { data: state, isLoading } = hooks.useGameState();
 *   const action = hooks.useGameAction();
 *   
 *   const handleFire = (row: number, col: number) => {
 *     action.mutate({ entrypoint: 'fire_shot', args: { row, col } });
 *   };
 *   
 *   if (isLoading) return <div>Loading...</div>;
 *   
 *   return <GameBoard state={state} onCellClick={handleFire} />;
 * }
 * ```
 */
export function createGameHooks<TState extends BaseGameState = BaseGameState>(
  game: GameClient<TState>
) {
  const instanceId = game.getInstanceId();

  return {
    /**
     * Get the current game state (personalized view).
     */
    useGameState: (
      options?: Omit<UseQueryOptions<TState, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['game', instanceId, 'state'],
        queryFn: () => game.getState(),
        ...options,
      });
    },

    /**
     * Get the raw game state (for debugging).
     */
    useRawGameState: (
      options?: Omit<UseQueryOptions<TState, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['game', instanceId, 'rawState'],
        queryFn: () => game.getRawState(),
        ...options,
      });
    },

    /**
     * Check if it's the current user's turn.
     */
    useIsMyTurn: (
      options?: Omit<UseQueryOptions<boolean, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['game', instanceId, 'isMyTurn'],
        queryFn: () => game.isMyTurn(),
        ...options,
      });
    },

    /**
     * Check if the game is finished.
     */
    useIsFinished: (
      options?: Omit<UseQueryOptions<boolean, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['game', instanceId, 'isFinished'],
        queryFn: () => game.isFinished(),
        ...options,
      });
    },

    /**
     * Get the game winner.
     */
    useWinner: (
      options?: Omit<UseQueryOptions<string | null, Error>, 'queryKey' | 'queryFn'>
    ) => {
      return useQuery({
        queryKey: ['game', instanceId, 'winner'],
        queryFn: () => game.getWinner(),
        ...options,
      });
    },

    /**
     * Execute a game action.
     * 
     * @example
     * ```tsx
     * const action = hooks.useGameAction();
     * 
     * // Fire a shot
     * action.mutate({ entrypoint: 'fire_shot', args: { row: 0, col: 5 } });
     * 
     * // With callbacks
     * action.mutate(
     *   { entrypoint: 'fire_shot', args: { row: 0, col: 5 } },
     *   {
     *     onSuccess: (result) => console.log('Hit!', result),
     *     onError: (error) => console.error('Miss!', error),
     *   }
     * );
     * ```
     */
    useGameAction: (
      options?: Omit<UseMutationOptions<
        GameActionResult<TState>,
        Error,
        { entrypoint: string; args?: unknown }
      >, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: async ({ entrypoint, args }) => {
          return game.action(entrypoint, args);
        },
        onSuccess: () => {
          // Invalidate all game queries
          queryClient.invalidateQueries({ queryKey: ['game', instanceId] });
        },
        ...options,
      });
    },

    /**
     * Execute a game action, throwing on error.
     */
    useGameActionOrThrow: (
      options?: Omit<UseMutationOptions<
        GameActionResult<TState>,
        Error,
        { entrypoint: string; args?: unknown }
      >, 'mutationFn'>
    ) => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: async ({ entrypoint, args }) => {
          return game.actionOrThrow(entrypoint, args);
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['game', instanceId] });
        },
        ...options,
      });
    },

    /**
     * Invalidate all game queries (force refetch).
     */
    invalidateGameQueries: () => {
      const queryClient = useQueryClient();
      return () => queryClient.invalidateQueries({ queryKey: ['game', instanceId] });
    },
  };
}

/**
 * Type for the game hooks object.
 */
export type GameHooks<TState extends BaseGameState = BaseGameState> = ReturnType<typeof createGameHooks<TState>>;

