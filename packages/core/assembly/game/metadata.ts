// @ts-nocheck
/**
 * Metadata Management for Game Contracts
 * 
 * Provides a builder-style API for managing game metadata easily.
 * Metadata is stored as a JSON string containing an object with string fields
 * and a "players" array.
 * 
 * Example usage:
 * ```typescript
 * // Create metadata from existing response
 * const metadata = MetadataBuilder.fromResponse(response)
 *   .addPlayer(playerId)
 *   .set("game_type", "battleship")
 *   .set("player_count", "2")
 *   .build();
 * response = response.withMetadata(metadata);
 * 
 * // Or create from scratch
 * const metadata = MetadataBuilder.create()
 *   .addPlayer(player1)
 *   .addPlayer(player2)
 *   .set("game_type", "pvp-coinflip")
 *   .build();
 * response = response.withMetadata(metadata);
 * 
 * // Or update existing metadata
 * const updatedMetadata = MetadataBuilder.from(response.metadataJson)
 *   .addPlayer(newPlayer)
 *   .set("table_status", "playing")
 *   .build();
 * response = response.withMetadata(updatedMetadata);
 * ```
 */

import { parseJSONToMap, unquoteJsonString } from "../primitives/utils";
import { escapeJsonString } from "../core/response";
import { ContractResponse } from "../core/response";

/**
 * MetadataBuilder - Builder class for managing metadata
 * 
 * Provides a fluent API for building and modifying metadata.
 * Internally separates string fields from the players array for simpler manipulation.
 */
export class MetadataBuilder {
  private fields: Map<string, string>;
  private players: string[];

  private constructor(metadataJson: string | null) {
    this.fields = new Map<string, string>();
    this.players = [];
    
    if (metadataJson !== null && metadataJson.length > 0) {
      this.parseMetadata(metadataJson);
    }
  }

  /**
   * Parse metadata JSON string into internal structure
   */
  private parseMetadata(metadataJson: string): void {
    const metadataMap = parseJSONToMap(metadataJson);
    if (metadataMap === null) {
      return;
    }

    // Extract all fields except "players"
    const keys = metadataMap.keys();
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key !== null && key !== "players") {
        const value = metadataMap.get(key);
        if (value !== null) {
          this.fields.set(key, value);
        }
      }
    }

    // Extract players array
    const playersValue = metadataMap.get("players");
    if (playersValue !== null && playersValue.length > 0) {
      this.players = parseStringArray(playersValue);
    }
  }

  /**
   * Create a new MetadataBuilder from scratch
   */
  static create(): MetadataBuilder {
    return new MetadataBuilder(null);
  }

  /**
   * Create a MetadataBuilder from existing metadata JSON string
   */
  static from(metadataJson: string | null): MetadataBuilder {
    return new MetadataBuilder(metadataJson);
  }

  /**
   * Create a MetadataBuilder from a ContractResponse's metadata
   */
  static fromResponse<TState>(response: ContractResponse<TState>): MetadataBuilder {
    return new MetadataBuilder(response.metadataJson);
  }

  /**
   * Get a field value from metadata
   */
  get(key: string): string | null {
    if (key === "players") {
      return null; // Use getPlayers() for players array
    }
    return this.fields.get(key);
  }

  /**
   * Set a field value in metadata
   */
  set(key: string, value: string): MetadataBuilder {
    if (key !== "players") {
      this.fields.set(key, value);
    }
    return this;
  }

  /**
   * Remove a field from metadata
   */
  remove(key: string): MetadataBuilder {
    if (key !== "players") {
      this.fields.delete(key);
    }
    return this;
  }

  /**
   * Get the players array from metadata
   */
  getPlayers(): string[] {
    return this.players;
  }

  /**
   * Add a player to the players array
   * If the player already exists, no change is made
   */
  addPlayer(playerId: string): MetadataBuilder {
    if (playerId.length === 0) {
      return this;
    }

    // Check if player already exists
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i] === playerId) {
        return this; // Already exists
      }
    }

    // Add player
    const updatedPlayers = new Array<string>(this.players.length + 1);
    for (let i = 0; i < this.players.length; i++) {
      updatedPlayers[i] = this.players[i];
    }
    updatedPlayers[this.players.length] = playerId;
    this.players = updatedPlayers;
    
    return this;
  }

  /**
   * Remove a player from the players array
   */
  removePlayer(playerId: string): MetadataBuilder {
    if (playerId.length === 0) {
      return this;
    }

    const updatedPlayers: string[] = [];
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i] !== playerId) {
        updatedPlayers.push(this.players[i]);
      }
    }
    this.players = updatedPlayers;
    
    return this;
  }

  /**
   * Set the entire players array
   */
  setPlayers(players: string[]): MetadataBuilder {
    this.players = players;
    return this;
  }

  /**
   * Build the metadata JSON string
   */
  build(): string {
    return this.toJSON();
  }

  /**
   * Alias for build() - returns JSON string
   */
  toJSON(): string {
    // Build JSON object manually
    let json = "{";
    let first = true;

    // Add all string fields
    const keys = this.fields.keys();
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key !== null && key.length > 0) {
        if (!first) {
          json += ",";
        }
        first = false;
        const value = this.fields.get(key);
        const valueStr = value !== null ? value : "";
        json += escapeJsonString(key) + ":" + escapeJsonString(valueStr);
      }
    }

    // Add players array using manual encoding
    if (!first) {
      json += ",";
    }
    json += '"players":' + encodeStringArray(this.players);
    
    json += "}";
    return json;
  }
}


