import { AxiosInstance, AxiosRequestConfig } from 'axios';
import { encode } from '@msgpack/msgpack';
import { extractData, ApiResponse, ArcanaInstanceError } from '../types/common.js';
import {
  encodeArgsBytes,
  decodeHexBytes,
  decodeMsgpackResponse,
  decodeActionResponseData,
  decodeViewResponseData,
  decodeViewResponseWithReads,
} from '../utils/bytes.js';
import type {
  ArgsStruct,
  InstanceActionResponse,
  InstanceInfo,
  InstanceEvent,
  EventHistoryOptions,
  EventHistoryState,
  GetEventsPageOptions,
  EventPage,
  GetEventsOptions,
  TransactionEnvelope,
  TransactionBundle,
  BundleResponse,
  ViewReadsRequest,
  ViewReadsResult,
  ViewWithReadsResponse,
} from './types.js';

type ArgField = {
  names: string[];
  defaultValue: unknown;
};

export class EventHistoryCursor {
  private baseOptions: EventHistoryOptions;
  private cursor: string | null;
  private items: InstanceEvent[] = [];
  private loading = false;
  private hasMore = true;

  constructor(
    private readonly fetchPage: (options: GetEventsPageOptions) => Promise<EventPage>,
    options: EventHistoryOptions = {},
  ) {
    this.baseOptions = { ...options };
    this.cursor = options.cursor ?? null;
  }

  get state(): EventHistoryState {
    return {
      items: [...this.items],
      cursor: this.cursor,
      hasMore: this.hasMore,
      loading: this.loading,
    };
  }

  reset(options: EventHistoryOptions = this.baseOptions): EventHistoryState {
    this.items = [];
    this.baseOptions = { ...options };
    this.cursor = options.cursor ?? null;
    this.hasMore = true;
    this.loading = false;
    return this.state;
  }

  async loadNext(): Promise<EventHistoryState> {
    if (this.loading) return this.state;
    if (!this.hasMore) return this.state;
    this.loading = true;
    try {
      const { maxItems, ...pageOptions } = this.baseOptions;
      const page = await this.fetchPage({
        ...pageOptions,
        cursor: this.cursor ?? pageOptions.cursor,
      });
      this.items = this.items.concat(page.items);
      if (typeof maxItems === 'number' && maxItems > 0 && this.items.length > maxItems) {
        this.items = this.items.slice(this.items.length - maxItems);
      }
      this.cursor = page.next_cursor ?? null;
      this.hasMore = Boolean(page.next_cursor);
      return this.state;
    } finally {
      this.loading = false;
    }
  }
}

