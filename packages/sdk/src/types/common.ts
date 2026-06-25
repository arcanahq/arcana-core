/**
 * Common types and API response wrappers
 */

export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface ApiError {
  status: number;
  message: string;
  error?: string;
  data?: any;
}

/**
 * Custom error class for API errors
 */
export class ArcanaApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ArcanaApiError';
  }
}

/**
 * Custom error class for network errors
 */
export class ArcanaNetworkError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'ArcanaNetworkError';
  }
}

/**
 * Custom error class for instance action errors
 */
export class ArcanaInstanceError extends Error {
  constructor(
    message: string,
    public instanceId?: string,
    public entrypoint?: string,
    public response?: any
  ) {
    super(message);
    this.name = 'ArcanaInstanceError';
  }
}

/**
 * Helper to extract data from API response
 */
export function extractData<T>(response: { data: ApiResponse<T> }): T {
  return response.data.data;
}

