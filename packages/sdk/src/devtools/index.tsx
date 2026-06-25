import React, { useEffect, useMemo, useState } from 'react';
import { decode } from '@msgpack/msgpack';
import {
  decodeActionResponseData,
  decodeArgsBytes,
  decodeHexBytes,
  decodeMsgpackResponse,
  decodeViewResponseData,
} from '../utils/bytes.js';

export type ArcanaDevtoolsStatus = 'pending' | 'ok' | 'error';
export type ArcanaDevtoolsRequestKind =
  | 'action'
  | 'view'
  | 'auth'
  | 'scope'
  | 'capability'
  | 'transaction'
  | 'event'
  | 'subscription'
  | 'bank'
  | 'config'
  | 'other';

export interface ArcanaDevtoolsDecodedBody {
  format: 'msgpack' | 'json' | 'text' | 'bytes' | 'empty' | 'unavailable';
  value?: unknown;
  error?: string;
  byteLength?: number;
}

export interface ArcanaDevtoolsRequestEntry {
  id: number;
  method: string;
  url: string;
  path: string;
  kind: ArcanaDevtoolsRequestKind;
  status: ArcanaDevtoolsStatus;
  statusCode?: number;
  startedAt: number;
  durationMs?: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: ArcanaDevtoolsDecodedBody;
  responseBody: ArcanaDevtoolsDecodedBody;
  summary: string;
  txHashes: string[];
  error?: string;
}

export interface ArcanaDeveloperToolsProps {
  apiUrl?: string;
  /**
   * Defaults to enabled in development and disabled when common production
   * environment flags are detected. Pass an explicit boolean to force behavior.
   */
  enabled?: boolean;
  maxEntries?: number;
  explorerUrl?: string;
  defaultOpen?: boolean;
}

type RequestDraft = {
  id: number;
  method: string;
  url: string;
  startedAt: number;
  requestHeaders: Record<string, string>;
  requestBody: ArcanaDevtoolsDecodedBody;
};

type MonitorState = {
  installed: boolean;
  entries: ArcanaDevtoolsRequestEntry[];
  nextId: number;
  maxEntries: number;
  apiUrl?: string;
  originalFetch?: typeof window.fetch;
  originalOpen?: typeof XMLHttpRequest.prototype.open;
  originalSend?: typeof XMLHttpRequest.prototype.send;
  originalSetRequestHeader?: typeof XMLHttpRequest.prototype.setRequestHeader;
  originalWebSocket?: typeof window.WebSocket;
};

type XhrWithArcanaDevtools = XMLHttpRequest & {
  __arcanaDevtools?: RequestDraft;
};

const MONITOR_KEY = '__arcanaDeveloperToolsMonitor';
const EVENT_NAME = 'arcana:devtools-request';
const TX_HASH_PATTERN = /0x[a-fA-F0-9]{64}/g;
const REQUEST_KINDS: Array<'all' | ArcanaDevtoolsRequestKind> = [
  'all',
  'action',
  'view',
  'auth',
  'scope',
  'capability',
  'transaction',
  'event',
  'subscription',
  'bank',
  'config',
  'other',
];

function defaultEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const explicit = window.localStorage?.getItem('arcana:devtools');
  if (explicit === '1' || explicit === 'true') return true;
  if (explicit === '0' || explicit === 'false') return false;

  const meta = (typeof import.meta !== 'undefined' ? import.meta : undefined) as
    | { env?: Record<string, unknown> }
    | undefined;
  if (meta?.env?.PROD === true) return false;
  if (meta?.env?.DEV === true) return true;
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return false;
  return true;
}

function monitorState(maxEntries: number, apiUrl?: string): MonitorState {
  const target = window as unknown as Record<string, MonitorState | undefined>;
  if (!target[MONITOR_KEY]) {
    target[MONITOR_KEY] = {
      installed: false,
      entries: [],
      nextId: 1,
      maxEntries,
    };
  }
  target[MONITOR_KEY]!.maxEntries = maxEntries;
  target[MONITOR_KEY]!.apiUrl = apiUrl;
  return target[MONITOR_KEY]!;
}

function collectTxHashes(value: unknown): string[] {
  const text = typeof value === 'string' ? value : safeJson(value);
  return Array.from(new Set(text.match(TX_HASH_PATTERN) || []));
}

function publish(state: MonitorState, entry: ArcanaDevtoolsRequestEntry): void {
  const index = state.entries.findIndex((item) => item.id === entry.id);
  if (index >= 0) {
    state.entries = [
      entry,
      ...state.entries.slice(0, index),
      ...state.entries.slice(index + 1),
    ].slice(0, state.maxEntries);
  } else {
    state.entries = [entry, ...state.entries].slice(0, state.maxEntries);
  }
  window.dispatchEvent(new CustomEvent<ArcanaDevtoolsRequestEntry>(EVENT_NAME, { detail: entry }));
}

