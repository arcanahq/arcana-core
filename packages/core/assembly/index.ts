/**
 * Core interfaces for AssemblyScript contracts
 *
 * MessagePack-first runtime APIs for Arcana programs.
 */

// Export state
export {
  ProgramState,
  RandomSeedFields,
  ContractStatus,
  Environment,
  ContractArgs
} from "./core/state";

// Export views
export {
  ProgramStateView,
  RandomSeedFieldsView,
  ContractContextView
} from "./core/views";

export {
  normalizeCallerId,
  applyProgramStateView,
  programStateToView,
  copyStringArray,
  copyStringMatrix,
  copyI64Matrix
} from "./core/program";

// Export context
export {
  ContractContext
} from "./core/context";

// Export entrypoint
export {
  handleWithRegistries
} from "./core/entrypoint";

// Export WASM ABI constants
export {
  ARCANA_WASM_ABI_VERSION,
  OPERATION_MODE_ACTION,
  OPERATION_MODE_VIEW
} from "./core/abi";
// Export decorators
export {
  action,
  view,
  constructor,
  msgpackView,
  msgpackArgs,
  arcanaState,
  arcanaEvent,
  topic
} from "./core/decorators";

// Export response
export {
  ContractResponse,
  ViewResponse,
  ContractError,
  ContractEvent,
  Event,
  EventBuilder,
  EventPayload,
  ContractEffect,
  ContractTask,
  Task,
  TaskBuilder,
  TaskArgs,
  IncrementBalanceEffect,
  DecrementBalanceEffect,
  LogEffect,
  PrintStatusEffect,
  createIncrementBalanceEffect,
  createDecrementBalanceEffect,
  createLogEffect,
  createPrintStatusEffect
} from "./core/response";

// ContractResponse.withError is available as a static method

// Export registry
export {
  EntrypointRegistry,
  BytesEntrypoint
} from "./core/registry";

// Export random utilities
export {
  RandomSeed,
  RandomResult,
  createRandomSeed,
  hashRandomSeed,
  getRandomValue,
  getRandomInRange,
  getRandomIntInRange,
  getRandomValueFromSeed,
  getRandomInRangeFromSeed,
  getRandomIntInRangeFromSeed
} from "./primitives/random";

// Export WASM helpers
export {
  getCurrentArgsBytes,
  decodeArgsArray,
  decodeStateArray,
} from "./core/args";

// Export WASM helpers
export {
  alloc,
  scratch_alloc,
  scratch_reset,
  init_scratch_base,
  free,
  readString,
  readBytes,
  reset_alloc,
  lastGrowPages,
  lastGrowResult,
  memPages,
  current_pages,
  lastAllocReq,
  lastAllocAligned,
  lastAllocPtr,
  lastAllocNext,
  allocFailReason,
  scratch_base,
  scratch_ptr
} from "./core/wasm";

// Export utility helpers
export {
  getNumber,
  getString,
  getBoolean,
  getObject,
  getArray,
  getStringArray,
  numberToJSON,
  stringToJSON,
  booleanToJSON,
  stringArrayToJSON
} from "./primitives/utils";

// Export result helpers
export {
  createEvent,
  createTypedEvent,
  createEventPayload,
  createErrorEvent,
  createEventsArray,
  createEffectsArray,
  createIncrementBalanceEffectU64,
  createDecrementBalanceEffectU64,
  pushEffect,
  EffectsBuilder,
  ViewSerializable,
} from "./primitives/result";

// Export ContractEffect and response types from response.ts (including effect creation functions)
export {
  ContractEffect,
  IncrementBalanceEffect,
  DecrementBalanceEffect,
  LogEffect,
  PrintStatusEffect,
  ContractResponse,
  ViewResponse,
  ContractError,
  ContractEvent,
  Event,
  EventBuilder,
  EventPayload,
  ContractTask,
  ProgramTask,
  ProgramEffect,
  Task,
  TaskBuilder,
  TaskArgs,
  createIncrementBalanceEffect,
  createDecrementBalanceEffect,
  createLogEffect,
  createPrintStatusEffect
} from "./core/response";

// Export conversion helpers
export {
  u64_to_string,
  string_to_u64,
  raw_to_human,
  human_to_raw,
  DEFAULT_DECIMALS,
  // Fixed-point integer conversions for game engine
  FIXED_POINT_DECIMALS,
  raw_u256_to_fixed_point_u64,
  fixed_point_u64_to_raw_u256,
  fixed_point_u64_to_human,
  human_to_fixed_point_u64,
  // u256 validation and utilities
  is_valid_u256_string,
  parse_u256_string,
  u256_string_to_bigint,
  u256_string_fits_u64,
  u256_string_to_u64
} from "./primitives/conversions";

// Export amount utilities (standardized u256 handling)
export {
  is_valid_amount_string,
  parse_amount_from_string,
  parse_amount_from_number,
  parse_amount_from_string_required,
  parse_amount_from_number_required,
  parse_amount_from_string_positive,
  parse_amount_from_number_positive,
  amount_string_fits_u64,
  parse_amount_string_to_u64,
  parse_amount_number_to_u64,
  amount_to_string,
  u64_amount_to_string,
  compare_amounts,
  add_amounts,
  subtract_amounts,
  multiply_amount,
  divide_amount
} from "./primitives/amount_utils";

