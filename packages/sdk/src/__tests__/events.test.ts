import { EventsModule } from '../events/index.js';

describe('EventsModule', () => {
  let eventsModule: EventsModule;
  let mockApi: any;

  beforeEach(() => {
    mockApi = {
      get: vi.fn(),
    };
    eventsModule = new EventsModule(mockApi);
  });

  it('queries generic event pages', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        status: 200,
        message: 'Success',
        data: {
          items: [{ id: '1', event_type: 'price.updated', payload: { tick: '1' } }],
          next_cursor: 'next',
        },
      },
    });

    const result = await eventsModule.queryPage({
      scope_id: 'demo:app',
      program_type: 'price-stream',
      page_size: 10,
    });

    expect(result.items).toEqual([
      {
        id: '1',
        event_type: 'price.updated',
        payload: { tick: '1' },
        data: null,
        topics: [],
        topic0: null,
        topic1: null,
        topic2: null,
        topic3: null,
        event_data: { tick: '1' },
      },
    ]);
    expect(result.next_cursor).toBe('next');
    expect(mockApi.get).toHaveBeenCalledWith('/events', {
      params: {
        scope_id: 'demo:app',
        program_type: 'price-stream',
        page_size: 10,
      },
    });
  });
});
