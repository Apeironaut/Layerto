import type { RequestLogItem } from '@layerto/types';
import { api } from './api';

const PAGE_SIZE = 50; // server page size for /api/requests
const MAX_PAGES = 20; // up to 1,000 requests per chart

export interface RequestHistory {
  items: RequestLogItem[];
  /** True if older requests in the range were not fetched (more than MAX_PAGES pages). */
  truncated: boolean;
}

/** Fetches request history newest-first until it reaches `since` (or the page cap). */
export async function fetchRequestsSince(since: Date): Promise<RequestHistory> {
  const items: RequestLogItem[] = [];
  let cursor: number | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await api.getRequests(cursor);
    items.push(...batch);
    const oldest = batch[batch.length - 1];
    if (batch.length < PAGE_SIZE || !oldest || new Date(oldest.created_at) < since) {
      return { items, truncated: false };
    }
    cursor = oldest.seq;
  }
  return { items, truncated: true };
}
