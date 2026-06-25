// @ts-nocheck
/**
 * Tests for state validation helpers
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import { GameState, ContractStatus } from "../core/state";
import {
  ValidationResult,
  validateGameStatus,
  validateGameNotFinished,
  validateGameActive,
  validateGamePending,
  validateWager,
  validateWagerPositive,
  validatePlayers,
  validateMinPlayers,
  validatePlayerIdsNotEmpty,
  validatePlayerIdsUnique,
  validateToken,
  validateRange,
  validateMin,
  validateMax
} from "../game/validation";

describe("ValidationResult", () => {
  test("valid should create valid result", () => {
    const result = ValidationResult.valid();
    
    expect(result.isValid).toBe(true);
    expect(result.errorMessage).toBe("");
  });

  test("invalid should create invalid result with message", () => {
    const result = ValidationResult.invalid("Test error");
    
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBe("Test error");
  });
});

describe("validateGameStatus", () => {
  test("should return valid when status matches", () => {
    const state = new GameState("", 0, 0, ContractStatus.ACTIVE, "TESTING", 0, "", "", 0, "", null);
    
    const result = validateGameStatus(state, ContractStatus.ACTIVE);
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid when status does not match", () => {
    const state = new GameState("", 0, 0, ContractStatus.PENDING, "TESTING", 0, "", "", 0, "", null);
    
    const result = validateGameStatus(state, ContractStatus.ACTIVE);
    
    expect(result.isValid).toBe(false);
    expect(result.errorMessage.length > 0).toBe(true);
  });
});

describe("validateGameNotFinished", () => {
  test("should return valid when game is not finished", () => {
    const state = new GameState("", 0, 0, ContractStatus.ACTIVE, "TESTING", 0, "", "", 0, "", null);
    
    const result = validateGameNotFinished(state);
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid when game is finished", () => {
    const state = new GameState("", 0, 0, ContractStatus.FINISHED, "TESTING", 0, "", "", 0, "", null);
    
    const result = validateGameNotFinished(state);
    
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBe("Game has already finished");
  });
});

describe("validateGameActive", () => {
  test("should return valid when game is active", () => {
    const state = new GameState("", 0, 0, ContractStatus.ACTIVE, "TESTING", 0, "", "", 0, "", null);
    
    const result = validateGameActive(state);
    
    expect(result.isValid).toBe(true);
  });

  test("should return valid when game is running", () => {
    const state = new GameState("", 0, 0, ContractStatus.RUNNING, "TESTING", 0, "", "", 0, "", null);
    
    const result = validateGameActive(state);
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid when game is pending", () => {
    const state = new GameState("", 0, 0, ContractStatus.PENDING, "TESTING", 0, "", "", 0, "", null);
    
    const result = validateGameActive(state);
    
    expect(result.isValid).toBe(false);
  });

  test("should return invalid when game is finished", () => {
    const state = new GameState("", 0, 0, ContractStatus.FINISHED, "TESTING", 0, "", "", 0, "", null);
    
    const result = validateGameActive(state);
    
    expect(result.isValid).toBe(false);
  });
});

describe("validateGamePending", () => {
  test("should return valid when game is pending", () => {
    const state = new GameState("", 0, 0, ContractStatus.PENDING, "TESTING", 0, "", "", 0, "", null);
    
    const result = validateGamePending(state);
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid when game is not pending", () => {
    const state = new GameState("", 0, 0, ContractStatus.ACTIVE, "TESTING", 0, "", "", 0, "", null);
    
    const result = validateGamePending(state);
    
    expect(result.isValid).toBe(false);
  });
});

describe("validateWager", () => {
  test("should return valid when wager is in range", () => {
    const result = validateWager(100, 10, 1000);
    
    expect(result.isValid).toBe(true);
  });

  test("should return valid when wager equals min", () => {
    const result = validateWager(10, 10, 1000);
    
    expect(result.isValid).toBe(true);
  });

  test("should return valid when wager equals max", () => {
    const result = validateWager(1000, 10, 1000);
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid when wager is below min", () => {
    const result = validateWager(5, 10, 1000);
    
    expect(result.isValid).toBe(false);
    expect(result.errorMessage.length > 0).toBe(true);
  });

  test("should return invalid when wager is above max", () => {
    const result = validateWager(2000, 10, 1000);
    
    expect(result.isValid).toBe(false);
    expect(result.errorMessage.length > 0).toBe(true);
  });

  test("should handle no max wager (0 means no max)", () => {
    const result = validateWager(1000000, 10, 0);
    
    expect(result.isValid).toBe(true);
  });
});

describe("validateWagerPositive", () => {
  test("should return valid for positive wager", () => {
    const result = validateWagerPositive(100);
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid for zero wager", () => {
    const result = validateWagerPositive(0);
    
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBe("Wager must be greater than 0");
  });

  test("should return invalid for negative wager", () => {
    const result = validateWagerPositive(-10);
    
    expect(result.isValid).toBe(false);
  });
});

describe("validatePlayers", () => {
  test("should return valid when player count matches", () => {
    const players = ["player1", "player2"];
    
    const result = validatePlayers(players, 2);
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid when player count does not match", () => {
    const players = ["player1", "player2"];
    
    const result = validatePlayers(players, 3);
    
    expect(result.isValid).toBe(false);
    expect(result.errorMessage.length > 0).toBe(true);
  });

  test("should return invalid when players is null", () => {
    const result = validatePlayers(null, 2);
    
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBe("Players array is null");
  });
});

describe("validateMinPlayers", () => {
  test("should return valid when player count meets minimum", () => {
    const players = ["player1", "player2", "player3"];
    
    const result = validateMinPlayers(players, 2);
    
    expect(result.isValid).toBe(true);
  });

  test("should return valid when player count equals minimum", () => {
    const players = ["player1", "player2"];
    
    const result = validateMinPlayers(players, 2);
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid when player count is below minimum", () => {
    const players = ["player1"];
    
    const result = validateMinPlayers(players, 2);
    
    expect(result.isValid).toBe(false);
  });

  test("should return invalid when players is null", () => {
    const result = validateMinPlayers(null, 2);
    
    expect(result.isValid).toBe(false);
  });
});

describe("validatePlayerIdsNotEmpty", () => {
  test("should return valid when all player IDs are non-empty", () => {
    const players = ["player1", "player2"];
    
    const result = validatePlayerIdsNotEmpty(players);
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid when a player ID is empty", () => {
    const players = ["player1", ""];
    
    const result = validatePlayerIdsNotEmpty(players);
    
    expect(result.isValid).toBe(false);
    expect(result.errorMessage.length > 0).toBe(true);
  });

  test("should return invalid when players is null", () => {
    const result = validatePlayerIdsNotEmpty(null);
    
    expect(result.isValid).toBe(false);
  });
});

describe("validatePlayerIdsUnique", () => {
  test("should return valid when all player IDs are unique", () => {
    const players = ["player1", "player2", "player3"];
    
    const result = validatePlayerIdsUnique(players);
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid when there are duplicate player IDs", () => {
    const players = ["player1", "player2", "player1"];
    
    const result = validatePlayerIdsUnique(players);
    
    expect(result.isValid).toBe(false);
    expect(result.errorMessage.length > 0).toBe(true);
  });

  test("should return invalid when players is null", () => {
    const result = validatePlayerIdsUnique(null);
    
    expect(result.isValid).toBe(false);
  });
});

describe("validateToken", () => {
  test("should return valid for non-empty token", () => {
    const result = validateToken("USDC");
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid for empty token", () => {
    const result = validateToken("");
    
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBe("Token symbol is required");
  });
});

describe("validateRange", () => {
  test("should return valid when value is in range", () => {
    const result = validateRange(5, 0, 10);
    
    expect(result.isValid).toBe(true);
  });

  test("should return valid when value equals min", () => {
    const result = validateRange(0, 0, 10);
    
    expect(result.isValid).toBe(true);
  });

  test("should return valid when value equals max", () => {
    const result = validateRange(10, 0, 10);
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid when value is below min", () => {
    const result = validateRange(-1, 0, 10);
    
    expect(result.isValid).toBe(false);
  });

  test("should return invalid when value is above max", () => {
    const result = validateRange(11, 0, 10);
    
    expect(result.isValid).toBe(false);
  });
});

describe("validateMin", () => {
  test("should return valid when value meets minimum", () => {
    const result = validateMin(10, 5);
    
    expect(result.isValid).toBe(true);
  });

  test("should return valid when value equals minimum", () => {
    const result = validateMin(5, 5);
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid when value is below minimum", () => {
    const result = validateMin(3, 5);
    
    expect(result.isValid).toBe(false);
  });
});

describe("validateMax", () => {
  test("should return valid when value meets maximum", () => {
    const result = validateMax(5, 10);
    
    expect(result.isValid).toBe(true);
  });

  test("should return valid when value equals maximum", () => {
    const result = validateMax(10, 10);
    
    expect(result.isValid).toBe(true);
  });

  test("should return invalid when value is above maximum", () => {
    const result = validateMax(11, 10);
    
    expect(result.isValid).toBe(false);
  });
});

describe("Validation Integration", () => {
  test("should chain validations", () => {
    const state = new GameState("", 0, 0, ContractStatus.ACTIVE, "TESTING", 0, "", "", 0, "", null);
    const players = ["player1", "player2"];
    
    const statusResult = validateGameActive(state);
    const playersResult = validatePlayers(players, 2);
    const wagerResult = validateWagerPositive(100);
    
    expect(statusResult.isValid).toBe(true);
    expect(playersResult.isValid).toBe(true);
    expect(wagerResult.isValid).toBe(true);
  });

  test("should identify first failing validation", () => {
    const state = new GameState("", 0, 0, ContractStatus.FINISHED, "TESTING", 0, "", "", 0, "", null);
    const players = ["player1"];
    
    const statusResult = validateGameActive(state);
    const playersResult = validatePlayers(players, 2);
    
    expect(statusResult.isValid).toBe(false);
    expect(playersResult.isValid).toBe(false);
  });
});


