export type SubscriptionStatus =
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'resync'
  | 'closed'
  | 'error';

export interface SubscriptionEvent<TView = unknown> {
  sequence?: number;
  instance_id?: string;
  scope_id?: string;
  view_json?: TView;
  payload?: unknown;
  /** Hex-encoded msgpack event data for typed Arcana events. */
  data?: string | null;
  /** Indexed typed-event topics in order. */
  topics?: string[];
  topic0?: string | null;
  topic1?: string | null;
  topic2?: string | null;
  topic3?: string | null;
  queryable?: boolean;
  exposure?: string | null;
  recipient_field?: string | null;
  indexes?: string[];
  state_version?: number;
  event_type: string;
  /**
   * Opaque echo of the client-supplied mutation id that produced this state
   * change. Optimistic stores match incoming server events against pending
   * mutations using this field. Absent for events not triggered by an
   * identified mutation (e.g. internal jobs) and for resync sentinels.
   */
  client_mutation_id?: string | null;
}

export interface SubscriptionHandle {
  close(): void;
  readonly closed: boolean;
}

export interface SubscriptionBackoffOptions {
  reconnect?: boolean;
  minReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  reconnectJitterRatio?: number;
  /**
   * Abort the underlying SSE connection if no chunk (event or `ping`) arrives
   * within this window. Triggers the reconnect path. Default 45000ms; server
   * keep-alive pings every 15s, so this catches stalls without false positives.
   */
  keepAliveTimeoutMs?: number;
  /**
   * Wake the reconnect backoff immediately when `window.online` fires. Default true.
   */
  reconnectOnOnline?: boolean;
  /**
   * Wake the reconnect backoff immediately when the document becomes visible. Default true.
   */
  reconnectOnVisible?: boolean;
}

export interface SubscriptionDuplicateOptions {
  initialSequence?: number;
  initialStateVersion?: number;
}

export interface SubscriptionFallbackOptions<TSnapshot = unknown> {
  /**
   * Called after reconnects and while disconnected. Use this to refetch the
   * authoritative view because the current server does not replay missed SSE
   * events.
   */
  refetch?: () => Promise<TSnapshot | void> | TSnapshot | void;
  onRefetch?: (snapshot: TSnapshot) => void;
  fallbackPollIntervalMs?: number;
}

export interface SubscribeOptions<TView = unknown, TSnapshot = unknown>
  extends SubscriptionBackoffOptions,
    SubscriptionDuplicateOptions,
    SubscriptionFallbackOptions<TSnapshot> {
  scopeId: string;
  instanceId?: string;
  eventType?: string;
  signal?: AbortSignal;
  lastEventId?: string;
  onEvent?: (event: SubscriptionEvent<TView>) => void;
  onView?: (view: TView, event: SubscriptionEvent<TView>) => void;
  onError?: (error: unknown) => void;
  onStatusChange?: (status: SubscriptionStatus) => void;
}

export type SubscribeInstanceOptions<TView = unknown, TSnapshot = unknown> = Omit<
  SubscribeOptions<TView, TSnapshot>,
  'scopeId' | 'instanceId'
>;

export type SubscribeScopeOptions<TView = unknown, TSnapshot = unknown> = Omit<
  SubscribeOptions<TView, TSnapshot>,
  'scopeId'
>;
