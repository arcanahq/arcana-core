// @ts-nocheck
/**
 * History Storage Utilities
 * 
 * Provides types and builders for persisting game history using the capsule + envelope pattern.
 * 
 * ## Architecture Overview
 * 
 * ```
 * User plays game → Contract emits HISTORY_PERSIST effect
 *                        ↓
 *         ┌──────────────┴──────────────┐
 *         ↓                              ↓
 *    Capsule (public)           Envelopes (private)
 *    - Move history             - Player's board
 *    - Final scores             - Hidden cards
 *    - Game result              - Secret state
 *         ↓                              ↓
 *    Compressed (zstd)          Encrypted (XChaCha20)
 *         ↓                              ↓
 *         └──────────────┬──────────────┘
 *                        ↓
 *                  Database tables:
 *                  - history_session (game session)
 *                  - capsule (compressed public data)
 *                  - history_envelope (encrypted private data)
 *                  - user_history (fast queryable index)
 * ```
 * 
 * ## Key Concepts
 * 
 * - **Session**: A game instance (session_id = your contract instance ID)
 * - **Capsule**: Public, compressed game state visible to all participants
 * - **Envelope**: Private, encrypted data specific to each user
 * - **History Row**: Fast queryable metadata for listing games (no blob reads)
 * 
 * ## Querying History
 * 
 * Users can view their history via these endpoints:
 * - `GET /history/contracts` - List games the user participated in
 * - `GET /history/contract/{contract_id}` - List sessions for a game type
 * - `GET /history/session/{session_id}/view` - View capsule + their envelope combined
 */

import { HistoryPersistEffect } from "./effects";
import { MessagePackEncoder } from "../primitives/msgpack";
import { MsgpackEncodable } from "./response";

/**
 * Per-user private data (will be encrypted)
 */
export class HistoryEnvelopeData implements MsgpackEncodable {
  user_id: string = "";
  plain_bytes: Uint8Array = new Uint8Array(0); // Raw bytes (will be encrypted)

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    // [user_id, plain_bytes]
    encoder.encodeArrayStart(2);
    encoder.encodeString(this.user_id);
    encoder.encodeBin(this.plain_bytes);
  }
}

/**
 * Queryable metadata for fast listing
 */
export class HistoryRowData implements MsgpackEncodable {
  user_id: string = "";
  result_i64: i64 = -1; // -1 means null (use for win/loss amount)
  meta_bytes: Uint8Array = new Uint8Array(0); // Raw bytes; empty = null (max 4KB)

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    // [user_id, result_i64, meta_bytes]
    encoder.encodeArrayStart(3);
    encoder.encodeString(this.user_id);
    encoder.encodeI64(this.result_i64);
    encoder.encodeBin(this.meta_bytes);
  }
}

/**
 * Core history data structure
 */
export class HistoryData implements MsgpackEncodable {
  object_id: string = "";    // Session ID (serialized as object_id for compatibility)
  root_id: string = "";      // Parent session for multi-round games
  parent_id: string = "";    // Empty = null
  capsule_id: string = "";   // MUST be unique per capsule
  capsule_bytes: Uint8Array = new Uint8Array(0); // Public game data
  envelopes: Array<HistoryEnvelopeData> = [];
  history_rows: Array<HistoryRowData> = [];
  ts_ms: i64 = 0;

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    // [object_id, root_id, parent_id, capsule_id, capsule_bytes, envelopes[], history_rows[], ts_ms]
    encoder.encodeArrayStart(8);
    encoder.encodeString(this.object_id);
    encoder.encodeString(this.root_id);
    encoder.encodeString(this.parent_id);
    encoder.encodeString(this.capsule_id);
    encoder.encodeBin(this.capsule_bytes);
    encoder.encodeArrayStart(this.envelopes.length);
    for (let i = 0; i < this.envelopes.length; i++) {
      this.envelopes[i].encodeToMsgpack(encoder);
    }
    encoder.encodeArrayStart(this.history_rows.length);
    for (let i = 0; i < this.history_rows.length; i++) {
      this.history_rows[i].encodeToMsgpack(encoder);
    }
    encoder.encodeI64(this.ts_ms);
  }
}

/**
 * Builder for constructing history data
 * 
 * ## Usage Example
 * 
 * ```typescript
 * // In your action handler (e.g., when game ends):
 * const builder = new HistoryDataBuilder();
 * 
 * // Generate unique capsule ID (IMPORTANT: must be unique per capsule)
 * const capsuleId = context.contractId + "-" + context.nowMs.toString();
 * 
 * builder
 *   .setSessionId(context.contractId)      // Game instance ID
 *   .setRootId(context.contractId)         // Session group (same as sessionId for single games)
 *   .setCapsuleId(capsuleId)               // UNIQUE per history entry
 *   .setCapsuleBytes(encodeMsgpackToBytes(publicData))
 *   .addEnvelope(player1Id, encodeMsgpackToBytes(player1Private))
 *   .addEnvelope(player2Id, encodeMsgpackToBytes(player2Private))
 *   .addHistoryRow(player1Id, player1Won ? 1 : 0, encodeMsgpackToBytes(player1Meta))
 *   .addHistoryRow(player2Id, player2Won ? 1 : 0, encodeMsgpackToBytes(player2Meta))
 *   .setTimestamp(context.nowMs);
 * 
 * // Add effect to response
 * const effect = createHistoryPersistEffect(builder, false);
 * response = response.effect(effect);
 * ```
 */
