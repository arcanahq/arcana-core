import { ContractsModule } from '../contracts/index.js';
import { decodeHexBytes, encodeArgsBytes } from '../utils/bytes.js';
import axios from 'axios';
import { decode, encode } from '@msgpack/msgpack';

vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;

describe('ContractsModule', () => {
  let contractsModule: ContractsModule;
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
    };
    
    contractsModule = new ContractsModule(mockApi);
  });

  const decodePostedBody = (callIndex = 0): Record<string, unknown> => {
    const posted = mockApi.post.mock.calls[callIndex]?.[1] as unknown;
    if (posted instanceof Uint8Array) {
      return decode(posted) as Record<string, unknown>;
    }
    if (posted && typeof posted === 'object') {
      return posted as Record<string, unknown>;
    }
    throw new Error('Expected JSON object or MessagePack request body');
  };

  describe('executeAction', () => {
    it('should execute instance action', async () => {
      const actionEnvelope = [{ value: 10 }, [], [], null, null];
      const resultHex = Buffer.from(encode(actionEnvelope)).toString('hex');
      const mockResponse = {
        resultHex,
      };

      mockApi.post.mockResolvedValue({
        data: encode({
          status: 200,
          message: 'Success',
          data: mockResponse,
        }),
      });

      const result = await contractsModule.executeAction(
        'instance-id',
        'increment',
        { amount: 1 }
      );

      expect(result.new_state).toEqual({ value: 10 });
      expect((result as any).resultHex).toBe(resultHex);
      expect(mockApi.post).toHaveBeenCalled();
      expect(mockApi.post.mock.calls[0]?.[0]).toBe('/instances/instance-id/actions');
      expect(decodePostedBody()).toMatchObject({
        operation: 'action',
        instance_id: 'instance-id',
        entrypoint: 'increment',
        args_bytes: encodeArgsBytes({ amount: 1 }),
      });
      expect(mockApi.post.mock.calls[0]?.[2]).toMatchObject({
        params: {},
        responseType: 'arraybuffer',
      });
    });

    it('should handle action errors', async () => {
      const errorEnvelope = [null, [], [], null, ['ERROR', 'Invalid action', null]];
      const resultHex = Buffer.from(encode(errorEnvelope)).toString('hex');
      mockApi.post.mockResolvedValue({
        data: encode({
          status: 400,
          message: 'Error',
          data: {
            result_hex: resultHex,
            version: 1,
          },
        }),
      });

      await expect(
        contractsModule.executeAction('instance-id', 'invalid', {})
      ).rejects.toThrow();
    });

    it('should decode msgpack HTTP error payloads and preserve debug metadata', async () => {
      mockApi.post.mockRejectedValue({
        message: 'Request failed with status code 400',
        response: {
          status: 400,
          headers: { 'content-type': 'application/msgpack' },
          data: encode({
            status: 400,
            message: 'Action failed',
            data: { error: 'C004 insufficient house balance for payout' },
          }),
        },
      });

      await expect(
        contractsModule.executeAction('instance-id', 'execute_spin', { bet: 100 })
      ).rejects.toMatchObject({
        name: 'ArcanaInstanceError',
        message: 'Action failed',
        instanceId: 'instance-id',
        entrypoint: 'execute_spin',
        response: expect.objectContaining({
          http_status: 400,
          payload: expect.objectContaining({
            message: 'Action failed',
          }),
        }),
      });
    });

    it('should encode no-arg tuple args for claim-like actions', async () => {
      const actionEnvelope = [null, [], [], null, null];
      const resultHex = Buffer.from(encode(actionEnvelope)).toString('hex');
      mockApi.post.mockResolvedValue({
        data: encode({
          status: 200,
          message: 'Success',
          data: { resultHex },
        }),
      });

      await contractsModule.executeAction('instance-id', 'claim_play_money');

      expect(mockApi.post.mock.calls[0]?.[0]).toBe('/instances/instance-id/actions');
      expect(decodePostedBody()).toMatchObject({
        operation: 'action',
        entrypoint: 'claim_play_money',
        args_bytes: encodeArgsBytes(['', '']),
      });
    });

    it('should send idempotency_key as a header for claim-like actions', async () => {
      const actionEnvelope = [null, [], [], null, null];
      const resultHex = Buffer.from(encode(actionEnvelope)).toString('hex');
      mockApi.post.mockResolvedValue({
        data: encode({
          status: 200,
          message: 'Success',
          data: { resultHex },
        }),
      });

      await contractsModule.executeAction(
        'instance-id',
        'claim_play_money',
        {},
        { idempotency_key: 'claim-unique-1' },
      );

      expect(mockApi.post.mock.calls[0]?.[0]).toBe('/instances/instance-id/actions');
      expect(decodePostedBody()).toMatchObject({
        operation: 'action',
        entrypoint: 'claim_play_money',
        args_bytes: encodeArgsBytes(['', '']),
      });
      expect(mockApi.post.mock.calls[0]?.[2]).toMatchObject({
        headers: { 'x-arcana-client-mutation-id': 'claim-unique-1' },
      });
    });

    it('preserves tuple args payloads for positional contract decoders', async () => {
      const actionEnvelope = [null, [], [], null, null];
      const resultHex = Buffer.from(encode(actionEnvelope)).toString('hex');
      mockApi.post.mockResolvedValue({
        data: encode({
          status: 200,
          message: 'Success',
          data: { resultHex },
        }),
      });

      const tupleArgs = ['spin-hash', 'client-seed', 100, 20, false, 1000, 2, false, 'play', 'asset:id'];
      await contractsModule.executeAction('instance-id', 'execute_spin', tupleArgs as unknown as Record<string, unknown>);

      expect(mockApi.post.mock.calls[0]?.[0]).toBe('/instances/instance-id/actions');
      expect(decodePostedBody()).toMatchObject({
        operation: 'action',
        entrypoint: 'execute_spin',
        args_bytes: encodeArgsBytes(tupleArgs),
      });
    });

    it('does not append idempotency_key to strict tuple args', async () => {
      const actionEnvelope = [null, [], [], null, null];
      const resultHex = Buffer.from(encode(actionEnvelope)).toString('hex');
      mockApi.post.mockResolvedValue({
        data: encode({
          status: 200,
          message: 'Success',
          data: { resultHex },
        }),
      });

      const tupleArgs = ['1000000', '0', '0'];
      await contractsModule.executeAction(
        'instance-id',
        'startRound',
        tupleArgs as unknown as Record<string, unknown>,
        { idempotency_key: 'start-u3-r7' },
      );

      expect(decodePostedBody()).toMatchObject({
        operation: 'action',
        entrypoint: 'startRound',
        args_bytes: encodeArgsBytes(['1000000', '0', '0']),
      });
      expect(mockApi.post.mock.calls[0]?.[2]).toMatchObject({
        headers: { 'x-arcana-client-mutation-id': 'start-u3-r7' },
      });
    });

    it('should get paginated instance events', async () => {
      const mockPage = {
        items: [{ id: '1', event_type: 'GameStarted', payload: {} }],
        next_cursor: 'cursor-2',
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockPage,
        },
      });

      const result = await contractsModule.getEventsPage('instance-id', {
        page_size: 25,
        cursor: 'cursor-1',
        event_type: 'GameStarted',
      });

      expect(result.items).toEqual([
        { id: '1', event_type: 'GameStarted', payload: {}, event_data: {} },
      ]);
      expect(result.next_cursor).toBe('cursor-2');
      expect(mockApi.get).toHaveBeenCalledWith(
        '/instances/instance-id/events',
        expect.objectContaining({
          responseType: 'arraybuffer',
          params: {
            page_size: 25,
            cursor: 'cursor-1',
            event_type: 'GameStarted',
          },
        }),
      );
    });
  });

  describe('view', () => {
    it('should get instance view', async () => {
      const mockView = { my_data: 'visible' };
      const resultHex = Buffer.from(encode(mockView)).toString('hex');

      mockApi.get.mockResolvedValue({
        data: encode({
          status: 200,
          message: 'Success',
          data: { resultHex },
        }),
      });

      const result = await contractsModule.view('instance-id');

      expect(result).toEqual(mockView);
      expect(mockApi.get).toHaveBeenCalledWith(
        '/instances/instance-id/view',
        expect.objectContaining({
          responseType: 'arraybuffer',
        })
      );
    });

    it('should not fallback to legacy singular /instance route on 404', async () => {
      mockApi.get.mockRejectedValue({
        response: { status: 404 },
        message: 'Not found',
      });

      await expect(contractsModule.view('instance-id')).rejects.toThrow();
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(mockApi.get).toHaveBeenCalledWith(
        '/instances/instance-id/view',
        expect.objectContaining({ responseType: 'arraybuffer' }),
      );
    });

    it('should call POST /view when entrypoint or args are provided', async () => {
      const mockView = { canClaimPlayMoneyNow: true, playMoneyBalance: '100' };
      const resultHex = Buffer.from(encode(mockView)).toString('hex');
      mockApi.post.mockResolvedValue({
        data: encode({
          status: 200,
          message: 'Success',
          data: { resultHex },
        }),
      });

      const result = await contractsModule.view('instance-id', 'view', {});

      expect(result).toEqual(mockView);
      expect(mockApi.post.mock.calls[0]?.[0]).toBe('/instances/instance-id/view');
      expect(decodePostedBody()).toMatchObject({
        entrypoint: 'view',
        args_bytes: encodeArgsBytes([]),
      });
    });

    it('should send empty args_bytes for no-arg view entrypoints', async () => {
      const mockView = { playMoneyBalance: '1000', canClaimNow: true };
      const resultHex = Buffer.from(encode(mockView)).toString('hex');
      mockApi.post.mockResolvedValue({
        data: encode({
          status: 200,
          message: 'Success',
          data: { resultHex },
        }),
      });

      const result = await contractsModule.view('instance-id', 'view_play_money_status');

      expect(result).toEqual(mockView);
      expect(mockApi.post.mock.calls[0]?.[0]).toBe('/instances/instance-id/view');
      expect(decodePostedBody()).toMatchObject({
        entrypoint: 'view_play_money_status',
        args_bytes: '',
      });
    });

    it('should call viewWithReads and return view + reads', async () => {
      const mockView = { tables: ['leaderboard_points', 'profile_stats'] };
      const resultHex = Buffer.from(encode(mockView)).toString('hex');
      const mockReads = {
        tables: [
          {
            table_name: 'leaderboard_points',
            table_scope: 'project',
            row_count: 2,
            rows: [
              ['id1', 'user1', 'all_time', null, '1000', '900', '100'],
              ['id2', 'user2', 'all_time', null, '800', '800', '0'],
            ],
          },
        ],
      };
      mockApi.post.mockResolvedValue({
        data: encode({
          status: 200,
          message: 'Success',
          data: { resultHex, reads: mockReads },
        }),
      });

      const result = await contractsModule.viewWithReads(
        'analytics-instance-id',
        { tables: [{ table_name: 'leaderboard_points', table_scope: 'project', limit: 10 }] },
        'view_tables_catalog',
        {}
      );

      expect(result.view).toEqual(mockView);
      expect(result.reads.tables).toHaveLength(1);
      expect(result.reads.tables![0].table_name).toBe('leaderboard_points');
      expect(result.reads.tables![0].rows).toHaveLength(2);
      expect(mockApi.post.mock.calls[0]?.[0]).toBe('/instances/analytics-instance-id/view');
      expect(decodePostedBody()).toMatchObject({
        entrypoint: 'view_tables_catalog',
        reads: { tables: [{ table_name: 'leaderboard_points', table_scope: 'project', limit: 10 }] },
      });
    });
  });

  describe('getState', () => {
    it('should get raw instance state', async () => {
      const mockState = {
        id: 'instance-id',
        program_type: 'counter',
        data: Buffer.from(encode({ value: 10 })).toString('hex'),
        state_version: 1,
        status: 'active',
      };

      mockApi.get.mockResolvedValue({
        data: encode({
          status: 200,
          message: 'Success',
          data: mockState,
        }),
      });

      const result = await contractsModule.getState('instance-id');

      expect(result.state).toEqual(decodeHexBytes(mockState.data));
      expect(mockApi.get).toHaveBeenCalledWith(
        '/instances/instance-id',
        expect.objectContaining({ responseType: 'arraybuffer' }),
      );
    });
  });

  describe('getUserInstances', () => {
    it('should call /instances when no scope filter is provided', async () => {
      mockApi.get.mockResolvedValue({
        data: encode({
          status: 200,
          message: 'Success',
          data: [],
        }),
      });

      const result = await contractsModule.getUserInstances();

      expect(result).toEqual([]);
      expect(mockApi.get).toHaveBeenCalledWith(
        '/instances',
        expect.objectContaining({ params: {}, responseType: 'arraybuffer' }),
      );
    });

    it('should include scope_id when scope filter is provided', async () => {
      mockApi.get.mockResolvedValue({
        data: encode({
          status: 200,
          message: 'Success',
          data: [],
        }),
      });

      const result = await contractsModule.getUserInstances({ scopeId: 'project:app' });

      expect(result).toEqual([]);
      expect(mockApi.get).toHaveBeenCalledWith(
        '/instances',
        expect.objectContaining({
          params: { scope_id: 'project:app' },
          responseType: 'arraybuffer',
        }),
      );
    });
  });

  describe('getEvents', () => {
    it('should get instance events', async () => {
      const mockEvents = [
        { id: '1', event_type: 'GameStarted', event_data: {} },
        { id: '2', event_type: 'MovePlayed', event_data: {} },
      ];

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockEvents,
        },
      });

      const result = await contractsModule.getEvents('instance-id', {
        limit: 50,
        offset: 0,
      });

      expect(result).toEqual(mockEvents);
      // offset: 0 is falsy, so it may not be included in params
      expect(mockApi.get).toHaveBeenCalledWith(
        '/instances/instance-id/events',
        expect.objectContaining({
          responseType: 'arraybuffer',
          params: expect.objectContaining({
            limit: 50,
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('should create instance', async () => {
      const mockInstance = {
        id: 'new-instance-id',
        program_type: 'counter',
        state: {},
        state_version: 0,
        status: 'active',
        data: {},
        state_hex: undefined,
      };

      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockInstance,
        },
      });

      const result = await contractsModule.create('counter', { initialValue: 0 });

      expect(result).toEqual(mockInstance);
      expect(mockApi.post.mock.calls[0]?.[0]).toBe('/instances');
      expect(decodePostedBody()).toMatchObject({
        operation: 'create_instance',
        program_type: 'counter',
        args_bytes: encodeArgsBytes({ initialValue: 0 }),
      });
    });
  });
});
