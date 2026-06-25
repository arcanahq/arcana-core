/**
 * Transaction types
 */

export type TransactionStatus = 'pending' | 'executing' | 'completed' | 'failed';

export interface TransactionResult {
  transaction_id: string;
  status: TransactionStatus;
  response?: any;
  error?: string;
}

export interface TransactionInfo {
  transaction_id: string;
  status: string;
  contract_id?: string;
  scope_id?: string;
  error_message?: string;
  created_at?: string;
  completed_at?: string;
}

export interface WaitOptions {
  timeout?: number; // Timeout in milliseconds
  pollInterval?: number; // Poll interval in milliseconds (default: 100)
}

