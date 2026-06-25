// @ts-nocheck
/**
 * Standard game interface definitions
 * 
 * Defines standard fields and actions that all tournament games should implement
 */

/**
 * Standard place/ranking structure for games with multiple places
 */
export class PlaceView {
  playerId: string = "";
  place: i32 = 0;  // 1 = first place, 2 = second place, etc.
  score: f64 = 0.0;  // Optional score/points for ranking
}

/**
 * Standard game interface requirements:
 * 
 * Required fields in game state:
 * - status: string (must use ContractStatus constants)
 * - gameFinished: bool
 * - winner: string (empty string if no winner/tie, or if game uses places)
 * - players: string[]
 * - places: PlaceView[] (optional, for games with multiple places)
 * 
 * Required actions:
 * - initialize: Set up game with players, wager, token
 * - start_game or start: Begin gameplay (transitions to "running")
 * - view: Get current game state
 * 
 * Standard status transitions:
 * - "pending" → "active" (when players join/initialize)
 * - "active" → "running" (when game starts)
 * - "running" → "finished" (when game completes)
 * - "finished" is terminal
 */
