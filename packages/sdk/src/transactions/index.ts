import axios, { AxiosInstance } from 'axios';
import { extractData, ApiResponse, ArcanaApiError } from '../types/common.js';
import type {
  TransactionResult,
  WaitOptions,
} from './types.js';

/**
 * Transactions module
 * 
 * Provides methods for checking transaction status and waiting for completion:
 * - Get transaction status
 * - Wait for transaction completion
 */
export class TransactionsModule {
  constructor(private api: AxiosInstance) {}

  /**
   * Get transaction status by ID
   * 
   * @param transactionId - The transaction ID
   */
  async getStatus(transactionId: string): Promise<TransactionResult | null> {
    try {
      const response = await this.api.get<ApiResponse<TransactionResult>>(
        `/instances/transactions/${transactionId}`
      );
      return extractData(response);
    } catch (error: any) {
      if (error instanceof ArcanaApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Wait for a transaction to complete
   * 
   * This method polls the transaction status until it completes or fails.
   * 
   * @param transactionId - The transaction ID
   * @param options - Wait options (timeout, pollInterval)
   */
  async wait(
    transactionId: string,
    options?: WaitOptions
  ): Promise<any> {
    const timeout = options?.timeout || 30000; // Default 30 seconds
    const pollInterval = options?.pollInterval || 100; // Default 100ms
    const startTime = Date.now();

    // First, try the server's wait endpoint (more efficient)
    try {
      const response = await this.api.get<ApiResponse<any>>(
        `/instances/transactions/${transactionId}/wait`,
        { timeout: timeout + 1000 } // Add buffer for HTTP timeout
      );
      return extractData(response);
    } catch (error: any) {
      // If server wait endpoint fails, fall back to polling
      if (error instanceof ArcanaApiError && error.status === 404) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }
      
      // For other errors, fall back to polling
    }

    // Fallback: Poll for status
    while (Date.now() - startTime < timeout) {
      const status = await this.getStatus(transactionId);
      
      if (!status) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }

      if (status.status === 'completed') {
        if (status.response) {
          return status.response;
        }
        throw new Error('Transaction completed but response is missing');
      }

      if (status.status === 'failed') {
        const errorMsg = status.error || 'Transaction failed';
        throw new Error(errorMsg);
      }

      // Still pending or executing, wait and poll again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Transaction timeout after ${timeout}ms: ${transactionId}`);
  }
}