// Export time utilities
export {
  isTimeoutElapsed,
  calculateDeadline,
  getTimeRemaining,
  isValidDeadline,
  TurnTimer,
  createTurnTimer
} from "./game/time";

// Export precompiles (host-provided)
export {
  nowMs
} from "./precompiles/time";

// Export U256 precompiles (host-provided)
export {
  u256Add,
  u256Sub,
  u256Mul,
  u256Div,
  u256Mod,
  u256Cmp,
} from "./precompiles/u256";

// Export scoped KV read precompiles (host-provided)
export {
  kvGetU256,
  kvGetBaseU256,
  kvGetBytes,
  kvGetBaseBytes,
} from "./precompiles/kv";

// Export authorization helpers
export {
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
} from "./game/auth";

// Export turn management utilities
export {
  nextPlayer,
  previousPlayer,
  rotatePlayers,
  isValidPlayerIndex,
  TurnManager,
  createTurnManager
} from "./game/turns";

// Export validation helpers
export {
  ValidationResult,
  validateProgramStatus,
  validateProgramNotFinished,
  validateProgramActive,
  validateProgramPending,
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
} from "./game/validation";

// Export state transition helpers
export {
  StateTransition,
  isTransitionAllowed,
  validateTransition,
  createStandardProgramTransitions,
  createStandardGameTransitions,
  isTerminalStatus,
  getAllowedTransitions,
  TransitionManager,
  createStandardTransitionManager
} from "./game/transitions";

// Export metadata helpers
// Export structured instance metadata
export { InstanceMetadata } from "./game/instance_metadata";
// Legacy JSON metadata helpers removed in MessagePack-only mode.

// Card game utilities have been moved to @arcanahq/cardgames
// Import from "@arcanahq/cardgames/assembly/cards" for Card, Suit, Rank
// Import from "@arcanahq/cardgames/assembly/cardgames" for deck utilities
// Import from "@arcanahq/cardgames/assembly/blackjack/blackjack" for blackjack utilities

// Export BigInt
export { BigInt } from "./primitives/bigint";

// Cash game utilities have been moved to @arcanahq/cardgames
// Import from "@arcanahq/cardgames/assembly/cashgames" for cash game types and utilities

// Export standard effects (Bank, Scope Data, Assertions, Table effects)
export {
  Effects,
  Principal,
  // Generic named-bytes effects
  NamedBytesEffect,
  createNamedBytesEffect,
  // Host-managed random seed rotation (commit-reveal)
  RotateSeedEffect,
  createRotateSeedEffect,
  // Bank effects
  BankTransferEffect,
  createBankTransferEffect,
  // Scope data effects
  ScopeDataSetEffect,
  ScopeDataDelEffect,
  ScopeDataIncEffect,
  ScopeDataDecEffect,
  ScopeDataMaxEffect,
  ScopeDataMinEffect,
  createScopeDataSetEffect,
  createScopeDataDelEffect,
  createScopeDataIncEffect,
  createScopeDataDecEffect,
  createScopeDataMaxEffect,
  createScopeDataMinEffect,
  // Base storage effects (project-level, shared across scopes)
  createBaseDataSetEffect,
  createBaseDataDelEffect,
  createBaseDataIncEffect,
  createBaseDataDecEffect,
  createBaseDataMaxEffect,
  createBaseDataMinEffect,
  // History effects
  HistoryPersistEffect,
  // Assertion effects
  AssertStateEqEffect,
  AssertStateNotExistsEffect,
  AssertStateContainsEffect,
  AssertStateGtEffect,
  AssertStateLtEffect,
  AssertStateGteEffect,
  AssertStateLteEffect,
  createAssertStateEqEffect,
  createAssertStateNotExistsEffect,
  createAssertStateContainsEffect,
  createAssertStateGtEffect,
  createAssertStateLtEffect,
  createAssertStateGteEffect,
  createAssertStateLteEffect,
  // Table effects (for TablesCapability)
  TableCreatedEffect,
  TablePlayerJoinedEffect,
  TablePlayerLeftEffect,
  TableStartedEffect,
  TableFinishedEffect,
  TableClosedEffect,
  TableMetadataUpdateEffect,
  createTableCreatedEffect,
  createTablePlayerJoinedEffect,
  createTablePlayerLeftEffect,
  createTableStartedEffect,
  createTableFinishedEffect,
  createTableClosedEffect,
  createTableMetadataUpdateEffect
} from "./core/effects";

// Export MessagePack helpers for contract authors
export {
  MessagePackEncoder,
  encodeMapToMsgPack,
} from "./primitives/msgpack";

export {
  MsgpackKind,
  MsgpackValue,
  decodeMsgpack,
  getStringField,
  getMapField,
  getArrayItem,
  getArrayString,
  getArrayI64,
  getArrayBool,
} from "./primitives/msgpack_decode";

export {
  encodeMsgpackToBytes,
  encodeMsgpackMapToBytes,
} from "./primitives/msgpack_utils";

export { BorshReader } from "./primitives/borsh_decode";
