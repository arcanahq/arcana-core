import type { AxiosInstance } from 'axios';
import { ArcanaApiError, ArcanaNetworkError } from '../types/common.js';
import type {
  SubscribeInstanceOptions,
  SubscribeOptions,
  SubscribeScopeOptions,
  SubscriptionEvent,
  SubscriptionHandle,
  SubscriptionStatus,
} from './types.js';

type TokenRefresher = {
  ensureAccessToken?: () => Promise<boolean>;
  refreshTokens?: () => Promise<boolean>;
};

const DEFAULT_MIN_RECONNECT_DELAY_MS = 500;
const DEFAULT_MAX_RECONNECT_DELAY_MS = 30_000;
const DEFAULT_RECONNECT_JITTER_RATIO = 0.25;
const DEFAULT_FALLBACK_POLL_INTERVAL_MS = 15_000;
const DEFAULT_KEEP_ALIVE_TIMEOUT_MS = 45_000;
const RESYNC_EVENT_TYPE = 'resync';

function normalizeApiUrl(value: string | undefined): string {
  return String(value || 'http://localhost:3003').replace(/\/+$/, '');
}

function buildSubscriptionUrl(baseUrl: string, options: SubscribeOptions<any, any>): string {
  const url = new URL('/subscriptions', `${normalizeApiUrl(baseUrl)}/`);
  url.searchParams.set('scope_id', options.scopeId);
  if (options.instanceId) {
    url.searchParams.set('instance_id', options.instanceId);
  }
  if (options.eventType) {
    url.searchParams.set('event_type', options.eventType);
  }
  return url.toString();
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function nextBackoffDelay(attempt: number, options: SubscribeOptions<any, any>): number {
  const minDelay = normalizePositiveNumber(options.minReconnectDelayMs, DEFAULT_MIN_RECONNECT_DELAY_MS);
  const maxDelay = normalizePositiveNumber(options.maxReconnectDelayMs, DEFAULT_MAX_RECONNECT_DELAY_MS);
  const jitterRatio = Math.max(0, Number(options.reconnectJitterRatio ?? DEFAULT_RECONNECT_JITTER_RATIO));
  const exponential = Math.min(maxDelay, minDelay * 2 ** Math.max(0, attempt - 1));
  const jitter = exponential * jitterRatio * Math.random();
  return Math.min(maxDelay, Math.floor(exponential + jitter));
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isResyncEvent(event: SubscriptionEvent): boolean {
  return event.event_type === RESYNC_EVENT_TYPE;
}

function isDuplicateEvent(
  event: SubscriptionEvent,
  lastSequenceByInstance: Map<string, number>,
  lastVersionByInstance: Map<string, number>,
): boolean {
  const key = event.instance_id || '__scope__';
  const sequence = Number(event.sequence);
  if (Number.isFinite(sequence)) {
    const previousSequence = lastSequenceByInstance.get(key);
    if (previousSequence !== undefined && sequence <= previousSequence) {
      return true;
    }
  }

  const stateVersion = Number(event.state_version);
  if (Number.isFinite(stateVersion)) {
    const previousVersion = lastVersionByInstance.get(key);
    if (previousVersion !== undefined && stateVersion <= previousVersion) {
      return true;
    }
  }

  if (Number.isFinite(sequence)) {
    lastSequenceByInstance.set(key, sequence);
  }
  if (Number.isFinite(stateVersion)) {
    lastVersionByInstance.set(key, stateVersion);
  }
  return false;
}

async function callRefetch<TView, TSnapshot>(
  options: SubscribeOptions<TView, TSnapshot>,
): Promise<void> {
  if (!options.refetch) return;
  const snapshot = await options.refetch();
  if (snapshot !== undefined) {
    options.onRefetch?.(snapshot as TSnapshot);
  }
}

interface Wakeup {
  signal(): void;
  wait(): Promise<void>;
}

function createWakeup(): Wakeup {
  let resolveCurrent: () => void = () => {};
  let current = new Promise<void>((resolve) => {
    resolveCurrent = resolve;
  });
  return {
    signal() {
      const resolve = resolveCurrent;
      current = new Promise<void>((next) => {
        resolveCurrent = next;
      });
      resolve();
    },
    wait() {
      return current;
    },
  };
}

function attachLifecycleWakeups(
  wakeup: Wakeup,
  options: { reconnectOnOnline: boolean; reconnectOnVisible: boolean },
): () => void {
  const cleanups: Array<() => void> = [];
  const win: any = typeof window !== 'undefined' ? window : undefined;
  if (options.reconnectOnOnline && win && typeof win.addEventListener === 'function') {
    const onOnline = () => wakeup.signal();
    win.addEventListener('online', onOnline);
    cleanups.push(() => {
      if (typeof win.removeEventListener === 'function') {
        win.removeEventListener('online', onOnline);
      }
    });
  }
  const doc: any = typeof document !== 'undefined' ? document : undefined;
  if (options.reconnectOnVisible && doc && typeof doc.addEventListener === 'function') {
    const onVisibility = () => {
      if (!doc.hidden) wakeup.signal();
    };
    doc.addEventListener('visibilitychange', onVisibility);
    cleanups.push(() => {
      if (typeof doc.removeEventListener === 'function') {
        doc.removeEventListener('visibilitychange', onVisibility);
      }
    });
  }
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

async function waitWithFallbackPolling<TSnapshot>(
  delayMs: number,
  options: SubscribeOptions<any, TSnapshot>,
  signal: AbortSignal,
  wakeup: Wakeup,
): Promise<void> {
  if (delayMs <= 0) return;

  const pollIntervalMs = normalizePositiveNumber(
    options.fallbackPollIntervalMs,
    DEFAULT_FALLBACK_POLL_INTERVAL_MS,
  );
  const deadline = Date.now() + delayMs;

  while (!signal.aborted) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return;
    const sleepMs = options.refetch ? Math.min(remaining, pollIntervalMs) : remaining;
    const woken = await new Promise<'sleep' | 'wakeup'>((resolve) => {
      const timeout = setTimeout(() => resolve('sleep'), sleepMs);
      const onAbort = () => {
        clearTimeout(timeout);
        resolve('sleep');
      };
      signal.addEventListener('abort', onAbort, { once: true });
      void wakeup.wait().then(() => {
        clearTimeout(timeout);
        signal.removeEventListener('abort', onAbort);
        resolve('wakeup');
      });
    });
    if (woken === 'wakeup') return;
    if (signal.aborted || Date.now() >= deadline || !options.refetch) continue;
    await callRefetch(options);
  }
}

function parseSseFrames(buffer: string): { frames: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const frames: string[] = [];
  let start = 0;
  while (true) {
    const index = normalized.indexOf('\n\n', start);
    if (index === -1) break;
    frames.push(normalized.slice(start, index));
    start = index + 2;
  }
  return { frames, rest: normalized.slice(start) };
}

function readStringField(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

function readNullableStringField(
  record: Record<string, unknown>,
  ...keys: string[]
): string | null | undefined {
  for (const key of keys) {
    if (!(key in record)) continue;
    const value = record[key];
    if (typeof value === 'string') return value;
    if (value === null) return null;
  }
  return undefined;
}

function readBooleanField(record: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
  }
  return undefined;
}

function readStringArrayField(record: Record<string, unknown>, ...keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }
  }
  return undefined;
}