function clearEntries(state: MonitorState): void {
  state.entries = [];
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function headerRecord(headers: Headers | Record<string, unknown> | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key.toLowerCase()] = value;
    });
    return record;
  }
  return Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function requestDetails(input: RequestInfo | URL, init?: RequestInit): {
  method: string;
  url: string;
  headers: Record<string, string>;
} {
  if (input instanceof Request) {
    return {
      method: (init?.method || input.method || 'GET').toUpperCase(),
      url: input.url,
      headers: {
        ...headerRecord(input.headers),
        ...headerRecord(init?.headers as Headers | Record<string, unknown> | undefined),
      },
    };
  }
  return {
    method: (init?.method || 'GET').toUpperCase(),
    url: String(input),
    headers: headerRecord(init?.headers as Headers | Record<string, unknown> | undefined),
  };
}

function isKnownArcanaPath(pathname: string): boolean {
  return pathname.startsWith('/auth') ||
    pathname.startsWith('/instances') ||
    pathname.startsWith('/scopes') ||
    pathname.startsWith('/capabilities') ||
    pathname.startsWith('/transactions') ||
    pathname.startsWith('/events') ||
    pathname.startsWith('/subscriptions') ||
    pathname.startsWith('/bank') ||
    pathname.startsWith('/config');
}

function isArcanaUrl(url: string, apiUrl?: string): boolean {
  try {
    const parsed = new URL(url, window.location.href);
    if (apiUrl) {
      const api = new URL(apiUrl, window.location.href);
      if (parsed.origin === api.origin) return true;
    }
    return isKnownArcanaPath(parsed.pathname);
  } catch {
    return isKnownArcanaPath(url);
  }
}

function pathFromUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.href);
    redactUrlParams(parsed);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function redactUrlParams(url: URL): void {
  for (const key of ['arcana_token', 'access_token', 'token', 'jwt']) {
    if (url.searchParams.has(key)) {
      url.searchParams.set(key, 'redacted');
    }
  }
}

function classifyRequest(method: string, path: string): ArcanaDevtoolsRequestKind {
  if (/\/instances\/[^/]+\/actions(?:\?|$)/.test(path)) return 'action';
  if (/\/instances\/[^/]+\/view(?:\?|$)/.test(path)) return 'view';
  if (path.startsWith('/auth')) return 'auth';
  if (path.startsWith('/scopes')) return 'scope';
  if (path.startsWith('/capabilities')) return 'capability';
  if (path.startsWith('/transactions')) return 'transaction';
  if (path.startsWith('/events')) return 'event';
  if (path.startsWith('/subscriptions')) return 'subscription';
  if (path.startsWith('/bank')) return 'bank';
  if (path.startsWith('/config')) return 'config';
  if (method === 'POST' && path.includes('/view')) return 'view';
  return 'other';
}

function byteLength(value: BodyInit | XMLHttpRequestBodyInit | Document | null | undefined): number | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value.length;
  if (value instanceof Blob) return value.size;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (value instanceof FormData || value instanceof URLSearchParams || value instanceof Document) return undefined;
  return undefined;
}

async function bodyFromFetch(input: RequestInfo | URL, init?: RequestInit): Promise<ArcanaDevtoolsDecodedBody> {
  if (init?.body) return await decodeBody(init.body, headerRecord(init.headers as Headers | Record<string, unknown> | undefined));
  if (input instanceof Request) {
    try {
      return await decodeBody(await input.clone().arrayBuffer(), headerRecord(input.headers));
    } catch (error) {
      return { format: 'unavailable', error: errorMessage(error) };
    }
  }
  return { format: 'empty' };
}

async function decodeResponseBody(response: Response): Promise<ArcanaDevtoolsDecodedBody> {
  try {
    const bytes = await response.clone().arrayBuffer();
    return decodeBytes(new Uint8Array(bytes), headerRecord(response.headers));
  } catch (error) {
    return { format: 'unavailable', error: errorMessage(error) };
  }
}

function streamingResponseBody(headers: Record<string, string>): ArcanaDevtoolsDecodedBody | undefined {
  const contentType = (headers['content-type'] || '').toLowerCase();
  if (contentType.includes('text/event-stream')) {
    return { format: 'text', value: '[event stream open]' };
  }
  return undefined;
}

