import { AxiosInstance } from 'axios';
import { extractData, ApiResponse } from '../types/common.js';
import { EventHistoryCursor } from '../contracts/index.js';
import type { EventHistoryOptions, EventPage, InstanceEvent } from '../contracts/types.js';

export interface QueryEventsOptions {
  scope_id?: string;
  program_type?: string;
  instance_id?: string;
  event_type?: string;
  topic0?: string;
  topic1?: string;
  topic2?: string;
  topic3?: string;
  cursor?: string;
  page_size?: number;
  limit?: number;
}

export class EventsModule {
  constructor(private api: AxiosInstance) {}

  async queryPage(options: QueryEventsOptions = {}): Promise<EventPage> {
    const response = await this.api.get<ApiResponse<any>>('/events', { params: options });
    const data = extractData(response);
    return {
      items: (data.items || []).map((event: any) => this.normalizeEvent(event)),
      next_cursor: data.next_cursor ?? null,
    };
  }

  async query(options: QueryEventsOptions = {}): Promise<InstanceEvent[]> {
    const page = await this.queryPage(options);
    return page.items;
  }

  history(options: EventHistoryOptions & QueryEventsOptions = {}): EventHistoryCursor {
    return new EventHistoryCursor((pageOptions) => this.queryPage(pageOptions), options);
  }

  private normalizeEvent(apiEvent: any): InstanceEvent {
    const topics = Array.isArray(apiEvent.topics)
      ? apiEvent.topics.filter((topic: unknown): topic is string => typeof topic === 'string')
      : [apiEvent.topic0, apiEvent.topic1, apiEvent.topic2, apiEvent.topic3].filter(
          (topic: unknown): topic is string => typeof topic === 'string',
        );
    const data = apiEvent.data ?? apiEvent.data_hex ?? null;

    return {
      ...apiEvent,
      data,
      topics,
      topic0: apiEvent.topic0 ?? topics[0] ?? null,
      topic1: apiEvent.topic1 ?? topics[1] ?? null,
      topic2: apiEvent.topic2 ?? topics[2] ?? null,
      topic3: apiEvent.topic3 ?? topics[3] ?? null,
      event_data: apiEvent.event_data ?? apiEvent.payload ?? data,
    };
  }
}

export type { EventPage, InstanceEvent };