function field(names: string | string[], defaultValue: unknown = ''): ArgField {
  return { names: Array.isArray(names) ? names : [names], defaultValue };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readArg(args: Record<string, unknown>, spec: ArgField): unknown {
  for (const name of spec.names) {
    if (Object.prototype.hasOwnProperty.call(args, name)) {
      return args[name];
    }
  }
  return spec.defaultValue;
}

function toTuple(args: Record<string, unknown>, fields: ArgField[]): unknown[] {
  return fields.map((spec) => readArg(args, spec));
}

function initFieldsForProgram(programType?: string): ArgField[] | undefined {
  switch (programType) {
    case 'cage':
      return [
        field('minHouseDeposit', '0'),
        field('defaultAssetId', ''),
        field('initialHouseAssetId', ''),
        field('initialHouseBalance', '0'),
      ];
    case 'neon-dragon':
      return [
        field(['resetCounters', 'reset_counters'], true),
        field(['progressiveSeedMultiplierBps', 'progressive_seed_multiplier_bps'], 10000),
      ];
    case 'blackjack':
      return [field('wagerAmount', '1000000'), field('assetId', ''), field('usePlayMoney', 'false')];
    case 'coinflip':
      return [
        field('assetId', ''),
        field('usePlayMoney', 'false'),
        field('initialFlipHistory', ''),
        field('initialTotalFlips', '0'),
        field('initialCurrentStreak', '0'),
      ];
    case 'pvp-coinflip':
      return [field('token'), field('wager', '0'), field('prediction')];
    case 'roshambo':
      return [field('token'), field('wager', '0'), field('usePlayMoney', 'false')];
    case 'guts':
      return [
        field('assetId'),
        field('usePlayMoney', 'false'),
        field('anteAmount', '0'),
        field('playerNames'),
        field('playerIds'),
        field('waitForPlayers', 'false'),
      ];
    case 'uno':
      return [field('wagerAmount', '0'), field('assetId', 'asset:usdc'), field('usePlayMoney', 'false'), field('playerName')];
    case 'mines':
      return [field('wager', '0'), field('difficulty', '3'), field('assetId', 'asset:usdc'), field('usePlayMoney', 'false')];
    case 'plinko':
      return [
        field('assetId'),
        field('houseEdgeBps', '250'),
        field('riskLevel', 'low'),
        field('rows', '8'),
        field('usePlayMoney', 'false'),
      ];
    case 'battleship':
      return [field('wager', '0'), field('token'), field('usePlayMoney', 'false')];
    case 'analytics-query':
      return [];
    default:
      return undefined;
  }
}

function fieldsForEntrypoint(entrypoint: string, args?: Record<string, unknown>, programType?: string): ArgField[] | undefined {
  switch (entrypoint) {
    case 'initialize':
      return initFieldsForProgram(programType)
        ?? (args && ('resetCounters' in args || 'progressiveSeedMultiplierBps' in args)
          ? initFieldsForProgram('neon-dragon')
          : undefined);
    case 'deposit':
      return [
        field('assetId', 'usdc'),
        field('amount', '0'),
        field('authId', null),
        field(['balanceSnapshotU256', 'balance_snapshot_u256'], '0'),
        field('idempotency_key'),
      ];
    case 'deposit_house':
      return [
        field('assetId', 'usdc'),
        field('amount', '0'),
        field('currentHouseBalance', '0'),
        field('currentTotalShares', '0'),
        field('idempotency_key'),
      ];
    case 'withdraw':
      return [
        field('assetId', null),
        field('amount', '0'),
        field(['balanceSnapshotU256', 'balance_snapshot_u256'], '0'),
        field('allocations', []),
        field('idempotency_key'),
      ];
    case 'withdraw_house':
      return [
        field('assetId', 'usdc'),
        field('amount', '0'),
        field('currentUserShares', '0'),
        field('currentTotalShares', '0'),
        field('currentHouseBalance', '0'),
        field('idempotency_key'),
      ];
    case 'update_asset_groups':
      return [field('assetGroups', [])];
    case 'claim_play_money':
      return [
        field(['balanceSnapshotU256', 'balance_snapshot_u256']),
        field(['lastClaimTimestampMs', 'last_claim_timestamp_ms']),
      ];
    case 'admin_grant_play_money':
      return [field('userId'), field('amount', '0')];
    case 'register_user':
      return [
        field('walletAddress'),
        field('referralCode'),
        field('referredByReferralCode'),
        field('referralCodeOwnerSnapshot'),
        field('createdAtSnapshotMs', '0'),
        field('referralCodeSnapshot'),
        field('referredBySnapshot'),
        field('metadataJson'),
        field('idempotency_key'),
      ];
    case 'execute_spin':
      return [
        field('spinHash'),
        field('clientSeed'),
        field('bet', 100),
        field('activeLines', 20),
        field('inFreeSpins', false),
        field('denomMilli', 1000),
        field('freeSpinMultiplier', 2),
        field('devForceJackpot', false),
        field('devForceJackpotTier'),
        field('fundsMode', 'real'),
        field('assetId'),
      ];
    case 'startRound':
      return [field('amount', '0'), field('pairPlusBet', '0'), field('twentyOnePlusThreeBet', '0')];
    case 'flip':
      return [field('amount', '0'), field('prediction')];
    case 'reveal':
      return [field('position', '0'), field('nonce')];
    case 'submit_choice':
      return [field('choice')];
    case 'declare':
      return [field('declaration')];
    case 'choose_color':
      return [field('color')];
    case 'view_caller_profile':
      return [field('gameType')];
    case 'view_referral_pair':
      return [field('referredUserId')];
    case 'join_game':
      if (args && 'playerName' in args) return [field('playerName')];
      return args && 'nonce' in args ? [field('nonce')] : [];
    case 'cashout':
    case 'expire_game':
    case 'flip_coin':
    case 'cancel_game':
      return args && 'nonce' in args ? [field('nonce')] : [];
    case 'quit_game':
      return [];
    default:
      return undefined;
  }
}

function normalizeArgs(programType: string | undefined, entrypoint: string, args: unknown): unknown {
  if (Array.isArray(args)) return args;
  if (!isRecord(args)) return args;
  const fields = fieldsForEntrypoint(entrypoint, args, programType);
  if (fields) return toTuple(args, fields);
  return Object.keys(args).length === 0 ? [] : args;
}

function fieldsAcceptIdempotency(entrypoint: string): boolean {
  const fields = fieldsForEntrypoint(entrypoint);
  return Boolean(fields?.some((spec) => spec.names.includes('idempotency_key')));
}

function normalizeViewPayload<TView>(entrypoint: string, payload: TView): TView {
  if (!Array.isArray(payload)) return payload;

  if (entrypoint === 'view_play_money_status' && payload.length >= 6) {
    const [userId, playMoneyBalance, lastClaimTimestamp, nextClaimAvailableAt, canClaimNow, dailyAmount] = payload;
    return {
      userId,
      playMoneyBalance,
      lastClaimTimestamp,
      nextClaimAvailableAt,
      canClaimNow,
      dailyAmount,
    } as TView;
  }

  if (entrypoint === 'view' && payload.length === 10) {
    const [
      userId,
      cageBalance,
      playMoneyBalance,
      canClaimPlayMoneyNow,
      lastPlayMoneyClaimTimestamp,
      nextPlayMoneyClaimAvailableAt,
      houseBalance,
      houseShares,
      totalHouseBalance,
      totalShares,
    ] = payload;
    return {
      userId,
      cageBalance,
      playMoneyBalance,
      canClaimPlayMoneyNow,
      lastPlayMoneyClaimTimestamp,
      nextPlayMoneyClaimAvailableAt,
      houseBalance,
      houseShares,
      totalHouseBalance,
      totalShares,
    } as TView;
  }

  return payload;
}

/**
 * Instances module (formerly Contracts module)
 *
 * See docs/README.md for standardized naming:
 * - Instance: A running instance of a Program with its own state
 * - Program: Deployed WASM binary code (the deployable unit)
 *
 * Provides methods for interacting with Arcana instances:
 * - Execute actions (mutate state)
 * - View instances (read personalized state)
 * - Get raw instance state
 * - Get instance events
 */
export class ContractsModule {
  constructor(private api: AxiosInstance, private deviceAuth?: any) {}

  private buildMsgpackConfig(config: AxiosRequestConfig = {}): AxiosRequestConfig {
    return {
      ...config,
      responseType: 'arraybuffer',
      headers: {
        Accept: 'application/msgpack, application/json',
        ...(config.headers ?? {}),
      },
    };
  }

  private async postMsgpack<T = unknown>(
    url: string,
    payload: unknown,
    config: AxiosRequestConfig = {},
  ): Promise<T> {
    const msgpackBody = encode(payload);
    // Ensure we send only the encoded bytes, not any extra backing-buffer capacity.
    const compactBody = new Uint8Array(msgpackBody);
    const response = await this.api.post<T>(
      url,
      compactBody,
      this.buildMsgpackConfig({
        ...config,
        headers: {
          'Content-Type': 'application/msgpack',
          ...(config.headers ?? {}),
        },
      }),
    );
    return response.data;
  }

  private async postJson<T = unknown>(
    url: string,
    payload: unknown,
    config: AxiosRequestConfig = {},
  ): Promise<T> {
    const response = await this.api.post<T>(
      url,
      payload,
      this.buildMsgpackConfig({
        ...config,
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers ?? {}),
        },
      }),
    );
    return response.data;
  }

  private async getMsgpack<T = unknown>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    const response = await this.api.get<T>(url, this.buildMsgpackConfig(config));
    return response.data;
  }

  private coerceApiResponse<T = any>(payload: T): T {
    if (payload == null) return payload;
    if (payload instanceof ArrayBuffer) {
      try {
        return decodeMsgpackResponse(payload) as T;
      } catch {
        const text = new TextDecoder().decode(new Uint8Array(payload));
        return JSON.parse(text) as T;
      }
    }
    if (ArrayBuffer.isView(payload)) {
      try {
        return decodeMsgpackResponse(payload as unknown as Uint8Array) as T;
      } catch {
        const bytes = payload as unknown as Uint8Array;
        const text = new TextDecoder().decode(bytes);
        return JSON.parse(text) as T;
      }
    }
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload) as T;
      } catch {
        return payload;
      }
    }
    return payload;
  }

  private normalizeActionResponse(payload: any): InstanceActionResponse {
    return decodeActionResponseData(payload) as InstanceActionResponse;
  }

  /**
   * Decode heterogeneous Axios error payloads (JSON/msgpack/arraybuffer/string)
   * and preserve HTTP metadata for debugging.
   */
  private decodeAxiosError(error: any): {
    message: string;
    response: {
      http_status?: number;
      http_headers?: Record<string, unknown>;
      payload?: unknown;
    };
  } {
    const httpStatus: number | undefined = error?.response?.status;
    const httpHeaders: Record<string, unknown> | undefined = error?.response?.headers;

    const candidates: unknown[] = [
      error?.response?.data,
      error?.data,
      error?.request?.response,
      error?.request?.responseText,
      error?.responseText,
    ];

    let decodedPayload: unknown = undefined;
    for (const candidate of candidates) {
      if (candidate == null) continue;
      try {
        decodedPayload = this.coerceApiResponse(candidate);
      } catch {
        decodedPayload = candidate;
      }
      if (decodedPayload != null) break;
    }

    const payloadRecord = decodedPayload as Record<string, unknown> | undefined;
    const payloadData = payloadRecord?.data as Record<string, unknown> | undefined;
    const message =
      (payloadRecord?.message as string | undefined) ||
      (payloadData?.reason as string | undefined) ||
      (payloadData?.error as string | undefined) ||
      (payloadData?.code as string | undefined) ||
      (payloadRecord?.error as string | undefined) ||
      (typeof decodedPayload === 'string' ? decodedPayload : undefined) ||
      error?.message ||
      'Unknown error occurred';

    return {
      message,
      response: {
        http_status: httpStatus,
        http_headers: httpHeaders,
        payload: decodedPayload,
      },
    };
  }

  /**
   * Normalize API response to SDK types
   * Maps data -> state for backward compatibility
   */
  private normalizeInstanceInfo(apiData: any): InstanceInfo {
    const rawData = apiData.state ?? apiData.data;
    let state = rawData ?? {};
    let stateHex: string | undefined;
    if (typeof rawData === 'string' && /^[0-9a-fA-F]+$/.test(rawData)) {
      stateHex = rawData;
      state = decodeHexBytes(rawData);
    }
    return {
      ...apiData,
      program_type: apiData.program_type || '',
      state,
      data: apiData.data,
      state_hex: stateHex,
    };
  }

  /**
   * Normalize event data to SDK types
   * Maps payload -> event_data for backward compatibility
   */
  private normalizeEvent(apiEvent: any): InstanceEvent {
    return {
      ...apiEvent,
      event_data: apiEvent.event_data || apiEvent.payload,
    };
  }

  /**
   * Execute an action/entrypoint on an instance
   *
   * @param instanceId - The instance ID
   * @param entrypoint - The entrypoint name
   * @param args - Arguments to pass to the entrypoint
   * @param options - Optional parameters (block, idempotency_key)
   */
  async executeAction(
    instanceId: string,
    entrypoint: string,
    args: ArgsStruct = {},
    options?: {
      /** If true (default), wait for transaction to complete. If false, returns transaction ID immediately. */
      block?: boolean;
      /** Idempotency key for HTTP-level idempotency */
      idempotency_key?: string;
    }
  ): Promise<InstanceActionResponse> {
    try {
      // transaction_id is deterministically generated from transaction content (caller, instance, entrypoint, args)
      // and is used as action_id for contract-level idempotency. No need to send action_id.
      // Only contracts with an explicit idempotency field can receive it in
      // args_bytes; strict tuple decoders reject unknown trailing fields.
      const finalArgs: ArgsStruct | unknown[] = Array.isArray(args) ? [...args] : { ...args };
      const acceptsContractIdempotency = fieldsAcceptIdempotency(entrypoint);
      if (options?.idempotency_key && acceptsContractIdempotency) {
        if (Array.isArray(finalArgs)) {
          const fields = fieldsForEntrypoint(entrypoint);
          if (fields && finalArgs.length === fields.length - 1) {
            finalArgs.push(options.idempotency_key);
          }
        } else {
          finalArgs.idempotency_key = options.idempotency_key;
        }
      }
      const encodedArgs = normalizeArgs(undefined, entrypoint, finalArgs);

      const envelope: TransactionEnvelope = {
        operation: 'action',
        instance_id: instanceId,
        entrypoint,
        args_bytes: encodeArgsBytes(encodedArgs),
      };

      // Add query parameters
      const params: any = {};
      if (options?.block === false) {
        params.block = 'false';
      }

      const url = `/instances/${instanceId}/actions`;
      const responseData = await this.postMsgpack<ApiResponse<any>>(url, envelope, {
        params,
        headers: options?.idempotency_key
          ? { 'x-arcana-client-mutation-id': options.idempotency_key }
          : undefined,
      });

      const apiResponse = this.coerceApiResponse<ApiResponse<any>>(responseData);
      const data = apiResponse.data as any;

      // Handle non-blocking response (status 202 with transaction_id)
      if (apiResponse.status === 202 && 'transaction_id' in data) {
        return {
          transaction_id: data.transaction_id,
        } as InstanceActionResponse;
      }

      // Check if API returned an error
      if (apiResponse.status !== 200 && 'error' in data && data.error) {
        throw new ArcanaInstanceError(
          data.error,
          instanceId,
          entrypoint,
          data
        );
      }

      const normalized = this.normalizeActionResponse(data);
      if (normalized.error || normalized.error_code) {
        throw new ArcanaInstanceError(
          normalized.error || 'Contract error',
          instanceId,
          entrypoint,
          normalized
        );
      }
      return normalized;
    } catch (error: any) {
      if (error instanceof ArcanaInstanceError) {
        throw error;
      }

      const decoded = this.decodeAxiosError(error);

      throw new ArcanaInstanceError(
        decoded.message,
        instanceId,
        entrypoint,
        decoded.response
      );
    }
  }

  /**
   * View instance state (personalized view based on authenticated user)
   * 
   * This is the correct way to get a personalized view of the instance state.
   * The caller_id is derived from the authentication token.
   * 
   * @param instanceId - The instance ID
   * @param entrypoint - Optional entrypoint name (defaults to "view")
   * @param args - Optional arguments to pass to the view entrypoint
   */
  async view<TView = unknown>(
    instanceId: string,
    entrypoint?: string,
    args?: ArgsStruct
  ): Promise<TView> {
    const effectiveEntrypoint = entrypoint || "view";
    const argsBytes = args === undefined
      ? ''
      : encodeArgsBytes(normalizeArgs(undefined, effectiveEntrypoint, args));
    const viewBody = {
      entrypoint: effectiveEntrypoint,
      args_bytes: argsBytes,
    };
    // If entrypoint or args provided, use POST with body.
    if (entrypoint || args) {
      const responseData = await this.postMsgpack<ApiResponse<any>>(
        `/instances/${instanceId}/view`,
        viewBody,
        {}
      );
      const apiResponse = this.coerceApiResponse<ApiResponse<any>>(responseData);
      return normalizeViewPayload(effectiveEntrypoint, decodeViewResponseData<TView>(apiResponse.data));
    }
    
    // Otherwise use GET.
    const responseData = await this.getMsgpack<ApiResponse<any>>(
      `/instances/${instanceId}/view`,
      {}
    );
    const apiResponse = this.coerceApiResponse<ApiResponse<any>>(responseData);
    return normalizeViewPayload(effectiveEntrypoint, decodeViewResponseData<TView>(apiResponse.data));
  }

  /**
   * View instance state with direct table/KV reads.
   * 
   * Use this to fetch leaderboard, session history, deposit/withdrawal history,
   * etc. The API executes the view and runs the requested reads, attaching
   * `reads.tables[].rows` to the response.
   * 
   * Requires POST (reads only supported on POST). Auth required when using
   * `caller_bind_column` for caller-scoped reads.
   * 
   * @param instanceId - The instance ID (e.g. analytics-query)
   * @param reads - KV and/or table read requests
   * @param entrypoint - Optional entrypoint name (defaults to "view")
   * @param args - Optional arguments to pass to the view entrypoint
   */
  async viewWithReads<TView = unknown>(
    instanceId: string,
    reads: ViewReadsRequest,
    entrypoint?: string,
    args?: ArgsStruct
  ): Promise<ViewWithReadsResponse<TView>> {
    const effectiveEntrypoint = entrypoint || "view";
    const argsBytes = args === undefined
      ? ''
      : encodeArgsBytes(normalizeArgs(undefined, effectiveEntrypoint, args));
    const viewBody: Record<string, unknown> = {
      entrypoint: effectiveEntrypoint,
      args_bytes: argsBytes,
      reads,
    };
    const responseData = await this.postMsgpack<ApiResponse<unknown>>(
      `/instances/${instanceId}/view`,
      viewBody,
      {}
    );
    const apiResponse = this.coerceApiResponse<ApiResponse<unknown>>(responseData);
    const { view, reads: readsData } = decodeViewResponseWithReads<TView>(apiResponse.data);
    const normalizedView = normalizeViewPayload(effectiveEntrypoint, view);
    const readsResult: ViewReadsResult = (readsData ?? { kv: [], tables: [] }) as ViewReadsResult;
    return { view: normalizedView, reads: readsResult };
  }

  /**
   * Get raw instance state (no caller_id filtering)
   * 
   * @param instanceId - The instance ID
   */
  async getState(instanceId: string): Promise<InstanceInfo> {
    const responseData = await this.getMsgpack<ApiResponse<any>>(
      `/instances/${instanceId}`
    );
    const apiResponse = this.coerceApiResponse<ApiResponse<any>>(responseData);
    return this.normalizeInstanceInfo(apiResponse.data);
  }

  /**
   * Get instance events
   * 
   * @param instanceId - The instance ID
   * @param options - Options for filtering events
   */
  async getEvents(
    instanceId: string,
    options?: GetEventsOptions
  ): Promise<InstanceEvent[]> {
    const params: any = {};
    if (options?.limit) params.limit = options.limit;
    if (options?.offset) params.offset = options.offset;
    if (options?.event_type) params.event_type = options.event_type;

    const responseData = await this.getMsgpack<ApiResponse<any[]>>(
      `/instances/${instanceId}/events`,
      { params }
    );
    const apiResponse = this.coerceApiResponse<ApiResponse<any[]>>(responseData);
    const data = extractData({ data: apiResponse });
    return data.map(event => this.normalizeEvent(event));
  }

  async getEventsPage(
    instanceId: string,
    options?: GetEventsPageOptions
  ): Promise<EventPage> {
    const params: any = {};
    if (options?.limit) params.limit = options.limit;
    if (options?.page_size) params.page_size = options.page_size;
    if (options?.cursor) params.cursor = options.cursor;
    if (options?.event_type) params.event_type = options.event_type;

    const responseData = await this.getMsgpack<ApiResponse<any>>(
      `/instances/${instanceId}/events`,
      { params }
    );
    const apiResponse = this.coerceApiResponse<ApiResponse<any>>(responseData);
    const data = extractData({ data: apiResponse });
    return {
      items: (data.items || []).map((event: any) => this.normalizeEvent(event)),
      next_cursor: data.next_cursor ?? null,
    };
  }

  eventHistory(instanceId: string, options: EventHistoryOptions = {}): EventHistoryCursor {
    return new EventHistoryCursor(
      (pageOptions) => this.getEventsPage(instanceId, pageOptions),
      options,
    );
  }

  /**
   * Create a new instance from a deployed program
   * 
   * @param programType - The program type
   * @param args - Arguments to pass to the initialize entrypoint
   * @param options - Optional instance ID or block parameter
   */
  async create(
    programType: string,
    args: ArgsStruct = {},
    options?: {
      /** Optional instance ID (auto-generated if not provided) */
      instanceId?: string;
      /** If true (default), wait for transaction to complete. If false, returns transaction ID immediately. */
      block?: boolean;
    }
  ): Promise<InstanceInfo> {
    const envelope: TransactionEnvelope = {
      operation: 'create_instance',
      program_type: programType,
      args_bytes: encodeArgsBytes(normalizeArgs(programType, 'initialize', args || {})),
    };

    if (options?.instanceId) {
      envelope.instance_id = options.instanceId;
    }

    // Add block query parameter (defaults to true)
    const params: any = {};
    if (options?.block === false) {
      params.block = 'false';
    }

    const responseData = await this.postMsgpack<ApiResponse<InstanceInfo | { transaction_id: string; status: string }>>(
      '/instances',
      envelope,
      { params }
    );

    const apiResponse = this.coerceApiResponse<ApiResponse<any>>(responseData);
    const data = extractData({ data: apiResponse });

    // Handle non-blocking response (status 202 with transaction_id)
    if (apiResponse.status === 202 && 'transaction_id' in data) {
      // Return a partial InstanceInfo with transaction_id
      return {
        id: '', // Will be available after transaction completes
        program_type: programType,
        state: {},
        state_version: 0,
        status: 'pending',
        transaction_id: data.transaction_id,
      } as InstanceInfo;
    }
    
    return this.normalizeInstanceInfo(data);
  }

  /**
   * Get user's instances
   *
   * Requires authentication. Returns instances created by the authenticated user.
   *
   * @param options.scopeId - Optional scope filter (`scope_id` query param).
   */
  async getUserInstances(options?: { scopeId?: string }): Promise<InstanceInfo[]> {
    const params: Record<string, string> = {};
    if (options?.scopeId) {
      params.scope_id = options.scopeId;
    }
    const responseData = await this.getMsgpack<ApiResponse<any[]>>('/instances', { params });
    const apiResponse = this.coerceApiResponse<ApiResponse<any[]>>(responseData);
    const data = extractData({ data: apiResponse });
    return data.map(item => this.normalizeInstanceInfo(item));
  }

  /**
   * Execute a transaction bundle
   * 
   * Executes multiple transactions in order. If `stop_on_failure` is true,
   * execution stops on the first failure. If false, all transactions execute
   * regardless of individual failures.
   * 
   * @param bundle - The transaction bundle to execute
   * @param options - Optional block parameter
   */
  async executeBundle(
    bundle: TransactionBundle,
    options?: {
      /** If true (default), wait for bundle to complete. If false, returns bundle ID immediately. */
      block?: boolean;
    }
  ): Promise<BundleResponse | { transaction_id: string }> {
    try {
      // Add block query parameter (defaults to true)
      const params: any = {};
      if (options?.block === false) {
        params.block = 'false';
      }

      const responseData = await this.postMsgpack<ApiResponse<BundleResponse | { transaction_id: string; status: string }>>(
        '/instances/transactions/bundle',
        bundle,
        { params }
      );

      const apiResponse = this.coerceApiResponse<ApiResponse<any>>(responseData);
      const data = extractData({ data: apiResponse });

      // Handle non-blocking response (status 202 with transaction_id)
      if (apiResponse.status === 202 && 'transaction_id' in data) {
        return {
          transaction_id: data.transaction_id,
        } as { transaction_id: string };
      }

      // Check if API returned an error
      if (apiResponse.status !== 200 && 'error' in data) {
        const errorMsg = (data as any).error;
        throw new ArcanaInstanceError(
          typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg),
          '',
          'bundle',
          data
        );
      }

      return data as BundleResponse;
    } catch (error: any) {
      if (error instanceof ArcanaInstanceError) {
        throw error;
      }

      const decoded = this.decodeAxiosError(error);

      throw new ArcanaInstanceError(
        decoded.message,
        '',
        'bundle',
        decoded.response
      );
    }
  }
}
