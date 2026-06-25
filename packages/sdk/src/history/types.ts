/**
 * History types
 * 
 * These types align with the game history API (capsule + envelope pattern).
 * See arcana/docs/GAME_HISTORY.md for full documentation.
 */

/**
 * A history item represents a user's participation in a game session.
 * Returned by history listing endpoints.
 */
export interface HistoryItem {
  /** Game session identifier */
  session_id: string;
  /** Scope the game belongs to */
  scope_id: string;
  /** Capsule ID for retrieving game data */
  capsule_id?: string;
  /** Root session ID (for multi-round games, same as session_id for single games) */
  root_id: string;
  /** Unix timestamp in milliseconds */
  ts: number;
  /** Result value (e.g., 1 for win, 0 for loss, -1 for null) */
  result_i64?: number;
  /** Optional metadata JSON for display (e.g., opponent, wager) */
  meta_json?: string;
}

/**
 * Paginated history response
 */
export interface HistoryPage {
  /** List of history items */
  items: HistoryItem[];
  /** Cursor for next page (base64 encoded) */
  next_cursor?: string;
}

/**
 * Options for listing history
 */
export interface HistoryListOptions {
  /** Maximum number of items to return (default: 50, max: 200) */
  limit?: number;
  /** Pagination cursor from previous response */
  cursor?: string;
}

/**
 * Summary of user's history for a scope
 */
export interface ScopeSummary {
  /** Scope identifier */
  scope_id: string;
  /** Number of sessions in this scope */
  n: number;
  /** Timestamp of last activity */
  last_ts: number;
}


/**
 * Capsule info for a session
 */
export interface CapsuleInfo {
  /** Unique capsule identifier */
  capsule_id: string;
  /** Session this capsule belongs to */
  session_id: string;
  /** Unix timestamp in milliseconds */
  ts: number;
  /** Size of uncompressed capsule data */
  capsule_len: number;
  /** Whether user has an envelope for this capsule */
  has_envelope: boolean;
}

/**
 * Rendered capsule with optional envelope data
 */
export interface RenderedCapsule {
  /** Capsule identifier */
  capsule_id: string;
  /** Unix timestamp in milliseconds */
  ts: number;
  /** Rendered view combining capsule and envelope data */
  view: any;
}

/**
 * Session view response with all capsules
 */
export interface SessionView {
  /** Session identifier */
  session_id: string;
  /** List of rendered capsules in chronological order */
  capsules: RenderedCapsule[];
}

