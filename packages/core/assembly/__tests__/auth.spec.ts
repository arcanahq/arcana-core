// @ts-nocheck
/**
 * Tests for player authorization helpers
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import { ContractContext } from "../core/context";
import {
  isPlayer,
  getPlayerIndex,
  isPlayerAtIndex,
  isCurrentPlayer,
  isNotCurrentPlayer,
  validatePlayer,
  validateCurrentPlayer,
  getPlayerId,
  isPlayerIdInGame,
  getOtherPlayers
} from "../game/auth";

describe("isPlayer", () => {
  test("should return true when caller is a player", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(isPlayer(context, playerIds)).toBe(true);
  });

  test("should return false when caller is not a player", () => {
    const context = new ContractContext("", "player3", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(isPlayer(context, playerIds)).toBe(false);
  });

  test("should handle empty players array", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds: string[] = [];
    
    expect(isPlayer(context, playerIds)).toBe(false);
  });

  test("should handle single player", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1"];
    
    expect(isPlayer(context, playerIds)).toBe(true);
  });
});

describe("getPlayerIndex", () => {
  test("should return correct index for player", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(getPlayerIndex(context, playerIds)).toBe(0);
  });

  test("should return correct index for second player", () => {
    const context = new ContractContext("", "player2", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(getPlayerIndex(context, playerIds)).toBe(1);
  });

  test("should return -1 when caller is not a player", () => {
    const context = new ContractContext("", "player3", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(getPlayerIndex(context, playerIds)).toBe(-1);
  });
});

describe("isPlayerAtIndex", () => {
  test("should return true when caller is at specified index", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(isPlayerAtIndex(context, playerIds, 0)).toBe(true);
  });

  test("should return false when caller is not at specified index", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(isPlayerAtIndex(context, playerIds, 1)).toBe(false);
  });

  test("should return false for invalid index", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(isPlayerAtIndex(context, playerIds, -1)).toBe(false);
    expect(isPlayerAtIndex(context, playerIds, 2)).toBe(false);
  });
});

describe("isCurrentPlayer", () => {
  test("should return true when caller is current player", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(isCurrentPlayer(context, playerIds, 0)).toBe(true);
  });

  test("should return false when caller is not current player", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(isCurrentPlayer(context, playerIds, 1)).toBe(false);
  });

  test("should return false for invalid current player index", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(isCurrentPlayer(context, playerIds, -1)).toBe(false);
    expect(isCurrentPlayer(context, playerIds, 2)).toBe(false);
  });
});

describe("isNotCurrentPlayer", () => {
  test("should return true when caller is not current player", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(isNotCurrentPlayer(context, playerIds, 1)).toBe(true);
  });

  test("should return false when caller is current player", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(isNotCurrentPlayer(context, playerIds, 0)).toBe(false);
  });
});

describe("validatePlayer", () => {
  test("should return true when caller is a player", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(validatePlayer(context, playerIds)).toBe(true);
  });

  test("should return false when caller is not a player", () => {
    const context = new ContractContext("", "player3", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(validatePlayer(context, playerIds)).toBe(false);
  });
});

describe("validateCurrentPlayer", () => {
  test("should return true when caller is current player", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(validateCurrentPlayer(context, playerIds, 0)).toBe(true);
  });

  test("should return false when caller is not current player", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2"];
    
    expect(validateCurrentPlayer(context, playerIds, 1)).toBe(false);
  });
});

describe("getPlayerId", () => {
  test("should return player ID at valid index", () => {
    const playerIds = ["player1", "player2"];
    
    expect(getPlayerId(playerIds, 0)).toBe("player1");
    expect(getPlayerId(playerIds, 1)).toBe("player2");
  });

  test("should return empty string for invalid index", () => {
    const playerIds = ["player1", "player2"];
    
    expect(getPlayerId(playerIds, -1)).toBe("");
    expect(getPlayerId(playerIds, 2)).toBe("");
  });
});

describe("isPlayerIdInGame", () => {
  test("should return true when player ID is in game", () => {
    const playerIds = ["player1", "player2"];
    
    expect(isPlayerIdInGame("player1", playerIds)).toBe(true);
    expect(isPlayerIdInGame("player2", playerIds)).toBe(true);
  });

  test("should return false when player ID is not in game", () => {
    const playerIds = ["player1", "player2"];
    
    expect(isPlayerIdInGame("player3", playerIds)).toBe(false);
    expect(isPlayerIdInGame("", playerIds)).toBe(false);
  });
});

describe("getOtherPlayers", () => {
  test("should return other players excluding caller", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2", "player3"];
    
    const others = getOtherPlayers(context, playerIds);
    
    expect(others.length).toBe(2);
    expect(others[0]).toBe("player2");
    expect(others[1]).toBe("player3");
  });

  test("should return empty array when caller is only player", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1"];
    
    const others = getOtherPlayers(context, playerIds);
    
    expect(others.length).toBe(0);
  });

  test("should return all players when caller is not in game", () => {
    const context = new ContractContext("", "player4", 0, "");
    const playerIds = ["player1", "player2"];
    
    const others = getOtherPlayers(context, playerIds);
    
    expect(others.length).toBe(2);
    expect(others[0]).toBe("player1");
    expect(others[1]).toBe("player2");
  });
});

describe("Authorization Integration", () => {
  test("should work together for turn validation", () => {
    const context = new ContractContext("", "player1", 0, "");
    const playerIds = ["player1", "player2"];
    const currentPlayerIndex = 0;
    
    // Check if player
    expect(isPlayer(context, playerIds)).toBe(true);
    expect(getPlayerIndex(context, playerIds)).toBe(0);
    
    // Check if current player
    expect(isCurrentPlayer(context, playerIds, currentPlayerIndex)).toBe(true);
    expect(validateCurrentPlayer(context, playerIds, currentPlayerIndex)).toBe(true);
    
    // Get current player ID
    expect(getPlayerId(playerIds, currentPlayerIndex)).toBe("player1");
  });

  test("should handle opponent validation", () => {
    const context = new ContractContext("", "player2", 0, "");
    const playerIds = ["player1", "player2"];
    const currentPlayerIndex = 0;
    
    // Player2 is a player but not current
    expect(isPlayer(context, playerIds)).toBe(true);
    expect(isCurrentPlayer(context, playerIds, currentPlayerIndex)).toBe(false);
    expect(isNotCurrentPlayer(context, playerIds, currentPlayerIndex)).toBe(true);
    
    // Get other players (should be player1)
    const others = getOtherPlayers(context, playerIds);
    expect(others.length).toBe(1);
    expect(others[0]).toBe("player1");
  });
});