async function decodeBody(
  body: BodyInit | XMLHttpRequestBodyInit | Document | null | undefined,
  headers: Record<string, string>,
): Promise<ArcanaDevtoolsDecodedBody> {
  if (!body) return { format: 'empty' };
  if (typeof body === 'string') return decodeText(body, headers);
  if (body instanceof Blob) return decodeBytes(new Uint8Array(await body.arrayBuffer()), headers);
  if (body instanceof ArrayBuffer) return decodeBytes(new Uint8Array(body), headers);
  if (ArrayBuffer.isView(body)) return decodeBytes(new Uint8Array(body.buffer, body.byteOffset, body.byteLength), headers);
  if (body instanceof URLSearchParams) return decodeText(body.toString(), headers);
  if (body instanceof FormData) return { format: 'unavailable', value: '[FormData]' };
  if (body instanceof Document) return { format: 'unavailable', value: '[Document]' };
  return { format: 'unavailable', byteLength: byteLength(body) };
}

function decodeText(text: string, headers: Record<string, string>): ArcanaDevtoolsDecodedBody {
  if (text.length === 0) return { format: 'empty' };
  const contentType = (headers['content-type'] || '').toLowerCase();
  if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      return { format: 'json', value: enhanceArcanaPayload(JSON.parse(text)) };
    } catch {
      return { format: 'text', value: text };
    }
  }
  return { format: 'text', value: text };
}

function decodeBytes(bytes: Uint8Array, headers: Record<string, string>): ArcanaDevtoolsDecodedBody {
  if (bytes.byteLength === 0) return { format: 'empty', byteLength: 0 };
  const contentType = (headers['content-type'] || '').toLowerCase();
  const isMsgpack = contentType.includes('application/msgpack') || contentType.includes('application/x-msgpack');
  if (isMsgpack) {
    try {
      return {
        format: 'msgpack',
        value: enhanceArcanaPayload(decode(bytes, { useMap: false } as never)),
        byteLength: bytes.byteLength,
      };
    } catch (error) {
      return { format: 'msgpack', error: errorMessage(error), byteLength: bytes.byteLength };
    }
  }

  const text = new TextDecoder().decode(bytes);
  if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      return { format: 'json', value: enhanceArcanaPayload(JSON.parse(text)), byteLength: bytes.byteLength };
    } catch {
      return { format: 'text', value: text, byteLength: bytes.byteLength };
    }
  }
  try {
    return { format: 'msgpack', value: enhanceArcanaPayload(decodeMsgpackResponse(bytes)), byteLength: bytes.byteLength };
  } catch {
    return { format: 'bytes', value: `[${bytes.byteLength} bytes]`, byteLength: bytes.byteLength };
  }
}

function enhanceArcanaPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(enhanceArcanaPayload);
  if (!value || typeof value !== 'object') return value;

  const record = value as Record<string, unknown>;
  const enhanced: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    enhanced[key] = enhanceArcanaPayload(item);
  }

  const argsBytes = record.args_bytes ?? record.argsBytes;
  if (typeof argsBytes === 'string' && argsBytes.length > 0) {
    try {
      enhanced.args_decoded = decodeArgsBytes(argsBytes);
    } catch (error) {
      enhanced.args_decoded_error = errorMessage(error);
    }
  }

  const resultHex = record.resultHex ?? record.result_hex;
  if (typeof resultHex === 'string' && resultHex.length > 0) {
    try {
      enhanced.action_decoded = decodeActionResponseData(record);
    } catch (error) {
      enhanced.action_decoded_error = errorMessage(error);
    }
    try {
      enhanced.view_decoded = decodeViewResponseData(record);
    } catch (error) {
      enhanced.view_decoded_error = errorMessage(error);
    }
    try {
      enhanced.result_bytes = `${decodeHexBytes(resultHex).byteLength} bytes`;
    } catch {
      // Keep the original result hex visible.
    }
  }
  return enhanced;
}

function createPendingEntry(draft: RequestDraft): ArcanaDevtoolsRequestEntry {
  const path = pathFromUrl(draft.url);
  const kind = classifyRequest(draft.method, path);
  return {
    ...draft,
    path,
    kind,
    status: 'pending',
    responseHeaders: {},
    responseBody: { format: 'empty' },
    summary: summaryFor(kind, draft.method, path, draft.requestBody),
    txHashes: [],
  };
}

function finishEntry(
  entry: ArcanaDevtoolsRequestEntry,
  status: ArcanaDevtoolsStatus,
  responseBody: ArcanaDevtoolsDecodedBody,
  responseHeaders: Record<string, string>,
  statusCode?: number,
  error?: string,
): ArcanaDevtoolsRequestEntry {
  const semanticError = error ?? arcanaSemanticError(responseBody.value);
  return {
    ...entry,
    status: semanticError ? 'error' : status,
    statusCode,
    responseHeaders,
    responseBody,
    durationMs: Date.now() - entry.startedAt,
    txHashes: collectTxHashes(responseBody.value ?? responseBody.error ?? ''),
    error: semanticError,
  };
}