function readNumberField(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function normalizeSubscriptionEvent<TView>(value: unknown): SubscriptionEvent<TView> | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as Record<string, unknown>;
  const eventType = readStringField(event, 'event_type', 'eventType', 'kind');
  if (!eventType) return null;

  const normalized: SubscriptionEvent<TView> = {
    event_type: eventType,
  };
  const sequence = readNumberField(event, 'sequence');
  if (sequence !== undefined) normalized.sequence = sequence;
  const instanceId = readStringField(event, 'instance_id', 'instanceId');
  if (instanceId !== undefined) normalized.instance_id = instanceId;
  const scopeId = readStringField(event, 'scope_id', 'scopeId');
  if (scopeId !== undefined) normalized.scope_id = scopeId;
  const stateVersion = readNumberField(event, 'state_version', 'stateVersion');
  if (stateVersion !== undefined) normalized.state_version = stateVersion;
  const clientMutationId = readNullableStringField(event, 'client_mutation_id', 'clientMutationId');
  if (clientMutationId !== undefined) normalized.client_mutation_id = clientMutationId;

  const data = readNullableStringField(event, 'data', 'data_hex', 'dataHex');
  if (data !== undefined) normalized.data = data;
  const topics = readStringArrayField(event, 'topics');
  if (topics !== undefined) normalized.topics = topics;
  const topic0 = readNullableStringField(event, 'topic0');
  const topic1 = readNullableStringField(event, 'topic1');
  const topic2 = readNullableStringField(event, 'topic2');
  const topic3 = readNullableStringField(event, 'topic3');
  if (topic0 !== undefined) normalized.topic0 = topic0;
  if (topic1 !== undefined) normalized.topic1 = topic1;
  if (topic2 !== undefined) normalized.topic2 = topic2;
  if (topic3 !== undefined) normalized.topic3 = topic3;
  if (!normalized.topics) {
    const derivedTopics = [topic0, topic1, topic2, topic3].filter(
      (topic): topic is string => typeof topic === 'string',
    );
    if (derivedTopics.length > 0) normalized.topics = derivedTopics;
  }
  const queryable = readBooleanField(event, 'queryable');
  if (queryable !== undefined) normalized.queryable = queryable;
  const exposure = readNullableStringField(event, 'exposure');
  if (exposure !== undefined) normalized.exposure = exposure;
  const recipientField = readNullableStringField(event, 'recipient_field', 'recipientField');
  if (recipientField !== undefined) normalized.recipient_field = recipientField;
  const indexes = readStringArrayField(event, 'indexes');
  if (indexes !== undefined) normalized.indexes = indexes;

  if ('view_json' in event) {
    normalized.view_json = event.view_json as TView;
  } else if ('viewJson' in event) {
    normalized.view_json = event.viewJson as TView;
  }
  if ('payload' in event) {
    normalized.payload = event.payload;
  } else if (!('view_json' in normalized) && !('data' in normalized)) {
    normalized.payload = event;
  }

  if (!('view_json' in normalized) && !('payload' in normalized) && !('data' in normalized)) return null;
  return normalized;
}