export class HistoryDataBuilder {
  private data: HistoryData;

  constructor() {
    this.data = new HistoryData();
  }

  /**
   * Set the session ID (game instance identifier)
   * Typically use context.contractId
   */
  setSessionId(sessionId: string): HistoryDataBuilder {
    this.data.object_id = sessionId;
    return this;
  }

  /**
   * Alias for setSessionId (legacy support)
   */
  setObjectId(objectId: string): HistoryDataBuilder {
    this.data.object_id = objectId;
    return this;
  }

  /**
   * Set the root ID (parent session for grouping)
   * For single games, use same as sessionId
   * For tournaments/matches, use the parent session ID
   */
  setRootId(rootId: string): HistoryDataBuilder {
    this.data.root_id = rootId;
    return this;
  }

  /**
   * Set parent ID (for hierarchical structures)
   * Pass null or empty string for no parent
   */
  setParentId(parentId: string | null): HistoryDataBuilder {
    this.data.parent_id = parentId !== null ? parentId : "";
    return this;
  }

  /**
   * Set the capsule ID - MUST BE UNIQUE per capsule
   * 
   * IMPORTANT: Each history entry needs a unique capsule_id.
   * Recommended: use contractId + "-" + timestamp
   * 
   * Example: context.contractId + "-" + context.nowMs.toString()
   */
  setCapsuleId(capsuleId: string): HistoryDataBuilder {
    this.data.capsule_id = capsuleId;
    return this;
  }

  /**
   * Set the capsule bytes (public game data)
   * 
   * This is the public data visible to all participants.
   * Use MessagePack bytes (caller-defined encoding).
   * 
   * Include: move history, final scores, game result, timestamps
   * Exclude: hidden board states, private cards, secrets
   */
  setCapsuleBytes(capsuleBytes: Uint8Array): HistoryDataBuilder {
    this.data.capsule_bytes = capsuleBytes;
    return this;
  }

  /**
   * Add a private envelope for a user
   * 
   * Envelopes are encrypted per-user. Only that user can decrypt.
   * 
   * @param userId - The user's ID (e.g., their wallet address)
   * @param plainBytes - Raw bytes (will be encrypted)
   */
  addEnvelope(userId: string, plainBytes: Uint8Array): HistoryDataBuilder {
    const envelope = new HistoryEnvelopeData();
    envelope.user_id = userId;
    envelope.plain_bytes = plainBytes;
    this.data.envelopes.push(envelope);
    return this;
  }

  /**
   * Add a history row for fast querying
   * 
   * These are indexed for fast listing without reading blob data.
   * 
   * @param userId - The user's ID
   * @param resultI64 - Win/loss amount or score (-1 for null)
   * @param metaBytes - Raw bytes (max 4KB, empty for null)
   */
  addHistoryRow(userId: string, resultI64: i64 = -1, metaBytes: Uint8Array = new Uint8Array(0)): HistoryDataBuilder {
    const row = new HistoryRowData();
    row.user_id = userId;
    row.result_i64 = resultI64;
    row.meta_bytes = metaBytes;
    this.data.history_rows.push(row);
    return this;
  }

  /**
   * Set the timestamp (unix milliseconds)
   * Typically use context.nowMs
   */
  setTimestamp(tsMs: i64): HistoryDataBuilder {
    this.data.ts_ms = tsMs;
    return this;
  }

  build(): HistoryData {
    return this.data;
  }
}

/**
 * Encode a MsgpackEncodable into a standalone byte array.
 * Copies the encoder buffer into a new Uint8Array.
 */
export function encodeMsgpackToBytes(value: MsgpackEncodable, initialCapacity: i32 = 1024): Uint8Array {
  const encoder = new MessagePackEncoder(initialCapacity);
  value.encodeToMsgpack(encoder);
  const len = encoder.getLength();
  const out = new Uint8Array(len);
  memory.copy(out.dataStart, encoder.getBufferPtr(), len);
  return out;
}

/**
 * Create a HISTORY_PERSIST effect from a builder
 * 
 * @param builder - HistoryDataBuilder with all data set
 * @param isRoot - true for root/session summary, false for instance replay
 * @returns Effect ready to add to ContractResponse
 */
export function createHistoryPersistEffect(
  builder: HistoryDataBuilder,
  isRoot: bool = false
): HistoryPersistEffect {
  return new HistoryPersistEffect(builder.build(), isRoot);
}
