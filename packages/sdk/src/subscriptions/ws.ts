/**
 * WebSocket subscription client.
 *
 * Multiplexes multiple topics over a single connection, matching the server
 * handler in `arcana-api/src/routes/subscriptions.rs::ws_subscribe`.
 *
 * Frame protocol (JSON text frames):
 *
 *   C -> S:
 *     { "type": "subscribe", "topics": [WsTopic, ...] }
 *     { "type": "unsubscribe", "topic": WsTopic }
 *     { "type": "ping" }
 *
 *   S -> C:
 *     { "type": "event", "topic": WsTopic, "payload": SubscriptionEvent }
 *     { "type": "resync", "topic": WsTopic, "reason": string }
 *     { "type": "pong" }
 *     { "type": "error", "code": string, "message": string }
 *
 * Each topic is dedup'd by (sequence, state_version) using the same logic as
 * the SSE client. The handle exposed by `connectWebSocket` matches the shape
 * of `SubscriptionHandle` so callers can use either transport interchangeably.
 */

import type {
  SubscriptionEvent,
  SubscriptionHandle,
  SubscriptionStatus,
} from './types.js';

const DEFAULT_MIN_RECONNECT_DELAY_MS = 500;
const DEFAULT_MAX_RECONNECT_DELAY_MS = 30_000;
const DEFAULT_RECONNECT_JITTER_RATIO = 0.25;
const PING_INTERVAL_MS = 15_000;

export type WsTopicKind = 'instance' | 'scope';

export interface WsTopic {
  kind: WsTopicKind;
  scope_id: string;
  instance_id?: string;
  after_sequence?: number;
}

export interface WsConnectOptions<TView = unknown> {
  /**
   * Full WebSocket URL (e.g. `ws://localhost:3003/subscriptions/ws`).
   * `wss://` is supported and recommended in production.
   */
  url: string;
  /**
   * Returns the current bearer token. May be called multiple times across
   * reconnects. The token is sent as the `arcana_token` query parameter on the
   * upgrade request — browsers cannot set Authorization headers on WebSocket
   * handshakes. If the server's auth middleware only accepts the Authorization
   * header, place a thin proxy in front of it or supply a token-in-cookie auth
   * path.
   */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Topics to subscribe to immediately after connection. */
  topics: WsTopic[];
  reconnect?: boolean;
  minReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  reconnectJitterRatio?: number;
  /** Optional WebSocket constructor — useful for tests/Node/`ws` polyfill. */
  WebSocketImpl?: typeof WebSocket;
  onEvent?: (event: SubscriptionEvent<TView>, topic: WsTopic) => void;
  onView?: (view: TView, event: SubscriptionEvent<TView>, topic: WsTopic) => void;
  onResync?: (topic: WsTopic, reason: string) => void;
  onError?: (error: unknown) => void;
  onStatusChange?: (status: SubscriptionStatus) => void;
}

interface DedupKey {
  lastSequence?: number;
  lastVersion?: number;
}

function topicKey(t: WsTopic): string {
  return t.instance_id ? `i:${t.scope_id}:${t.instance_id}` : `s:${t.scope_id}`;
}

function nextBackoffDelay<TView>(attempt: number, options: WsConnectOptions<TView>): number {
  const minDelay = Math.max(1, Number(options.minReconnectDelayMs ?? DEFAULT_MIN_RECONNECT_DELAY_MS));
  const maxDelay = Math.max(minDelay, Number(options.maxReconnectDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS));
  const jitterRatio = Math.max(0, Number(options.reconnectJitterRatio ?? DEFAULT_RECONNECT_JITTER_RATIO));
  const exponential = Math.min(maxDelay, minDelay * 2 ** Math.max(0, attempt - 1));
  const jitter = exponential * jitterRatio * Math.random();
  return Math.min(maxDelay, Math.floor(exponential + jitter));
}

function isDuplicate(
  event: SubscriptionEvent,
  key: string,
  state: Map<string, DedupKey>,
): boolean {
  const entry = state.get(key) ?? {};
  const seq = Number(event.sequence);
  if (Number.isFinite(seq)) {
    if (entry.lastSequence !== undefined && seq <= entry.lastSequence) return true;
  }
  const ver = Number(event.state_version);
  if (Number.isFinite(ver)) {
    if (entry.lastVersion !== undefined && ver <= entry.lastVersion) return true;
  }
  if (Number.isFinite(seq)) entry.lastSequence = seq;
  if (Number.isFinite(ver)) entry.lastVersion = ver;
  state.set(key, entry);
  return false;
}

