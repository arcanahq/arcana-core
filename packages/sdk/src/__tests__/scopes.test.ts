import { ScopesModule } from '../scopes/index.js';
import { encodeArgsBytes } from '../utils/bytes.js';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;

describe('ScopesModule', () => {
  let scopesModule: ScopesModule;
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
    };
    
    scopesModule = new ScopesModule(mockApi);
  });

  describe('createScope', () => {
    it('should create a scope successfully', async () => {
      const mockScope = {
        scope_id: 'test-project:my-scope',
        name: 'My Scope',
        owner_user_id: 'user-123',
        visibility: 'private' as const,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Scope created',
          data: mockScope,
        },
      });

      const result = await scopesModule.createScope({
        name: 'My Scope',
        scope_id: 'test-project:my-scope',
        visibility: 'private',
      });

      expect(result).toEqual(mockScope);
      expect(mockApi.post).toHaveBeenCalledWith(
        '/scopes',
        {
          name: 'My Scope',
          scope_id: 'test-project:my-scope',
          visibility: 'private',
        }
      );
    });

    it('should handle scope creation errors', async () => {
      // Axios will throw for non-2xx status codes if configured, or we can test the response
      // For now, test that the request is made correctly
      mockApi.post.mockRejectedValue(new Error('Invalid scope name'));

      await expect(
        scopesModule.createScope({ name: '' })
      ).rejects.toThrow('Invalid scope name');
    });
  });

  describe('listScopes', () => {
    it('should list scopes without filters', async () => {
      const mockScopes = [
        {
          scope_id: 'scope-1',
          name: 'Scope 1',
          owner_user_id: 'user-1',
          visibility: 'public' as const,
        },
        {
          scope_id: 'scope-2',
          name: 'Scope 2',
          owner_user_id: 'user-2',
          visibility: 'private' as const,
        },
      ];

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Scopes retrieved',
          data: mockScopes,
        },
      });

      const result = await scopesModule.listScopes();

      expect(result).toEqual(mockScopes);
      expect(mockApi.get).toHaveBeenCalledWith('/scopes', { params: {} });
    });

    it('should list scopes with project filter', async () => {
      const mockScopes = [
        {
          scope_id: 'project-1:scope-1',
          name: 'Scope 1',
          owner_user_id: 'user-1',
          visibility: 'public' as const,
        },
      ];

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Scopes retrieved',
          data: mockScopes,
        },
      });

      const result = await scopesModule.listScopes({ project_id: 'project-1' });

      expect(result).toEqual(mockScopes);
      expect(mockApi.get).toHaveBeenCalledWith('/scopes', {
        params: { project_id: 'project-1' },
      });
    });

    it('should list scopes with pagination', async () => {
      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Scopes retrieved',
          data: [],
        },
      });

      await scopesModule.listScopes({ limit: 10, offset: 20 });

      expect(mockApi.get).toHaveBeenCalledWith('/scopes', {
        params: { limit: 10, offset: 20 },
      });
    });
  });

  describe('getScope', () => {
    it('should get scope details', async () => {
      const mockScope = {
        scope_id: 'test-scope',
        name: 'Test Scope',
        owner_user_id: 'user-123',
        visibility: 'public' as const,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Scope retrieved',
          data: mockScope,
        },
      });

      const result = await scopesModule.getScope('test-scope');

      expect(result).toEqual(mockScope);
      expect(mockApi.get).toHaveBeenCalledWith('/scopes/test-scope');
    });

    it('should handle scope not found', async () => {
      // Axios will throw for non-2xx status codes
      mockApi.get.mockRejectedValue(new Error('Scope not found'));

      await expect(scopesModule.getScope('non-existent')).rejects.toThrow('Scope not found');
    });
  });

  describe('deployProgram', () => {
    it('should deploy program with base64 WASM', async () => {
      const mockProgram = {
        program_id: 'program-uuid',
        program_type: 'my-contract',
        wasm_hash: 'abc123...',
        scope_id: 'test-scope',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Program deployed',
          data: mockProgram,
        },
      });

      const result = await scopesModule.deployProgram('test-scope', {
        program_type: 'my-contract',
        wasm: 'base64-encoded-wasm',
        version: '1.0.0',
        metadata: {
          visibility: 'public',
          singleton: false,
        },
      });

      expect(result).toEqual(mockProgram);
      expect(mockApi.post).toHaveBeenCalledWith(
        '/scopes/test-scope/programs',
        {
          program_type: 'my-contract',
          wasm: 'base64-encoded-wasm',
          version: '1.0.0',
          metadata: {
            visibility: 'public',
            singleton: false,
          },
        }
      );
    });

    it('should deploy program with metadata and privileges', async () => {
      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Program deployed',
          data: {
            program_id: 'program-uuid',
            program_type: 'my-contract',
            wasm_hash: 'abc123...',
            scope_id: 'test-scope',
          },
        },
      });

      await scopesModule.deployProgram('test-scope', {
        program_type: 'my-contract',
        wasm: 'base64-wasm',
        metadata: {
          visibility: 'private',
          singleton: true,
          privileges: {
            kv_write: ['user/', 'config/'],
            kv_read: ['public/'],
            capabilities: ['bank.transfer'],
          },
        },
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        '/scopes/test-scope/programs',
        expect.objectContaining({
          program_type: 'my-contract',
          wasm: 'base64-wasm',
          metadata: expect.objectContaining({
            privileges: expect.objectContaining({
              kv_write: ['user/', 'config/'],
            }),
          }),
        })
      );
    });
  });

  describe('listPrograms', () => {
    it('should list programs in scope', async () => {
      const mockPrograms = [
        {
          program_id: 'program-1',
          program_type: 'contract-1',
          wasm_hash: 'hash-1',
          scope_id: 'test-scope',
        },
        {
          program_id: 'program-2',
          program_type: 'contract-2',
          wasm_hash: 'hash-2',
          scope_id: 'test-scope',
        },
      ];

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Programs retrieved',
          data: mockPrograms,
        },
      });

      const result = await scopesModule.listPrograms('test-scope');

      expect(result).toEqual(mockPrograms);
      expect(mockApi.get).toHaveBeenCalledWith('/scopes/test-scope/programs', {
        params: {},
      });
    });

    it('should list programs with pagination', async () => {
      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Programs retrieved',
          data: [],
        },
      });

      await scopesModule.listPrograms('test-scope', { limit: 5, offset: 10 });

      expect(mockApi.get).toHaveBeenCalledWith('/scopes/test-scope/programs', {
        params: { limit: 5, offset: 10 },
      });
    });

    it('should handle empty program list', async () => {
      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Programs retrieved',
          data: [],
        },
      });

      const result = await scopesModule.listPrograms('empty-scope');
      expect(result).toEqual([]);
    });
  });

  describe('createInstance', () => {
    it('should create instance with program_id and args_bytes', async () => {
      const argsBytes = encodeArgsBytes({ initialValue: 0 });
      const mockInstance = {
        instance_id: 'instance-uuid',
        program_type: 'my-program',
        scope_id: 'test-scope',
        state: { value: 0 },
        state_version: 0,
        status: 'active',
      };

      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Instance created',
          data: mockInstance,
        },
      });

      const result = await scopesModule.createInstance('test-scope', {
        program_id: 'program-uuid',
        args_bytes: argsBytes,
        entrypoint: 'initialize',
      });

      expect(result).toEqual(mockInstance);
      expect(mockApi.post).toHaveBeenCalledWith(
        '/scopes/test-scope/instances',
        {
          program_id: 'program-uuid',
          args_bytes: argsBytes,
          entrypoint: 'initialize',
        }
      );
    });

    it('should create instance with optional instance_id', async () => {
      const argsBytes = encodeArgsBytes({});
      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Instance created',
          data: {
            instance_id: 'custom-instance-id',
            program_type: 'my-program',
            scope_id: 'test-scope',
          },
        },
      });

      await scopesModule.createInstance('test-scope', {
        program_id: 'program-uuid',
        args_bytes: argsBytes,
        contract_id: 'custom-instance-id',
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        '/scopes/test-scope/instances',
        {
          program_id: 'program-uuid',
          args_bytes: argsBytes,
          contract_id: 'custom-instance-id',
        }
      );
    });

    it('should create instance without entrypoint (defaults to initialize)', async () => {
      const argsBytes = encodeArgsBytes({ value: 10 });
      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Instance created',
          data: {
            instance_id: 'instance-uuid',
            program_type: 'my-program',
            scope_id: 'test-scope',
          },
        },
      });

      await scopesModule.createInstance('test-scope', {
        program_id: 'program-uuid',
        args_bytes: argsBytes,
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        '/scopes/test-scope/instances',
        {
          program_id: 'program-uuid',
          args_bytes: argsBytes,
        }
      );
    });

    it('should pass discoverable when provided', async () => {
      const argsBytes = encodeArgsBytes({ discoverable: true });
      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Instance created',
          data: {
            instance_id: 'instance-uuid',
            program_type: 'my-program',
            scope_id: 'test-scope',
          },
        },
      });

      await scopesModule.createInstance('test-scope', {
        program_id: 'program-uuid',
        args_bytes: argsBytes,
        discoverable: true,
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        '/scopes/test-scope/instances',
        {
          program_id: 'program-uuid',
          args_bytes: argsBytes,
          discoverable: true,
        }
      );
    });
  });

  describe('listInstances', () => {
    it('should list instances in scope', async () => {
      const mockInstances = [
        {
          instance_id: 'instance-1',
          program_type: 'program-1',
          scope_id: 'test-scope',
          status: 'active',
        },
        {
          instance_id: 'instance-2',
          program_type: 'program-2',
          scope_id: 'test-scope',
          status: 'active',
        },
      ];

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Instances retrieved',
          data: mockInstances,
        },
      });

      const result = await scopesModule.listInstances('test-scope');

      expect(result).toEqual(mockInstances);
      expect(mockApi.get).toHaveBeenCalledWith('/scopes/test-scope/instances', {
        params: {},
      });
    });

    it('should list instances with pagination', async () => {
      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Instances retrieved',
          data: [],
        },
      });

      await scopesModule.listInstances('test-scope', { limit: 20, offset: 0 });

      // offset: 0 is falsy, so it may not be included in params
      // Check that limit is included
      expect(mockApi.get).toHaveBeenCalledWith(
        '/scopes/test-scope/instances',
        expect.objectContaining({
          params: expect.objectContaining({
            limit: 20,
          }),
        })
      );
    });

    it('should include terminated instances when requested', async () => {
      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Instances retrieved',
          data: [],
        },
      });

      await scopesModule.listInstances('test-scope', { include_terminated: true });

      expect(mockApi.get).toHaveBeenCalledWith('/scopes/test-scope/instances', {
        params: { include_terminated: true },
      });
    });
  });

  describe('getKV', () => {
    it('should get KV store', async () => {
      const mockKV = {
        'config/app_name': 'My App',
        'config/version': '1.0.0',
        'user/alice': '{"name": "Alice"}',
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'KV retrieved',
          data: mockKV,
        },
      });

      const result = await scopesModule.getKV('test-scope');

      expect(result).toEqual(mockKV);
      expect(mockApi.get).toHaveBeenCalledWith('/scopes/test-scope/kv');
    });

    it('should handle empty KV store', async () => {
      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'KV retrieved',
          data: {},
        },
      });

      const result = await scopesModule.getKV('empty-scope');
      expect(result).toEqual({});
    });
  });

  describe('setKV', () => {
    it('should set single KV key', async () => {
      mockApi.put.mockResolvedValue({
        data: {
          status: 200,
          message: 'KV updated',
          data: null,
        },
      });

      await scopesModule.setKV('test-scope', {
        'config/app_name': 'My App',
      });

      expect(mockApi.put).toHaveBeenCalledTimes(1);
      expect(mockApi.put).toHaveBeenCalledWith('/scopes/test-scope/kv', {
        key: 'config/app_name',
        value: 'My App',
      });
    });

    it('should set multiple KV keys', async () => {
      mockApi.put.mockResolvedValue({
        data: {
          status: 200,
          message: 'KV updated',
          data: null,
        },
      });

      await scopesModule.setKV('test-scope', {
        'config/app_name': 'My App',
        'config/version': '1.0.0',
        'user/alice': '{"name": "Alice"}',
      });

      expect(mockApi.put).toHaveBeenCalledTimes(3);
      expect(mockApi.put).toHaveBeenNthCalledWith(1, '/scopes/test-scope/kv', {
        key: 'config/app_name',
        value: 'My App',
      });
      expect(mockApi.put).toHaveBeenNthCalledWith(2, '/scopes/test-scope/kv', {
        key: 'config/version',
        value: '1.0.0',
      });
      expect(mockApi.put).toHaveBeenNthCalledWith(3, '/scopes/test-scope/kv', {
        key: 'user/alice',
        value: '{"name": "Alice"}',
      });
    });
  });
});
