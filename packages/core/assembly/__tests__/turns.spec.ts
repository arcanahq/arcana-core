// @ts-nocheck
/**
 * Tests for turn management utilities
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import {
  nextPlayer,
  previousPlayer,
  rotatePlayers,
  isValidPlayerIndex,
  TurnManager,
  createTurnManager
} from "../game/turns";

describe("nextPlayer", () => {
  test("should advance to next player", () => {
    expect(nextPlayer(0, 2)).equal(1);
    expect(nextPlayer(1, 2)).equal(0); // Wraps around
  });

  test("should wrap around after last player", () => {
    expect(nextPlayer(2, 3)).equal(0);
    expect(nextPlayer(1, 2)).equal(0);
  });

  test("should handle single player", () => {
    expect(nextPlayer(0, 1)).equal(0);
  });

  test("should return 0 for invalid total players", () => {
    expect(nextPlayer(0, 0)).equal(0);
    expect(nextPlayer(5, -1)).equal(0);
  });
});

describe("previousPlayer", () => {
  test("should go back to previous player", () => {
    expect(previousPlayer(1, 2)).equal(0);
    expect(previousPlayer(2, 3)).equal(1);
  });

  test("should wrap around from first to last", () => {
    expect(previousPlayer(0, 2)).equal(1);
    expect(previousPlayer(0, 3)).equal(2);
  });

  test("should handle single player", () => {
    expect(previousPlayer(0, 1)).equal(0);
  });

  test("should return 0 for invalid total players", () => {
    expect(previousPlayer(0, 0)).equal(0);
  });
});

describe("rotatePlayers", () => {
  test("should rotate players starting from index", () => {
    const players = ["player1", "player2", "player3"];
    const rotated = rotatePlayers(players, 1);
    
    expect(rotated.length).equal(3);
    expect(rotated[0]).equal("player2");
    expect(rotated[1]).equal("player3");
    expect(rotated[2]).equal("player1");
  });

  test("should return original order when starting from 0", () => {
    const players = ["player1", "player2", "player3"];
    const rotated = rotatePlayers(players, 0);
    
    expect(rotated.length).equal(3);
    expect(rotated[0]).equal("player1");
    expect(rotated[1]).equal("player2");
    expect(rotated[2]).equal("player3");
  });

  test("should handle empty array", () => {
    const players: string[] = [];
    const rotated = rotatePlayers(players, 0);
    
    expect(rotated.length).equal(0);
  });

  test("should handle invalid start index", () => {
    const players = ["player1", "player2"];
    const rotated1 = rotatePlayers(players, -1);
    const rotated2 = rotatePlayers(players, 2);
    
    // Should return copy of original
    expect(rotated1.length).equal(2);
    expect(rotated2.length).equal(2);
  });

  test("should not modify original array", () => {
    const players = ["player1", "player2", "player3"];
    const rotated = rotatePlayers(players, 1);
    
    // Original should be unchanged
    expect(players[0]).equal("player1");
    expect(players[1]).equal("player2");
    expect(players[2]).equal("player3");
  });
});

describe("isValidPlayerIndex", () => {
  test("should return true for valid indices", () => {
    expect(isValidPlayerIndex(0, 2)).equal(true);
    expect(isValidPlayerIndex(1, 2)).equal(true);
  });

  test("should return false for negative index", () => {
    expect(isValidPlayerIndex(-1, 2)).equal(false);
  });

  test("should return false for index >= total players", () => {
    expect(isValidPlayerIndex(2, 2)).equal(false);
    expect(isValidPlayerIndex(5, 2)).equal(false);
  });
});

describe("TurnManager", () => {
  test("should create manager with players and current index", () => {
    const players = ["player1", "player2", "player3"];
    const manager = new TurnManager(players, 1);
    
    expect(manager.getCurrentPlayer()).equal("player2");
    expect(manager.getCurrentIndex()).equal(1);
    expect(manager.getPlayerCount()).equal(3);
  });

  test("should default to index 0", () => {
    const players = ["player1", "player2"];
    const manager = new TurnManager(players);
    
    expect(manager.getCurrentIndex()).equal(0);
    expect(manager.getCurrentPlayer()).equal("player1");
  });

  test("should handle invalid initial index", () => {
    const players = ["player1", "player2"];
    const manager1 = new TurnManager(players, -1);
    const manager2 = new TurnManager(players, 5);
    
    expect(manager1.getCurrentIndex()).equal(0);
    expect(manager2.getCurrentIndex()).equal(0);
  });

  test("advanceTurn should move to next player", () => {
    const players = ["player1", "player2", "player3"];
    const manager = new TurnManager(players, 0);
    
    expect(manager.advanceTurn()).equal("player2");
    expect(manager.getCurrentIndex()).equal(1);
    expect(manager.getCurrentPlayer()).equal("player2");
  });

  test("advanceTurn should wrap around", () => {
    const players = ["player1", "player2"];
    const manager = new TurnManager(players, 1);
    
    expect(manager.advanceTurn()).equal("player1");
    expect(manager.getCurrentIndex()).equal(0);
  });

  test("previousTurn should go back to previous player", () => {
    const players = ["player1", "player2", "player3"];
    const manager = new TurnManager(players, 1);
    
    expect(manager.previousTurn()).equal("player1");
    expect(manager.getCurrentIndex()).equal(0);
  });

  test("previousTurn should wrap around", () => {
    const players = ["player1", "player2"];
    const manager = new TurnManager(players, 0);
    
    expect(manager.previousTurn()).equal("player2");
    expect(manager.getCurrentIndex()).equal(1);
  });

  test("setCurrentPlayer should set by index", () => {
    const players = ["player1", "player2", "player3"];
    const manager = new TurnManager(players, 0);
    
    expect(manager.setCurrentPlayer(2)).equal(true);
    expect(manager.getCurrentIndex()).equal(2);
    expect(manager.getCurrentPlayer()).equal("player3");
  });

  test("setCurrentPlayer should return false for invalid index", () => {
    const players = ["player1", "player2"];
    const manager = new TurnManager(players, 0);
    
    expect(manager.setCurrentPlayer(-1)).equal(false);
    expect(manager.setCurrentPlayer(2)).equal(false);
    expect(manager.getCurrentIndex()).equal(0); // Unchanged
  });

  test("setCurrentPlayerById should set by player ID", () => {
    const players = ["player1", "player2", "player3"];
    const manager = new TurnManager(players, 0);
    
    expect(manager.setCurrentPlayerById("player3")).equal(true);
    expect(manager.getCurrentIndex()).equal(2);
    expect(manager.getCurrentPlayer()).equal("player3");
  });

  test("setCurrentPlayerById should return false for invalid ID", () => {
    const players = ["player1", "player2"];
    const manager = new TurnManager(players, 0);
    
    expect(manager.setCurrentPlayerById("player3")).equal(false);
    expect(manager.getCurrentIndex()).equal(0); // Unchanged
  });

  test("peekNextPlayer should return next without advancing", () => {
    const players = ["player1", "player2", "player3"];
    const manager = new TurnManager(players, 0);
    
    expect(manager.peekNextPlayer()).equal("player2");
    expect(manager.getCurrentIndex()).equal(0); // Unchanged
    expect(manager.getCurrentPlayer()).equal("player1");
  });

  test("peekPreviousPlayer should return previous without going back", () => {
    const players = ["player1", "player2", "player3"];
    const manager = new TurnManager(players, 1);
    
    expect(manager.peekPreviousPlayer()).equal("player1");
    expect(manager.getCurrentIndex()).equal(1); // Unchanged
    expect(manager.getCurrentPlayer()).equal("player2");
  });

  test("isValid should return true when has players", () => {
    const players = ["player1", "player2"];
    const manager = new TurnManager(players);
    
    expect(manager.isValid()).equal(true);
  });

  test("isValid should return false when no players", () => {
    const players: string[] = [];
    const manager = new TurnManager(players);
    
    expect(manager.isValid()).equal(false);
  });

  test("clone should create independent copy", () => {
    const players = ["player1", "player2"];
    const manager1 = new TurnManager(players, 0);
    const manager2 = manager1.clone();
    
    expect(manager2.getCurrentIndex()).equal(0);
    
    manager1.advanceTurn();
    expect(manager1.getCurrentIndex()).equal(1);
    expect(manager2.getCurrentIndex()).equal(0); // Unchanged
  });

  test("should not modify original players array", () => {
    const players = ["player1", "player2"];
    const manager = new TurnManager(players);
    
    // Modify manager's internal array (shouldn't affect original)
    manager.advanceTurn();
    
    expect(players[0]).equal("player1");
    expect(players[1]).equal("player2");
  });
});

describe("createTurnManager", () => {
  test("should create manager with default start index", () => {
    const players = ["player1", "player2"];
    const manager = createTurnManager(players);
    
    expect(manager.getCurrentIndex()).equal(0);
    expect(manager.getCurrentPlayer()).equal("player1");
  });

  test("should create manager with specified start index", () => {
    const players = ["player1", "player2", "player3"];
    const manager = createTurnManager(players, 2);
    
    expect(manager.getCurrentIndex()).equal(2);
    expect(manager.getCurrentPlayer()).equal("player3");
  });
});

describe("Turn Management Integration", () => {
  test("should handle complete turn cycle", () => {
    const players = ["player1", "player2", "player3"];
    const manager = new TurnManager(players, 0);
    
    // Cycle through all players
    expect(manager.getCurrentPlayer()).equal("player1");
    expect(manager.advanceTurn()).equal("player2");
    expect(manager.advanceTurn()).equal("player3");
    expect(manager.advanceTurn()).equal("player1"); // Wraps around
  });

  test("should work with rotatePlayers", () => {
    const players = ["player1", "player2", "player3"];
    const rotated = rotatePlayers(players, 1);
    const manager = new TurnManager(rotated, 0);
    
    expect(manager.getCurrentPlayer()).equal("player2");
    expect(manager.advanceTurn()).equal("player3");
  });
});