function buildAuthedUrl(rawUrl: string, token: string | null | undefined): string {
  if (!token) return rawUrl;
  try {
    const url = new URL(rawUrl);
    url.searchParams.set('arcana_token', token);
    return url.toString();
  } catch {
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}arcana_token=${encodeURIComponent(token)}`;
  }
}

function pickWebSocketImpl<TView>(
  options: WsConnectOptions<TView>,
): typeof WebSocket | undefined {
  if (options.WebSocketImpl) return options.WebSocketImpl;
  if (typeof WebSocket !== 'undefined') return WebSocket;
  return undefined;
}

export function connectWebSocket<TView = unknown>(
  options: WsConnectOptions<TView>,
): SubscriptionHandle {
  let closedByUser = false;
  let attempt = 0;
  let socket: WebSocket | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  const dedup = new Map<string, DedupKey>();
  // Track per-topic resume cursors so reconnects don't drop events with the
  // same `after_sequence` the caller originally passed.
  const resumeCursor = new Map<string, number>();
  for (const t of options.topics) {
    if (typeof t.after_sequence === 'number') {
      resumeCursor.set(topicKey(t), t.after_sequence);
    }
  }

  const WsImpl = pickWebSocketImpl(options);
  if (!WsImpl) {
    queueMicrotask(() => {
      options.onError?.(new Error('No WebSocket implementation available in this environment'));
      options.onStatusChange?.('closed');
    });
    return {
      close: () => {
        closedByUser = true;
      },
      get closed() {
        return true;
      },
    };
  }

  const open = async (): Promise<void> => {
    if (closedByUser) return;

    let token: string | null | undefined = null;
    try {
      token = options.getToken ? await options.getToken() : null;
    } catch (err) {
      options.onError?.(err);
    }

    const url = buildAuthedUrl(options.url, token ?? null);
    options.onStatusChange?.(attempt === 0 ? 'connecting' : 'reconnecting');

    let ws: WebSocket;
    try {
      ws = new WsImpl(url);
    } catch (err) {
      options.onError?.(err);
      scheduleReconnect();
      return;
    }
    socket = ws;

    ws.onopen = () => {
      attempt = 0;
      options.onStatusChange?.('open');
      const subscribeTopics = options.topics.map((t) => ({
        ...t,
        after_sequence: resumeCursor.get(topicKey(t)) ?? t.after_sequence,
      }));
      try {
        ws.send(JSON.stringify({ type: 'subscribe', topics: subscribeTopics }));
      } catch (err) {
        options.onError?.(err);
      }
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          /* socket already closing */
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (msgEvent: MessageEvent) => {
      const raw = typeof msgEvent.data === 'string' ? msgEvent.data : null;
      if (!raw) return;
      let frame: any;
      try {
        frame = JSON.parse(raw);
      } catch (err) {
        options.onError?.(err);
        return;
      }
      switch (frame?.type) {
        case 'event': {
          const topic: WsTopic = frame.topic;
          const event: SubscriptionEvent<TView> = frame.payload;
          if (!topic || !event) return;
          const key = topicKey(topic);
          if (isDuplicate(event, key, dedup)) return;
          if (typeof event.sequence === 'number') {
            resumeCursor.set(key, event.sequence);
          }
          options.onEvent?.(event, topic);
          if ('view_json' in event) {
            options.onView?.(event.view_json as TView, event, topic);
          }
          return;
        }
        case 'resync': {
          const topic: WsTopic = frame.topic;
          options.onStatusChange?.('resync');
          options.onResync?.(topic, String(frame.reason ?? 'unknown'));
          return;
        }
        case 'pong':
          return;
        case 'error':
          options.onError?.(
            new Error(`Server error [${frame.code ?? 'unknown'}]: ${frame.message ?? ''}`),
          );
          return;
        default:
          return;
      }
    };

    ws.onerror = (err) => {
      options.onError?.(err);
    };

    ws.onclose = () => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      socket = null;
      if (closedByUser || options.reconnect === false) {
        options.onStatusChange?.('closed');
        return;
      }
      attempt += 1;
      scheduleReconnect();
    };
  };

  const scheduleReconnect = (): void => {
    if (closedByUser || options.reconnect === false) {
      options.onStatusChange?.('closed');
      return;
    }
    const delay = nextBackoffDelay(attempt, options);
    options.onStatusChange?.('reconnecting');
    setTimeout(() => {
      void open();
    }, delay);
  };

  void open();

  return {
    close: () => {
      closedByUser = true;
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
    },
    get closed() {
      return closedByUser;
    },
  };
}
