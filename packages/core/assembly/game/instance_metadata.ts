// @ts-nocheck
/**
 * Structured Instance Metadata for Contracts
 * 
 * Provides a type-safe, structured way to manage instance metadata.
 * All contracts should use InstanceMetadata instead of manually building JSON strings or Map<string, string>.
 */

import { MessagePackEncoder } from "../primitives/msgpack";
import { MsgpackEncodable } from "../core/response";

/**
 * Structured instance metadata class
 * All fields are optional to allow contracts to set only what they need
 */
export class InstanceMetadata implements MsgpackEncodable {
  // Core fields - always set these
  participants: string[] = []; // List of user IDs with visibility/access to this instance
  
  // Identity fields
  created_by: string | null = null; // User ID who created the instance
  
  // Game/instance type fields
  game_type: string | null = null; // Type of game/instance (e.g., "battleship", "blackjack", "roshambo")
  table_mode: string | null = null; // Mode (e.g., "tournament", "cash")
  
  // Status fields
  game_status: string | null = null; // Game status (e.g., "betting", "playing", "finished")
  table_status: string | null = null; // Table status (e.g., "waiting", "setup", "playing", "finished")
  
  // Player/participant count
  player_count: string | null = null; // Number of players (as string for consistency)
  min_players: string | null = null; // Minimum players required
  max_players: string | null = null; // Maximum players allowed
  
  // Financial fields
  token: string | null = null; // Asset ID for wagering
  entry_fee: string | null = null; // Entry fee/wager amount (as string for U256)
  
  // Privacy/access fields
  is_private: bool = true; // Whether instance requires invite code
  invite_code: string = ""; // Invite code for private instances

  encodeToMsgpack(encoder: MessagePackEncoder): void {
    // Map struct with only provided fields to preserve merge semantics.
    const hasParticipants = this.participants.length > 0;
    const hasCreatedBy = this.created_by !== null;
    const hasGameType = this.game_type !== null;
    const hasTableMode = this.table_mode !== null;
    const hasGameStatus = this.game_status !== null;
    const hasTableStatus = this.table_status !== null;
    const hasPlayerCount = this.player_count !== null;
    const hasMinPlayers = this.min_players !== null;
    const hasMaxPlayers = this.max_players !== null;
    const hasToken = this.token !== null;
    const hasEntryFee = this.entry_fee !== null;
    const hasInviteCode = this.invite_code.length > 0;
    const hasIsPrivate = hasInviteCode || this.is_private === false;

    let count = 0;
    if (hasParticipants) count++;
    if (hasCreatedBy) count++;
    if (hasGameType) count++;
    if (hasTableMode) count++;
    if (hasGameStatus) count++;
    if (hasTableStatus) count++;
    if (hasPlayerCount) count++;
    if (hasMinPlayers) count++;
    if (hasMaxPlayers) count++;
    if (hasToken) count++;
    if (hasEntryFee) count++;
    if (hasIsPrivate) count++;
    if (hasInviteCode) count++;

    encoder.encodeMapStart(count);

    if (hasParticipants) {
      encoder.encodeString("participants");
      encoder.encodeArrayStart(this.participants.length);
      for (let i = 0; i < this.participants.length; i++) {
        encoder.encodeString(this.participants[i]);
      }
    }
    if (hasCreatedBy) {
      encoder.encodeString("created_by");
      encoder.encodeString(this.created_by as string);
    }
    if (hasGameType) {
      encoder.encodeString("game_type");
      encoder.encodeString(this.game_type as string);
    }
    if (hasTableMode) {
      encoder.encodeString("table_mode");
      encoder.encodeString(this.table_mode as string);
    }
    if (hasGameStatus) {
      encoder.encodeString("game_status");
      encoder.encodeString(this.game_status as string);
    }
    if (hasTableStatus) {
      encoder.encodeString("table_status");
      encoder.encodeString(this.table_status as string);
    }
    if (hasPlayerCount) {
      encoder.encodeString("player_count");
      encoder.encodeString(this.player_count as string);
    }
    if (hasMinPlayers) {
      encoder.encodeString("min_players");
      encoder.encodeString(this.min_players as string);
    }
    if (hasMaxPlayers) {
      encoder.encodeString("max_players");
      encoder.encodeString(this.max_players as string);
    }
    if (hasToken) {
      encoder.encodeString("token");
      encoder.encodeString(this.token as string);
    }
    if (hasEntryFee) {
      encoder.encodeString("entry_fee");
      encoder.encodeString(this.entry_fee as string);
    }
    if (hasIsPrivate) {
      encoder.encodeString("is_private");
      encoder.encodeBool(this.is_private);
    }
    if (hasInviteCode) {
      encoder.encodeString("invite_code");
      encoder.encodeString(this.invite_code);
    }
  }
  
  /**
   * Add a participant to the participants array
   * If the participant already exists, no change is made
   */
  addParticipant(participantId: string): void {
    if (participantId.length === 0) {
      return;
    }
    
    // Check if participant already exists
    for (let i = 0; i < this.participants.length; i++) {
      if (this.participants[i] === participantId) {
        return; // Already exists
      }
    }
    
    // Add participant
    const updated = new Array<string>(this.participants.length + 1);
    for (let i = 0; i < this.participants.length; i++) {
      updated[i] = this.participants[i];
    }
    updated[this.participants.length] = participantId;
    this.participants = updated;
  }
  
  /**
   * Remove a participant from the participants array
   */
  removeParticipant(participantId: string): void {
    if (participantId.length === 0) {
      return;
    }
    
    const updated: string[] = [];
    for (let i = 0; i < this.participants.length; i++) {
      if (this.participants[i] !== participantId) {
        updated.push(this.participants[i]);
      }
    }
    this.participants = updated;
  }
  
  /**
   * Set the entire participants array
   */
  setParticipants(participants: string[]): void {
    this.participants = participants;
  }
}