function hasEventType(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.event_type === 'string' ||
    typeof record.eventType === 'string' ||
    typeof record.kind === 'string'
  );
}

function applyFrameEventType(parsedEvent: unknown, frameEventType: string | null): unknown {
  if (!frameEventType || hasEventType(parsedEvent)) return parsedEvent;
  if (!parsedEvent || typeof parsedEvent !== 'object') {
    return {
      event_type: frameEventType,
      payload: parsedEvent,
    };
  }
  const record = parsedEvent as Record<string, unknown>;
  return {
    ...record,
    event_type: frameEventType,
    payload: 'payload' in record ? record.payload : parsedEvent,
  };
}

function parseSseFrame(frame: string): { id: string | null; event: string | null; data: string | null } {
  const dataLines: string[] = [];
  let id: string | null = null;
  let event: string | null = null;
  for (const line of frame.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? '' : line.slice(separator + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') {
      dataLines.push(value);
    } else if (field === 'id') {
      id = value;
    } else if (field === 'event') {
      event = value || null;
    }
  }
  return { id, event, data: dataLines.length > 0 ? dataLines.join('\n') : null };
}

interface LastEventIdRef {
  value: string | undefined;
}

const STALL_SENTINEL: unique symbol = Symbol('stall');

async function readSseStream<TView, TSnapshot>(
  response: Response,
  options: SubscribeOptions<TView, TSnapshot>,
  signal: AbortSignal,
  lastSequenceByInstance: Map<string, number>,
  lastVersionByInstance: Map<string, number>,
  lastEventIdRef: LastEventIdRef,
  keepAliveTimeoutMs: number,
): Promise<void> {
  if (!response.body) {
    throw new ArcanaNetworkError('Subscription response did not include a readable stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (!signal.aborted) {
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const stallPromise = new Promise<typeof STALL_SENTINEL>((resolve) => {
      stallTimer = setTimeout(() => resolve(STALL_SENTINEL), keepAliveTimeoutMs);
    });
    const raceResult = await Promise.race([reader.read(), stallPromise]);
    if (stallTimer) clearTimeout(stallTimer);

    if (raceResult === STALL_SENTINEL) {
      try {
        await reader.cancel();
      } catch {
        // ignore — already cancelled or closed
      }
      throw new ArcanaNetworkError(
        'Subscription stream stalled (no data within keep-alive window)',
      );
    }

    const { done, value } = raceResult;
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseFrames(buffer);
    buffer = parsed.rest;

    for (const frame of parsed.frames) {
      const { id, event: frameEventType, data } = parseSseFrame(frame);
      if (id) lastEventIdRef.value = id;
      if (!data || data === 'ping') continue;

      let parsedEvent: unknown;
      try {
        parsedEvent = JSON.parse(data);
      } catch (error) {
        options.onError?.(error);
        continue;
      }

      const event = normalizeSubscriptionEvent<TView>(
        applyFrameEventType(parsedEvent, frameEventType),
      );
      if (!event) {
        options.onError?.(new ArcanaNetworkError('Ignoring malformed subscription event'));
        continue;
      }

      if (isResyncEvent(event)) {
        options.onStatusChange?.('resync');
        try {
          await callRefetch(options);
        } catch (refetchError) {
          options.onError?.(refetchError);
        }
        continue;
      }

      if (isDuplicateEvent(event, lastSequenceByInstance, lastVersionByInstance)) {
        continue;
      }
      options.onEvent?.(event);
      if ('view_json' in event) {
        options.onView?.(event.view_json as TView, event);
      }
    }
  }
}

export class SubscriptionsModule {
  constructor(
    private readonly api: AxiosInstance,
    private readonly getToken: () => string | null,
    private readonly tokenRefresher?: TokenRefresher,
  ) {}

  subscribeInstance<TView = unknown, TSnapshot = unknown>(
    scopeId: string,
    instanceId: string,
    options: SubscribeInstanceOptions<TView, TSnapshot> = {},
  ): SubscriptionHandle {
    return this.subscribe<TView, TSnapshot>({ ...options, scopeId, instanceId });
  }

  subscribeScope<TView = unknown, TSnapshot = unknown>(
    scopeId: string,
    options: SubscribeScopeOptions<TView, TSnapshot> = {},
  ): SubscriptionHandle {
    return this.subscribe<TView, TSnapshot>({ ...options, scopeId });
  }

  subscribe<TView = unknown, TSnapshot = unknown>(
    options: SubscribeOptions<TView, TSnapshot>,
  ): SubscriptionHandle {
    const controller = new AbortController();
    const externalSignal = options.signal;
    if (externalSignal?.aborted) {
      controller.abort();
    } else {
      externalSignal?.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const lastSequenceByInstance = new Map<string, number>();
    const lastVersionByInstance = new Map<string, number>();
    const initialKey = options.instanceId || '__scope__';
    if (options.initialSequence !== undefined) {
      lastSequenceByInstance.set(initialKey, options.initialSequence);
    }
    if (options.initialStateVersion !== undefined) {
      lastVersionByInstance.set(initialKey, options.initialStateVersion);
    }
    const lastEventIdRef: LastEventIdRef = {
      value: options.lastEventId,
    };

    const wakeup = createWakeup();
    const detachLifecycle = attachLifecycleWakeups(wakeup, {
      reconnectOnOnline: options.reconnectOnOnline !== false,
      reconnectOnVisible: options.reconnectOnVisible !== false,
    });

    void this.runSubscriptionLoop(
      options,
      controller.signal,
      lastSequenceByInstance,
      lastVersionByInstance,
      lastEventIdRef,
      wakeup,
    ).finally(detachLifecycle);

    return {
      close: () => controller.abort(),
      get closed() {
        return controller.signal.aborted;
      },
    };
  }

  private async runSubscriptionLoop<TView, TSnapshot>(
    options: SubscribeOptions<TView, TSnapshot>,
    signal: AbortSignal,
    lastSequenceByInstance: Map<string, number>,
    lastVersionByInstance: Map<string, number>,
    lastEventIdRef: LastEventIdRef,
    wakeup: Wakeup,
  ): Promise<void> {
    let attempt = 0;
    let didOpen = false;
    const shouldReconnect = options.reconnect !== false;

    while (!signal.aborted) {
      try {
        options.onStatusChange?.(didOpen ? 'reconnecting' : 'connecting');
        if (didOpen) {
          await callRefetch(options);
        }
        await this.connectOnce(
          options,
          signal,
          lastSequenceByInstance,
          lastVersionByInstance,
          lastEventIdRef,
        );
        if (!shouldReconnect || signal.aborted) break;
        attempt += 1;
      } catch (error) {
        if (signal.aborted || isAbortError(error)) break;
        options.onStatusChange?.('error');
        options.onError?.(error);
        if (!shouldReconnect) break;
        attempt += 1;
      }

      didOpen = true;
      const delayMs = nextBackoffDelay(attempt, options);
      options.onStatusChange?.('reconnecting');
      await waitWithFallbackPolling(delayMs, options, signal, wakeup);
    }

    options.onStatusChange?.('closed');
  }

  private async connectOnce<TView, TSnapshot>(
    options: SubscribeOptions<TView, TSnapshot>,
    signal: AbortSignal,
    lastSequenceByInstance: Map<string, number>,
    lastVersionByInstance: Map<string, number>,
    lastEventIdRef: LastEventIdRef,
  ): Promise<void> {
    if (typeof fetch !== 'function') {
      throw new ArcanaNetworkError('Global fetch is required for subscriptions');
    }

    await this.tokenRefresher?.ensureAccessToken?.();
    let response = await this.openFetch(options, signal, lastEventIdRef);
    if (response.status === 401 || response.status === 403) {
      const refreshed = await this.tokenRefresher?.refreshTokens?.();
      if (refreshed) {
        response = await this.openFetch(options, signal, lastEventIdRef);
      }
    }
    if (!response.ok) {
      throw new ArcanaApiError(response.status, `Subscription failed with status ${response.status}`);
    }

    options.onStatusChange?.('open');

    const keepAliveTimeoutMs = normalizePositiveNumber(
      options.keepAliveTimeoutMs,
      DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
    );
    await readSseStream(
      response,
      options,
      signal,
      lastSequenceByInstance,
      lastVersionByInstance,
      lastEventIdRef,
      keepAliveTimeoutMs,
    );
  }

  private async openFetch<TView, TSnapshot>(
    options: SubscribeOptions<TView, TSnapshot>,
    signal: AbortSignal,
    lastEventIdRef: LastEventIdRef,
  ): Promise<Response> {
    const headers = new Headers({ Accept: 'text/event-stream' });
    const token = this.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (lastEventIdRef.value) {
      headers.set('Last-Event-ID', lastEventIdRef.value);
    }

    return fetch(buildSubscriptionUrl(String(this.api.defaults.baseURL), options), {
      method: 'GET',
      headers,
      signal,
    });
  }
}

export type {
  SubscribeInstanceOptions,
  SubscribeOptions,
  SubscribeScopeOptions,
  SubscriptionEvent,
  SubscriptionHandle,
  SubscriptionStatus,
} from './types.js';

export { connectWebSocket } from './ws.js';
export type { WsConnectOptions, WsTopic, WsTopicKind } from './ws.js';