function arcanaSemanticError(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const status = typeof record.status === 'number' ? record.status : undefined;
  const data = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : undefined;
  const topLevelError = errorValue(record.error);
  const dataError = errorValue(data?.error);
  const dataErrorCode = errorValue(data?.error_code ?? data?.errorCode);
  const dataReason = errorValue(data?.reason);
  if (topLevelError) return topLevelError;
  if (dataError) return dataError;
  if (dataErrorCode) return dataErrorCode;
  if (dataReason) return dataReason;
  if (status !== undefined && status >= 400) {
    return typeof record.message === 'string' ? record.message : `Arcana API status ${status}`;
  }
  return undefined;
}

function errorValue(value: unknown): string | undefined {
  if (value === null || value === undefined || value === false) return undefined;
  if (typeof value === 'string') return value.length > 0 ? value : undefined;
  return safeJson(value);
}

function summaryFor(
  kind: ArcanaDevtoolsRequestKind,
  method: string,
  path: string,
  body: ArcanaDevtoolsDecodedBody,
): string {
  const value = body.value;
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  const entrypoint = typeof record?.entrypoint === 'string' ? record.entrypoint : undefined;
  const operation = typeof record?.operation === 'string' ? record.operation : undefined;
  const instance = typeof record?.instance_id === 'string' ? record.instance_id : undefined;
  if (kind === 'action') return `${entrypoint || operation || 'action'}${instance ? ` on ${shortId(instance)}` : ''}`;
  if (kind === 'view') return `${entrypoint || 'view'}${instance ? ` on ${shortId(instance)}` : ''}`;
  return `${method} ${path}`;
}

function shortId(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function statusLabel(entry: ArcanaDevtoolsRequestEntry): string {
  if (entry.status === 'error') return entry.statusCode ? `${entry.statusCode} error` : 'error';
  return entry.statusCode ? String(entry.statusCode) : entry.status;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2);
  } catch {
    return String(value);
  }
}

