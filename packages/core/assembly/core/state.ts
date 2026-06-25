// @ts-nocheck
/**
 * State management for contracts
 * 
 * Working classes with methods for logic
 */

import { getRandomValueFromSeed, getRandomInRangeFromSeed, getRandomIntInRangeFromSeed, RandomResult } from "../primitives/random";
import { RandomSeedFieldsView, ProgramStateView, GameStateView } from "./views";
import { decodeStateBytesToMsgpackValue } from "./args";
import { MsgpackKind } from "../primitives/msgpack_decode";

// Contract status constants
export class ContractStatus {
  static readonly PENDING: string = "pending";
  static readonly ACTIVE: string = "active";
  static readonly RUNNING: string = "running";
  static readonly FINISHED: string = "finished";
}

// Environment constants
export class Environment {
  static readonly TESTING: string = "TESTING";
  static readonly STAGING: string = "STAGING";
  static readonly PRODUCTION: string = "PRODUCTION";
}

/**
 * Working RandomSeedFields class
 * Loads from view class for parsing, converts to view for serialization
 *
 * Only the per-call draw `randomSeedIndex` lives in program state. The raw seed
 * is host-managed: committed at instance creation, injected each call via
 * `ContractContext.serverSeed`, and revealed (per epoch) only after the instance
 * finalizes. Keeping the seed out of program state makes it impossible to leak
 * through an action or view response.
 */
export class RandomSeedFields {
  randomSeedIndex: i32 = 0;

  constructor(randomSeedIndex: i32 = 0) {
    this.randomSeedIndex = randomSeedIndex;
  }

  /**
   * Load from view class (after MessagePack decode)
   */
  static fromView(view: RandomSeedFieldsView): RandomSeedFields {
    return new RandomSeedFields(view.randomSeedIndex);
  }

  /**
   * Convert to view class (for MessagePack encode)
   */
  toView(): RandomSeedFieldsView {
    const view = new RandomSeedFieldsView();
    view.randomSeedIndex = this.randomSeedIndex;
    return view;
  }
}


/**
 * Working ProgramState class with methods
 * Loads from view class for parsing, converts to view for serialization
 */
export class ProgramState {
  randomSeedFields: RandomSeedFields = new RandomSeedFields();
  status: string = ContractStatus.PENDING;
  environment: string = "TESTING";
  createdAt: i64 = 0;

  // Convenience accessor for the per-call draw index.
  get randomSeedIndex(): i32 {
    return this.randomSeedFields.randomSeedIndex;
  }

  set randomSeedIndex(value: i32) {
    this.randomSeedFields.randomSeedIndex = value;
  }

  constructor(
    randomSeedIndex: i32 = 0,
    status: string = ContractStatus.PENDING,
    environment: string = "TESTING",
    createdAt: i64 = 0
  ) {
    this.randomSeedFields = new RandomSeedFields(randomSeedIndex);
    this.status = status;
    this.environment = environment;
    this.createdAt = createdAt;
  }

  /**
   * Load from view class (after MessagePack decode)
   */
  static fromView(view: ProgramStateView): ProgramState {
    const state = new ProgramState(
      view.randomSeedFields.randomSeedIndex,
      view.status,
      view.environment,
      view.createdAt
    );
    return state;
  }



  /**
   * Parse state from MessagePack bytes.
   * Subclasses can override for direct MessagePack decoding.
   */
  static fromBytes<T extends ProgramState>(bytes: Uint8Array): T {
    const decoded = decodeStateBytesToMsgpackValue(bytes);
    const view = new ProgramStateView();
    if (decoded.kind == MsgpackKind.Array) {
      return changetype<T>(ProgramState.fromView(ProgramStateView.fromMsgpackArray(decoded.arr)));
    }
    if (decoded.kind == MsgpackKind.Map) {
      return changetype<T>(ProgramState.fromView(ProgramStateView.fromMsgpackMap(decoded.map)));
    }
    return changetype<T>(ProgramState.fromView(view));
  }

  // Randomness methods - delegate to random utilities.
  //
  // The base seed is host-managed and supplied per call via
  // `ContractContext.serverSeed` (the committed seed for the current epoch).
  // Pass `ctx.serverSeed` as `baseSeed`. Each draw advances and persists the
  // per-call index in program state; the raw seed never enters state.
  getRandomValue(baseSeed: string): RandomResult {
    const result = getRandomValueFromSeed(baseSeed, this.randomSeedFields.randomSeedIndex);
    this.randomSeedFields.randomSeedIndex = result.seed.index;
    return result;
  }

  getRandomInRange(baseSeed: string, min: f64, max: f64): RandomResult {
    const result = getRandomInRangeFromSeed(baseSeed, this.randomSeedFields.randomSeedIndex, min, max);
    this.randomSeedFields.randomSeedIndex = result.seed.index;
    return result;
  }

  getRandomIntInRange(baseSeed: string, min: i32, max: i32): RandomResult {
    const result = getRandomIntInRangeFromSeed(baseSeed, this.randomSeedFields.randomSeedIndex, min, max);
    this.randomSeedFields.randomSeedIndex = result.seed.index;
    return result;
  }

  /**
   * Reset the per-call draw index to 0. Call this in the same action that emits
   * the rotate-seed effect, so the next epoch's committed seed starts fresh.
   */
  resetRandomIndex(): void {
    this.randomSeedFields.randomSeedIndex = 0;
  }
}

/**
 * @deprecated Use ProgramState for new programs.
 */
export class GameState extends ProgramState {
  static fromView(view: GameStateView): GameState {
    const base = ProgramState.fromView(view);
    const state = new GameState(
      base.randomSeedFields.randomSeedIndex,
      base.status,
      base.environment,
      base.createdAt
    );
    return state;
  }

  static fromBytes<T extends GameState>(bytes: Uint8Array): T {
    const decoded = decodeStateBytesToMsgpackValue(bytes);
    const view = new GameStateView();
    if (decoded.kind == MsgpackKind.Array) {
      return changetype<T>(GameState.fromView(GameStateView.fromMsgpackArray(decoded.arr)));
    }
    if (decoded.kind == MsgpackKind.Map) {
      return changetype<T>(GameState.fromView(GameStateView.fromMsgpackMap(decoded.map)));
    }
    return changetype<T>(GameState.fromView(view));
  }
}

/**
 * Base class for contract arguments
 * Subclasses should create view classes and implement fromBytes/toBytes (or equivalent)
 */
export class ContractArgs {
  // Subclasses can override when custom byte parsing is needed.
  static fromBytes<T extends ContractArgs>(bytes: Uint8Array): T {
    throw new Error("ContractArgs.fromBytes() not implemented");
  }
}