/**
 * Get the players array from metadata JSON string
 * @param metadataJson - The metadata JSON string (can be null or empty)
 * @returns Array of player IDs, or empty array if not found
 */
export function getPlayersFromMetadata(metadataJson: string | null): string[] {
  if (metadataJson === null || metadataJson.length === 0) {
    return [];
  }
  
  
    const metadataMap = parseJSONToMap(metadataJson);
  if (metadataMap === null) {
    return [];
  }

    const playersStr = metadataMap.get("players");
    
    if (playersStr === null || playersStr.length === 0) {
      return [];
    }
    
    return parseStringArray(playersStr);
}

/**
 * Add a player to the metadata players array
 * If the player is already in the array, no change is made
 * @param metadataJson - The existing metadata JSON string (can be null or empty)
 * @param playerId - The player ID to add
 * @returns Updated metadata JSON string with the player added
 */
export function addPlayerToMetadata(metadataJson: string | null, playerId: string): string {
  const builder = MetadataBuilder.from(metadataJson);
  builder.addPlayer(playerId);
  return builder.build();
}

/**
 * Remove a player from the metadata players array
 * If the player is not in the array, no change is made
 * @param metadataJson - The existing metadata JSON string (can be null or empty)
 * @param playerId - The player ID to remove
 * @returns Updated metadata JSON string with the player removed
 */
export function removePlayerFromMetadata(metadataJson: string | null, playerId: string): string {
  const builder = MetadataBuilder.from(metadataJson);
  builder.removePlayer(playerId);
  return builder.build();
}

/**
 * Update metadata with a new players array
 * This replaces the entire players array in metadata
 * @param metadataJson - The existing metadata JSON string (can be null or empty)
 * @param players - The new array of player IDs
 * @returns Updated metadata JSON string with the new players array
 */
export function setPlayersInMetadata(metadataJson: string | null, players: string[]): string {
  const builder = MetadataBuilder.from(metadataJson);
  builder.setPlayers(players);
  return builder.build();
}

function parseStringArray(raw: string): string[] {
  let s = raw;
  if (s.length == 0) return new Array<string>(0);
  if (s.charAt(0) === '"') {
    s = unquoteJsonString(s);
  }
  if (s.length == 0 || s.charAt(0) !== '[') return new Array<string>(0);
  const out = new Array<string>(0);
  let i = 1;
  while (i < s.length) {
    const c = s.charAt(i);
    if (c === ']') break;
    if (c === '"' ) {
      i++;
      let buf = "";
      while (i < s.length) {
        const ch = s.charAt(i);
        if (ch === '\\' && i + 1 < s.length) {
          const next = s.charAt(i + 1);
          if (next === '"') { buf += '"'; i += 2; continue; }
          if (next === '\\') { buf += '\\'; i += 2; continue; }
          if (next === 'n') { buf += '\n'; i += 2; continue; }
          if (next === 'r') { buf += '\r'; i += 2; continue; }
          if (next === 't') { buf += '\t'; i += 2; continue; }
        }
        if (ch === '"') { i++; break; }
        buf += ch;
        i++;
      }
      out.push(buf);
    }
    while (i < s.length && s.charAt(i) !== ',' && s.charAt(i) !== ']') i++;
    if (i < s.length && s.charAt(i) === ',') i++;
  }
  return out;
}

function encodeStringArray(values: string[]): string {
  if (values.length == 0) return "[]";
  let out = "[";
  for (let i = 0; i < values.length; i++) {
    if (i > 0) out += ",";
    out += escapeJsonString(values[i]);
  }
  out += "]";
  return out;
}