export function installArcanaDeveloperToolsMonitor(maxEntries: number = 100, apiUrl?: string): void {
  if (typeof window === 'undefined') return;
  const state = monitorState(maxEntries, apiUrl);
  if (state.installed) return;

  state.originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const details = requestDetails(input, init);
    if (!isArcanaUrl(details.url, state.apiUrl)) {
      return state.originalFetch!(input, init);
    }

    const draft: RequestDraft = {
      id: state.nextId++,
      method: details.method,
      url: details.url,
      startedAt: Date.now(),
      requestHeaders: details.headers,
      requestBody: await bodyFromFetch(input, init),
    };
    const entry = createPendingEntry(draft);
    publish(state, entry);
    try {
      const response = await state.originalFetch!(input, init);
      const responseHeaders = headerRecord(response.headers);
      const responseBody = streamingResponseBody(responseHeaders) ?? await decodeResponseBody(response);
      publish(state, finishEntry(
        entry,
        response.ok ? 'ok' : 'error',
        responseBody,
        responseHeaders,
        response.status,
      ));
      return response;
    } catch (error) {
      publish(state, finishEntry(entry, 'error', { format: 'empty' }, {}, undefined, errorMessage(error)));
      throw error;
    }
  };

  state.originalOpen = XMLHttpRequest.prototype.open;
  state.originalSend = XMLHttpRequest.prototype.send;
  state.originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  state.originalWebSocket = window.WebSocket;

  XMLHttpRequest.prototype.open = function patchedOpen(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ): void {
    const xhr = this as XhrWithArcanaDevtools;
    xhr.__arcanaDevtools = {
      id: state.nextId++,
      method: method.toUpperCase(),
      url: String(url),
      startedAt: Date.now(),
      requestHeaders: {},
      requestBody: { format: 'empty' },
    };
    return state.originalOpen!.call(this, method, url, async ?? true, username ?? undefined, password ?? undefined);
  };

  XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(name: string, value: string): void {
    const xhr = this as XhrWithArcanaDevtools;
    if (xhr.__arcanaDevtools) xhr.__arcanaDevtools.requestHeaders[name.toLowerCase()] = value;
    return state.originalSetRequestHeader!.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null): void {
    const xhr = this as XhrWithArcanaDevtools;
    const draft = xhr.__arcanaDevtools;
    if (!draft || !isArcanaUrl(draft.url, state.apiUrl)) {
      return state.originalSend!.call(this, body ?? null);
    }

    decodeBody(body, draft.requestHeaders).then((decodedRequestBody) => {
      const entry = createPendingEntry({ ...draft, requestBody: decodedRequestBody });
      publish(state, entry);
      this.addEventListener('loadend', () => {
        const responseHeaders = parseXhrHeaders(this.getAllResponseHeaders());
        let responseBody: ArcanaDevtoolsDecodedBody = { format: 'empty' };
        try {
          if (this.response instanceof ArrayBuffer) {
            responseBody = decodeBytes(new Uint8Array(this.response), responseHeaders);
          } else if (ArrayBuffer.isView(this.response)) {
            responseBody = decodeBytes(
              new Uint8Array(this.response.buffer, this.response.byteOffset, this.response.byteLength),
              responseHeaders,
            );
          } else if (typeof this.response === 'string') {
            responseBody = decodeText(this.response, responseHeaders);
          } else if (
            (this.responseType === '' || this.responseType === 'text') &&
            typeof this.responseText === 'string' &&
            this.responseText.length > 0
          ) {
            responseBody = decodeText(this.responseText, responseHeaders);
          } else if (this.response != null) {
            responseBody = { format: 'json', value: enhanceArcanaPayload(this.response) };
          }
        } catch (error) {
          responseBody = { format: 'unavailable', error: errorMessage(error) };
        }
        publish(state, finishEntry(
          entry,
          this.status >= 200 && this.status < 400 ? 'ok' : 'error',
          responseBody,
          responseHeaders,
          this.status,
        ));
      });
      return state.originalSend!.call(this, body ?? null);
    }).catch((error) => {
      const entry = createPendingEntry({ ...draft, requestBody: { format: 'unavailable', error: errorMessage(error) } });
      publish(state, entry);
      return state.originalSend!.call(this, body ?? null);
    });
  };

  if (typeof window.WebSocket === 'function') {
    const OriginalWebSocket = state.originalWebSocket;
    const PatchedWebSocket = function patchedWebSocket(
      this: WebSocket,
      url: string | URL,
      protocols?: string | string[],
    ): WebSocket {
      const targetUrl = String(url);
      const socket = protocols === undefined
        ? new OriginalWebSocket!(url)
        : new OriginalWebSocket!(url, protocols);
      if (!isArcanaUrl(targetUrl, state.apiUrl)) return socket;

      const entry = createPendingEntry({
        id: state.nextId++,
        method: 'WS',
        url: targetUrl,
        startedAt: Date.now(),
        requestHeaders: {},
        requestBody: { format: 'empty' },
      });
      publish(state, entry);

      const originalSend = socket.send.bind(socket);
      socket.send = (data: string | ArrayBufferLike | Blob | ArrayBufferView): void => {
        decodeBody(data as BodyInit, {}).then((decodedRequestBody) => {
          publish(state, { ...entry, requestBody: decodedRequestBody });
        }).catch(() => undefined);
        return originalSend(data);
      };

      socket.addEventListener('open', () => {
        publish(state, finishEntry(entry, 'ok', { format: 'text', value: '[websocket open]' }, {}, 101));
      });
      socket.addEventListener('message', (event) => {
        const responseBody = typeof event.data === 'string'
          ? decodeText(event.data, { 'content-type': 'application/json' })
          : { format: 'bytes', value: '[websocket binary frame]' } as ArcanaDevtoolsDecodedBody;
        publish(state, finishEntry(entry, 'ok', responseBody, {}, 101));
      });
      socket.addEventListener('error', () => {
        publish(state, finishEntry(entry, 'error', { format: 'empty' }, {}, undefined, 'WebSocket error'));
      });
      socket.addEventListener('close', (event) => {
        const status = event.wasClean ? 'ok' : 'error';
        const reason = event.reason || `WebSocket closed with code ${event.code}`;
        publish(state, finishEntry(entry, status, { format: 'text', value: reason }, {}, event.code));
      });
      return socket;
    } as unknown as typeof WebSocket;
    PatchedWebSocket.prototype = OriginalWebSocket!.prototype;
    Object.defineProperties(PatchedWebSocket, {
      CONNECTING: { value: OriginalWebSocket!.CONNECTING },
      OPEN: { value: OriginalWebSocket!.OPEN },
      CLOSING: { value: OriginalWebSocket!.CLOSING },
      CLOSED: { value: OriginalWebSocket!.CLOSED },
    });
    window.WebSocket = PatchedWebSocket;
  }

  state.installed = true;
}

function parseXhrHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  raw.trim().split(/[\r\n]+/).forEach((line) => {
    const index = line.indexOf(':');
    if (index > 0) headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  });
  return headers;
}

