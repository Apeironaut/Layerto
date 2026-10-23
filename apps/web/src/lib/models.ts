import { LayertoClient } from '@layerto/api-client';
import type { PublicModelItem } from '@layerto/types';
import { API_URL } from '../config';

const client = new LayertoClient(API_URL);
let request: Promise<PublicModelItem[]> | undefined;

/**
 * Loads the public model catalogue once per page view and shares the result
 * (used by the boot screen, the pricing scene and the model pages).
 */
export function loadModels(): Promise<PublicModelItem[]> {
  if (!request) request = client.getModels();
  return request;
}
