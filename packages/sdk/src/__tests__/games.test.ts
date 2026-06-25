import { GameClient } from '../games/index.js';
import { ArcanaClient } from '../client.js';
import { ContractsModule } from '../contracts/index.js';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;

describe('GameClient', () => {
  let gameClient: GameClient;
  let mockClient: ArcanaClient;
  let mockContracts: ContractsModule;
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
    };

    mockContracts = {
      view: vi.fn(),
      getState: vi.fn(),
      executeAction: vi.fn(),
      create: vi.fn(),
    } as any;

    mockClient = {
      contracts: mockContracts,
    } as any;

    gameClient = new GameClient(mockClient, 'instance1', 'user1');
  });

  describe('getState', () => {
    it('should get game state from view', async () => {
      const mockState = {
        status: 'playing',
        phase: 'active',
        players: ['user1', 'user2'],
      };

      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.getState();

      expect(result).toEqual(mockState);
      expect(mockContracts.view).toHaveBeenCalledWith('instance1');
    });

    it('should parse nested gameState', async () => {
      const mockResponse = {
        gameState: {
          status: 'playing',
          players: ['user1'],
        },
      };

      mockContracts.view = vi.fn().mockResolvedValue(mockResponse);

      const result = await gameClient.getState();

      expect(result).toEqual(mockResponse.gameState);
    });

  });

  describe('getRawState', () => {
    it('should get raw state', async () => {
      const mockState = {
        id: 'instance1',
        state: { status: 'playing', private_data: 'hidden' },
        state_version: 1,
      };

      mockContracts.getState = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.getRawState();

      expect(result).toEqual(mockState.state);
    });

  });

  describe('action', () => {
    it('should execute action successfully', async () => {
      const mockResponse = {
        events: [{ event_type: 'MovePlayed' }],
        version: 2,
      };

      mockContracts.executeAction = vi.fn().mockResolvedValue(mockResponse);

      const result = await gameClient.action('move', { x: 1, y: 2 });

      expect(result).toEqual({
        events: mockResponse.events,
        version: mockResponse.version,
      });
      expect(mockContracts.executeAction).toHaveBeenCalledWith(
        'instance1',
        'move',
        { x: 1, y: 2 },
        undefined
      );
    });

    it('should execute action with options', async () => {
      const mockResponse = {
        events: [],
        version: 1,
      };

      mockContracts.executeAction = vi.fn().mockResolvedValue(mockResponse);

      const result = await gameClient.action('move', { x: 1 }, {
        idempotency_key: 'key1',
      });

      expect(result).toEqual({
        events: [],
        version: 1,
      });
      expect(mockContracts.executeAction).toHaveBeenCalledWith(
        'instance1',
        'move',
        { x: 1 },
        { idempotency_key: 'key1' }
      );
    });

    it('should return error on failure', async () => {
      const error = new Error('Invalid move');
      mockContracts.executeAction = vi.fn().mockRejectedValue(error);

      const result = await gameClient.action('move', { x: 1 });

      expect(result.error).toBe('Invalid move');
    });
  });

  describe('actionOrThrow', () => {
    it('should throw on error', async () => {
      const error = new Error('Invalid move');
      mockContracts.executeAction = vi.fn().mockRejectedValue(error);

      await expect(gameClient.actionOrThrow('move', { x: 1 })).rejects.toThrow(
        "Action 'move' failed: Invalid move\nInstance: instance1, User: user1"
      );
    });

    it('should return result on success', async () => {
      const mockResponse = {
        events: [],
        version: 1,
      };

      mockContracts.executeAction = vi.fn().mockResolvedValue(mockResponse);

      const result = await gameClient.actionOrThrow('move', { x: 1 });

      expect(result).toEqual({
        events: [],
        version: 1,
      });
    });
  });

  describe('getStatus', () => {
    it('should get game status', async () => {
      const mockState = { status: 'playing' };
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.getStatus();

      expect(result).toBe('playing');
    });
  });

  describe('getPhase', () => {
    it('should get game phase', async () => {
      const mockState = { phase: 'setup' };
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.getPhase();

      expect(result).toBe('setup');
    });
  });

  describe('isFinished', () => {
    it('should return true when gameFinished is true', async () => {
      const mockState = { gameFinished: true };
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.isFinished();

      expect(result).toBe(true);
    });

    it('should return true when status is finished', async () => {
      const mockState = { status: 'finished' };
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.isFinished();

      expect(result).toBe(true);
    });

    it('should return false when game is not finished', async () => {
      const mockState = { status: 'playing' };
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.isFinished();

      expect(result).toBe(false);
    });
  });

  describe('getWinner', () => {
    it('should get winner from state', async () => {
      const mockState = { winner: 'user1' };
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.getWinner();

      expect(result).toBe('user1');
    });

    it('should get winner from places', async () => {
      const mockState = {
        places: [
          { place: 1, playerId: 'user1' },
          { place: 2, playerId: 'user2' },
        ],
      };
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.getWinner();

      expect(result).toBe('user1');
    });

    it('should return null when no winner', async () => {
      const mockState = { status: 'playing' };
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.getWinner();

      expect(result).toBeNull();
    });
  });

  describe('getPlaces', () => {
    it('should get places', async () => {
      const mockPlaces = [
        { place: 1, playerId: 'user1' },
        { place: 2, playerId: 'user2' },
      ];
      const mockState = { places: mockPlaces };
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.getPlaces();

      expect(result).toEqual(mockPlaces);
    });

    it('should return empty array when no places', async () => {
      const mockState = {};
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.getPlaces();

      expect(result).toEqual([]);
    });
  });

  describe('getPlayers', () => {
    it('should get players as array of strings', async () => {
      const mockState = { players: ['user1', 'user2'] };
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.getPlayers();

      expect(result).toEqual(['user1', 'user2']);
    });

    it('should extract player IDs from objects', async () => {
      const mockState = {
        players: [
          { playerId: 'user1' },
          { id: 'user2' },
          'user3',
        ],
      };
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.getPlayers();

      expect(result).toEqual(['user1', 'user2', 'user3']);
    });

    it('should return empty array when no players', async () => {
      const mockState = {};
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.getPlayers();

      expect(result).toEqual([]);
    });
  });

  describe('isMyTurn', () => {
    it('should return true when it is user turn', async () => {
      const mockState = {
        currentPlayerIndex: 0,
        players: ['user1', 'user2'],
      };
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.isMyTurn();

      expect(result).toBe(true);
    });

    it('should return false when it is not user turn', async () => {
      const mockState = {
        currentPlayerIndex: 1,
        players: ['user1', 'user2'],
      };
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.isMyTurn();

      expect(result).toBe(false);
    });

    it('should return false when currentPlayerIndex is undefined', async () => {
      const mockState = { players: ['user1'] };
      mockContracts.view = vi.fn().mockResolvedValue(mockState);

      const result = await gameClient.isMyTurn();

      expect(result).toBe(false);
    });
  });

  describe('accessors', () => {
    it('should get instance ID', () => {
      expect(gameClient.getInstanceId()).toBe('instance1');
    });

    it('should get user ID', () => {
      expect(gameClient.getUserId()).toBe('user1');
    });

    it('should get client', () => {
      expect(gameClient.getClient()).toBe(mockClient);
    });
  });

  describe('create', () => {
    it('should create a new game instance', async () => {
      const mockInstance = {
        instance_id: 'new-instance',
        program_type: 'battleship',
        state: {},
        state_version: 0,
        status: 'active',
      };

      mockContracts.create = vi.fn().mockResolvedValue(mockInstance);

      const result = await GameClient.create(mockClient, 'battleship', 'user1', {
        args: { boardSize: 10 },
      });

      expect(result).toBeInstanceOf(GameClient);
      expect(result.getInstanceId()).toBe('new-instance');
      expect(result.getUserId()).toBe('user1');
      expect(mockContracts.create).toHaveBeenCalledWith(
        'battleship',
        { boardSize: 10 },
        { instanceId: undefined }
      );
    });

    it('should create with instance ID', async () => {
      const mockInstance = {
        id: 'custom-instance',
        program_type: 'battleship',
        state: {},
        state_version: 0,
        status: 'active',
      };

      mockContracts.create = vi.fn().mockResolvedValue(mockInstance);

      const result = await GameClient.create(mockClient, 'battleship', 'user1', {
        instanceId: 'custom-instance',
      });

      expect(result.getInstanceId()).toBe('custom-instance');
      expect(mockContracts.create).toHaveBeenCalledWith(
        'battleship',
        undefined,
        { instanceId: 'custom-instance' }
      );
    });

    it('should throw when instance creation fails', async () => {
      const mockInstance = {};

      mockContracts.create = vi.fn().mockResolvedValue(mockInstance);

      await expect(
        GameClient.create(mockClient, 'battleship', 'user1')
      ).rejects.toThrow('Failed to create instance: no instance_id returned');
    });
  });
});
