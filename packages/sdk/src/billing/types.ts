/**
 * Billing types
 */

export interface Project {
  project_id: string;
  project_name: string;
  owner_user_id: string;
  registered_at?: string;
  registration_fee_paid?: boolean;
  metadata?: any;
}

export interface ProjectFunding {
  asset_id: string;
  balance: string;
  last_updated: string;
}

export interface BillingEvent {
  id: string;
  scope_id: string;
  event_type: 'ACTION_EXEC' | 'VIEW_RECOMPUTE' | 'STORAGE_BYTES';
  units: number;
  timestamp: string;
  metadata_json?: any;
}

export interface Budget {
  scope_id: string;
  asset_id: string;
  balance: string;
  last_updated?: string;
}

export interface BillingTransaction {
  id: string;
  project_id?: string;
  transaction_type: string;
  amount: string;
  asset_id: string;
  timestamp: string;
  metadata_json?: any;
}

export interface UserBalance {
  asset_id: string;
  balance: string;
}

export interface CreateProjectRequest {
  project_name: string;
  metadata?: any;
  fund_from_user?: {
    asset_id: string;
    amount: string;
  };
}

export interface FundProjectRequest {
  asset_id: string;
  amount: string;
}

export interface FundUserRequest {
  asset_id: string;
  amount: string;
}

export interface ProjectUsage {
  request_count: number;
}

export interface ProjectStorage {
  storage_bytes: number;
}
