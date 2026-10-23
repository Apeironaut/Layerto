import { LayertoClient } from '@layerto/api-client';
import { API_URL } from '../config';

/** API client for the public Studio pages (profiles, projects, model sites). */
export const studioClient = new LayertoClient(API_URL);

export function pct(v: number | undefined): string {
  return typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—';
}
