/**
 * Scopes types
 * 
 * ## Terminology (see docs/README.md)
 * 
 * - **Program**: Deployed WASM binary code (the deployable unit)
 * - **Instance**: A running instance of a Program with its own state
 * - **Scope**: Isolation boundary that owns programs and instances
 */

export interface Scope {
  scope_id: string;
  name: string;
  owner_user_id: string;
  visibility: 'private' | 'public' | 'unlisted';
  metadata_json?: unknown;
  created_at?: string;
}

/**
 * Program: Deployed WASM binary code.
 */
export interface Program {
  program_id: string;
  /** Human-readable program name (e.g., "battleship", "cage") */
  program_type: string;
  wasm_hash: string;
  wasm_sha256?: string;
  scope_id: string;
  version?: string;
  metadata?: unknown;
  deployed_by?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Instance: A running instance of a Program with its own state.
 */
export interface Instance {
  /** Instance ID (UUID) */
  instance_id: string;
  /** Owner/creator user ID (UUID) */
  owner_id?: string;
  /** Program type name (e.g., "battleship", "cage") */
  program_type: string;
  /** Scope this instance belongs to */
  scope_id: string;
  /** Program ID this instance was created from */
  program_id?: string;
  /** Current state */
  state?: unknown;
  state_version?: number;
  status?: string;
  /** Whether this instance is discoverable in scope listings */
  discoverable?: boolean;
  /** Classification for UI convenience */
  instance_kind?: 'unlisted_instance' | 'scope_public_instance';
  metadata?: unknown;
  invite_code?: string;
  deployed_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateScopeRequest {
  name: string;
  scope_id?: string;
  visibility?: 'private' | 'public' | 'unlisted';
  metadata_json?: unknown;
}

export interface DeployProgramRequest {
  /** Human-readable program name */
  program_type: string;
  /** Base64-encoded WASM bytes or IPFS hash */
  wasm: string;
  version?: string;
  metadata?: unknown;
}

export interface CreateInstanceRequest {
  /** UUID of installed program */
  program_id: string;
  /** Optional entrypoint name (defaults to "initialize") */
  entrypoint?: string;
  /** Optional base64-encoded raw args payload (use this for byte-oriented init args) */
  args_bytes?: string;
  /** Optional contract ID (UUID will be generated if not provided). Must be a valid UUID. */
  contract_id?: string;
  /** Optional discoverability override for this instance. */
  discoverable?: boolean;
}

export interface KVStore {
  [key: string]: string;
}

export interface ListScopesOptions {
  project_id?: string;
  limit?: number;
  offset?: number;
}

export interface ListProgramsOptions {
  limit?: number;
  offset?: number;
}

export interface ListInstancesOptions {
  limit?: number;
  offset?: number;
  status?: string;
  program_type?: string;
  /** Include finished/cancelled instances (default: false) */
  include_terminated?: boolean;
}

export interface InstallProgramRequest {
  program_id: string;
}

export interface UpdateProgramSettingsRequest {
  creation_disabled?: boolean;
}

export interface Aggregation {
  aggregation_id: string;
  name: string;
  source_metric: string;
  aggregation_type: string;
  period: string;
  target_event_id: string;
  target_metric_name: string;
  enabled: boolean;
}

export interface AggregationTopOptions {
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
}

export interface AggregationTopUser {
  user_id: string;
  value: number;
  rank?: number;
}
