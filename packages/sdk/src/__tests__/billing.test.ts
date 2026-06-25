import { BillingModule } from '../billing/index.js';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;

describe('BillingModule', () => {
  let billingModule: BillingModule;
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    };
    
    billingModule = new BillingModule(mockApi);
  });

  describe('getUserBalance', () => {
    it('should get user balance', async () => {
      const mockBalance = [
        { asset_id: 'asset1', balance: '1000', formatted: '1000.00' },
      ];

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockBalance,
        },
      });

      const result = await billingModule.getUserBalance();

      expect(result).toEqual(mockBalance);
      expect(mockApi.get).toHaveBeenCalledWith('/billing/user/balance');
    });
  });

  describe('fundUserAccount', () => {
    it('should fund user account', async () => {
      const request = { asset_id: 'asset1', amount: '100' };
      const mockResponse = { transaction_id: 'tx123' };

      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockResponse,
        },
      });

      const result = await billingModule.fundUserAccount(request);

      expect(result).toEqual(mockResponse);
      expect(mockApi.post).toHaveBeenCalledWith('/billing/user/fund', request);
    });
  });

  describe('getUserTransactions', () => {
    it('should get user transactions without options', async () => {
      const mockTransactions = [
        { id: 'tx1', type: 'deposit', amount: '100' },
      ];

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockTransactions,
        },
      });

      const result = await billingModule.getUserTransactions();

      expect(result).toEqual(mockTransactions);
      expect(mockApi.get).toHaveBeenCalledWith('/billing/user/transactions', { params: {} });
    });

    it('should get user transactions with pagination', async () => {
      const mockTransactions = [{ id: 'tx1' }];
      const options = { limit: 10, offset: 20 };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockTransactions,
        },
      });

      const result = await billingModule.getUserTransactions(options);

      expect(result).toEqual(mockTransactions);
      expect(mockApi.get).toHaveBeenCalledWith('/billing/user/transactions', {
        params: { limit: 10, offset: 20 },
      });
    });
  });

  describe('createProject', () => {
    it('should create a project', async () => {
      const request = { project_name: 'My Project' };
      const mockProject = {
        id: 'project1',
        project_name: 'My Project',
      };

      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockProject,
        },
      });

      const result = await billingModule.createProject(request);

      expect(result).toEqual(mockProject);
      expect(mockApi.post).toHaveBeenCalledWith('/billing/projects', request);
    });
  });

  describe('listProjects', () => {
    it('should list all projects', async () => {
      const mockProjects = [
        { id: 'project1', name: 'Project 1' },
        { id: 'project2', name: 'Project 2' },
      ];

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockProjects,
        },
      });

      const result = await billingModule.listProjects();

      expect(result).toEqual(mockProjects);
      expect(mockApi.get).toHaveBeenCalledWith('/billing/projects');
    });
  });

  describe('getProject', () => {
    it('should get project details', async () => {
      const mockProject = { id: 'project1', name: 'My Project' };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockProject,
        },
      });

      const result = await billingModule.getProject('project1');

      expect(result).toEqual(mockProject);
      expect(mockApi.get).toHaveBeenCalledWith('/billing/projects/project1');
    });
  });

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      const mockResponse = { project_id: 'project1' };

      mockApi.delete.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockResponse,
        },
      });

      const result = await billingModule.deleteProject('project1');

      expect(result).toEqual(mockResponse);
      expect(mockApi.delete).toHaveBeenCalledWith('/billing/projects/project1');
    });
  });

  describe('getProjectFunding', () => {
    it('should get project funding', async () => {
      const mockFunding = [
        { asset_id: 'asset1', balance: '500' },
      ];

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockFunding,
        },
      });

      const result = await billingModule.getProjectFunding('project1');

      expect(result).toEqual(mockFunding);
      expect(mockApi.get).toHaveBeenCalledWith('/billing/projects/project1/funding');
    });
  });

  describe('fundProject', () => {
    it('should fund a project', async () => {
      const request = { asset_id: 'asset1', amount: '200' };
      const mockResponse = { transaction_id: 'tx123' };

      mockApi.post.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockResponse,
        },
      });

      const result = await billingModule.fundProject('project1', request);

      expect(result).toEqual(mockResponse);
      expect(mockApi.post).toHaveBeenCalledWith('/billing/projects/project1/fund', request);
    });
  });

  describe('getProjectTransactions', () => {
    it('should get project transactions', async () => {
      const mockTransactions = [{ id: 'tx1', project_id: 'project1' }];
      const options = { limit: 20 };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockTransactions,
        },
      });

      const result = await billingModule.getProjectTransactions('project1', options);

      expect(result).toEqual(mockTransactions);
      expect(mockApi.get).toHaveBeenCalledWith('/billing/projects/project1/transactions', {
        params: { limit: 20 },
      });
    });
  });

  describe('getProjectUsage', () => {
    it('should get project usage statistics', async () => {
      const mockUsage = {
        compute_seconds: 1000,
        storage_bytes: 50000,
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockUsage,
        },
      });

      const result = await billingModule.getProjectUsage('project1');

      expect(result).toEqual(mockUsage);
      expect(mockApi.get).toHaveBeenCalledWith('/billing/projects/project1/usage');
    });
  });

  describe('getProjectStorage', () => {
    it('should get project storage statistics', async () => {
      const mockStorage = {
        total_bytes: 100000,
        instance_count: 5,
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockStorage,
        },
      });

      const result = await billingModule.getProjectStorage('project1');

      expect(result).toEqual(mockStorage);
      expect(mockApi.get).toHaveBeenCalledWith('/billing/projects/project1/storage');
    });
  });

  describe('getScopeBudget', () => {
    it('should get scope budget', async () => {
      const mockBudget = {
        scope_id: 'scope1',
        allocated: '1000',
        spent: '500',
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockBudget,
        },
      });

      const result = await billingModule.getScopeBudget('scope1');

      expect(result).toEqual(mockBudget);
      expect(mockApi.get).toHaveBeenCalledWith('/billing/scopes/scope1/budget');
    });

    it('should return null on 404', async () => {
      const error: any = new Error('Not found');
      error.response = { status: 404 };

      mockApi.get.mockRejectedValue(error);

      const result = await billingModule.getScopeBudget('scope1');

      expect(result).toBeNull();
    });

    it('should throw on other errors', async () => {
      const error: any = new Error('Server error');
      error.response = { status: 500 };

      mockApi.get.mockRejectedValue(error);

      await expect(billingModule.getScopeBudget('scope1')).rejects.toThrow('Server error');
    });
  });

  describe('getScopeEvents', () => {
    it('should get scope billing events', async () => {
      const mockEvents = [
        { id: 'event1', event_type: 'charge', amount: '10' },
      ];

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockEvents,
        },
      });

      const result = await billingModule.getScopeEvents('scope1');

      expect(result).toEqual(mockEvents);
      expect(mockApi.get).toHaveBeenCalledWith('/billing/scopes/scope1/events', {
        params: {},
      });
    });

    it('should get scope events with filters', async () => {
      const mockEvents = [{ id: 'event1' }];
      const options = { limit: 10, offset: 0, event_type: 'charge' };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockEvents,
        },
      });

      const result = await billingModule.getScopeEvents('scope1', options);

      expect(result).toEqual(mockEvents);
      expect(mockApi.get).toHaveBeenCalledWith('/billing/scopes/scope1/events', {
        params: expect.objectContaining({
          limit: 10,
          event_type: 'charge',
        }),
      });
    });

    it('should propagate 404 errors', async () => {
      const error: any = new Error('Not found');
      error.response = { status: 404 };

      mockApi.get.mockRejectedValue(error);

      await expect(billingModule.getScopeEvents('scope1')).rejects.toThrow('Not found');
    });
  });
});
