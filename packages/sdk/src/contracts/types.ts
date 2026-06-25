/**
 * Instance types (see docs/README.md)
 * 
 * - **Program**: Deployed WASM binary code (the deployable unit)
 * - **Instance**: A running instance of a Program with its own state
 * - **Scope**: Isolation boundary that owns programs and instances
 */

export type InstanceOperation = 'deploy' | 'create_instance' | 'action';
export type ArgsStruct = Record<string, unknown> | unknown[];

export interface TransactionEnvelope {
  operation: InstanceOperation;
  /** Instance ID for action and create_instance operations */
  instance_id?: string;
  /** Program type name */
  program_type?: string;
  entrypoint?: string;
  /** Base64-encoded MessagePack args payload */
  args_bytes?: string;
  program_id?: string;
  wasm_hash?: string;
  metadata?: unknown;
}

export interface TransactionBundle {
  /** List of transactions to execute in order */
  transactions: TransactionEnvelope[];
  /** If true, stop execution on first failure (default: true) */
  stop_on_failure?: boolean;
}

export interface BundleTransactionResult {
  /** Index of the transaction in the bundle */
  index: number;
  /** Transaction ID */
  transaction_id: string;
  /** Whether this transaction succeeded */
  success: boolean;
  /** Response if successful */
  response?: InstanceActionResponse | InstanceInfo;
  /** Error message if failed */
  error?: string;
}

export interface BundleResponse {
  /** Bundle transaction ID */
  bundle_id: string;
  /** Results for each transaction in the bundle */
  results: BundleTransactionResult[];
  /** Whether all transactions succeeded */
  all_succeeded: boolean;
  /** Whether execution was stopped early due to failure */
  stopped_early: boolean;
}

export interface InstanceActionRequest<TArgs extends ArgsStruct = ArgsStruct> {
  entrypoint: string;
  /** Structured args that will be serialized to MessagePack bytes by SDK callers */
  args?: TArgs;
  /** Pre-serialized base64 MessagePack bytes */
  args_bytes?: string;
}

export interface InstanceActionResponse {
  /** Raw MessagePack response envelope as hex */
  resultHex?: string;
  /** @deprecated legacy snake_case alias */
  result_hex?: string;
  /** Decoded MessagePack action envelope `[state, events, _, metadata, error]` */
  envelope?: {
    state: unknown;
    events: unknown[];
    metadata: unknown;
    error: {
      code?: string;
      message?: string;
      data?: unknown;
    } | null;
  };
  /** Decoded contract state from response envelope */
  new_state?: unknown;
  /** Alias for new_state */
  state?: unknown;
  /** Events emitted by the action */
  events?: unknown[];
  /** Metadata emitted by the action */
  metadata?: unknown;
  /** Contract error code (if any) */
  error_code?: string;
  /** Contract error data (if any) */
  error_data?: unknown;
  /** New state version after the action */
  version?: number;
  /** Transaction ID (when block=false) */
  transaction_id?: string;
  /** Performance metrics (optional) */
  performance?: unknown;
  /** Error message (if action failed) */
  error?: string;
}

/**
 * Information about an instance.
 */
export interface InstanceInfo {
  id: string;
  /** The program type name (e.g., "battleship", "cage") */
  program_type: string;
  /** The instance state */
  state: unknown;
  /** Alias for state to match API response field name */
  data?: unknown;
  /** Raw state/view bytes as hex (if returned by API) */
  state_hex?: string;
  state_version: number;
  status: string;
  /** Scope this instance belongs to */
  scope_id?: string;
  /** Program ID this instance was created from */
  program_id?: string;
  metadata?: unknown;
  invite_code?: string;
  created_at?: string;
  updated_at?: string;
  /** Transaction ID (when block=false) */
  transaction_id?: string;
}

export interface InstanceEvent {
  id: string;
  instance_id?: string;
  scope_id?: string;
  program_type?: string;
  event_type: string;
  payload?: unknown;
  /** Hex-encoded msgpack event data for typed events. */
  data?: string | null;
  /** Indexed typed-event topics in order. */
  topics?: string[];
  topic0?: string | null;
  topic1?: string | null;
  topic2?: string | null;
  topic3?: string | null;
  event_data?: unknown; // Alias for payload (backward compatibility)
  event_index?: number;
  queryable?: boolean;
  exposure?: string;
  recipient_field?: string;
  indexes?: string[];
  created_at: string;
}

export interface GetEventsOptions {
  limit?: number;
  offset?: number;
  event_type?: string;
}

export interface GetEventsPageOptions extends GetEventsOptions {
  cursor?: string;
  page_size?: number;
}

export interface EventPage {
  items: InstanceEvent[];
  next_cursor?: string | null;
}

export interface EventHistoryOptions extends GetEventsPageOptions {
  maxItems?: number;
}

export interface EventHistoryState {
  items: InstanceEvent[];
  cursor: string | null;
  hasMore: boolean;
  loading: boolean;
}

/**
 * Table order specification for view reads.
 */
export interface TableOrderBy {
  column: string;
  direction?: 'asc' | 'desc';
}

export type PredicateValue =
  | string
  | number
  | boolean
  | null
  | PredicateValue[]
  | { [key: string]: PredicateValue };

export type TablePredicate =
  | { Eq: [string, PredicateValue] }
  | { Ne: [string, PredicateValue] }
  | { Lt: [string, PredicateValue] }
  | { Lte: [string, PredicateValue] }
  | { Gt: [string, PredicateValue] }
  | { Gte: [string, PredicateValue] }
  | { In: [string, PredicateValue[]] }
  | { Between: [string, PredicateValue, PredicateValue] }
  | { IsNull: [string] | string }
  | { IsNotNull: [string] | string }
  | { Like: [string, string] }
  | { And: [TablePredicate, TablePredicate] }
  | { Or: [TablePredicate, TablePredicate] }
  | { Not: [TablePredicate] | TablePredicate };

/**
 * Request to read rows from a project or scoped table.
 * Matches the Arcana API ViewReadsRequest.tables[] shape.
 */
export interface TableReadRequest {
  table_name: string;
  /** "project" (default) or "scoped" */
  table_scope?: 'project' | 'scoped';
  /** Enforce column == caller_id (requires auth). Omit for public/catalog reads. */
  caller_bind_column?: string;
  /** Canonical predicate object (e.g. `{ Eq: ["user_id", "0x..."] }`). */
  predicate?: TablePredicate;
  /** Max rows to return (default 100, max 1000) */
  limit?: number;
  /** Sort order */
  order_by?: TableOrderBy[];
}

/**
 * Request for KV and/or table reads attached to a view call.
 */
export interface ViewReadsRequest {
  kv?: Array<{ key: string; source?: 'scoped' | 'project' }>;
  tables?: TableReadRequest[];
}

/**
 * Result for a single table read.
 */
export interface TableReadResult {
  table_name: string;
  table_scope: string;
  row_count: number;
  rows: unknown[][];
}

/**
 * Result from execute_view_reads (attached to view response when reads requested).
 */
export interface ViewReadsResult {
  kv?: Array<{ key: string; source: string; value_hex?: string }>;
  tables?: TableReadResult[];
}

/**
 * Combined view + reads response from viewWithReads.
 */
export interface ViewWithReadsResponse<TView = unknown> {
  view: TView;
  reads: ViewReadsResult;
}
