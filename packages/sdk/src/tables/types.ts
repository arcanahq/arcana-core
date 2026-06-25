/**
 * Table types
 */

export interface Table {
  id: string;
  contract_id?: string;
  game_type: string;
  table_mode: 'cash' | 'tournament';
  min_players: number;
  max_players: number;
  created_by: string;
  is_private: boolean;
  invite_code?: string;
  status: 'waiting' | 'playing' | 'finished' | 'rematch_pending' | 'closed';
  rematch_requested_by?: string;
  rematch_deadline?: string;
  rematch_responses?: Record<string, 'accepted' | 'declined'>;
  entry_fee?: string;
  buy_in?: string;
  token?: string;
  min_buy_in?: string;
  max_buy_in?: string;
  config_json?: any;
  created_at: string;
  updated_at: string;
  player_count?: number;
  players?: string[];
}

export interface CreateTableRequest {
  game_type: string;
  table_mode: 'cash' | 'tournament';
  min_players?: number;
  max_players?: number;
  is_private?: boolean;
  password?: string;
  entry_fee?: string;
  buy_in?: string;
  token?: string;
  min_buy_in?: string;
  max_buy_in?: string;
  match_format?: 'single' | 'best_of_3' | 'best_of_5' | 'best_of_N';
  match_format_value?: number;
  house_rules?: {
    allowStacking?: boolean;
  };
}

export interface JoinTableRequest {
  password?: string;
  seat_number?: number;
  buy_in_amount?: string;
}

export interface TableSeat {
  id: string;
  table_id: string;
  seat_number: number;
  user_id?: string;
  is_sitting_out: boolean;
  has_seat_preference: boolean;
  joined_at?: string;
  last_active_at?: string;
}

export interface ListTablesOptions {
  game_type?: string;
  table_mode?: string;
  status?: string;
  scope_id?: string;
  limit?: number;
  offset?: number;
}

