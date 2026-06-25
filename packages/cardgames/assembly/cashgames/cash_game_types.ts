// @ts-nocheck
/**
 * Shared types for cash games
 * 
 * Standardized interfaces for buy-in, rake, rebuy, and seat management
 */

/**
 * Rake configuration for cash games
 */
export class RakeConfig {
  percentage: f64 = 0.0; // Rake percentage (e.g., 5.0 for 5%)
  cap: i64 = 0; // Maximum rake per pot (0 = no cap)
  
  constructor(percentage: f64 = 0.0, cap: i64 = 0) {
    this.percentage = percentage;
    this.cap = cap;
  }
  
  clone(): RakeConfig {
    return new RakeConfig(this.percentage, this.cap);
  }
}

/**
 * Buy-in range configuration
 */
export class BuyInRange {
  min: string = "0"; // Minimum buy-in amount (BigInt string)
  max: string = "0"; // Maximum buy-in amount (BigInt string)
  
  constructor(min: string = "0", max: string = "0") {
    this.min = min;
    this.max = max;
  }
  
  clone(): BuyInRange {
    return new BuyInRange(this.min, this.max);
  }
}

/**
 * Rebuy configuration
 */
export class RebuyConfig {
  allowed: bool = true; // Whether rebuys are allowed
  cooldownMs: i64 = 0; // Cooldown between rebuys (0 = no cooldown)
  maxRebuys: i32 = -1; // Maximum rebuys per player (-1 = unlimited)
  autoRebuy: bool = false; // Auto-rebuy when stack reaches 0
  
  constructor(
    allowed: bool = true,
    cooldownMs: i64 = 0,
    maxRebuys: i32 = -1,
    autoRebuy: bool = false
  ) {
    this.allowed = allowed;
    this.cooldownMs = cooldownMs;
    this.maxRebuys = maxRebuys;
    this.autoRebuy = autoRebuy;
  }
  
  clone(): RebuyConfig {
    return new RebuyConfig(this.allowed, this.cooldownMs, this.maxRebuys, this.autoRebuy);
  }
}

/**
 * Cash game configuration
 * Combines all cash game settings
 */
export class CashGameConfig {
  buyInRange: BuyInRange = new BuyInRange();
  rakeConfig: RakeConfig = new RakeConfig();
  rebuyConfig: RebuyConfig = new RebuyConfig();
  
  constructor(
    buyInRange: BuyInRange | null = null,
    rakeConfig: RakeConfig | null = null,
    rebuyConfig: RebuyConfig | null = null
  ) {
    this.buyInRange = buyInRange !== null ? buyInRange : new BuyInRange();
    this.rakeConfig = rakeConfig !== null ? rakeConfig : new RakeConfig();
    this.rebuyConfig = rebuyConfig !== null ? rebuyConfig : new RebuyConfig();
  }
  
  clone(): CashGameConfig {
    return new CashGameConfig(
      this.buyInRange.clone(),
      this.rakeConfig.clone(),
      this.rebuyConfig.clone()
    );
  }
}

/**
 * Base interface for cash game seats
 * Games should extend this with game-specific fields
 */
export class CashGameSeatBase {
  seatId: i32 = 0;
  playerId: string | null = null;
  stack: string = "0"; // Current stack (BigInt string)
  buyInAmount: string = "0"; // Original buy-in amount (BigInt string)
  lastRebuyAt: i64 = 0; // Timestamp of last rebuy
  rebuyCount: i32 = 0; // Number of rebuys this player has made
  
  constructor(
    seatId: i32 = 0,
    playerId: string | null = null,
    stack: string = "0",
    buyInAmount: string = "0"
  ) {
    this.seatId = seatId;
    this.playerId = playerId;
    this.stack = stack;
    this.buyInAmount = buyInAmount;
    this.lastRebuyAt = 0;
    this.rebuyCount = 0;
  }
  
  isEmpty(): bool {
    const pid = this.playerId;
    if (pid === null) {
      return true;
    }
    return pid.length === 0;
  }
  
  clone(): CashGameSeatBase {
    const seat = new CashGameSeatBase(
      this.seatId,
      this.playerId,
      this.stack,
      this.buyInAmount
    );
    seat.lastRebuyAt = this.lastRebuyAt;
    seat.rebuyCount = this.rebuyCount;
    return seat;
  }
}