export function ArcanaDeveloperTools({
  apiUrl,
  enabled,
  maxEntries = 100,
  explorerUrl = 'https://explorer.inkonchain.com',
  defaultOpen = false,
}: ArcanaDeveloperToolsProps): React.ReactElement | null {
  const isEnabled = enabled ?? defaultEnabled();
  const [open, setOpen] = useState(defaultOpen);
  const [entries, setEntries] = useState<ArcanaDevtoolsRequestEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [kindFilter, setKindFilter] = useState<'all' | ArcanaDevtoolsRequestKind>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ArcanaDevtoolsStatus>('all');
  const [query, setQuery] = useState('');
  const [followLatest, setFollowLatest] = useState(true);

  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined') return;
    installArcanaDeveloperToolsMonitor(maxEntries, apiUrl);
    const state = monitorState(maxEntries, apiUrl);
    setEntries([...state.entries]);
    const onRequest = (event: Event): void => {
      setEntries([...state.entries]);
      const detail = event instanceof CustomEvent ? event.detail as ArcanaDevtoolsRequestEntry | undefined : undefined;
      if (detail && followLatest) setSelectedId(detail.id);
    };
    window.addEventListener(EVENT_NAME, onRequest);
    return () => window.removeEventListener(EVENT_NAME, onRequest);
  }, [apiUrl, followLatest, isEnabled, maxEntries]);

  useEffect(() => {
    if (entries.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId == null || !entries.some((entry) => entry.id === selectedId)) {
      setSelectedId(entries[0].id);
    }
  }, [entries, selectedId]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (kindFilter !== 'all' && entry.kind !== kindFilter) return false;
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return [
        entry.method,
        entry.path,
        entry.summary,
        String(entry.statusCode ?? ''),
        safeJson(entry.requestBody.value),
        safeJson(entry.responseBody.value),
      ].join('\n').toLowerCase().includes(normalizedQuery);
    });
  }, [entries, kindFilter, query, statusFilter]);

  const selected = filteredEntries.find((entry) => entry.id === selectedId) ?? filteredEntries[0] ?? null;
  const pending = entries.filter((entry) => entry.status === 'pending').length;
  const failed = entries.filter((entry) => entry.status === 'error').length;
  const actions = entries.filter((entry) => entry.kind === 'action').length;
  const views = entries.filter((entry) => entry.kind === 'view').length;
  const explorerBase = explorerUrl.replace(/\/+$/, '');

  if (!isEnabled) return null;

  return (
    <div style={styles.root}>
      <button type="button" style={styles.launcher} onClick={() => setOpen(true)} aria-label="Open Arcana developer tools">
        <span style={styles.launcherMark}>A</span>
        <span>Arcana</span>
        {failed > 0 ? <span style={styles.errorPill} title={`${failed} failed Arcana request${failed === 1 ? '' : 's'}`}>{failed}</span> : null}
      </button>

      {open ? (
        <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="Arcana developer tools">
          <div style={styles.modal}>
            <header style={styles.header}>
              <div>
                <div style={styles.title}>Arcana Developer Tools</div>
                <div style={styles.subtitle}>
                  {entries.length} requests · {actions} actions · {views} views
                  {pending > 0 ? ` · ${pending} pending` : ''}
                  {failed > 0 ? ` · ${failed} errors` : ''}
                </div>
              </div>
              <div style={styles.headerActions}>
                <button
                  type="button"
                  style={followLatest ? styles.activeSecondaryButton : styles.secondaryButton}
                  onClick={() => setFollowLatest((value) => !value)}
                >
                  {followLatest ? 'Following' : 'Paused'}
                </button>
                <button type="button" style={styles.secondaryButton} onClick={() => clearEntries(monitorState(maxEntries, apiUrl))}>
                  Clear
                </button>
                <button type="button" style={styles.iconButton} onClick={() => setOpen(false)} aria-label="Close Arcana developer tools">
                  x
                </button>
              </div>
            </header>

            <section style={styles.toolbar}>
              <input
                style={styles.searchInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by path, entrypoint, payload..."
              />
              <select style={styles.select} value={kindFilter} onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)}>
                {REQUEST_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
              </select>
              <select style={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                <option value="all">all status</option>
                <option value="pending">pending</option>
                <option value="ok">ok</option>
                <option value="error">error</option>
              </select>
            </section>

            <div style={styles.content}>
              <section style={styles.list} aria-label="Arcana requests">
                {filteredEntries.length === 0 ? (
                  <div style={styles.empty}>No matching Arcana requests.</div>
                ) : filteredEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    style={entry.id === selected?.id ? styles.selectedRow : styles.row}
                    onClick={() => {
                      setFollowLatest(false);
                      setSelectedId(entry.id);
                    }}
                  >
                    <span style={styles.rowTop}>
                      <span style={styles.kind}>{entry.kind}</span>
                      <span style={entry.status === 'error' ? styles.badStatus : styles.goodStatus}>
                        {statusLabel(entry)}
                      </span>
                      <span style={styles.duration}>{entry.durationMs !== undefined ? `${entry.durationMs}ms` : '...'}</span>
                    </span>
                    <span style={styles.rowSummary}>{entry.summary}</span>
                    <span style={styles.url}>{entry.method} {entry.path}</span>
                  </button>
                ))}
              </section>

              <section style={styles.detail} aria-label="Arcana request detail">
                {selected ? (
                  <>
                    <div style={styles.detailHeader}>
                      <div>
                        <div style={styles.detailTitle}>{selected.kind.toUpperCase()} · {selected.method}</div>
                        <div style={styles.detailPath}>{selected.path}</div>
                      </div>
                      <span style={selected.status === 'error' ? styles.badBadge : styles.goodBadge}>
                        {statusLabel(selected)}
                      </span>
                    </div>

                    {selected.error ? <div style={styles.errorBox}>{selected.error}</div> : null}
                    {selected.txHashes.length > 0 ? (
                      <div style={styles.hashes}>
                        {selected.txHashes.map((hash) => (
                          <a key={hash} href={`${explorerBase}/tx/${hash}`} target="_blank" rel="noreferrer">
                            {hash.slice(0, 10)}...{hash.slice(-8)}
                          </a>
                        ))}
                      </div>
                    ) : null}

                    <PayloadPanel title="Request" body={selected.requestBody} headers={selected.requestHeaders} />
                    <PayloadPanel title="Response" body={selected.responseBody} headers={selected.responseHeaders} />
                  </>
                ) : (
                  <div style={styles.empty}>Select a request to inspect decoded payloads.</div>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PayloadPanel({
  title,
  body,
  headers,
}: {
  title: string;
  body: ArcanaDevtoolsDecodedBody;
  headers: Record<string, string>;
}): React.ReactElement {
  const content = body.error
    ? body.error
    : body.value === undefined
      ? body.format
      : safeJson(body.value);
  return (
    <details style={styles.payload} open={title === 'Response'}>
      <summary style={styles.payloadSummary}>
        {title}
        <span style={styles.payloadMeta}>
          {body.format}{body.byteLength !== undefined ? ` · ${body.byteLength} bytes` : ''}
        </span>
      </summary>
      {Object.keys(headers).length > 0 ? (
        <pre style={styles.headersPre}>{safeJson(headers)}</pre>
      ) : null}
      <pre style={body.error ? styles.errorPre : styles.payloadPre}>{content}</pre>
    </details>
  );
}

const colors = {
  ink: '#f8fafc',
  muted: '#94a3b8',
  panel: '#0f1724',
  panel2: '#131f2f',
  panel3: '#19283b',
  border: '#2a3c55',
  blue: '#7dd3fc',
  green: '#86efac',
  red: '#fca5a5',
  amber: '#fbbf24',
};

const styles = {
  root: {
    zIndex: 2147483000,
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    pointerEvents: 'none',
  } as React.CSSProperties,
  launcher: {
    position: 'fixed',
    right: 18,
    bottom: 18,
    zIndex: 2147483002,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    padding: '8px 12px',
    color: colors.ink,
    background: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: 999,
    boxShadow: '0 14px 36px rgba(15, 23, 42, 0.32)',
    fontWeight: 800,
    cursor: 'pointer',
    pointerEvents: 'auto',
  } as React.CSSProperties,
  launcherMark: {
    display: 'grid',
    placeItems: 'center',
    width: 22,
    height: 22,
    color: '#082f49',
    background: colors.blue,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
  } as React.CSSProperties,
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2147483001,
    display: 'grid',
    placeItems: 'center',
    padding: 18,
    background: 'rgba(2, 6, 23, 0.48)',
    pointerEvents: 'auto',
  } as React.CSSProperties,
  modal: {
    display: 'grid',
    gridTemplateRows: 'auto auto minmax(0, 1fr)',
    width: 'min(1120px, calc(100vw - 36px))',
    height: 'min(720px, calc(100vh - 36px))',
    color: colors.ink,
    background: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    boxShadow: '0 24px 80px rgba(2, 6, 23, 0.52)',
    overflow: 'hidden',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '14px 16px',
    borderBottom: `1px solid ${colors.border}`,
  } as React.CSSProperties,
  title: {
    fontSize: 16,
    fontWeight: 900,
  } as React.CSSProperties,
  subtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
  } as React.CSSProperties,
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,
  secondaryButton: {
    height: 30,
    padding: '0 10px',
    color: colors.ink,
    background: colors.panel3,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    cursor: 'pointer',
  } as React.CSSProperties,
  activeSecondaryButton: {
    height: 30,
    padding: '0 10px',
    color: '#082f49',
    background: colors.blue,
    border: `1px solid ${colors.blue}`,
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 800,
  } as React.CSSProperties,
  iconButton: {
    width: 30,
    height: 30,
    color: colors.ink,
    background: colors.panel3,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    cursor: 'pointer',
  } as React.CSSProperties,
  toolbar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(160px, 1fr) 150px 130px',
    gap: 10,
    padding: 12,
    borderBottom: `1px solid ${colors.border}`,
    background: colors.panel2,
  } as React.CSSProperties,
  searchInput: {
    minWidth: 0,
    height: 34,
    padding: '0 10px',
    color: colors.ink,
    background: '#0b1220',
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    outline: 'none',
  } as React.CSSProperties,
  select: {
    height: 34,
    color: colors.ink,
    background: '#0b1220',
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
  } as React.CSSProperties,
  content: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(360px, 1.4fr)',
    minHeight: 0,
  } as React.CSSProperties,
  list: {
    display: 'grid',
    alignContent: 'start',
    gap: 8,
    minHeight: 0,
    overflow: 'auto',
    padding: 10,
    borderRight: `1px solid ${colors.border}`,
  } as React.CSSProperties,
  empty: {
    padding: 14,
    color: colors.muted,
  } as React.CSSProperties,
  row: {
    display: 'grid',
    gap: 5,
    width: '100%',
    padding: 10,
    color: colors.ink,
    textAlign: 'left',
    background: colors.panel2,
    border: `1px solid ${colors.border}`,
    borderRadius: 7,
    cursor: 'pointer',
  } as React.CSSProperties,
  selectedRow: {
    display: 'grid',
    gap: 5,
    width: '100%',
    padding: 10,
    color: colors.ink,
    textAlign: 'left',
    background: colors.panel3,
    border: `1px solid ${colors.blue}`,
    borderRadius: 7,
    cursor: 'pointer',
  } as React.CSSProperties,
  rowTop: {
    display: 'grid',
    gridTemplateColumns: 'auto auto 1fr',
    gap: 8,
    alignItems: 'center',
    fontSize: 12,
  } as React.CSSProperties,
  kind: {
    color: colors.blue,
    fontWeight: 900,
  } as React.CSSProperties,
  goodStatus: {
    color: colors.green,
    fontWeight: 800,
  } as React.CSSProperties,
  badStatus: {
    color: colors.red,
    fontWeight: 800,
  } as React.CSSProperties,
  duration: {
    color: colors.muted,
    textAlign: 'right',
  } as React.CSSProperties,
  rowSummary: {
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: 800,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  url: {
    overflow: 'hidden',
    color: colors.muted,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontSize: 12,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  detail: {
    minHeight: 0,
    overflow: 'auto',
    padding: 14,
  } as React.CSSProperties,
  detailHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  } as React.CSSProperties,
  detailTitle: {
    fontSize: 14,
    fontWeight: 900,
  } as React.CSSProperties,
  detailPath: {
    marginTop: 4,
    color: colors.muted,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontSize: 12,
  } as React.CSSProperties,
  goodBadge: {
    padding: '4px 8px',
    color: '#052e16',
    background: colors.green,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  } as React.CSSProperties,
  badBadge: {
    padding: '4px 8px',
    color: '#450a0a',
    background: colors.red,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  } as React.CSSProperties,
  errorBox: {
    marginBottom: 12,
    padding: 10,
    color: colors.red,
    background: '#3b1018',
    border: '1px solid #7f1d1d',
    borderRadius: 6,
  } as React.CSSProperties,
  hashes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    fontSize: 12,
  } as React.CSSProperties,
  payload: {
    marginBottom: 12,
    background: colors.panel2,
    border: `1px solid ${colors.border}`,
    borderRadius: 7,
    overflow: 'hidden',
  } as React.CSSProperties,
  payloadSummary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 900,
  } as React.CSSProperties,
  payloadMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: 600,
  } as React.CSSProperties,
  headersPre: {
    margin: 0,
    padding: '10px 12px',
    color: colors.muted,
    background: '#0b1220',
    borderTop: `1px solid ${colors.border}`,
    overflow: 'auto',
    fontSize: 11,
  } as React.CSSProperties,
  payloadPre: {
    margin: 0,
    maxHeight: 300,
    padding: 12,
    color: '#dbeafe',
    background: '#08111f',
    borderTop: `1px solid ${colors.border}`,
    overflow: 'auto',
    fontSize: 12,
    lineHeight: 1.45,
  } as React.CSSProperties,
  errorPre: {
    margin: 0,
    maxHeight: 300,
    padding: 12,
    color: colors.red,
    background: '#180b0f',
    borderTop: `1px solid ${colors.border}`,
    overflow: 'auto',
    fontSize: 12,
    lineHeight: 1.45,
  } as React.CSSProperties,
  errorPill: {
    minWidth: 20,
    padding: '2px 6px',
    color: '#450a0a',
    background: colors.red,
    borderRadius: 999,
    fontSize: 12,
  } as React.CSSProperties,
};
