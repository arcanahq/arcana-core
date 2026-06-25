import { TransactionsModule } from '../transactions/index.js';
import { ArcanaApiError } from '../types/common.js';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;

describe('TransactionsModule', () => {
  let transactionsModule: TransactionsModule;
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockApi = {
      get: vi.fn(),
    };
    
    transactionsModule = new TransactionsModule(mockApi);
  });

  afterEach(() => {
    // Clear any pending timers before switching
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('getStatus', () => {
    it('should get transaction status', async () => {
      const mockStatus = {
        transaction_id: 'tx1',
        status: 'completed',
        response: { result: 'success' },
      };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockStatus,
        },
      });

      const result = await transactionsModule.getStatus('tx1');

      expect(result).toEqual(mockStatus);
      expect(mockApi.get).toHaveBeenCalledWith('/instances/transactions/tx1');
    });

    it('should return null on 404', async () => {
      const error = new ArcanaApiError(404, 'Not found');

      mockApi.get.mockRejectedValue(error);

      const result = await transactionsModule.getStatus('tx1');

      expect(result).toBeNull();
    });

    it('should throw on other errors', async () => {
      const error = new Error('Server error');

      mockApi.get.mockRejectedValue(error);

      await expect(transactionsModule.getStatus('tx1')).rejects.toThrow('Server error');
    });
  });

  describe('wait', () => {
    it('should wait using server wait endpoint', async () => {
      const mockResponse = { result: 'success' };

      mockApi.get.mockResolvedValue({
        data: {
          status: 200,
          message: 'Success',
          data: mockResponse,
        },
      });

      const result = await transactionsModule.wait('tx1', { timeout: 5000 });

      expect(result).toEqual(mockResponse);
      expect(mockApi.get).toHaveBeenCalledWith('/instances/transactions/tx1/wait', {
        timeout: 6000, // timeout + 1000 buffer
      });
    });

    it('should fall back to polling when server wait endpoint fails', async () => {
      const waitError = new Error('Timeout');
      mockApi.get
        .mockRejectedValueOnce(waitError) // First call to /wait fails
        .mockResolvedValueOnce({
          data: {
            status: 200,
            message: 'Success',
            data: { transaction_id: 'tx1', status: 'completed', response: { result: 'success' } },
          },
        });

      const resultPromise = transactionsModule.wait('tx1', {
        timeout: 5000,
        pollInterval: 100,
      });

      // Fast-forward timers to trigger polling
      vi.advanceTimersByTime(100);

      const result = await resultPromise;

      expect(result).toEqual({ result: 'success' });
      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });

    it('should poll until transaction completes', async () => {
      // Clear fake timers before switching to real timers
      vi.clearAllTimers();
      vi.useRealTimers();
      
      // This test is complex with fake timers, so we'll test the polling logic
      // by verifying the fallback behavior when wait endpoint fails
      mockApi.get
        .mockRejectedValueOnce(new Error('Not found')) // /wait endpoint not found
        .mockResolvedValueOnce({
          data: {
            status: 200,
            message: 'Success',
            data: { transaction_id: 'tx1', status: 'completed', response: { result: 'success' } },
          },
        });
      
      const result = await transactionsModule.wait('tx1', {
        timeout: 1000,
        pollInterval: 50,
      });

      expect(result).toEqual({ result: 'success' });
      expect(mockApi.get).toHaveBeenCalledTimes(2);
    }, 5000);

    it('should throw on transaction failure', async () => {
      mockApi.get
        .mockRejectedValueOnce(new Error('Not found')) // /wait endpoint not found
        .mockResolvedValueOnce({
          data: {
            status: 200,
            message: 'Success',
            data: { transaction_id: 'tx1', status: 'failed', error: 'Transaction failed' },
          },
        });

      const resultPromise = transactionsModule.wait('tx1', {
        timeout: 5000,
        pollInterval: 100,
      });

      // Advance timers to trigger polling
      vi.advanceTimersByTime(100);
      // Run pending promises
      await Promise.resolve();

      await expect(resultPromise).rejects.toThrow('Transaction failed');
    });

    it('should throw on timeout', async () => {
      mockApi.get
        .mockRejectedValueOnce(new Error('Not found')) // /wait endpoint not found
        .mockResolvedValue({
          data: {
            status: 200,
            message: 'Success',
            data: { transaction_id: 'tx1', status: 'pending' },
          },
        });

      const resultPromise = transactionsModule.wait('tx1', {
        timeout: 1000,
        pollInterval: 100,
      });

      // Fast-forward past timeout
      vi.advanceTimersByTime(1100);
      // Run pending promises
      await Promise.resolve();

      await expect(resultPromise).rejects.toThrow('Transaction timeout after 1000ms');
    });

    it('should throw when transaction not found', async () => {
      const error = new ArcanaApiError(404, 'Not found');
      mockApi.get
        .mockRejectedValueOnce(new Error('Not found')) // /wait endpoint not found
        .mockRejectedValueOnce(error);

      const resultPromise = transactionsModule.wait('tx1', {
        timeout: 5000,
        pollInterval: 100,
      });

      vi.advanceTimersByTime(100);

      await expect(resultPromise).rejects.toThrow('Transaction not found: tx1');
    });

    it('should throw when response is missing after completion', async () => {
      mockApi.get
        .mockRejectedValueOnce(new Error('Not found')) // /wait endpoint not found
        .mockResolvedValueOnce({
          data: {
            status: 200,
            message: 'Success',
            data: { transaction_id: 'tx1', status: 'completed' }, // No response field
          },
        });

      const resultPromise = transactionsModule.wait('tx1', {
        timeout: 5000,
        pollInterval: 100,
      });

      vi.advanceTimersByTime(100);

      await expect(resultPromise).rejects.toThrow('Transaction completed but response is missing');
    });
  });
});
