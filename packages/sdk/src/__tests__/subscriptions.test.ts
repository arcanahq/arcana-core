import { SubscriptionsModule, type SubscriptionEvent } from '../subscriptions/index.js';

function createModule(token = 'token-1') {
  const api = {
    defaults: { baseURL: 'http://localhost:3003' },
  } as any;
  return new SubscriptionsModule(api, () => token);
}

function sseResponse(events: Array<Partial<SubscriptionEvent> | string>, status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        if (typeof event === 'string') {
          controller.enqueue(encoder.encode(event));
        } else {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('SubscriptionsModule', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('opens an authenticated instance SSE subscription', async () => {
    const fetchMock = vi.fn(async () =>
      sseResponse([
        {
          sequence: 1,
          instance_id: 'instance-1',
          scope_id: 'scope-1',
          view_json: { status: 'active' },
          state_version: 2,
          event_type: 'state_change',
        },
      ]),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const module = createModule();
    const onEvent = vi.fn();
    const onStatusChange = vi.fn();
    module.subscribeInstance('scope-1', 'instance-1', {
      reconnect: false,
      onEvent,
      onStatusChange,
    });

    await vi.waitFor(() => {
      expect(onEvent).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3003/subscriptions?scope_id=scope-1&instance_id=instance-1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer token-1');
    expect(headers.get('Accept')).toBe('text/event-stream');
    expect(onEvent.mock.calls[0]?.[0]).toMatchObject({
      sequence: 1,
      state_version: 2,
      view_json: { status: 'active' },
    });
    expect(onStatusChange).toHaveBeenCalledWith('open');
  });

  it('drops duplicate or stale events by sequence and state_version', async () => {
    const events = [
      {
        sequence: 1,
        instance_id: 'instance-1',
        scope_id: 'scope-1',
        view_json: { value: 1 },
        state_version: 1,
        event_type: 'state_change',
      },
      {
        sequence: 1,
        instance_id: 'instance-1',
        scope_id: 'scope-1',
        view_json: { value: 'duplicate-sequence' },
        state_version: 2,
        event_type: 'state_change',
      },
      {
        sequence: 2,
        instance_id: 'instance-1',
        scope_id: 'scope-1',
        view_json: { value: 'stale-version' },
        state_version: 1,
        event_type: 'state_change',
      },
      {
        sequence: 3,
        instance_id: 'instance-1',
        scope_id: 'scope-1',
        view_json: { value: 3 },
        state_version: 3,
        event_type: 'state_change',
      },
    ];
    globalThis.fetch = vi.fn(async () => sseResponse(events)) as typeof fetch;

    const module = createModule();
    const onView = vi.fn();
    module.subscribeInstance('scope-1', 'instance-1', {
      reconnect: false,
      onView,
    });

    await vi.waitFor(() => {
      expect(onView).toHaveBeenCalledTimes(2);
    });
    expect(onView.mock.calls.map((call) => call[0])).toEqual([{ value: 1 }, { value: 3 }]);
  });

  it('reports malformed frames and continues reading later valid events', async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse([
        'data: {"sequence":\n\n',
        { sequence: 1, instance_id: 'instance-1', scope_id: 'scope-1', state_version: 1 },
        {
          sequence: 2,
          instance_id: 'instance-1',
          scope_id: 'scope-1',
          view_json: { value: 2 },
          state_version: 2,
          event_type: 'state_change',
        },
      ]),
    ) as typeof fetch;

    const module = createModule();
    const onError = vi.fn();
    const onView = vi.fn();
    module.subscribeInstance('scope-1', 'instance-1', {
      reconnect: false,
      onError,
      onView,
    });

    await vi.waitFor(() => {
      expect(onView).toHaveBeenCalledWith(
        { value: 2 },
        expect.objectContaining({ sequence: 2, state_version: 2 }),
      );
    });
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('triggers refetch and reports resync status when receiving a resync sentinel', async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse([
        {
          sequence: 1,
          instance_id: 'instance-1',
          scope_id: 'scope-1',
          view_json: { value: 1 },
          state_version: 1,
          event_type: 'state_change',
        },
        {
          sequence: 0,
          instance_id: 'instance-1',
          scope_id: 'scope-1',
          view_json: null as any,
          state_version: 0,
          event_type: 'resync',
        },
        {
          sequence: 2,
          instance_id: 'instance-1',
          scope_id: 'scope-1',
          view_json: { value: 2 },
          state_version: 2,
          event_type: 'state_change',
        },
      ]),
    ) as typeof fetch;

    const module = createModule();
    const refetch = vi.fn(async () => ({ value: 'snapshot' }));
    const onRefetch = vi.fn();
    const onView = vi.fn();
    const onStatusChange = vi.fn();

    module.subscribeInstance('scope-1', 'instance-1', {
      reconnect: false,
      refetch,
      onRefetch,
      onView,
      onStatusChange,
    });

    await vi.waitFor(() => {
      expect(onView).toHaveBeenCalledTimes(2);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onRefetch).toHaveBeenCalledWith({ value: 'snapshot' });
    expect(onStatusChange).toHaveBeenCalledWith('resync');
    expect(onView.mock.calls.map((call) => call[0])).toEqual([{ value: 1 }, { value: 2 }]);
  });

  it('echoes Last-Event-ID from the previous SSE id field on reconnect', async () => {
    let connectAttempt = 0;
    globalThis.fetch = vi.fn(async () => {
      connectAttempt += 1;
      if (connectAttempt === 1) {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              const enc = new TextEncoder();
              controller.enqueue(
                enc.encode(
                  `id: 7\ndata: ${JSON.stringify({
                    sequence: 7,
                    instance_id: 'instance-1',
                    scope_id: 'scope-1',
                    view_json: { value: 7 },
                    state_version: 7,
                    event_type: 'state_change',
                  })}\n\n`,
                ),
              );
              controller.close();
            },
          }),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        );
      }
      return sseResponse([], 200);
    }) as typeof fetch;

    const module = createModule();
    const handle = module.subscribeInstance('scope-1', 'instance-1', {
      minReconnectDelayMs: 5,
      maxReconnectDelayMs: 5,
      reconnectJitterRatio: 0,
      onError: () => undefined,
    });

    await vi.waitFor(() => {
      expect(connectAttempt).toBeGreaterThanOrEqual(2);
    });
    const fetchCalls = (globalThis.fetch as any).mock.calls;
    const reconnectHeaders = fetchCalls[1]?.[1]?.headers as Headers;
    expect(reconnectHeaders.get('Last-Event-ID')).toBe('7');
    handle.close();
  });

  it('aborts and reconnects when keep-alive window elapses with no chunk', async () => {
    let openCount = 0;
    const firstOpen = new Promise<void>((resolveOpened) => {
      globalThis.fetch = vi.fn(async (_url, init) => {
        openCount += 1;
        if (openCount === 1) {
          const signal = (init as RequestInit | undefined)?.signal;
          const idleStream = new ReadableStream<Uint8Array>({
            start(controller) {
              resolveOpened();
              if (signal) {
                signal.addEventListener('abort', () => {
                  try {
                    controller.close();
                  } catch {
                    // already closed
                  }
                });
              }
            },
          });
          return new Response(idleStream, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          });
        }
        return sseResponse([
          {
            sequence: 1,
            instance_id: 'instance-1',
            scope_id: 'scope-1',
            view_json: { value: 1 },
            state_version: 1,
            event_type: 'state_change',
          },
        ]);
      }) as typeof fetch;
    });

    const module = createModule();
    const onEvent = vi.fn();
    const onError = vi.fn();
    const handle = module.subscribeInstance('scope-1', 'instance-1', {
      keepAliveTimeoutMs: 25,
      minReconnectDelayMs: 5,
      maxReconnectDelayMs: 5,
      reconnectJitterRatio: 0,
      onEvent,
      onError,
    });

    await firstOpen;
    await vi.waitFor(() => {
      expect(onEvent).toHaveBeenCalledTimes(1);
    });
    expect(openCount).toBeGreaterThanOrEqual(2);
    handle.close();
  });

  it('skips the reconnect backoff when window.online fires', async () => {
    const listeners: Array<(...args: unknown[]) => void> = [];
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = {
      addEventListener: (event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'online') listeners.push(handler);
      },
      removeEventListener: (_event: string, handler: (...args: unknown[]) => void) => {
        const idx = listeners.indexOf(handler);
        if (idx >= 0) listeners.splice(idx, 1);
      },
    };

    try {
      let openCount = 0;
      globalThis.fetch = vi.fn(async () => {
        openCount += 1;
        if (openCount === 1) {
          return sseResponse([], 503);
        }
        return sseResponse([
          {
            sequence: 1,
            instance_id: 'instance-1',
            scope_id: 'scope-1',
            view_json: { value: 1 },
            state_version: 1,
            event_type: 'state_change',
          },
        ]);
      }) as typeof fetch;

      const module = createModule();
      const onEvent = vi.fn();
      const handle = module.subscribeInstance('scope-1', 'instance-1', {
        minReconnectDelayMs: 60_000,
        maxReconnectDelayMs: 60_000,
        reconnectJitterRatio: 0,
        onEvent,
        onError: () => undefined,
      });

      await vi.waitFor(() => {
        expect(openCount).toBe(1);
        expect(listeners.length).toBeGreaterThan(0);
      });

      for (const listener of listeners) listener();

      await vi.waitFor(() => {
        expect(onEvent).toHaveBeenCalledTimes(1);
      });
      handle.close();
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = originalWindow;
      }
    }
  });

  it('refreshes tokens on every reconnect attempt', async () => {
    let openCount = 0;
    globalThis.fetch = vi.fn(async (_url, init) => {
      openCount += 1;
      if (openCount === 1) {
        return sseResponse([
          {
            sequence: 1,
            instance_id: 'instance-1',
            scope_id: 'scope-1',
            view_json: { value: 1 },
            state_version: 1,
            event_type: 'state_change',
          },
        ]);
      }
      if (openCount === 2) {
        return new Response('', { status: 401 });
      }
      // Open #3: deliver the event then keep the stream open indefinitely so
      // the loop blocks here and assertions see a stable call count.
      const signal = (init as RequestInit | undefined)?.signal;
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                sequence: 2,
                instance_id: 'instance-1',
                scope_id: 'scope-1',
                view_json: { value: 2 },
                state_version: 2,
                event_type: 'state_change',
              })}\n\n`,
            ),
          );
          if (signal) {
            signal.addEventListener('abort', () => {
              try {
                controller.close();
              } catch {
                // already closed
              }
            });
          }
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as typeof fetch;

    const ensureAccessToken = vi.fn(async () => true);
    const refreshTokens = vi.fn(async () => true);

    const api = { defaults: { baseURL: 'http://localhost:3003' } } as any;
    const subs = new SubscriptionsModule(api, () => 'token', {
      ensureAccessToken,
      refreshTokens,
    });

    const onEvent = vi.fn();
    const handle = subs.subscribeInstance('scope-1', 'instance-1', {
      minReconnectDelayMs: 5,
      maxReconnectDelayMs: 5,
      reconnectJitterRatio: 0,
      onEvent,
      onError: () => undefined,
    });

    await vi.waitFor(() => {
      expect(onEvent).toHaveBeenCalledTimes(2);
    });

    expect(ensureAccessToken).toHaveBeenCalledTimes(2);
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    handle.close();
  });

  it('uses refetch fallback during reconnect backoff', async () => {
    globalThis.fetch = vi.fn(async () => sseResponse([], 503)) as typeof fetch;

    const module = createModule();
    const refetch = vi.fn();
    const handle = module.subscribeInstance('scope-1', 'instance-1', {
      minReconnectDelayMs: 20,
      maxReconnectDelayMs: 20,
      reconnectJitterRatio: 0,
      fallbackPollIntervalMs: 1,
      refetch,
      onError: () => undefined,
    });

    await vi.waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });
    handle.close();
  });
});
