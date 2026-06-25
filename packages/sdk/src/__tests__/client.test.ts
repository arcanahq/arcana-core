import { ArcanaClient } from '../client.js';
import axios from 'axios';
import { encode } from '@msgpack/msgpack';

vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;

describe('ArcanaClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.create.mockReturnValue({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn(),
        },
        response: {
          use: vi.fn(),
        },
      },
    } as any);
  });

  it('should create client with default config', () => {
    const client = new ArcanaClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(client.contracts).toBeDefined();
    expect(client.programs).toBe(client.contracts);
    expect(client.history).toBeDefined();
    expect(client.tables).toBeDefined();
    expect(client.transactions).toBeDefined();
    expect(client.billing).toBeDefined();
    expect(client.scopes).toBeDefined();
    expect(client.bank).toBeDefined();
    expect(client.config).toBeDefined();
  });

  it('should create client with custom config', () => {
    const getToken = vi.fn(() => 'test-token');
    const setToken = vi.fn();
    
    const client = new ArcanaClient({
      apiUrl: 'http://custom-url:3000',
      getToken,
      setToken,
    });
    
    expect(client).toBeDefined();
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://custom-url:3000',
      })
    );
  });

  it('should use environment variable for API URL', () => {
    const originalEnv = process.env.ARCANA_API_URL;
    process.env.ARCANA_API_URL = 'http://env-url:4000';
    
    new ArcanaClient();
    
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://env-url:4000',
      })
    );
    
    if (originalEnv) {
      process.env.ARCANA_API_URL = originalEnv;
    } else {
      delete process.env.ARCANA_API_URL;
    }
  });

  it('should get API instance', () => {
    const client = new ArcanaClient();
    const apiInstance = client.getApiInstance();
    expect(apiInstance).toBeDefined();
  });

  it('should decode MessagePack API responses in the shared transport', () => {
    new ArcanaClient();
    const createConfig = mockedAxios.create.mock.calls.at(-1)?.[0] as any;
    const [transformResponse] = createConfig.transformResponse;
    const payload = {
      status: 200,
      message: 'Instances retrieved',
      data: [{ instance_id: 'instance-1', program_type: 'cage' }],
    };

    expect(transformResponse(encode(payload), { 'content-type': 'application/msgpack' })).toEqual(payload);
  });
});
