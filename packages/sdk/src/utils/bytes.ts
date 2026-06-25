import { decode, encode } from '@msgpack/msgpack';

export interface DecodedContractError {
  code?: string;
  message?: string;
  data?: unknown;
}

export interface DecodedActionEnvelope<TState = unknown> {
  state: TState | null;
  events: unknown[];
  metadata: unknown;
  error: DecodedContractError | null;
}

export interface DecodedActionResponse<TState = unknown> {
  resultHex?: string;
  /** @deprecated legacy alias kept only for input compatibility */
  result_hex?: string;
  envelope?: DecodedActionEnvelope<TState>;
  new_state?: TState | null;
  state?: TState | null;
  events?: unknown[];
  metadata?: unknown;
  error?: string;
  error_code?: string;
  error_data?: unknown;
  performance?: unknown;
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  if (typeof btoa !== 'undefined') {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  throw new Error('No base64 encoder available in this runtime');
}

function decodeBase64(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }
  if (typeof atob !== 'undefined') {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  throw new Error('No base64 decoder available in this runtime');
}

/**
 * Encode SDK args payloads as base64 MessagePack bytes for Arcana byte-oriented endpoints.
 */
export function encodeArgsBytes(value: unknown): string {
  const normalized = value === undefined ? {} : value;
  return encodeBase64(encode(normalized));
}

/**
 * Decode base64 MessagePack args payloads back into values.
 * Intended for diagnostics/tests.
 */
export function decodeArgsBytes<T = unknown>(argsBytes: string): T {
  return decode(decodeBase64(argsBytes)) as T;
}

export function decodeMsgpackResponse<T = unknown>(data: ArrayBuffer | Uint8Array): T {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return decode(bytes as any, { useMap: false } as any) as T;
}

export function decodeMsgpackBase64<T = unknown>(value: string): T {
  return decode(decodeBase64(value) as any, { useMap: false } as any) as T;
}

export function decodeHexBytes(value: string): Uint8Array {
  const normalized = value.startsWith('0x') ? value.slice(2) : value;
  if (normalized.length === 0) return new Uint8Array(0);
  if (normalized.length % 2 !== 0) {
    throw new Error('Hex string must have an even length');
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(normalized, 'hex'));
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

export function decodeMsgpackHex<T = unknown>(value: string): T {
  return decode(decodeHexBytes(value) as any, { useMap: false } as any) as T;
}

/**
 * Decode an API payload that may contain MessagePack hex bytes under
 * `resultHex` (preferred) or `result_hex` (legacy).
 * If present, it is decoded and returned; otherwise returns payload as-is.
 */
export function decodeViewResponseData<T = unknown>(payload: unknown): T {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const resultHex = record.resultHex ?? record.result_hex;
    if (typeof resultHex === 'string' && resultHex.length > 0) {
      try {
        return decodeMsgpackHex<T>(resultHex);
      } catch {
        return payload as T;
      }
    }
  }
  return payload as T;
}

/**
 * Decode view response that may include attached reads.
 * Returns { view, reads } when reads are present; otherwise { view } with reads: undefined.
 */
export function decodeViewResponseWithReads<T = unknown>(payload: unknown): {
  view: T;
  reads?: { kv?: unknown[]; tables?: unknown[] };
} {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const reads = record.reads as { kv?: unknown[]; tables?: unknown[] } | undefined;
  const view = decodeViewResponseData<T>(payload);
  return reads ? { view, reads } : { view };
}

/**
 * Decode a MessagePack action envelope:
 * [state, events, _, metadata, error]
 */
export function decodeActionEnvelope<TState = unknown>(value: unknown): DecodedActionEnvelope<TState> {
  if (!Array.isArray(value) || value.length < 5) {
    throw new Error('Invalid action envelope: expected tuple [state, events, _, metadata, error]');
  }
  const [state, events, _ignored, metadata, error] = value as [TState, unknown, unknown, unknown, unknown];
  let decodedError: DecodedContractError | null = null;
  if (Array.isArray(error) && error.length > 0) {
    decodedError = {
      code: typeof error[0] === 'string' ? error[0] : undefined,
      message: typeof error[1] === 'string' ? error[1] : undefined,
      data: error.length > 2 ? error[2] : undefined,
    };
  }
  return {
    state: (state ?? null) as TState | null,
    events: Array.isArray(events) ? events : [],
    metadata,
    error: decodedError,
  };
}

/**
 * Decode a hex-encoded MessagePack action envelope.
 */
export function decodeActionResultHex<TState = unknown>(resultHex: string): DecodedActionEnvelope<TState> {
  const decoded = decodeMsgpackHex<unknown>(resultHex);
  return decodeActionEnvelope<TState>(decoded);
}

/**
 * Normalize an API action payload that includes `result_hex` MessagePack envelope bytes.
 */
export function decodeActionResponseData<TState = unknown>(payload: unknown): DecodedActionResponse<TState> {
  if (!payload || typeof payload !== 'object') {
    return { error: 'Invalid response payload' };
  }

  const record = payload as Record<string, unknown>;
  const resultHex = record.resultHex ?? record.result_hex;
  if (typeof resultHex !== 'string' || resultHex.length === 0) {
    return payload as DecodedActionResponse<TState>;
  }

  try {
    const envelope = decodeActionResultHex<TState>(resultHex);
    return {
      resultHex,
      envelope,
      new_state: envelope.state,
      state: envelope.state,
      events: envelope.events,
      metadata: envelope.metadata,
      error: envelope.error?.message,
      error_code: envelope.error?.code,
      error_data: envelope.error?.data,
      performance: record.performance,
    };
  } catch {
    return { resultHex, performance: record.performance };
  }
}
